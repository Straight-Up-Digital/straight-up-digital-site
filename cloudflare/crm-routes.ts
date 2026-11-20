import { validEmail } from "./http.ts";
import type { CloudflareWorkerEnv } from "./types.ts";

const TENANT_ID = "straight-up-digital";
const COOKIE_NAME = "sud_crm_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
const BODY_LIMIT = 16_000;
const PIPELINE_STAGES = ["new", "contacted", "quoted", "accepted", "live", "lost"] as const;
const ACTIVITY_TYPES = ["call", "whatsapp", "email", "meeting", "note"] as const;

type PipelineStage = typeof PIPELINE_STAGES[number];
type ActivityType = typeof ACTIVITY_TYPES[number];

interface ContactInput {
  businessName: string;
  firstName: string;
  surname: string;
  email: string;
  phone: string;
  location: string;
  town: string;
  websiteUrl: string;
  sector: string;
  pipelineStage: PipelineStage;
  source: string;
  notes: string;
  nextFollowUpDate: string;
  marketingConsent: boolean;
  consentTextVersion: string;
}

interface ActivityInput {
  eventType: ActivityType;
  channel: string;
  direction: "inbound" | "outbound";
  summary: string;
  outcome: string;
}

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Vary": "Cookie",
};

const json = (body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...privateHeaders,
      ...Object.fromEntries(new Headers(headers)),
    },
  });

const errorResponse = (error: string, status: number): Response => json({ error }, status);
const nowIso = (): string => new Date().toISOString();
const safeText = (value: unknown, limit: number): string =>
  typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit) : "";

const isPipelineStage = (value: unknown): value is PipelineStage =>
  typeof value === "string" && PIPELINE_STAGES.includes(value as PipelineStage);

const isActivityType = (value: unknown): value is ActivityType =>
  typeof value === "string" && ACTIVITY_TYPES.includes(value as ActivityType);

const isIsoDate = (value: string): boolean => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const hash = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const token = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

const passwordMatches = async (supplied: string, expected: string): Promise<boolean> => {
  const [left, right] = await Promise.all([hash(supplied), hash(expected)]);
  return constantTimeEqual(new TextEncoder().encode(left), new TextEncoder().encode(right));
};

const cookieValue = (request: Request): string => {
  const cookie = request.headers.get("cookie") || "";
  const item = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return item?.slice(COOKIE_NAME.length + 1) || "";
};

const originMatches = (request: Request): boolean => request.headers.get("origin") === new URL(request.url).origin;

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return null;
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > BODY_LIMIT) return null;
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > BODY_LIMIT) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const database = (env: CloudflareWorkerEnv) => env.CRM_DB;

async function hasSession(request: Request, env: CloudflareWorkerEnv): Promise<boolean> {
  const db = database(env);
  const rawToken = cookieValue(request);
  if (!db || !/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) return false;
  const tokenHash = await hash(rawToken);
  const session = await db.prepare(
    "SELECT token_hash FROM crm_sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, Date.now()).first<{ token_hash: string }>();
  return Boolean(session);
}

function sessionCookie(value: string, maxAge: number): string {
  return `${COOKIE_NAME}=${value}; Path=/api/crm; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

async function login(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);
  if (!originMatches(request)) return errorResponse("origin_not_allowed", 403);
  const db = database(env);
  const expectedPassword = env.CRM_ADMIN_PASSWORD || "";
  if (!db || expectedPassword.length < 32) return errorResponse("crm_auth_not_configured", 503);

  const body = await readJson(request);
  if (!body) return errorResponse("invalid_json", 400);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 1 || password.length > 256) return errorResponse("invalid_credentials", 401);

  const windowStart = Math.floor(Date.now() / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hash(`${expectedPassword}\u0000${ip}`);
  await db.prepare("DELETE FROM crm_login_attempts WHERE window_start < ?").bind(windowStart - LOGIN_WINDOW_MS).run();
  await db.prepare(
    `INSERT INTO crm_login_attempts (ip_hash, window_start, attempts)
     VALUES (?, ?, 1)
     ON CONFLICT (ip_hash, window_start) DO UPDATE SET attempts = attempts + 1`,
  ).bind(ipHash, windowStart).run();
  const attempt = await db.prepare(
    "SELECT attempts FROM crm_login_attempts WHERE ip_hash = ? AND window_start = ?",
  ).bind(ipHash, windowStart).first<{ attempts: number }>();
  if ((attempt?.attempts || 0) > LOGIN_LIMIT) {
    return json({ error: "too_many_attempts" }, 429, { "Retry-After": String(Math.ceil((windowStart + LOGIN_WINDOW_MS - Date.now()) / 1000)) });
  }

  if (!(await passwordMatches(password, expectedPassword))) return errorResponse("invalid_credentials", 401);

  const sessionToken = token();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await db.prepare(
    "INSERT INTO crm_sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)",
  ).bind(await hash(sessionToken), expiresAt, Date.now()).run();
  await db.prepare("DELETE FROM crm_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  await db.prepare("DELETE FROM crm_sessions WHERE expires_at <= ?").bind(Date.now()).run();
  return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(sessionToken, SESSION_TTL_MS / 1000) });
}

async function logout(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);
  if (!originMatches(request)) return errorResponse("origin_not_allowed", 403);
  const db = database(env);
  const rawToken = cookieValue(request);
  if (db && /^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) {
    await db.prepare("DELETE FROM crm_sessions WHERE token_hash = ?").bind(await hash(rawToken)).run();
  }
  return json({ authenticated: false }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

function normalizeContact(input: Record<string, unknown>): ContactInput | null {
  const businessName = safeText(input.businessName, 160);
  const firstName = safeText(input.firstName, 100);
  const surname = safeText(input.surname, 100);
  const email = safeText(input.email, 200);
  const phone = safeText(input.phone, 40);
  const location = safeText(input.location, 160);
  const town = safeText(input.town, 100);
  const websiteUrl = safeText(input.websiteUrl, 300);
  const sector = safeText(input.sector, 120);
  const pipelineStage = input.pipelineStage === undefined ? "new" : input.pipelineStage;
  const source = safeText(input.source || "manual", 80);
  const notes = safeText(input.notes, 4000);
  const nextFollowUpDate = safeText(input.nextFollowUpDate, 10);
  const marketingConsent = input.marketingConsent === undefined ? false : input.marketingConsent;
  const consentTextVersion = safeText(input.consentTextVersion, 100);
  if (!businessName || !isPipelineStage(pipelineStage) || !isIsoDate(nextFollowUpDate)
      || typeof marketingConsent !== "boolean" || (marketingConsent && !consentTextVersion)) return null;
  if (email && !validEmail(email)) return null;
  if (websiteUrl) {
    try {
      const parsed = new URL(websiteUrl);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    } catch {
      return null;
    }
  }
  return {
    businessName, firstName, surname, email, phone, location, town, websiteUrl, sector,
    pipelineStage, source, notes, nextFollowUpDate, marketingConsent, consentTextVersion,
  };
}

async function listContacts(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  const db = database(env);
  if (!db) return errorResponse("crm_database_not_configured", 503);
  const url = new URL(request.url);
  const query = safeText(url.searchParams.get("q"), 100);
  const stage = url.searchParams.get("stage") || "";
  if (stage && !isPipelineStage(stage)) return errorResponse("invalid_stage", 400);
  const result = await db.prepare(
    `SELECT id, business_name, first_name, surname, email, phone, location, town,
            website_url, sector, pipeline_stage, source, notes, audit_score,
            audit_date, next_follow_up_date, quote_amount_cents, monthly_fee_cents,
            hosting_enabled, marketing_consent, created_at, updated_at
     FROM crm_contacts
     WHERE tenant_id = ?
       AND (? = '' OR pipeline_stage = ?)
       AND (? = '' OR business_name LIKE '%' || ? || '%' COLLATE NOCASE
            OR email LIKE '%' || ? || '%' COLLATE NOCASE
            OR phone LIKE '%' || ? || '%' COLLATE NOCASE)
     ORDER BY updated_at DESC
     LIMIT 100`,
  ).bind(TENANT_ID, stage, stage, query, query, query, query).all<Record<string, unknown>>();
  return json({ contacts: result.results || [] });
}

async function createContact(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  const db = database(env);
  if (!db) return errorResponse("crm_database_not_configured", 503);
  const body = await readJson(request);
  if (!body) return errorResponse("invalid_json", 400);
  const contact = normalizeContact(body);
  if (!contact) return errorResponse("invalid_contact", 422);
  const id = crypto.randomUUID();
  const now = nowIso();
  await db.prepare(
    `INSERT INTO crm_contacts
      (tenant_id, id, business_name, first_name, surname, email, phone, location, town,
       website_url, sector, pipeline_stage, source, notes, next_follow_up_date,
       marketing_consent, consent_text_version, consent_recorded_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    TENANT_ID, id, contact.businessName, contact.firstName, contact.surname, contact.email,
    contact.phone, contact.location, contact.town, contact.websiteUrl, contact.sector,
    contact.pipelineStage, contact.source, contact.notes, contact.nextFollowUpDate,
    contact.marketingConsent ? 1 : 0, contact.consentTextVersion, contact.marketingConsent ? now : "", now, now,
  ).run();
  return json({ id }, 201);
}

async function contactDetail(request: Request, env: CloudflareWorkerEnv, contactId: string): Promise<Response> {
  const db = database(env);
  if (!db) return errorResponse("crm_database_not_configured", 503);
  if (request.method === "GET") {
    const contact = await db.prepare(
      "SELECT * FROM crm_contacts WHERE tenant_id = ? AND id = ?",
    ).bind(TENANT_ID, contactId).first<Record<string, unknown>>();
    if (!contact) return errorResponse("contact_not_found", 404);
    const activities = await db.prepare(
      `SELECT id, event_type, channel, direction, summary, outcome, created_at
       FROM crm_activities WHERE tenant_id = ? AND contact_id = ?
       ORDER BY created_at DESC LIMIT 100`,
    ).bind(TENANT_ID, contactId).all<Record<string, unknown>>();
    return json({ contact, activities: activities.results || [] });
  }
  if (request.method !== "PATCH") return errorResponse("method_not_allowed", 405);
  const body = await readJson(request);
  if (!body) return errorResponse("invalid_json", 400);
  const updates: Array<[string, string | number | null]> = [];
  const addText = (field: string, column: string, limit: number, required = false): Response | null => {
    if (body[field] === undefined) return null;
    if (typeof body[field] !== "string") return errorResponse(`invalid_${field}`, 422);
    const value = safeText(body[field], limit);
    if (required && !value) return errorResponse(`invalid_${field}`, 422);
    updates.push([column, value]);
    return null;
  };
  if (body.pipelineStage !== undefined) {
    if (!isPipelineStage(body.pipelineStage)) return errorResponse("invalid_stage", 422);
    updates.push(["pipeline_stage", body.pipelineStage]);
  }
  for (const [field, column, limit, required] of [
    ["businessName", "business_name", 160, true],
    ["firstName", "first_name", 100, false],
    ["surname", "surname", 100, false],
    ["email", "email", 200, false],
    ["phone", "phone", 40, false],
    ["location", "location", 160, false],
    ["town", "town", 100, false],
    ["sector", "sector", 120, false],
    ["notes", "notes", 4000, false],
  ] as const) {
    const error = addText(field, column, limit, required);
    if (error) return error;
  }
  if (body.email !== undefined) {
    const email = safeText(body.email, 200);
    if (email && !validEmail(email)) return errorResponse("invalid_email", 422);
  }
  if (body.websiteUrl !== undefined) {
    const websiteUrl = safeText(body.websiteUrl, 300);
    if (websiteUrl) {
      try {
        const parsed = new URL(websiteUrl);
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return errorResponse("invalid_website_url", 422);
      } catch {
        return errorResponse("invalid_website_url", 422);
      }
    }
    updates.push(["website_url", websiteUrl]);
  }
  if (body.nextFollowUpDate !== undefined) {
    const date = safeText(body.nextFollowUpDate, 10);
    if (!isIsoDate(date)) return errorResponse("invalid_follow_up_date", 422);
    updates.push(["next_follow_up_date", date]);
  }
  if (body.marketingConsent !== undefined) {
    if (typeof body.marketingConsent !== "boolean") return errorResponse("invalid_marketing_consent", 422);
    if (body.marketingConsent) {
      const version = safeText(body.consentTextVersion, 100);
      if (!version) return errorResponse("consent_record_required", 422);
      const current = await db.prepare(
        "SELECT marketing_consent, consent_text_version FROM crm_contacts WHERE tenant_id = ? AND id = ?",
      ).bind(TENANT_ID, contactId).first<{ marketing_consent: number; consent_text_version: string }>();
      if (!current) return errorResponse("contact_not_found", 404);
      if (!current.marketing_consent || current.consent_text_version !== version) {
        updates.push(["marketing_consent", 1], ["consent_text_version", version], ["consent_recorded_at", nowIso()]);
      }
    } else {
      updates.push(["marketing_consent", 0]);
    }
  }
  if (body.monthlyFeeCents !== undefined) {
    const amount = body.monthlyFeeCents;
    if (amount !== null && (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0)) return errorResponse("invalid_monthly_fee", 422);
    updates.push(["monthly_fee_cents", amount]);
  }
  if (!updates.length) return errorResponse("no_changes", 400);
  const setClause = updates.map(([column]) => `${column} = ?`).join(", ");
  const result = await db.prepare(
    `UPDATE crm_contacts SET ${setClause}, updated_at = ? WHERE tenant_id = ? AND id = ?`,
  ).bind(...updates.map(([, value]) => value), nowIso(), TENANT_ID, contactId).run();
  if ((result.meta?.changes || 0) === 0) return errorResponse("contact_not_found", 404);
  return json({ updated: true });
}

async function createActivity(request: Request, env: CloudflareWorkerEnv, contactId: string): Promise<Response> {
  const db = database(env);
  if (!db) return errorResponse("crm_database_not_configured", 503);
  const body = await readJson(request);
  if (!body) return errorResponse("invalid_json", 400);
  const eventType = body.eventType;
  const direction = body.direction === "inbound" ? "inbound" : "outbound";
  const channel = safeText(body.channel, 40);
  const summary = safeText(body.summary, 1000);
  const outcome = safeText(body.outcome, 500);
  if (!isActivityType(eventType) || !summary) return errorResponse("invalid_activity", 422);
  const id = crypto.randomUUID();
  const result = await db.prepare(
    `INSERT INTO crm_activities
      (tenant_id, id, contact_id, event_type, channel, direction, summary, outcome, created_at)
     SELECT ?, ?, id, ?, ?, ?, ?, ?, ? FROM crm_contacts
     WHERE tenant_id = ? AND id = ?`,
  ).bind(TENANT_ID, id, eventType, channel, direction, summary, outcome, nowIso(), TENANT_ID, contactId).run();
  if ((result.meta?.changes || 0) === 0) return errorResponse("contact_not_found", 404);
  return json({ id }, 201);
}

async function summary(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  const db = database(env);
  if (!db) return errorResponse("crm_database_not_configured", 503);
  const stages = await db.prepare(
    `SELECT pipeline_stage AS stage, COUNT(*) AS count
     FROM crm_contacts WHERE tenant_id = ? GROUP BY pipeline_stage`,
  ).bind(TENANT_ID).all<{ stage: string; count: number }>();
  const due = await db.prepare(
    `SELECT COUNT(*) AS count FROM crm_contacts
     WHERE tenant_id = ? AND next_follow_up_date <> '' AND next_follow_up_date <= ?`,
  ).bind(TENANT_ID, new Date().toISOString().slice(0, 10)).first<{ count: number }>();
  return json({ stages: stages.results || [], followUpsDue: due?.count || 0 });
}

async function dispatch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/crm/session" && request.method === "GET") {
    return json({ authenticated: await hasSession(request, env) });
  }
  if (path === "/api/crm/login") return login(request, env);
  if (path === "/api/crm/logout") return logout(request, env);
  if (!database(env)) return errorResponse("crm_database_not_configured", 503);
  if (!(await hasSession(request, env))) return errorResponse("unauthorized", 401);
  if (request.method !== "GET" && !originMatches(request)) return errorResponse("origin_not_allowed", 403);
  if (path === "/api/crm/summary" && request.method === "GET") return summary(request, env);
  if (path === "/api/crm/contacts" && request.method === "GET") return listContacts(request, env);
  if (path === "/api/crm/contacts" && request.method === "POST") return createContact(request, env);
  const detail = /^\/api\/crm\/contacts\/([0-9a-f-]{36})$/.exec(path);
  if (detail) return contactDetail(request, env, detail[1]);
  const activity = /^\/api\/crm\/contacts\/([0-9a-f-]{36})\/activities$/.exec(path);
  if (activity && request.method === "POST") return createActivity(request, env, activity[1]);
  return errorResponse("not_found", 404);
}

export async function handleCrmRequest(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
  try {
    return await dispatch(request, env);
  } catch (error) {
    console.error(JSON.stringify({
      event: "crm_request_failed",
      path: new URL(request.url).pathname,
      error_type: error instanceof Error ? error.name : "UnknownError",
    }));
    return errorResponse("crm_unavailable", 503);
  }
}
