import type { CleanEnquiry } from "../shared/validation.mts";
import type { CloudflareWorkerEnv, SocketConnect } from "./types.ts";

export class EmailConfigError extends Error {}
const OWNER_EMAIL = "straightupdigital@zohomail.com";
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
const cleanHeader = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
const validAddress = (value: string): boolean => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) && value.length <= 254;

function buildEnquiry(enquiry: CleanEnquiry) {
  const label = enquiry.service === "Online audit report response" ? "online audit report response" : enquiry.formType === "audit" ? "audit request" : "enquiry";
  const subject = cleanHeader(`New ${label}: ${enquiry.businessName || "website visitor"}`);
  const replyLink = `mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${subject}`)}`;
  const rows: [string, string][] = [
    ["Business", enquiry.businessName], ["Website", enquiry.websiteUrl || "Not supplied"],
    ["Email", enquiry.email], ["Phone", enquiry.phone || "Not supplied"],
    ["Service", enquiry.service], ["Message", enquiry.message || "Not supplied"],
    ["Consent", `${enquiry.consentTextVersion} at ${enquiry.consentTimestamp}`], ["Source", enquiry.source],
  ];
  if (enquiry.name) rows.unshift(["Name", enquiry.name]);
  const text = [`New ${label} from the Straight Up Digital website.`, "", ...rows.map(([key, value]) => `${key}: ${value}`), "", `Reply to this enquiry: ${replyLink}`].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5"><h1>New ${escapeHtml(label)}</h1><p><a href="${escapeHtml(replyLink)}" style="display:inline-block;padding:10px 16px;background:#132b50;color:#fff;text-decoration:none;border-radius:6px">Reply to this enquiry</a></p><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">${rows.map(([key, value]) => `<tr><th style="text-align:left;padding:8px 12px 8px 0;vertical-align:top;width:120px;border-bottom:1px solid #eee">${escapeHtml(key)}</th><td style="padding:8px 0;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table></div>`;
  return { subject, text, html };
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
const wrappedBase64 = (value: string): string => base64(value).match(/.{1,76}/g)?.join("\r\n") ?? "";

function mimeMessage(input: { from: string; to: string; replyTo?: string; subject: string; text: string; html: string }): string {
  const boundary = `sud_${crypto.randomUUID().replace(/-/g, "")}`;
  return [
    `From: ${cleanHeader(input.from)}`, `To: ${cleanHeader(input.to)}`,
    ...(input.replyTo ? [`Reply-To: ${cleanHeader(input.replyTo)}`] : []),
    `Subject: =?UTF-8?B?${base64(cleanHeader(input.subject))}?=`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@straightupdigital.co.za>`,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary=\"${boundary}\"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrappedBase64(input.text),
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrappedBase64(input.html),
    `--${boundary}--`, "",
  ].join("\r\n");
}

const timed = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`smtp_${label}_timeout`)), 8_000); })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
};

class SmtpChannel {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private pending = "";
  private decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();
  private socket: ReturnType<SocketConnect>;
  constructor(socket: ReturnType<SocketConnect>) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }
  replace(socket: ReturnType<SocketConnect>): void {
    try { this.reader.releaseLock(); } catch { /* old stream */ }
    try { this.writer.releaseLock(); } catch { /* old stream */ }
    this.socket = socket; this.reader = socket.readable.getReader(); this.writer = socket.writable.getWriter();
    this.pending = ""; this.decoder = new TextDecoder();
  }
  private async line(): Promise<string> {
    while (true) {
      const pos = this.pending.indexOf("\n");
      if (pos >= 0) { const line = this.pending.slice(0, pos).replace(/\r$/, ""); this.pending = this.pending.slice(pos + 1); return line; }
      const part = await this.reader.read();
      if (part.done) throw new Error("smtp_connection_closed");
      this.pending += this.decoder.decode(part.value, { stream: true });
      if (this.pending.length > 16_384) throw new Error("smtp_response_too_large");
    }
  }
  async reply(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = []; let code = 0;
    for (let i = 0; i < 30; i += 1) {
      const line = await timed(this.line(), "read"); const match = /^(\d{3})([ -])/.exec(line);
      if (!match) throw new Error("smtp_invalid_response");
      const current = Number(match[1]); if (code && code !== current) throw new Error("smtp_malformed_response");
      code = current; lines.push(line); if (match[2] === " ") return { code, lines };
    }
    throw new Error("smtp_too_many_response_lines");
  }
  async command(value: string, accepted: number[]): Promise<{ code: number; lines: string[] }> {
    await timed(this.writer.write(this.encoder.encode(`${value}\r\n`)), "write");
    const reply = await this.reply(); if (!accepted.includes(reply.code)) throw new Error(`smtp_unexpected_${reply.code}`); return reply;
  }
  async data(value: string): Promise<void> {
    const canonical = value.replace(/\r?\n/g, "\n").replace(/\r/g, "\n");
    const stuffed = canonical.split("\n").map((line) => line.startsWith(".") ? `.${line}` : line).join("\r\n");
    await timed(this.writer.write(this.encoder.encode(`${stuffed}\r\n.\r\n`)), "data_write");
    const reply = await this.reply(); if (reply.code !== 250) throw new Error(`smtp_unexpected_${reply.code}`);
  }
  async close(): Promise<void> {
    try { this.reader.releaseLock(); } catch { /* closed */ }
    try { this.writer.releaseLock(); } catch { /* closed */ }
    await this.socket.close();
  }
}

async function sendZoho(input: { from: string; to: string; replyTo?: string; subject: string; text: string; html: string }, env: CloudflareWorkerEnv, connect?: SocketConnect): Promise<void> {
  const host = (env.ZOHO_SMTP_HOST || "smtp.zoho.com").trim().toLowerCase();
  const port = Number(env.ZOHO_SMTP_PORT || "465");
  const username = (env.ZOHO_SMTP_USERNAME || input.from).trim();
  const password = env.ZOHO_SMTP_PASSWORD || "";
  if (!connect) throw new EmailConfigError("Zoho SMTP socket transport is unavailable.");
  if (host !== "smtp.zoho.com" || ![465, 587].includes(port) || !username || !password) throw new EmailConfigError("Zoho SMTP requires its supported host, TLS port, username, and app-specific password.");
  if (!validAddress(input.from) || !validAddress(input.to) || (input.replyTo && !validAddress(input.replyTo))) throw new EmailConfigError("The sender, recipient, or reply-to address is invalid.");
  let socket = connect({ hostname: host, port }, { secureTransport: port === 465 ? "on" : "starttls", allowHalfOpen: false });
  const channel = new SmtpChannel(socket);
  try {
    await timed(socket.opened ?? Promise.resolve(), "connect");
    const greeting = await channel.reply(); if (greeting.code !== 220) throw new Error(`smtp_unexpected_${greeting.code}`);
    const ehlo = await channel.command("EHLO straightupdigital.co.za", [250]);
    if (port === 587) {
      if (!ehlo.lines.join("\n").toUpperCase().includes("STARTTLS")) throw new Error("smtp_starttls_unavailable");
      await channel.command("STARTTLS", [220]); socket = socket.startTls(); channel.replace(socket);
      await timed(socket.opened ?? Promise.resolve(), "tls"); await channel.command("EHLO straightupdigital.co.za", [250]);
    }
    await channel.command("AUTH LOGIN", [334]); await channel.command(base64(username), [334]); await channel.command(base64(password), [235]);
    await channel.command(`MAIL FROM:<${input.from}>`, [250]); await channel.command(`RCPT TO:<${input.to}>`, [250, 251]);
    await channel.command("DATA", [354]); await channel.data(mimeMessage(input));
    try { await channel.command("QUIT", [221]); } catch { /* Server already accepted delivery. */ }
  } finally { await channel.close().catch(() => undefined); }
}

const ZOHO_MAIL_SCOPES = "ZohoMail.accounts.READ,ZohoMail.messages.CREATE";
const ZOHO_API_TIMEOUT_MS = 5_000;

async function zohoJson(url: string, init: RequestInit, stage: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(ZOHO_API_TIMEOUT_MS) });
  } catch (error) {
    const type = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error";
    throw new Error(`zoho_${stage}_${type}`);
  }
  if (!response.ok) throw new Error(`zoho_${stage}_http_${response.status}`);
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_json");
    return body as Record<string, unknown>;
  } catch {
    throw new Error(`zoho_${stage}_invalid_response`);
  }
}

async function sendZohoMailApi(input: { from: string; to: string; replyTo?: string; subject: string; text: string; html: string }, env: CloudflareWorkerEnv): Promise<void> {
  const clientId = (env.ZOHO_API_CLIENT_ID || "").trim();
  const clientSecret = (env.ZOHO_API_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) throw new EmailConfigError("Zoho Mail API OAuth client credentials are missing.");
  if (!validAddress(input.from) || !validAddress(input.to) || (input.replyTo && !validAddress(input.replyTo))) throw new EmailConfigError("The sender, recipient, or reply-to address is invalid.");

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: ZOHO_MAIL_SCOPES,
  });
  const token = await zohoJson("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: tokenBody.toString(),
  }, "oauth");
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("zoho_oauth_token_missing");

  const authHeaders = { Authorization: `Zoho-oauthtoken ${token.access_token}`, Accept: "application/json" };
  const accounts = await zohoJson("https://mail.zoho.com/api/accounts", { headers: authHeaders }, "accounts");
  const data = accounts.data;
  const account = Array.isArray(data)
    ? data.find((item) => item && typeof item === "object" && String((item as Record<string, unknown>).primaryEmailAddress || "").toLowerCase() === input.from.toLowerCase()) as Record<string, unknown> | undefined
    : undefined;
  const accountId = account?.accountId;
  if (typeof accountId !== "string" && typeof accountId !== "number") throw new Error("zoho_sender_account_not_found");

  const message = await zohoJson(`https://mail.zoho.com/api/accounts/${encodeURIComponent(String(accountId))}/messages`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ fromAddress: input.from, toAddress: input.to, subject: input.subject, content: input.html, mailFormat: "html", askReceipt: "no" }),
  }, "message");
  const result = message.status;
  if (!result || typeof result !== "object" || Number((result as Record<string, unknown>).code) !== 200) throw new Error("zoho_message_rejected");
}


async function sendMessage(content: { subject: string; text: string; html: string }, details: { to: string; from: string; replyTo?: string }, env: CloudflareWorkerEnv, provider: string, connect?: SocketConnect): Promise<void> {
  if (provider === "zoho-smtp") { await sendZoho({ ...content, ...details }, env, connect); return; }
  if (provider === "zoho-mail-api") { await sendZohoMailApi({ ...content, ...details }, env); return; }
  if (provider === "resend") {
    if (!env.RESEND_API_KEY) throw new EmailConfigError("RESEND_API_KEY is missing.");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: details.from, to: [details.to], subject: content.subject, text: content.text, html: content.html, reply_to: details.replyTo }) });
    if (!response.ok) throw new Error(`email_provider_rejected_${response.status}`);
    return;
  }
  if (provider === "postmark") {
    if (!env.POSTMARK_SERVER_TOKEN) throw new EmailConfigError("POSTMARK_SERVER_TOKEN is missing.");
    const response = await fetch("https://api.postmarkapp.com/email", { method: "POST", headers: { "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ From: details.from, To: details.to, Subject: content.subject, TextBody: content.text, HtmlBody: content.html, ReplyTo: details.replyTo, MessageStream: env.POSTMARK_MESSAGE_STREAM || "outbound" }) });
    if (!response.ok) throw new Error(`email_provider_rejected_${response.status}`);
    return;
  }
  throw new EmailConfigError(`Unknown email provider "${provider}".`);
}

export async function sendEnquiryEmail(enquiry: CleanEnquiry, env: CloudflareWorkerEnv, connect?: SocketConnect): Promise<{ provider: string }> {
  const provider = (env.EMAIL_PROVIDER || "").trim().toLowerCase();
  const to = (env.ENQUIRY_TO_EMAIL || "").trim();
  const from = (env.ENQUIRY_FROM_EMAIL || "").trim();
  if (!provider) throw new EmailConfigError("No email provider is configured.");
  if (provider === "console") {
    console.log(JSON.stringify({ event: enquiry.service === "Online audit report response" ? "audit_report_response_console_transport" : "enquiry_console_transport", form_type: enquiry.formType, service: enquiry.service }));
    return { provider };
  }
  if (!to || !from || !validAddress(to) || !validAddress(from)) throw new EmailConfigError("The configured email destination or sender is invalid.");
  await sendMessage(buildEnquiry(enquiry), { to, from, replyTo: enquiry.email }, env, provider, connect);
  return { provider };
}

export async function sendReportResponseEmail(input: {
  businessName: string; website: string; clientName: string; clientEmail: string;
  action: "proceed" | "meeting" | "question"; meetingWindow: string; message: string;
  reportDate: string; consentTimestamp: string; consentTextVersion: string;
}, env: CloudflareWorkerEnv, connect?: SocketConnect): Promise<{ provider: string }> {
  const actionLabel = input.action === "proceed" ? "Interested in discussing next steps" : input.action === "meeting" ? "Arrange a meeting" : "Ask a question";
  const message = [
    `Chosen next step: ${actionLabel}`, `Meeting preference: ${input.meetingWindow || "Not supplied"}`,
    `Report date: ${input.reportDate}`, `Response consent: ${input.consentTextVersion} at ${input.consentTimestamp}`,
    "", `Client message: ${input.message || "Not supplied"}`, "",
    "This response is not a purchase or binding acceptance. Agree any paid scope and price separately in writing.",
  ].join("\n");
  const enquiry = {
    name: input.clientName, businessName: input.businessName, websiteUrl: input.website, email: input.clientEmail,
    phone: "", service: "Online audit report response", message, consentGiven: true,
    consentTextVersion: input.consentTextVersion, consentTimestamp: input.consentTimestamp,
    source: "/report", formType: "contact",
  } as CleanEnquiry;
  return sendEnquiryEmail(enquiry, { ...env, ENQUIRY_TO_EMAIL: OWNER_EMAIL }, connect);
}
