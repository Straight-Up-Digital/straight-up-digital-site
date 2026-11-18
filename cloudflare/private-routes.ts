import { createReportToken, normalizeCustomerReport, readJsonBodyLimited, reportFlowReady } from "../netlify/lib/client-report.mts";
import { decodeCursor, createReportKey, type PrivateDataStore } from "./storage.ts";
import { FirestoreError } from "./firestore.ts";
import { bearerAuthorized, isProduction, rateLimit, RateLimitUnavailable } from "./security.ts";
import { jsonResponse, reportJsonResponse } from "./http.ts";
import type { CloudflareWorkerEnv } from "./types.ts";

export interface PrivateRouteDeps { store: PrivateDataStore; now?: () => number }
const nowFrom = (deps: PrivateRouteDeps): number => (deps.now ?? Date.now)();
const reportReady = (env: CloudflareWorkerEnv): boolean => reportFlowReady((key) => env[key as keyof CloudflareWorkerEnv] as string | undefined);

async function protectedRateLimit(request: Request, env: CloudflareWorkerEnv, deps: PrivateRouteDeps, route: string, limit: number): Promise<Response | null> {
  try {
    const result = await rateLimit(request, env, deps.store, route, limit, 60, nowFrom(deps));
    return result.allowed ? null : reportJsonResponse({ error: "rate_limited" }, 429);
  } catch (error) {
    const details = error instanceof FirestoreError ? { firestore_status: error.status, firestore_operation: error.operation } : {};
    console.log(JSON.stringify({ event: "request_rate_limit_unavailable", route, error_type: error instanceof Error ? error.name : "UnknownError", ...details }));
    return reportJsonResponse({ error: error instanceof RateLimitUnavailable ? "rate_limit_not_configured" : "rate_limit_unavailable" }, 503);
  }
}

const hostAllowlist = (env: CloudflareWorkerEnv): Set<string> => {
  const configured = (env.PUBLIC_REPORT_HOSTS || "straight-up-digital-site.netlify.app,straightupdigital.co.za,www.straightupdigital.co.za")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return new Set(configured);
};

export async function handlePublishReport(request: Request, env: CloudflareWorkerEnv, deps: PrivateRouteDeps): Promise<Response> {
  if (request.method !== "POST" && request.method !== "DELETE") return reportJsonResponse({ error: "method_not_allowed" }, 405);
  if (!isProduction(env)) return reportJsonResponse({ error: "not_found" }, 404);
  const limited = await protectedRateLimit(request, env, deps, "publish-audit-report", 5);
  if (limited) return limited;
  if (request.method === "POST" && !reportReady(env)) return reportJsonResponse({ error: "report_service_not_ready" }, 503);
  const expected = (env.AUDIT_REPORT_PUBLISH_TOKEN || "").trim();
  if (!(await bearerAuthorized(request, expected))) return reportJsonResponse({ error: "unauthorized" }, 401);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return reportJsonResponse({ error: "json_required" }, 415);
  const body = await readJsonBodyLimited(request, 20_000);
  if (!body || typeof body !== "object" || Array.isArray(body)) return reportJsonResponse({ error: "invalid_request" }, 400);

  if (request.method === "DELETE") {
    const reportUrl = (body as Record<string, unknown>).reportUrl;
    if (typeof reportUrl !== "string") return reportJsonResponse({ error: "invalid_report_url" }, 400);
    let parsed: URL;
    try { parsed = new URL(reportUrl); } catch { return reportJsonResponse({ error: "invalid_report_url" }, 400); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443") || parsed.search || parsed.hash || !hostAllowlist(env).has(parsed.hostname.toLowerCase())) return reportJsonResponse({ error: "invalid_report_url" }, 400);
    const match = /^\/report\/([A-Za-z0-9_-]{40,60})$/.exec(parsed.pathname);
    if (!match) return reportJsonResponse({ error: "invalid_report_url" }, 400);
    try {
      const deleted = await deps.store.deleteReport(await createReportKey(match[1]));
      return reportJsonResponse(deleted ? { deleted: true } : { deleted: false, already_unavailable: true }, 200);
    } catch {
      console.log(JSON.stringify({ event: "client_report_delete_failed" }));
      return reportJsonResponse({ error: "report_delete_failed" }, 503);
    }
  }

  const report = normalizeCustomerReport((body as Record<string, unknown>).report);
  if (!report) return reportJsonResponse({ error: "invalid_customer_report" }, 422);
  const expiresAt = new Date(nowFrom(deps) + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    let token = ""; let written = false;
    for (let attempt = 0; attempt < 2 && !written; attempt += 1) {
      token = createReportToken();
      written = await deps.store.createReport(await createReportKey(token), report, expiresAt, new Date(nowFrom(deps)).toISOString());
    }
    if (!written) return reportJsonResponse({ error: "report_store_conflict" }, 503);
    return reportJsonResponse({ url: new URL(`/report/${token}`, request.url).toString(), expiresAt });
  } catch {
    console.log(JSON.stringify({ event: "client_report_storage_failed" }));
    return reportJsonResponse({ error: "report_storage_failed" }, 503);
  }
}

export async function handleCrmEnquiries(request: Request, env: CloudflareWorkerEnv, deps: PrivateRouteDeps): Promise<Response> {
  if (!isProduction(env)) return jsonResponse({ error: "not_found" }, 404, { "Cache-Control": "no-store, private", "Vary": "Authorization" });
  if (request.method !== "GET" && request.method !== "DELETE") return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, DELETE", "Cache-Control": "no-store, private" });
  const limited = await protectedRateLimit(request, env, deps, "crm-enquiries", 30);
  if (limited) return limited;
  const secret = (env.CRM_ENQUIRY_SYNC_TOKEN || "").trim();
  if (!secret) return jsonResponse({ error: "sync_not_configured" }, 503, { "Cache-Control": "no-store, private" });
  if (!(await bearerAuthorized(request, secret))) return jsonResponse({ error: "unauthorized" }, 401, { "Cache-Control": "no-store, private", "Vary": "Authorization" });
  try {
    if (request.method === "GET") {
      const url = new URL(request.url); const cursorText = url.searchParams.get("cursor") || "";
      const cursor = cursorText ? decodeCursor(cursorText) : null;
      if (cursorText && !cursor) return jsonResponse({ error: "invalid_cursor" }, 400, { "Cache-Control": "no-store, private" });
      const page = await deps.store.listEnquiries(cursor, 100);
      return jsonResponse({ items: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore }, 200, { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", Vary: "Authorization" });
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 8_000) return jsonResponse({ error: "request_too_large" }, 413, { "Cache-Control": "no-store, private" });
    let body: unknown; try { body = JSON.parse(text); } catch { return jsonResponse({ error: "invalid_json" }, 400, { "Cache-Control": "no-store, private" }); }
    const ids = (body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return jsonResponse({ error: "invalid_ids" }, 400, { "Cache-Control": "no-store, private" });
    await deps.store.deleteEnquiries(ids as string[]);
    return jsonResponse({ deleted: ids.length }, 200, { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", Vary: "Authorization" });
  } catch (error) {
    console.log(JSON.stringify({ event: "crm_enquiry_sync_failed", error_type: error instanceof Error ? error.name : "UnknownError" }));
    return jsonResponse({ error: "sync_failed" }, 500, { "Cache-Control": "no-store, private", "Vary": "Authorization" });
  }
}
