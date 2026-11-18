import test from "node:test";
import assert from "node:assert/strict";
import { handleSubmitEnquiry, handleClientReport } from "../cloudflare/public-routes.ts";
import { handleCrmEnquiries, handlePublishReport } from "../cloudflare/private-routes.ts";
import { createReportKey } from "../cloudflare/storage.ts";
import { EmailConfigError, sendEnquiryEmail } from "../cloudflare/email.ts";
import { runDailyCleanup } from "../cloudflare/scheduled.ts";
import { applySiteSecurityHeaders } from "../cloudflare/response-headers.ts";
import { FirestoreError } from "../cloudflare/firestore.ts";

test("Worker-generated responses receive site security headers without overwriting stricter route policies", () => {
  const response = applySiteSecurityHeaders(new Response("ok", { headers: { "Cache-Control": "private, no-store" } }));
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.match(response.headers.get("Content-Security-Policy"), /form-action 'self'/);

  const privatePolicy = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
  const privateResponse = applySiteSecurityHeaders(new Response("report", { headers: { "Content-Security-Policy": privatePolicy } }));
  assert.equal(privateResponse.headers.get("Content-Security-Policy"), privatePolicy);
  assert.equal(privateResponse.headers.get("X-Frame-Options"), "DENY");
});

class MemoryStore {
  enquiries = new Map(); reports = new Map(); rates = new Map();
  failEnquiryWrites = false;
  async saveDeliveredEnquiry(fields, receivedAt, id) {
    if (this.failEnquiryWrites) throw new Error("synthetic_store_failure");
    this.enquiries.set(id, { id, receivedAt, fields });
  }
  async listEnquiries(cursor, limit) {
    const sorted = [...this.enquiries.values()].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
    const after = cursor ? sorted.filter((r) => r.receivedAt > cursor[0] || (r.receivedAt === cursor[0] && r.id > cursor[1])) : sorted;
    const items = after.slice(0, limit);
    return { items, nextCursor: items.length ? Buffer.from(JSON.stringify([items.at(-1).receivedAt, items.at(-1).id]), "utf8").toString("base64url") : null, hasMore: after.length > limit };
  }
  async deleteEnquiries(ids) { for (const id of ids) this.enquiries.delete(id); }
  async createReport(key, report, expiresAt, createdAt) {
    if (this.reports.has(key)) return false;
    this.reports.set(key, { report, expiresAt, createdAt }); return true;
  }
  async getReport(key) { return this.reports.get(key) ?? null; }
  async deleteReport(key) { return this.reports.delete(key); }
  async deleteExpiredReports(nowIso) {
    let removed = 0;
    for (const [key, record] of this.reports) if (Date.parse(record.expiresAt) <= Date.parse(nowIso)) { this.reports.delete(key); removed += 1; }
    return removed;
  }
  async incrementRateLimit(key, windowStart, expiresAt) {
    const bucket = `${key}:${windowStart}`; const record = this.rates.get(bucket) ?? { count: 0, expiresAt };
    record.count += 1; record.expiresAt = expiresAt; this.rates.set(bucket, record); return record.count;
  }
  async deleteExpiredRateLimits(now) {
    let removed = 0;
    for (const [key, record] of this.rates) if (record.expiresAt <= now) { this.rates.delete(key); removed += 1; }
    return removed;
  }
}

const owner = "straightupdigital@zohomail.com";
const publishToken = "P".repeat(48);
const syncToken = "S".repeat(64);
const productionEnv = {
  APP_ENV: "production", RATE_LIMIT_HASH_SECRET: "synthetic-test-rate-salt-not-a-secret",
  AUDIT_REPORTS_ENABLED: "true", EMAIL_PROVIDER: "zoho-mail-api",
  ENQUIRY_TO_EMAIL: owner, ENQUIRY_FROM_EMAIL: owner,
  ZOHO_API_CLIENT_ID: "synthetic-client-id", ZOHO_API_CLIENT_SECRET: "synthetic-client-secret",
  AUDIT_REPORT_PUBLISH_TOKEN: publishToken, CRM_ENQUIRY_SYNC_TOKEN: syncToken,
  PUBLIC_REPORT_HOSTS: "reports.example.workers.dev",
};
const reportFixture = (businessName = "Example Business") => ({
  schemaVersion: 1, businessName, website: "https://example.co.za/", location: "Port Alfred",
  reportDate: "2026-11-16", summary: "A synthetic customer-safe summary.", scopeNote: "A preliminary public-signal review.",
  findings: [{ title: "Mobile text is hard to read", priority: "Start here", whatWeFound: "The text is too small.", whyItMatters: "Customers may leave.", whatToDo: "Increase type size and check contrast." }],
});
const enquiryPayload = (overrides = {}) => ({
  name: "Ada Example", business_name: "Example Business", website_url: "example.co.za",
  email: "ada@example.co.za", phone: "046 000 0000", service_of_interest: "Website audit",
  message: "Please review the mobile experience and tell me what to fix.", consent_given: "yes",
  consent_text_version: "website-contact-v1", consent_timestamp: "2026-11-16T12:00:00.000Z",
  form_type: "contact", source: "/contact", started_at: String(Date.now() - 5_000), ...overrides,
});
const publicDeps = (store, extras = {}) => ({ store, newId: () => "11111111-1111-4111-8111-111111111111", ...extras });
const requestJson = (url, body, headers = {}) => new Request(url, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});

 test("contact submission validates, emails first, then stores only a private intake copy", async () => {
  const store = new MemoryStore(); let mailed = 0;
  const response = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { Accept: "application/json", "cf-connecting-ip": "192.0.2.1" }), { APP_ENV: "test", RATE_LIMIT_HASH_SECRET: "unit-test-salt", FIRESTORE_PROJECT_ID: "synthetic-test", GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: "synthetic-test" }, publicDeps(store, { sendEnquiryEmail: async (value) => { mailed += 1; assert.equal(value.email, "ada@example.co.za"); return { provider: "synthetic" }; } }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(mailed, 1); assert.equal(store.enquiries.size, 1);
  const saved = [...store.enquiries.values()][0];
  assert.equal(saved.fields.consentTextVersion, "website-contact-v1");
  assert.equal(saved.fields.marketingPermission, undefined);
});

test("enquiry failure does not create a CRM copy; storage failure does not undo an email acknowledgement", async () => {
  const mailFailureStore = new MemoryStore();
  const failed = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { "cf-connecting-ip": "192.0.2.2" }), { APP_ENV: "test", RATE_LIMIT_HASH_SECRET: "unit-test-salt" }, publicDeps(mailFailureStore, { sendEnquiryEmail: async () => { throw new EmailConfigError("synthetic_not_configured"); } }));
  assert.equal(failed.status, 503); assert.equal(mailFailureStore.enquiries.size, 0);
  const store = new MemoryStore(); store.failEnquiryWrites = true; let mailed = 0;
  const accepted = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { "cf-connecting-ip": "192.0.2.3" }), { APP_ENV: "test", RATE_LIMIT_HASH_SECRET: "unit-test-salt", FIRESTORE_PROJECT_ID: "synthetic-test", GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: "synthetic-test" }, publicDeps(store, { sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; } }));
  assert.equal(accepted.status, 200); assert.equal(mailed, 1); assert.equal(store.enquiries.size, 0);
});

test("valid enquiry emails and returns success when Firestore service-account JSON is absent", async () => {
  const store = new MemoryStore(); let mailed = 0; let firestoreRateCalls = 0;
  store.incrementRateLimit = async () => { firestoreRateCalls += 1; throw new Error("must_not_call_firestore_without_credentials"); };
  const warnings = []; const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const env = { APP_ENV: "production", RATE_LIMIT_HASH_SECRET: "unit-test-salt", FIRESTORE_PROJECT_ID: "straight-up-digital-test" };
    const response = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { Accept: "application/json", "cf-connecting-ip": "192.0.2.30" }), env, publicDeps(store, { sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; } }));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
    assert.equal(mailed, 1); assert.equal(store.enquiries.size, 0); assert.equal(store.rates.size, 0);
    assert.equal(store.rates.size, 0, "missing Firestore credentials must not attempt a Firestore rate-limit operation");
    assert.equal(firestoreRateCalls, 0);
    assert.match(warnings.join("\n"), /enquiry_firestore_unconfigured/);
    assert.match(warnings.join("\n"), /crm_intake_storage_skipped/);
  } finally {
    console.warn = originalWarn;
  }
});

test("silent honeypot submissions are acknowledged without validation, email, or storage", async () => {
  const store = new MemoryStore(); let mailed = 0;
  const response = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", { company_website_confirm: "filled-by-bot" }, { "cf-connecting-ip": "192.0.2.4" }), { APP_ENV: "test", RATE_LIMIT_HASH_SECRET: "unit-test-salt" }, publicDeps(store, { sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; } }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(mailed, 0); assert.equal(store.enquiries.size, 0);
});

test("Firestore rate-limit failure falls back to local limiting and does not prevent email delivery", async () => {
  const store = new MemoryStore(); let mailed = 0;
  store.incrementRateLimit = async () => { throw new FirestoreError(0, "authentication", "oauth_fetch", "network", new TypeError("Failed to fetch")); };
  const env = { APP_ENV: "production", RATE_LIMIT_HASH_SECRET: "unit-test-salt", FIRESTORE_PROJECT_ID: "synthetic-test", GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: "synthetic-test" };
  const response = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { "cf-connecting-ip": "192.0.2.31" }), env, publicDeps(store, { sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; } }));
  assert.equal(response.status, 200); assert.equal(mailed, 1); assert.equal(store.enquiries.size, 1);
});

test("local hashed-IP fallback blocks a visitor above five requests in ten minutes", async () => {
  const store = new MemoryStore(); let mailed = 0;
  const env = { APP_ENV: "production", RATE_LIMIT_HASH_SECRET: "unit-test-salt" };
  const deps = publicDeps(store, { sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; } });
  const responses = [];
  for (let i = 0; i < 6; i += 1) {
    responses.push(await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload(), { "cf-connecting-ip": "192.0.2.32" }), env, deps));
  }
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200, 429]);
  assert.equal(mailed, 5);
  assert.deepEqual(await responses[5].json(), { ok: false, code: "rate_limited", message: "Too many attempts. Please wait a few minutes, then try again." });
});

test("Turnstile service outage is logged but does not discard a validated enquiry", async () => {
  const store = new MemoryStore(); let mailed = 0;
  const warnings = []; const originalWarn = console.warn; console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const response = await handleSubmitEnquiry(requestJson("https://site.example/api/enquiries", enquiryPayload({ turnstile_token: "synthetic-valid-token" }), { "cf-connecting-ip": "192.0.2.33" }), { APP_ENV: "production", TURNSTILE_SECRET_KEY: "synthetic-secret" }, publicDeps(store, {
      verifyTurnstile: async () => null,
      sendEnquiryEmail: async () => { mailed += 1; return { provider: "synthetic" }; },
    }));
    assert.equal(response.status, 200); assert.equal(mailed, 1);
    assert.match(warnings.join("\n"), /turnstile_unavailable/);
  } finally {
    console.warn = originalWarn;
  }
});

test("non-production environments cannot publish or read customer report links", async () => {
  const store = new MemoryStore(); const env = { ...productionEnv, APP_ENV: "staging" };
  const pub = await handlePublishReport(requestJson("https://site.example/api/publish-audit-report", { report: reportFixture() }, { Authorization: `Bearer ${publishToken}` }), env, { store });
  const view = await handleClientReport(new Request(`https://site.example/report/${"T".repeat(43)}`), "T".repeat(43), env, publicDeps(store));
  const crm = await handleCrmEnquiries(new Request("https://site.example/api/private-enquiries", { headers: { Authorization: `Bearer ${syncToken}` } }), env, { store });
  assert.equal(pub.status, 404); assert.equal(view.status, 404); assert.equal(crm.status, 404);
  assert.equal(store.reports.size, 0);
});

test("owner report publication requires bearer auth, stores an expiring normalized report, and escapes customer text", async () => {
  const store = new MemoryStore();
  const url = "https://reports.example.workers.dev/api/publish-audit-report";
  const unauthorized = await handlePublishReport(requestJson(url, { report: reportFixture() }, { Authorization: `Bearer ${"X".repeat(48)}`, "cf-connecting-ip": "192.0.2.5" }), productionEnv, { store });
  assert.equal(unauthorized.status, 401);
  const response = await handlePublishReport(requestJson(url, { report: reportFixture("<script>bad</script>") }, { Authorization: `Bearer ${publishToken}`, "cf-connecting-ip": "192.0.2.5" }), productionEnv, { store });
  assert.equal(response.status, 200);
  const published = await response.json(); const token = new URL(published.url).pathname.split("/").at(-1);
  assert.match(token, /^[A-Za-z0-9_-]{40,60}$/); assert.equal(Date.parse(published.expiresAt) > Date.now(), true);
  assert.equal(store.reports.size, 1);
  const view = await handleClientReport(new Request(published.url), token, productionEnv, publicDeps(store));
  assert.equal(view.status, 200); assert.match(view.headers.get("x-robots-tag"), /noindex/);
  const html = await view.text(); assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/); assert.doesNotMatch(html, /<h1[^>]*>A clearer picture of <script>/);
});


test("private CRM sync uses stable 100-record pages and only acknowledges validated batches", async () => {
  const store = new MemoryStore();
  for (let i = 1; i <= 101; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    await store.saveDeliveredEnquiry({ email: `client${i}@example.co.za`, consentGiven: true }, "2026-11-16T12:00:00.000Z", id);
  }
  const first = await handleCrmEnquiries(new Request("https://site.example/api/private-enquiries", { headers: { Authorization: `Bearer ${syncToken}`, "cf-connecting-ip": "192.0.2.6" } }), productionEnv, { store });
  assert.equal(first.status, 200); const page1 = await first.json();
  assert.equal(page1.items.length, 100); assert.equal(page1.hasMore, true); assert.ok(page1.nextCursor);
  const second = await handleCrmEnquiries(new Request(`https://site.example/api/private-enquiries?cursor=${encodeURIComponent(page1.nextCursor)}`, { headers: { Authorization: `Bearer ${syncToken}`, "cf-connecting-ip": "192.0.2.6" } }), productionEnv, { store });
  const page2 = await second.json(); assert.equal(page2.items.length, 1); assert.equal(page2.hasMore, false);
  const badToken = await handleCrmEnquiries(new Request("https://site.example/api/private-enquiries", { headers: { Authorization: `Bearer ${"X".repeat(64)}`, "cf-connecting-ip": "192.0.2.7" } }), productionEnv, { store });
  assert.equal(badToken.status, 401);
  const ackRequest = new Request("https://site.example/api/private-enquiries", { method: "DELETE", headers: { Authorization: `Bearer ${syncToken}`, "Content-Type": "application/json", "cf-connecting-ip": "192.0.2.6" }, body: JSON.stringify({ ids: [page2.items[0].id] }) });
  const ack = await handleCrmEnquiries(ackRequest, productionEnv, { store });
  assert.equal(ack.status, 200); assert.deepEqual(await ack.json(), { deleted: 1 }); assert.equal(store.enquiries.size, 100);
});

test("protected rate-limit failure logs sanitized Firestore OAuth metadata only", async () => {
  const store = new MemoryStore();
  const marker = "synthetic-secret-value";
  store.incrementRateLimit = async () => { throw new FirestoreError(0, "authentication", "oauth_fetch", "network", new TypeError(`fetch failed Bearer ${marker}`)); };
  const logs = []; const originalWarn = console.warn; console.warn = (...args) => logs.push(args.join(" "));
  try {
    const response = await handleCrmEnquiries(new Request("https://site.example/api/private-enquiries", { headers: { Authorization: `Bearer ${syncToken}`, "cf-connecting-ip": "192.0.2.40" } }), productionEnv, { store });
    assert.equal(response.status, 503);
    const entry = JSON.parse(logs[0]);
    assert.equal(entry.event, "request_rate_limit_unavailable");
    assert.equal(entry.route, "crm-enquiries");
    assert.equal(entry.firestore_status, 0);
    assert.equal(entry.firestore_operation, "authentication");
    assert.equal(entry.firestore_stage, "oauth_fetch");
    assert.equal(entry.firestore_failure_type, "network");
    assert.equal(entry.oauth_error_name, "TypeError");
    assert.equal(entry.oauth_error_message, "fetch failed Bearer [redacted]");
    assert.doesNotMatch(logs.join(" "), new RegExp(marker));
  } finally {
    console.warn = originalWarn;
  }
});

test("report replies are emailed to the owner only after consent and expire after the private retention period", async () => {
  const store = new MemoryStore(); const token = "R".repeat(43); const key = await createReportKey(token);
  const now = Date.now(); await store.createReport(key, reportFixture(), new Date(now + 86_400_000).toISOString(), new Date(now).toISOString());
  let responseEmail;
  const form = new URLSearchParams({ started_at: String(now - 5_000), client_name: "Sam Client", client_email: "sam@example.co.za", action: "meeting", meeting_window: "Tuesday morning", message: "Discuss the first fix.", consent_given: "yes" });
  const reply = await handleClientReport(new Request(`https://reports.example.workers.dev/report/${token}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "cf-connecting-ip": "192.0.2.8" }, body: form }), token, productionEnv, publicDeps(store, { now: () => now, sendReportResponseEmail: async (value) => { responseEmail = value; } }));
  assert.equal(reply.status, 200); assert.match(await reply.text(), /Your response has been sent/);
  assert.equal(responseEmail.clientEmail, "sam@example.co.za"); assert.equal(responseEmail.action, "meeting"); assert.equal(responseEmail.consentTextVersion, "report-response-v1");
  const expiredToken = "E".repeat(43); const expiredKey = await createReportKey(expiredToken);
  await store.createReport(expiredKey, reportFixture(), new Date(now - 1_000).toISOString(), new Date(now - 90_000_000).toISOString());
  const expired = await handleClientReport(new Request(`https://reports.example.workers.dev/report/${expiredToken}`, { headers: { "cf-connecting-ip": "192.0.2.9" } }), expiredToken, productionEnv, publicDeps(store, { now: () => now }));
  assert.equal(expired.status, 410); assert.equal(store.reports.has(expiredKey), false);
});

test("report revocation accepts only allowlisted HTTPS URLs and invalidates the stored token", async () => {
  const store = new MemoryStore(); const token = "D".repeat(43); const key = await createReportKey(token);
  await store.createReport(key, reportFixture(), new Date(Date.now() + 60_000).toISOString(), new Date().toISOString());
  const makeDelete = (reportUrl, ip) => new Request("https://reports.example.workers.dev/api/publish-audit-report", { method: "DELETE", headers: { Authorization: `Bearer ${publishToken}`, "Content-Type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ reportUrl }) });
  const rejected = await handlePublishReport(makeDelete(`https://evil.example/report/${token}`, "192.0.2.10"), productionEnv, { store });
  assert.equal(rejected.status, 400);
  const deleted = await handlePublishReport(makeDelete(`https://reports.example.workers.dev/report/${token}`, "192.0.2.10"), productionEnv, { store });
  assert.equal(deleted.status, 200); assert.deepEqual(await deleted.json(), { deleted: true }); assert.equal(store.reports.has(key), false);
});

test("daily cleanup removes expired reports and rate buckets and reports aggregate counts", async () => {
  const store = new MemoryStore(); const now = Date.parse("2026-11-16T13:00:00.000Z");
  await store.createReport("reports/old", reportFixture(), "2026-11-16T12:00:00.000Z", "2026-10-01T00:00:00.000Z");
  await store.createReport("reports/new", reportFixture(), "2026-11-17T12:00:00.000Z", "2026-11-16T12:00:00.000Z");
  store.rates.set("expired", { count: 1, expiresAt: now - 1 }); store.rates.set("active", { count: 1, expiresAt: now + 1 });
  const result = await runDailyCleanup(store, now);
  assert.deepEqual(result, { reportsDeleted: 1, rateLimitBucketsDeleted: 1 });
  assert.equal(store.reports.has("reports/old"), false); assert.equal(store.reports.has("reports/new"), true);
});

test("Zoho SMTP adapter negotiates implicit TLS and sends escaped MIME through an in-memory SMTP server", async () => {
  const commands = []; let message = ""; let replyController;
  const encoder = new TextEncoder(); const decoder = new TextDecoder();
  const readable = new ReadableStream({ start(controller) { replyController = controller; controller.enqueue(encoder.encode("220 smtp.example ready\r\n")); } });
  const respond = (value) => {
    commands.push(value);
    let reply = "";
    if (value.endsWith("\r\n.\r\n")) { message = value; reply = "250 queued\r\n"; }
    else {
      const command = value.trim();
      if (command.startsWith("EHLO")) reply = "250-smtp.example\r\n250 AUTH LOGIN\r\n";
      else if (command === "AUTH LOGIN") reply = "334 username\r\n";
      else if (command === Buffer.from(owner).toString("base64")) reply = "334 password\r\n";
      else if (command === Buffer.from("synthetic-app-password").toString("base64")) reply = "235 authenticated\r\n";
      else if (command.startsWith("MAIL FROM") || command.startsWith("RCPT TO")) reply = "250 accepted\r\n";
      else if (command === "DATA") reply = "354 send data\r\n";
      else if (command === "QUIT") reply = "221 bye\r\n";
      else throw new Error(`unexpected_smtp_command:${command.slice(0, 12)}`);
    }
    replyController.enqueue(encoder.encode(reply));
  };
  const socket = {
    opened: Promise.resolve(), readable,
    writable: new WritableStream({ write(chunk) { respond(decoder.decode(chunk)); } }),
    startTls() { throw new Error("implicit TLS must not upgrade"); },
    async close() {},
  };
  let options;
  const connectFake = (address, config) => { options = { address, config }; return socket; };
  const result = await sendEnquiryEmail({
    name: "Ada", businessName: "<script>client</script>", websiteUrl: "https://example.co.za/", email: "ada@example.co.za", phone: "",
    service: "Audit", message: "Review <b>this</b>", consentGiven: true, consentTextVersion: "v1", consentTimestamp: "2026-11-16T12:00:00.000Z",
    formType: "contact", source: "/contact", turnstileToken: "", startedAt: Date.now() - 5_000,
  }, { EMAIL_PROVIDER: "zoho-smtp", ENQUIRY_TO_EMAIL: owner, ENQUIRY_FROM_EMAIL: owner, ZOHO_SMTP_USERNAME: owner, ZOHO_SMTP_PASSWORD: "synthetic-app-password", ZOHO_SMTP_HOST: "smtp.zoho.com", ZOHO_SMTP_PORT: "465" }, connectFake);
  assert.equal(result.provider, "zoho-smtp"); assert.equal(options.address.port, 465); assert.equal(options.config.secureTransport, "on");
  const htmlPart = /Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/.exec(message);
  assert.ok(htmlPart); const decodedHtml = Buffer.from(htmlPart[1], "base64").toString("utf8");
  assert.match(decodedHtml, /&lt;script&gt;client&lt;\/script&gt;/); assert.match(decodedHtml, /&lt;b&gt;this&lt;\/b&gt;/);
  assert.ok(commands.some((value) => value.trim() === "AUTH LOGIN"));
  assert.equal(commands.some((value) => value.includes("synthetic-app-password")), false);
});

test("Zoho Mail API sends via HTTPS token, account lookup and create-message calls", async () => {
  const originalFetch = globalThis.fetch; const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input); calls.push({ url: url.toString(), method: init.method || "GET", headers: init.headers, body: init.body });
    if (url.hostname === "accounts.zoho.com") {
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get("grant_type"), "client_credentials");
      assert.equal(form.get("scope"), "ZohoMail.accounts.READ,ZohoMail.messages.CREATE");
      assert.equal(form.get("client_id"), "synthetic-client-id");
      assert.equal(form.get("client_secret"), "synthetic-client-secret");
      return Response.json({ access_token: "synthetic-access-token", expires_in: 3600, api_domain: "https://mail.zoho.com" });
    }
    if (url.hostname === "mail.zoho.com" && url.pathname === "/api/accounts") {
      assert.equal(new Headers(init.headers).get("Authorization"), "Zoho-oauthtoken synthetic-access-token");
      return Response.json({ status: { code: 200 }, data: [{ accountId: "synthetic-account-id", primaryEmailAddress: owner }] });
    }
    if (url.hostname === "mail.zoho.com" && url.pathname === "/api/accounts/synthetic-account-id/messages") {
      const body = JSON.parse(String(init.body));
      assert.equal(body.fromAddress, owner); assert.equal(body.toAddress, owner); assert.equal(body.mailFormat, "html");
      assert.match(body.content, /New enquiry/);
      return Response.json({ status: { code: 200, description: "success" } });
    }
    throw new Error("unexpected synthetic API request");
  };
  try {
    const result = await sendEnquiryEmail({
      name: "Synthetic QA", businessName: "TEST - ignore", websiteUrl: "https://example.co.za/", email: "synthetic@example.co.za", phone: "",
      service: "Contact", message: "Synthetic delivery test", consentGiven: true, consentTextVersion: "v1", consentTimestamp: "2026-11-18T00:00:00.000Z",
      formType: "contact", source: "/contact", turnstileToken: "", startedAt: Date.now() - 5_000,
    }, { EMAIL_PROVIDER: "zoho-mail-api", ENQUIRY_TO_EMAIL: owner, ENQUIRY_FROM_EMAIL: owner, ZOHO_API_CLIENT_ID: "synthetic-client-id", ZOHO_API_CLIENT_SECRET: "synthetic-client-secret" });
    assert.equal(result.provider, "zoho-mail-api");
    assert.deepEqual(calls.map((call) => [new URL(call.url).hostname, call.method, new URL(call.url).pathname]), [
      ["accounts.zoho.com", "POST", "/oauth/v2/token"],
      ["mail.zoho.com", "GET", "/api/accounts"],
      ["mail.zoho.com", "POST", "/api/accounts/synthetic-account-id/messages"],
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Zoho Mail API token failure stops before account lookup and does not disclose response body", async () => {
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("private upstream details", { status: 401 }); };
  try {
    await assert.rejects(
      () => sendEnquiryEmail({
        name: "Synthetic", businessName: "Example", websiteUrl: "https://example.co.za/", email: "synthetic@example.co.za", phone: "",
        service: "Contact", message: "Test", consentGiven: true, consentTextVersion: "v1", consentTimestamp: "2026-11-18T00:00:00.000Z",
        formType: "contact", source: "/contact", turnstileToken: "", startedAt: Date.now() - 5_000,
      }, { EMAIL_PROVIDER: "zoho-mail-api", ENQUIRY_TO_EMAIL: owner, ENQUIRY_FROM_EMAIL: owner, ZOHO_API_CLIENT_ID: "synthetic-client-id", ZOHO_API_CLIENT_SECRET: "synthetic-client-secret" }),
      (error) => error.message === "zoho_oauth_http_401" && !error.message.includes("private upstream details"),
    );
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
