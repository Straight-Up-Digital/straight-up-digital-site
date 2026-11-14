import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { EmailConfigError, sendReportResponseEmail } from "../lib/email.mts";
import {
  normalizeCustomerReport,
  reportFlowReady,
  reportKeyForToken,
  reportSecurityHeaders,
  renderMissingPage,
  renderReportPage,
  renderResponseConfirmation,
  renderResponseError,
  renderUnavailablePage,
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

const html = (content: string, status = 200): Response =>
  new Response(content, { status, headers: reportSecurityHeaders() });

const readFormLimited = async (request: Request, limit: number): Promise<URLSearchParams | null> => {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") return null;
  if (Number(request.headers.get("content-length") || 0) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
};

const textField = (form: URLSearchParams, key: string, limit: number): string =>
  (form.get(key) || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit);

const validEmail = (email: string): boolean =>
  email.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email);

export async function handleClientAuditReport(
  request: Request,
  context: Context,
  envReader: (key: string) => string | undefined = getEnv,
): Promise<Response> {
  if (context.deploy.context !== "production") return html(renderMissingPage(), 404);
  if (!reportFlowReady(envReader)) return html(renderUnavailablePage(), 503);

  const token = context.params.token || "";
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return html(renderMissingPage(), 404);
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { ...Object.fromEntries(reportSecurityHeaders()), Allow: "GET, POST" } });
  }

  const store = getStore({ name: REPORT_STORE, consistency: "strong" });
  const key = reportKeyForToken(token);
  let stored: unknown;
  try {
    stored = await store.get(key, { type: "json", consistency: "strong" });
  } catch {
    return html(renderUnavailablePage(), 503);
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return html(renderMissingPage(), 404);
  const record = stored as Record<string, unknown>;
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : "";
  const expiryTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiryTime)) return html(renderMissingPage(), 404);
  if (expiryTime <= Date.now()) {
    try { await store.delete(key); } catch { /* The report remains inaccessible even if cleanup is delayed. */ }
    return html(renderMissingPage(true), 410);
  }
  const report = normalizeCustomerReport(record.report);
  if (!report) return html(renderMissingPage(), 404);

  if (request.method === "GET") {
    return html(renderReportPage(report, new Date(expiryTime).toLocaleDateString("en-ZA"), token));
  }

  const form = await readFormLimited(request, 6_000);
  if (!form) return html(renderResponseError(), 400);
  if (textField(form, "company_website_confirm", 300)) return html(renderResponseConfirmation());
  const startedAt = Number(textField(form, "started_at", 20));
  if (!Number.isFinite(startedAt) || startedAt > Date.now() || Date.now() - startedAt < 2_500) {
    return html(renderResponseConfirmation());
  }

  const clientName = textField(form, "client_name", 120);
  const clientEmail = textField(form, "client_email", 200).toLowerCase();
  const action = textField(form, "action", 20);
  const meetingWindow = textField(form, "meeting_window", 180);
  const message = textField(form, "message", 2_000);
  if (clientName.length < 2 || !validEmail(clientEmail) || !["proceed", "meeting", "question"].includes(action)
      || form.get("consent_given") !== "yes" || (action === "question" && message.length < 2)) {
    return html(renderResponseError(), 422);
  }

  try {
    await sendReportResponseEmail({
      businessName: report.businessName,
      website: report.website,
      clientName,
      clientEmail,
      action: action as "proceed" | "meeting" | "question",
      meetingWindow,
      message,
      reportDate: report.reportDate,
      consentTimestamp: new Date().toISOString(),
      consentTextVersion: "report-response-v1",
    }, envReader);
    return html(renderResponseConfirmation());
  } catch (error) {
    console.log(JSON.stringify({ event: "client_report_response_email_failed", reason: error instanceof EmailConfigError ? "configuration" : "delivery" }));
    return html(renderResponseError(), 502);
  }
}

export default async (request: Request, context: Context): Promise<Response> =>
  handleClientAuditReport(request, context);

export const config: Config = {
  path: "/report/:token",
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 300, windowLimit: 20 },
};
