/**
 * POST enquiry handler.
 *
 * Serves at /.netlify/functions/submit-enquiry (the default function path).
 * Used by the form when PUBLIC_FORM_MODE=email. Validates, filters spam, then
 * sends through the adapter in netlify/lib/email.mts.
 *
 * Deliberately logs no personal data. Only the form type, service and outcome
 * are recorded.
 */
import type { Config, Context } from "@netlify/functions";
import {
  isHoneypotFilled,
  isImplausiblyFast,
  validateEnquiry,
  type RawEnquiry,
} from "../lib/validation.mts";
import {
  EmailConfigError,
  sendEnquiryEmail,
  verifyTurnstile,
} from "../lib/email.mts";
import { storeDeliveredEnquiry } from "../lib/crm-enquiry-store.mts";

declare const Netlify: {
  env: { get(key: string): string | undefined };
};

const getEnv = (key: string): string | undefined => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) return Netlify.env.get(key);
  } catch {
    // Fall through to process.env for local runs.
  }
  return process.env[key];
};

const MAX_BODY_BYTES = 32_000;

const json = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function htmlResponse(message: string, status = 400): Response {
  const body = `<!doctype html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Enquiry not sent | Straight Up Digital</title>
  <meta name="robots" content="noindex" />
  <style>
    body { margin: 0; background: #080a09; color: #f2f4ef; font-family: system-ui, sans-serif; line-height: 1.6; }
    main { max-width: 620px; margin: 0 auto; padding: 64px 24px; }
    h1 { font-size: 1.8rem; line-height: 1.1; }
    p { color: #c9cfcb; }
    a { color: #a8ff65; }
  </style>
</head>
<body>
  <main>
    <h1>Your enquiry was not sent</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/contact">Go back to the contact form</a></p>
  </main>
</body>
</html>`;

  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

async function readBody(request: Request): Promise<RawEnquiry | null> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    try {
      return JSON.parse(text) as RawEnquiry;
    } catch {
      return null;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return Object.fromEntries(new URLSearchParams(text)) as RawEnquiry;
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(
      [...form.entries()].map(([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ]),
    ) as RawEnquiry;
  }

  return null;
}

export default async (request: Request, context: Context): Promise<Response> => {
  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  if (request.method !== "POST") {
    return json({ ok: false, message: "Use POST for this endpoint." }, 405);
  }

  const raw = await readBody(request);
  if (!raw) {
    const message = "The form data could not be read. Please try again.";
    return acceptsHtml ? htmlResponse(message, 400) : json({ ok: false, message }, 400);
  }

  const acknowledgement = (): Response =>
    acceptsHtml
      ? new Response(null, {
          status: 303,
          headers: { Location: "/thank-you", "Cache-Control": "no-store" },
        })
      : json({ ok: true });

  // Silent spam filters: acknowledge so bots do not learn, never deliver.
  if (isHoneypotFilled(raw)) {
    console.log(JSON.stringify({ event: "enquiry_dropped", reason: "honeypot" }));
    return acknowledgement();
  }

  const parsed = validateEnquiry(raw);
  if (!parsed.ok) {
    const message = "Some fields need attention. Check the highlighted fields and try again.";
    return acceptsHtml
      ? htmlResponse("Some fields were missing or invalid. Please go back and check the form.", 422)
      : json({ ok: false, message, errors: parsed.errors }, 422);
  }

  const enquiry = parsed.value;

  if (isImplausiblyFast(enquiry)) {
    console.log(JSON.stringify({ event: "enquiry_dropped", reason: "timing" }));
    return acknowledgement();
  }

  const turnstileSecret = getEnv("TURNSTILE_SECRET_KEY");
  if (turnstileSecret) {
    const verified = await verifyTurnstile(
      enquiry.turnstileToken,
      turnstileSecret,
      context.ip,
    );
    if (!verified) {
      const message =
        "The spam check did not pass. Refresh the page, complete the check and try again.";
      return acceptsHtml
        ? htmlResponse(message, 400)
        : json({ ok: false, message, errors: { turnstile: message } }, 400);
    }
  } else {
    // Documented fallback: without a Turnstile secret the form still relies on
    // the honeypot, the timing check, platform rate limiting and Netlify's own
    // protection. Set TURNSTILE_SECRET_KEY to require the challenge.
    console.log(
      JSON.stringify({ event: "turnstile_skipped", reason: "no_secret_configured" }),
    );
  }

  try {
    const result = await sendEnquiryEmail(enquiry, getEnv);
    try {
      await storeDeliveredEnquiry(enquiry, context);
    } catch (storageError) {
      // Keep the existing email and customer acknowledgement path reliable.
      // Never log form values or allow a CRM-storage failure to expose them.
      console.log(
        JSON.stringify({
          event: "crm_intake_storage_failed",
          form_type: enquiry.formType,
          error_type:
            storageError instanceof Error ? storageError.name : "UnknownError",
        }),
      );
    }
    console.log(
      JSON.stringify({
        event: "enquiry_delivered",
        form_type: enquiry.formType,
        service: enquiry.service,
        provider: result.provider,
      }),
    );
    return acknowledgement();
  } catch (error) {
    if (error instanceof EmailConfigError) {
      console.log(
        JSON.stringify({ event: "enquiry_not_configured", form_type: enquiry.formType }),
      );
      const message =
        "The enquiry form is not connected to an email provider yet. Nothing was sent. Please try again later, or use the contact route on the Contact page.";
      return acceptsHtml
        ? htmlResponse(message, 503)
        : json({ ok: false, code: "email_not_configured", message }, 503);
    }

    console.log(
      JSON.stringify({ event: "enquiry_failed", form_type: enquiry.formType }),
    );
    const message =
      "The message could not be sent. Nothing was sent, so please try again, or use the contact route on the Contact page.";
    return acceptsHtml
      ? htmlResponse(message, 502)
      : json({ ok: false, code: "delivery_failed", message }, 502);
  }
};

export const config: Config = {
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 5,
  },
};
