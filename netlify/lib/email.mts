/**
 * Email delivery for enquiries, behind one small adapter.
 *
 * The owner has not chosen an email provider yet. Resend and Postmark are both
 * implemented so either can be switched on by setting environment variables;
 * nothing else in the code changes. `console` is a development-only transport
 * that never sends mail.
 *
 * Required variables:
 *   EMAIL_PROVIDER      resend | postmark | console
 *   ENQUIRY_TO_EMAIL    destination inbox
 *   ENQUIRY_FROM_EMAIL  verified sender on the provider
 *   RESEND_API_KEY      when EMAIL_PROVIDER=resend
 *   POSTMARK_SERVER_TOKEN when EMAIL_PROVIDER=postmark
 */
import type { CleanEnquiry } from "./validation.mts";

export type EnvReader = (key: string) => string | undefined;

export class EmailConfigError extends Error {}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const cleanHeader = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();

const labelForType = (type: CleanEnquiry["formType"]): string =>
  type === "audit" ? "audit request" : "enquiry";

function buildContent(enquiry: CleanEnquiry) {
  const label = labelForType(enquiry.formType);
  const subject = cleanHeader(
    `New ${label} — ${enquiry.businessName || "website visitor"}`,
  );

  const rows: [string, string][] = [
    ["Business", enquiry.businessName],
    ["Website", enquiry.websiteUrl || "Not supplied"],
    ["Email", enquiry.email],
    ["Phone", enquiry.phone || "Not supplied"],
    ["Service", enquiry.service],
    ["Message", enquiry.message || "Not supplied"],
    ["Consent", `${enquiry.consentTextVersion} at ${enquiry.consentTimestamp}`],
    ["Source", enquiry.source],
  ];

  if (enquiry.name) rows.unshift(["Name", enquiry.name]);

  const text = [
    `New ${label} from the Straight Up Digital website.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New ${escapeHtml(label)}</h1>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 640px;">
        ${rows
          .map(
            ([rowLabel, value]) => `
          <tr>
            <th style="text-align: left; padding: 8px 12px 8px 0; vertical-align: top; width: 120px; border-bottom: 1px solid #eee;">${escapeHtml(rowLabel)}</th>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; white-space: pre-wrap;">${escapeHtml(value)}</td>
          </tr>`,
          )
          .join("")}
      </table>
    </div>
  `;

  return { subject, text, html };
}

export async function sendEnquiryEmail(
  enquiry: CleanEnquiry,
  getEnv: EnvReader,
): Promise<{ provider: string }> {
  const provider = (getEnv("EMAIL_PROVIDER") ?? "").trim().toLowerCase();
  const to = (getEnv("ENQUIRY_TO_EMAIL") ?? "").trim();
  const from = (getEnv("ENQUIRY_FROM_EMAIL") ?? "").trim();

  if (!provider) {
    throw new EmailConfigError(
      "No email provider is configured for this site yet.",
    );
  }

  if (provider === "console") {
    // Development only. No personal data is written to the log.
    console.log(
      JSON.stringify({
        event: "enquiry_console_transport",
        form_type: enquiry.formType,
        service: enquiry.service,
      }),
    );
    return { provider };
  }

  if (!to || !from) {
    throw new EmailConfigError(
      "The enquiry destination or sender address is not configured.",
    );
  }

  const { subject, text, html } = buildContent(enquiry);

  if (provider === "resend") {
    const apiKey = getEnv("RESEND_API_KEY");
    if (!apiKey) throw new EmailConfigError("RESEND_API_KEY is missing.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
        reply_to: enquiry.email,
      }),
    });

    if (!response.ok) {
      throw new Error(`The email provider rejected the message (${response.status}).`);
    }

    return { provider };
  }

  if (provider === "postmark") {
    const token = getEnv("POSTMARK_SERVER_TOKEN");
    if (!token) throw new EmailConfigError("POSTMARK_SERVER_TOKEN is missing.");

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: from,
        To: to,
        Subject: subject,
        TextBody: text,
        HtmlBody: html,
        ReplyTo: enquiry.email,
        MessageStream: getEnv("POSTMARK_MESSAGE_STREAM") || "outbound",
      }),
    });

    if (!response.ok) {
      throw new Error(`The email provider rejected the message (${response.status}).`);
    }

    return { provider };
  }

  throw new EmailConfigError(`Unknown EMAIL_PROVIDER "${provider}".`);
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
