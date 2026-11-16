import { isHoneypotFilled, isImplausiblyFast, validateEnquiry } from "../netlify/lib/validation.mts";
import {
  normalizeCustomerReport, readJsonBodyLimited, reportFlowReady, renderMissingPage,
  renderReportPage, renderResponseConfirmation, renderResponseError, renderUnavailablePage,
} from "../netlify/lib/client-report.mts";
import { EmailConfigError } from "./email.ts";
import { enquiryErrorHtml, htmlResponse, jsonResponse, readEnquiryBody, readUrlEncodedLimited, textField, validEmail } from "./http.ts";
import { rateLimit, RateLimitUnavailable } from "./security.ts";
import { createReportKey, type PrivateDataStore } from "./storage.ts";
import type { CloudflareWorkerEnv, EnquiryEmailSender, ReportEmailSender } from "./types.ts";
import { verifyTurnstile } from "./turnstile.ts";

export interface PublicRouteDeps {
  store: PrivateDataStore;
  now?: () => number;
  newId?: () => string;
  sendEnquiryEmail?: EnquiryEmailSender;
  sendReportResponseEmail?: ReportEmailSender;
  verifyTurnstile?: typeof verifyTurnstile;
}

const nowFrom = (deps: PublicRouteDeps): number => (deps.now ?? Date.now)();
const reportHtml = (content: string, status = 200): Response => htmlResponse(content, status);
const isEmailReady = (env: CloudflareWorkerEnv): boolean => reportFlowReady((key) => env[key as keyof CloudflareWorkerEnv] as string | undefined);
const reportRateError = (): Response => htmlResponse("Too many requests. Please wait a few minutes, then try again.", 429);

async function rateCheck(request: Request, env: CloudflareWorkerEnv, deps: PublicRouteDeps, route: string, limit: number, seconds: number): Promise<Response | null> {
  try {
    const result = await rateLimit(request, env, deps.store, route, limit, seconds, nowFrom(deps));
    if (result.allowed) return null;
    return jsonResponse({ ok: false, code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." }, 429, { "Retry-After": String(result.retryAfter) });
  } catch (error) {
    console.log(JSON.stringify({ event: "request_rate_limit_unavailable", route, error_type: error instanceof Error ? error.name : "UnknownError" }));
    return error instanceof RateLimitUnavailable
      ? jsonResponse({ ok: false, code: "rate_limit_not_configured", message: "The form is temporarily unavailable. Please try again later." }, 503)
      : jsonResponse({ ok: false, code: "rate_limit_unavailable", message: "The form is temporarily unavailable. Please try again later." }, 503);
  }
}

const ack = (acceptsHtml: boolean): Response => acceptsHtml
  ? new Response(null, { status: 303, headers: { Location: "/thank-you", "Cache-Control": "no-store" } })
  : jsonResponse({ ok: true });

export async function handleSubmitEnquiry(request: Request, env: CloudflareWorkerEnv, deps: PublicRouteDeps): Promise<Response> {
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (request.method !== "POST") return jsonResponse({ ok: false, message: "Use POST for this endpoint." }, 405, { Allow: "POST" });
  const limited = await rateCheck(request, env, deps, "submit-enquiry", 5, 60);
  if (limited) return limited;

  const raw = await readEnquiryBody(request);
  if (!raw) {
    const message = "The form data could not be read. Please try again.";
    return acceptsHtml ? enquiryErrorHtml(message, 400) : jsonResponse({ ok: false, message }, 400);
  }
  if (isHoneypotFilled(raw)) {
    console.log(JSON.stringify({ event: "enquiry_dropped", reason: "honeypot" }));
    return ack(acceptsHtml);
  }
  const parsed = validateEnquiry(raw);
  if (!parsed.ok) {
    const message = "Some fields need attention. Check the highlighted fields and try again.";
    return acceptsHtml
      ? enquiryErrorHtml("Some fields were missing or invalid. Please go back and check the form.", 422)
      : jsonResponse({ ok: false, message, errors: parsed.errors }, 422);
  }
  const enquiry = parsed.value;
  if (isImplausiblyFast(enquiry)) {
    console.log(JSON.stringify({ event: "enquiry_dropped", reason: "timing" }));
    return ack(acceptsHtml);
  }

  const turnstileSecret = env.TURNSTILE_SECRET_KEY || "";
  if (turnstileSecret) {
    const verified = await (deps.verifyTurnstile ?? verifyTurnstile)(
      enquiry.turnstileToken, turnstileSecret, request.headers.get("cf-connecting-ip") || undefined,
    );
    if (!verified) {
      const message = "The spam check did not pass. Refresh the page, complete the check and try again.";
      return acceptsHtml ? enquiryErrorHtml(message, 400) : jsonResponse({ ok: false, message, errors: { turnstile: message } }, 400);
    }
  } else {
    console.log(JSON.stringify({ event: "turnstile_skipped", reason: "no_secret_configured" }));
  }

  try {
    const sent = await (deps.sendEnquiryEmail ?? (async () => { throw new EmailConfigError("email_sender_unavailable"); }))(enquiry, env);
    try {
      await deps.store.saveDeliveredEnquiry(enquiry, new Date(nowFrom(deps)).toISOString(), (deps.newId ?? (() => crypto.randomUUID()))());
    } catch (storageError) {
      console.log(JSON.stringify({ event: "crm_intake_storage_failed", form_type: enquiry.formType, error_type: storageError instanceof Error ? storageError.name : "UnknownError" }));
    }
    console.log(JSON.stringify({ event: "enquiry_delivered", form_type: enquiry.formType, service: enquiry.service, provider: sent.provider }));
    return ack(acceptsHtml);
  } catch (error) {
    if (error instanceof EmailConfigError) {
      console.log(JSON.stringify({ event: "enquiry_not_configured", form_type: enquiry.formType }));
      const message = "The enquiry form is not connected to an email provider yet. Nothing was sent. Please try again later, or use the contact route on the Contact page.";
      return acceptsHtml ? enquiryErrorHtml(message, 503) : jsonResponse({ ok: false, code: "email_not_configured", message }, 503);
    }
    console.log(JSON.stringify({ event: "enquiry_failed", form_type: enquiry.formType }));
    const message = "The message could not be sent. Nothing was sent, so please try again, or use the contact route on the Contact page.";
    return acceptsHtml ? enquiryErrorHtml(message, 502) : jsonResponse({ ok: false, code: "delivery_failed", message }, 502);
  }
}

export async function handleClientReport(request: Request, token: string, env: CloudflareWorkerEnv, deps: PublicRouteDeps): Promise<Response> {
  if (env.APP_ENV !== "production") return reportHtml(renderMissingPage(), 404);
  if (!isEmailReady(env)) return reportHtml(renderUnavailablePage(), 503);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return reportHtml(renderMissingPage(), 404);
  if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
  const limited = await rateCheck(request, env, deps, "client-report", 20, 300);
  if (limited) return reportRateError();

  const key = await createReportKey(token);
  let stored;
  try { stored = await deps.store.getReport(key); }
  catch { return reportHtml(renderUnavailablePage(), 503); }
  if (!stored) return reportHtml(renderMissingPage(), 404);
  const expiry = Date.parse(stored.expiresAt);
  if (!Number.isFinite(expiry)) return reportHtml(renderMissingPage(), 404);
  if (expiry <= nowFrom(deps)) {
    try { await deps.store.deleteReport(key); } catch { /* Inaccessibility does not depend on cleanup. */ }
    return reportHtml(renderMissingPage(true), 410);
  }
  const report = normalizeCustomerReport(stored.report);
  if (!report) return reportHtml(renderMissingPage(), 404);
  if (request.method === "GET") {
    return reportHtml(renderReportPage(report, new Date(expiry).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" }), token));
  }

  const form = await readUrlEncodedLimited(request, 6_000);
  if (!form) return reportHtml(renderResponseError(), 400);
  if (textField(form, "company_website_confirm", 300)) return reportHtml(renderResponseConfirmation());
  const startedAt = Number(textField(form, "started_at", 20));
  if (!Number.isFinite(startedAt) || startedAt > nowFrom(deps) || nowFrom(deps) - startedAt < 2_500) return reportHtml(renderResponseConfirmation());
  const clientName = textField(form, "client_name", 120);
  const clientEmail = textField(form, "client_email", 200).toLowerCase();
  const action = textField(form, "action", 20);
  const meetingWindow = textField(form, "meeting_window", 180);
  const message = textField(form, "message", 2_000);
  if (clientName.length < 2 || !validEmail(clientEmail) || !["proceed", "meeting", "question"].includes(action) || form.get("consent_given") !== "yes" || (action === "question" && message.length < 2)) return reportHtml(renderResponseError(), 422);
  try {
    const sender = deps.sendReportResponseEmail ?? (async () => { throw new EmailConfigError("report_email_sender_unavailable"); });
    await sender({ businessName: report.businessName, website: report.website, clientName, clientEmail, action: action as "proceed" | "meeting" | "question", meetingWindow, message, reportDate: report.reportDate, consentTimestamp: new Date(nowFrom(deps)).toISOString(), consentTextVersion: "report-response-v1" }, env);
    return reportHtml(renderResponseConfirmation());
  } catch (error) {
    console.log(JSON.stringify({ event: "client_report_response_email_failed", reason: error instanceof EmailConfigError ? "configuration" : "delivery" }));
    return reportHtml(renderResponseError(), 502);
  }
}
