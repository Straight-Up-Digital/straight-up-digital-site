import { isHoneypotFilled, isImplausiblyFast, validateEnquiry } from "../shared/validation.mts";
import {
  normalizeCustomerReport, readJsonBodyLimited, reportFlowReady, renderMissingPage,
  renderReportPage, renderResponseConfirmation, renderResponseError, renderUnavailablePage,
} from "../shared/client-report.mts";
import { EmailConfigError, safeZohoFailure } from "./email.ts";
import { enquiryErrorHtml, htmlResponse, jsonResponse, readEnquiryBody, readUrlEncodedLimited, textField, validEmail } from "./http.ts";
import { FirestoreError, hasFirestoreConfiguration } from "./firestore.ts";
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
const ENQUIRY_RATE_WINDOW_MS = 10 * 60 * 1000;
const ENQUIRY_RATE_LIMIT = 5;
const localEnquiryRates = new Map<string, { count: number; expiresAt: number }>();

async function localEnquiryRateLimit(request: Request, nowMs: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)));
  const key = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  for (const [storedKey, bucket] of localEnquiryRates) if (bucket.expiresAt <= nowMs) localEnquiryRates.delete(storedKey);
  const bucket = localEnquiryRates.get(key);
  if (!bucket || bucket.expiresAt <= nowMs) {
    localEnquiryRates.set(key, { count: 1, expiresAt: nowMs + ENQUIRY_RATE_WINDOW_MS });
    return { allowed: true, retryAfter: Math.ceil(ENQUIRY_RATE_WINDOW_MS / 1000) };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= ENQUIRY_RATE_LIMIT, retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - nowMs) / 1000)) };
}

async function enquiryRateCheck(request: Request, env: CloudflareWorkerEnv, deps: PublicRouteDeps): Promise<Response | null> {
  const now = nowFrom(deps);
  let result: { allowed: boolean; retryAfter: number };
  if (hasFirestoreConfiguration(env)) {
    try {
      result = await rateLimit(request, env, deps.store, "submit-enquiry", ENQUIRY_RATE_LIMIT, 600, now);
    } catch (error) {
      const safeError = error instanceof FirestoreError ? {
        firestore_status: error.status,
        firestore_operation: error.operation,
        ...(error.stage ? { firestore_stage: error.stage } : {}),
        ...(error.failureType ? { firestore_failure_type: error.failureType } : {}),
        ...(error.causeName ? { oauth_error_name: error.causeName } : {}),
        ...(error.causeMessage ? { oauth_error_message: error.causeMessage } : {}),
      } : {};
      console.warn(JSON.stringify({ event: "enquiry_persistent_rate_limit_failed", error_type: error instanceof Error ? error.name : "UnknownError", ...safeError }));
      result = await localEnquiryRateLimit(request, now);
    }
  } else {
    console.warn(JSON.stringify({ event: "enquiry_firestore_unconfigured", action: "in_memory_rate_limit_and_crm_copy_skipped" }));
    result = await localEnquiryRateLimit(request, now);
  }
  return result.allowed ? null : jsonResponse({ ok: false, code: "rate_limited", message: "Too many attempts. Please wait a few minutes, then try again." }, 429, { "Retry-After": String(result.retryAfter) });
}

async function rateCheck(request: Request, env: CloudflareWorkerEnv, deps: PublicRouteDeps, route: string, limit: number, seconds: number): Promise<Response | null> {
  try {
    const result = await rateLimit(request, env, deps.store, route, limit, seconds, nowFrom(deps));
    if (result.allowed) return null;
    return jsonResponse({ ok: false, code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." }, 429, { "Retry-After": String(result.retryAfter) });
  } catch (error) {
    const details = error instanceof FirestoreError ? { firestore_status: error.status, firestore_operation: error.operation } : {};
    console.log(JSON.stringify({ event: "request_rate_limit_unavailable", route, error_type: error instanceof Error ? error.name : "UnknownError", ...details }));
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
  const firestoreConfigured = hasFirestoreConfiguration(env);
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
    if (verified === false) {
      const message = "The spam check did not pass. Refresh the page, complete the check and try again.";
      return acceptsHtml ? enquiryErrorHtml(message, 400) : jsonResponse({ ok: false, message, errors: { turnstile: message } }, 400);
    }
    if (verified === null) console.warn(JSON.stringify({ event: "turnstile_unavailable", action: "continue_after_local_spam_checks" }));
  } else {
    console.log(JSON.stringify({ event: "turnstile_skipped", reason: "no_secret_configured" }));
  }

  const limited = await enquiryRateCheck(request, env, deps);
  if (limited) return limited;

  try {
    const sent = await (deps.sendEnquiryEmail ?? (async () => { throw new EmailConfigError("email_sender_unavailable"); }))(enquiry, env);
    if (firestoreConfigured) {
      try {
        await deps.store.saveDeliveredEnquiry(enquiry, new Date(nowFrom(deps)).toISOString(), (deps.newId ?? (() => crypto.randomUUID()))());
      } catch (storageError) {
        console.warn(JSON.stringify({ event: "crm_intake_storage_failed", form_type: enquiry.formType, error_type: storageError instanceof Error ? storageError.name : "UnknownError" }));
      }
    } else {
      console.warn(JSON.stringify({ event: "crm_intake_storage_skipped", reason: "firestore_not_configured", form_type: enquiry.formType }));
    }
    console.log(JSON.stringify({ event: "enquiry_delivered", form_type: enquiry.formType, service: enquiry.service, provider: sent.provider }));
    return ack(acceptsHtml);
  } catch (error) {
    if (error instanceof EmailConfigError) {
      console.log(JSON.stringify({ event: "enquiry_not_configured", form_type: enquiry.formType }));
      const message = "The enquiry form is not connected to an email provider yet. Nothing was sent. Please try again later, or use the contact route on the Contact page.";
      return acceptsHtml ? enquiryErrorHtml(message, 503) : jsonResponse({ ok: false, code: "email_not_configured", message }, 503);
    }
    const zohoFailure = (env.EMAIL_PROVIDER || "").trim().toLowerCase() === "zoho-mail-api" ? safeZohoFailure(error) : null;
    console.log(JSON.stringify({
      event: "enquiry_failed",
      form_type: enquiry.formType,
      ...(zohoFailure ? {
        zoho_failure_stage: zohoFailure.stage,
        zoho_failure_category: zohoFailure.category,
        ...(zohoFailure.httpStatus ? { zoho_http_status: zohoFailure.httpStatus } : {}),
      } : {}),
    }));
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
