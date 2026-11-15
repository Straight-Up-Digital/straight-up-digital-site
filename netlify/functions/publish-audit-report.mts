import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import {
  createReportToken,
  normalizeCustomerReport,
  readJsonBodyLimited,
  reportFlowReady,
  reportKeyForToken,
  reportSecurityHeaders,
  REPORT_STORE,
} from "../lib/client-report.mts";

declare const Netlify: { env: { get(key: string): string | undefined } };

const getEnv = (key: string): string | undefined => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) return Netlify.env.get(key);
  } catch {
    // Local and test contexts fall through to process.env.
  }
  return process.env[key];
};

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: reportSecurityHeaders("application/json; charset=utf-8") });

const tokenMatches = (request: Request, expected: string): boolean => {
  const supplied = request.headers.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(supplied);
  if (!match || expected.length < 40) return false;
  const left = Buffer.from(match[1], "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) return false;
  return (awaitImportTimingSafeEqual(left, right));
};

// Node's built-in constant-time comparison; kept behind a helper for validation.
function awaitImportTimingSafeEqual(left: Buffer, right: Buffer): boolean {
  return timingSafeEqual(left, right);
}
import { timingSafeEqual } from "node:crypto";

export async function handlePublishAuditReport(
  request: Request,
  context: Context,
  envReader: (key: string) => string | undefined = getEnv,
): Promise<Response> {
  if (request.method !== "POST" && request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  if (context.deploy.context !== "production") return json({ error: "not_found" }, 404);
  if (request.method === "POST" && !reportFlowReady(envReader)) return json({ error: "report_service_not_ready" }, 503);
  const expected = (envReader("AUDIT_REPORT_PUBLISH_TOKEN") || "").trim();
  if (!tokenMatches(request, expected)) return json({ error: "unauthorized" }, 401);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "json_required" }, 415);
  }
  const body = await readJsonBodyLimited(request, 20_000);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_request" }, 400);

  if (request.method === "DELETE") {
    const reportUrl = (body as Record<string, unknown>).reportUrl;
    if (typeof reportUrl !== "string") return json({ error: "invalid_report_url" }, 400);
    let parsed: URL;
    try {
      parsed = new URL(reportUrl);
    } catch {
      return json({ error: "invalid_report_url" }, 400);
    }
    if (parsed.protocol !== "https:" || !["straight-up-digital-site.netlify.app", "straightupdigital.co.za", "www.straightupdigital.co.za"].includes(parsed.hostname)) {
      return json({ error: "invalid_report_url" }, 400);
    }
    const match = /^\/report\/([A-Za-z0-9_-]{40,60})$/.exec(parsed.pathname);
    if (!match) return json({ error: "invalid_report_url" }, 400);
    try {
      const store = getStore({ name: REPORT_STORE, consistency: "strong" });
      const key = reportKeyForToken(match[1]);
      if (await store.get(key) === null) return json({ deleted: false, already_unavailable: true }, 200);
      await store.delete(key);
      return json({ deleted: true }, 200);
    } catch {
      console.log(JSON.stringify({ event: "client_report_delete_failed" }));
      return json({ error: "report_delete_failed" }, 503);
    }
  }

  const report = normalizeCustomerReport((body as Record<string, unknown>).report);
  if (!report) return json({ error: "invalid_customer_report" }, 422);

  const ttlDays = 30;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const store = getStore({ name: REPORT_STORE, consistency: "strong" });
    let token = "";
    let written = false;
    for (let attempt = 0; attempt < 2 && !written; attempt += 1) {
      token = createReportToken();
      const result = await store.setJSON(reportKeyForToken(token), { report, expiresAt }, {
        onlyIfNew: true,
        metadata: { expiresAt: Date.parse(expiresAt), schemaVersion: 1 },
      });
      written = result.modified;
    }
    if (!written) return json({ error: "report_store_conflict" }, 503);

    const url = new URL(`/report/${token}`, request.url).toString();
    return json({ url, expiresAt });
  } catch {
    console.log(JSON.stringify({ event: "client_report_storage_failed" }));
    return json({ error: "report_storage_failed" }, 503);
  }
}

export default async (request: Request, context: Context): Promise<Response> =>
  handlePublishAuditReport(request, context);

export const config: Config = {
  method: ["POST", "DELETE"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 5 },
};
