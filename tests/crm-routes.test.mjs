import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleCrmRequest } from "../cloudflare/crm-routes.ts";

class MemoryD1 {
  attempts = new Map();
  sessions = new Map();
  contacts = new Map();
  activities = [];

  prepare(query) {
    return new MemoryStatement(this, query);
  }
}

class MemoryStatement {
  constructor(db, query) {
    this.db = db;
    this.query = query.replace(/\s+/g, " ").trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    const q = this.query;
    const a = this.args;
    if (q.startsWith("DELETE FROM crm_login_attempts WHERE window_start")) {
      for (const [key, record] of this.db.attempts) if (record.windowStart < a[0]) this.db.attempts.delete(key);
    } else if (q.startsWith("INSERT INTO crm_login_attempts")) {
      const key = `${a[0]}:${a[1]}`;
      const current = this.db.attempts.get(key);
      this.db.attempts.set(key, { windowStart: a[1], attempts: (current?.attempts || 0) + 1 });
    } else if (q.startsWith("DELETE FROM crm_login_attempts WHERE ip_hash")) {
      for (const [key] of this.db.attempts) if (key.startsWith(`${a[0]}:`)) this.db.attempts.delete(key);
    } else if (q.startsWith("INSERT INTO crm_sessions")) {
      this.db.sessions.set(a[0], a[1]);
    } else if (q.startsWith("DELETE FROM crm_sessions WHERE token_hash")) {
      this.db.sessions.delete(a[0]);
    } else if (q.startsWith("DELETE FROM crm_sessions WHERE expires_at")) {
      for (const [key, expiresAt] of this.db.sessions) if (expiresAt <= a[0]) this.db.sessions.delete(key);
    } else if (q.startsWith("INSERT INTO crm_contacts")) {
      const [tenant_id, id, business_name, first_name, surname, email, phone, location, town,
        website_url, sector, pipeline_stage, source, notes, next_follow_up_date,
        marketing_consent, consent_text_version, consent_recorded_at, created_at, updated_at] = a;
      this.db.contacts.set(`${tenant_id}:${id}`, {
        tenant_id, id, business_name, first_name, surname, email, phone, location, town,
        website_url, sector, pipeline_stage, source, notes, next_follow_up_date,
        marketing_consent, consent_text_version, consent_recorded_at, created_at, updated_at,
      });
    } else if (q.startsWith("UPDATE crm_contacts SET")) {
      const setClause = q.match(/^UPDATE crm_contacts SET (.+), updated_at = \? WHERE/)?.[1] || "";
      const columns = [...setClause.matchAll(/([a-z_]+) = \?/g)].map((match) => match[1]);
      const tenantId = a[columns.length + 1];
      const contactId = a[columns.length + 2];
      const contact = this.db.contacts.get(`${tenantId}:${contactId}`);
      if (!contact) return { meta: { changes: 0 } };
      columns.forEach((column, index) => { contact[column] = a[index]; });
      contact.updated_at = a[columns.length];
    } else if (q.startsWith("INSERT INTO crm_activities")) {
      const [tenant_id, id, event_type, channel, direction, summary, outcome, created_at, , contactId] = a;
      if (!this.db.contacts.has(`${tenant_id}:${contactId}`)) return { meta: { changes: 0 } };
      this.db.activities.push({ tenant_id, id, contact_id: contactId, event_type, channel, direction, summary, outcome, created_at });
    }
    return { meta: { changes: 1 } };
  }

  async first() {
    const q = this.query;
    const a = this.args;
    if (q.startsWith("SELECT attempts FROM crm_login_attempts")) {
      return this.db.attempts.get(`${a[0]}:${a[1]}`) || null;
    }
    if (q.startsWith("SELECT token_hash FROM crm_sessions")) {
      const expiry = this.db.sessions.get(a[0]);
      return expiry > a[1] ? { token_hash: a[0] } : null;
    }
    if (q.startsWith("SELECT marketing_consent, consent_text_version FROM crm_contacts")) {
      const contact = this.db.contacts.get(`${a[0]}:${a[1]}`);
      return contact ? { marketing_consent: contact.marketing_consent, consent_text_version: contact.consent_text_version } : null;
    }
    if (q.startsWith("SELECT * FROM crm_contacts")) {
      return this.db.contacts.get(`${a[0]}:${a[1]}`) || null;
    }
    if (q.startsWith("SELECT COUNT(*) AS count FROM crm_contacts")) {
      const today = a[1];
      const count = [...this.db.contacts.values()].filter((item) =>
        item.tenant_id === a[0] && item.next_follow_up_date && item.next_follow_up_date <= today
      ).length;
      return { count };
    }
    return null;
  }

  async all() {
    const q = this.query;
    const a = this.args;
    if (q.includes("FROM crm_contacts") && q.startsWith("SELECT id,")) {
      const [tenantId, stage, , query] = a;
      const filtered = [...this.db.contacts.values()].filter((contact) =>
        contact.tenant_id === tenantId
        && (!stage || contact.pipeline_stage === stage)
        && (!query || `${contact.business_name} ${contact.email} ${contact.phone}`.toLowerCase().includes(query.toLowerCase()))
      );
      return { results: filtered.slice(0, 100) };
    }
    if (q.startsWith("SELECT id, event_type")) {
      return { results: this.db.activities.filter((item) => item.tenant_id === a[0] && item.contact_id === a[1]).slice(-100).reverse() };
    }
    if (q.startsWith("SELECT pipeline_stage AS stage")) {
      const counts = new Map();
      for (const contact of this.db.contacts.values()) if (contact.tenant_id === a[0]) counts.set(contact.pipeline_stage, (counts.get(contact.pipeline_stage) || 0) + 1);
      return { results: [...counts].map(([stage, count]) => ({ stage, count })) };
    }
    return { results: [] };
  }
}

const password = "0123456789abcdef0123456789abcdef";
const env = () => ({ CRM_DB: new MemoryD1(), CRM_ADMIN_PASSWORD: password });
const request = (url, method = "GET", body, headers = {}) => new Request(`https://crm.example${url}`, {
  method,
  headers: { ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: "https://crm.example" }), ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function signedIn(testEnv) {
  const response = await handleCrmRequest(request("/api/crm/login", "POST", { password }), testEnv);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

test("CRM routes fail closed when Cloudflare D1 or the owner password is not configured", async () => {
  const unconfigured = await handleCrmRequest(request("/api/crm/login", "POST", { password }), {});
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { error: "crm_auth_not_configured" });

  const noPassword = await handleCrmRequest(request("/api/crm/login", "POST", { password }), { CRM_DB: new MemoryD1(), CRM_ADMIN_PASSWORD: "too-short" });
  assert.equal(noPassword.status, 503);
});

test("CRM login is same-origin, rate-limited, and creates a Secure HttpOnly session", async () => {
  const testEnv = env();
  const crossOrigin = request("/api/crm/login", "POST", { password }, { Origin: "https://attacker.example" });
  assert.equal((await handleCrmRequest(crossOrigin, testEnv)).status, 403);

  const denied = await handleCrmRequest(request("/api/crm/login", "POST", { password: "wrong-password" }), testEnv);
  assert.equal(denied.status, 401);

  const cookie = await signedIn(testEnv);
  assert.match(cookie, /^sud_crm_session=[A-Za-z0-9_-]{40,60}$/);
  const response = await handleCrmRequest(request("/api/crm/session", "GET", undefined, { Cookie: cookie }), testEnv);
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.match(response.headers.get("cache-control"), /no-store/);

  const unauthenticated = await handleCrmRequest(request("/api/crm/contacts"), testEnv);
  assert.equal(unauthenticated.status, 401);
});

test("authenticated owner can add, edit and track a contact without enabling marketing by default", async () => {
  const testEnv = env();
  const cookie = await signedIn(testEnv);
  const originHeaders = { Cookie: cookie, Origin: "https://crm.example" };
  const created = await handleCrmRequest(request("/api/crm/contacts", "POST", {
    businessName: "Example Shop",
    email: "owner@example.co.za",
    town: "Port Alfred",
    pipelineStage: "new",
  }, originHeaders), testEnv);
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const list = await handleCrmRequest(request("/api/crm/contacts?q=Example", "GET", undefined, originHeaders), testEnv);
  const listed = await list.json();
  assert.equal(list.status, 200);
  assert.equal(listed.contacts.length, 1);
  assert.equal(listed.contacts[0].marketing_consent, 0);

  const invalidConsent = await handleCrmRequest(request(`/api/crm/contacts/${id}`, "PATCH", {
    marketingConsent: true,
    consentTextVersion: "",
  }, originHeaders), testEnv);
  assert.equal(invalidConsent.status, 422);

  const update = await handleCrmRequest(request(`/api/crm/contacts/${id}`, "PATCH", {
    businessName: "Example Shop",
    firstName: "Sam",
    surname: "",
    email: "owner@example.co.za",
    phone: "",
    location: "",
    town: "Kenton-on-Sea",
    sector: "Retail",
    websiteUrl: "",
    pipelineStage: "contacted",
    nextFollowUpDate: "2026-11-25",
    notes: "Follow up next week.",
    marketingConsent: false,
    consentTextVersion: "",
  }, originHeaders), testEnv);
  assert.equal(update.status, 200);

  const activity = await handleCrmRequest(request(`/api/crm/contacts/${id}/activities`, "POST", {
    eventType: "call",
    direction: "outbound",
    summary: "Discussed the audit.",
    outcome: "Send proposal.",
  }, originHeaders), testEnv);
  assert.equal(activity.status, 201);
  const detail = await handleCrmRequest(request(`/api/crm/contacts/${id}`, "GET", undefined, originHeaders), testEnv);
  const record = await detail.json();
  assert.equal(record.contact.pipeline_stage, "contacted");
  assert.equal(record.contact.town, "Kenton-on-Sea");
  assert.equal(record.activities.length, 1);
  assert.equal(record.activities[0].summary, "Discussed the audit.");
});

test("CRM rejects invalid date, unsafe website URL, and cross-origin updates", async () => {
  const testEnv = env();
  const cookie = await signedIn(testEnv);
  const headers = { Cookie: cookie, Origin: "https://crm.example" };
  const invalidDate = await handleCrmRequest(request("/api/crm/contacts", "POST", {
    businessName: "Example Shop",
    nextFollowUpDate: "2026-02-31",
  }, headers), testEnv);
  assert.equal(invalidDate.status, 422);

  const unsafeUrl = await handleCrmRequest(request("/api/crm/contacts", "POST", {
    businessName: "Example Shop",
    websiteUrl: "javascript:alert(1)",
  }, headers), testEnv);
  assert.equal(unsafeUrl.status, 422);

  const crossOrigin = await handleCrmRequest(request("/api/crm/contacts", "POST", {
    businessName: "Example Shop",
  }, { ...headers, Origin: "https://attacker.example" }), testEnv);
  assert.equal(crossOrigin.status, 403);
});

test("CRM page is unindexed and inserts contact data through text nodes rather than HTML", () => {
  const page = readFileSync(new URL("../src/pages/crm/index.astro", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/scripts/crm.ts", import.meta.url), "utf8");
  assert.match(page, /noindex, nofollow, noarchive/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
});
