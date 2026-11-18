import { createHash, randomBytes } from "node:crypto";

export const REPORT_STORE = "client-audit-reports";
export const REPORT_KEY_PREFIX = "reports/";
export const OWNER_EMAIL = "straightupdigital@zohomail.com";

export type ReportEnvReader = (key: string) => string | undefined;

export function reportFlowReady(getEnv: ReportEnvReader): boolean {
  const owner = OWNER_EMAIL.toLowerCase();
  const provider = (getEnv("EMAIL_PROVIDER") || "").trim().toLowerCase();
  const mailReady = provider === "zoho-mail-api"
    ? Boolean((getEnv("ZOHO_API_CLIENT_ID") || "").trim() && (getEnv("ZOHO_API_CLIENT_SECRET") || "").trim())
    : provider === "zoho-smtp"
      && (getEnv("ZOHO_SMTP_USERNAME") || "").trim().toLowerCase() === owner
      && Boolean((getEnv("ZOHO_SMTP_PASSWORD") || "").trim());
  return getEnv("AUDIT_REPORTS_ENABLED") === "true"
    && mailReady
    && (getEnv("ENQUIRY_TO_EMAIL") || "").trim().toLowerCase() === owner
    && (getEnv("ENQUIRY_FROM_EMAIL") || "").trim().toLowerCase() === owner;
}

export interface CustomerFinding {
  title: string;
  priority: "Start here" | "Plan next" | "Consider later";
  whatWeFound: string;
  whyItMatters: string;
  whatToDo: string;
}

export interface CustomerReport {
  schemaVersion: 1;
  businessName: string;
  website: string;
  location: string;
  reportDate: string;
  summary: string;
  scopeNote: string;
  findings: CustomerFinding[];
}

export const reportKeyForToken = (token: string): string =>
  `${REPORT_KEY_PREFIX}${createHash("sha256").update(token).digest("hex")}`;

export const createReportToken = (): string => randomBytes(32).toString("base64url");

const cleanText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, max);
};

const safeWebsite = (value: unknown): string => {
  const raw = cleanText(value, 300);
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
};

export function normalizeCustomerReport(input: unknown): CustomerReport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1 || !Array.isArray(value.findings) || value.findings.length > 12) return null;
  const businessName = cleanText(value.businessName, 120);
  const website = safeWebsite(value.website);
  const reportDate = cleanText(value.reportDate, 10);
  if (!businessName || !website || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return null;

  const findings: CustomerFinding[] = [];
  for (const entry of value.findings) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const finding = entry as Record<string, unknown>;
    const priority = finding.priority;
    if (priority !== "Start here" && priority !== "Plan next" && priority !== "Consider later") return null;
    const title = cleanText(finding.title, 160);
    const whatWeFound = cleanText(finding.whatWeFound, 700);
    const whyItMatters = cleanText(finding.whyItMatters, 700);
    const whatToDo = cleanText(finding.whatToDo, 800);
    if (!title || !whatWeFound || !whyItMatters || !whatToDo) return null;
    findings.push({ title, priority, whatWeFound, whyItMatters, whatToDo });
  }

  const report: CustomerReport = {
    schemaVersion: 1,
    businessName,
    website,
    location: cleanText(value.location, 120),
    reportDate,
    summary: cleanText(value.summary, 600),
    scopeNote: cleanText(value.scopeNote, 1000),
    findings,
  };
  if (!report.summary || !report.scopeNote || Buffer.byteLength(JSON.stringify(report), "utf8") > 18_000) return null;
  return report;
}

export async function readJsonBodyLimited(request: Request, maxBytes: number): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

export function reportSecurityHeaders(contentType = "text/html; charset=utf-8"): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);

const pageShell = (title: string, body: string): string => `<!doctype html>
<html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escapeHtml(title)} · Straight Up Digital</title>
<link rel="stylesheet" href="/report-fonts.css"><style>
:root{color-scheme:light;--ink:#101411;--paper:#f5f7f3;--lime:#d5f43b;--line:#dce1d9;--muted:#566058;--white:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 Inter,Arial,sans-serif}.top{background:#101411;padding:18px 24px}.top__inner{max-width:900px;margin:auto;display:flex;align-items:center;gap:18px}.logo{display:block;width:min(250px,68vw);height:auto;background:#fff;padding:8px 10px;border-radius:4px}.brand-note{margin-left:auto;color:#e3e9e2;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}.wrap{width:min(900px,calc(100% - 36px));margin:34px auto 64px}.card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:clamp(22px,5vw,42px);box-shadow:0 12px 40px #1014110b}.eyebrow{font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#566500}.h1{font-size:clamp(2rem,5vw,3.35rem);line-height:1.08;letter-spacing:-.035em;margin:8px 0 12px}.lede{font-size:1.08rem;color:#344039;max-width:68ch}.meta{display:flex;gap:10px 18px;flex-wrap:wrap;color:var(--muted);font-size:.91rem;margin:20px 0 24px}.meta a{color:inherit;overflow-wrap:anywhere}.note{border-left:4px solid var(--lime);background:#f8fbe9;padding:14px 16px;border-radius:0 8px 8px 0;color:#30372f}.finding-list{display:grid;gap:14px;margin:24px 0}.finding{border:1px solid var(--line);border-radius:12px;padding:20px;background:#fff}.finding h2{font-size:1.22rem;line-height:1.3;margin:4px 0 14px}.priority{display:inline-block;background:#edf5c4;border-radius:99px;padding:3px 10px;font-size:.78rem;font-weight:800}.finding p{margin:8px 0}.finding strong{display:block;font-size:.9rem}.scope{font-size:.92rem;color:var(--muted);border-top:1px solid var(--line);padding-top:16px;margin-top:24px}.reply{margin-top:24px;padding-top:24px;border-top:1px solid var(--line)}.reply h2{font-size:1.4rem;margin:0 0 4px}.reply-intro{color:var(--muted);margin:0 0 18px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:grid;gap:5px}.wide{grid-column:1/-1}label{font-weight:700;font-size:.9rem}input,select,textarea{font:inherit;color:var(--ink);background:#fff;border:1px solid #9ca69d;border-radius:8px;padding:11px 12px;width:100%}input:focus,select:focus,textarea:focus{outline:3px solid #d5f43b;outline-offset:2px}textarea{min-height:115px;resize:vertical}.consent{display:flex;gap:10px;align-items:flex-start}.consent input{width:18px;height:18px;margin-top:4px;flex:none}.consent label{font-weight:400}.consent a,.text-link{color:#283500;text-underline-offset:3px}.btn{border:0;border-radius:999px;background:var(--lime);color:var(--ink);font-weight:800;padding:13px 22px;cursor:pointer;min-height:48px}.btn:hover{filter:brightness(.95)}.foot{color:var(--muted);font-size:.82rem;text-align:center;margin-top:20px}.honeypot{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}@media(max-width:620px){.top{padding:14px 18px}.brand-note{display:none}.wrap{width:min(100% - 24px,900px);margin:18px auto 38px}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.card{border-radius:12px}}
</style></head><body><header class="top"><div class="top__inner"><a href="/" aria-label="Straight Up Digital home"><img class="logo" src="/brand/logo-horizontal-dark.png" alt="Straight Up Digital"></a><span class="brand-note">Business Auditor</span></div></header><main class="wrap">${body}<p class="foot">Straight Up Digital · Business Auditor · <a class="text-link" href="/privacy">Privacy notice</a></p></main></body></html>`;

export function renderUnavailablePage(): string {
  return pageShell("Report unavailable", `<section class="card"><p class="eyebrow">Business Auditor</p><h1 class="h1">This report is not available right now.</h1><p class="lede">The secure report service is not enabled yet. Please contact Straight Up Digital to arrange delivery.</p><p><a class="text-link" href="/contact">Contact Straight Up Digital</a></p></section>`);
}

export function renderMissingPage(expired = false): string {
  const title = expired ? "Report link expired" : "Report not found";
  const copy = expired
    ? "This private report link has expired. Contact Straight Up Digital if you need a refreshed copy."
    : "We could not find a report at this link. Check the address or contact Straight Up Digital for help.";
  return pageShell(title, `<section class="card"><p class="eyebrow">Business Auditor</p><h1 class="h1">${escapeHtml(title)}</h1><p class="lede">${escapeHtml(copy)}</p><p><a class="text-link" href="/contact">Contact Straight Up Digital</a></p></section>`);
}

export function renderReportPage(report: CustomerReport, expiresAt: string, token: string, startedAt = Date.now()): string {
  const findings = report.findings.length
    ? report.findings.map((finding) => `<article class="finding"><span class="priority">${escapeHtml(finding.priority)}</span><h2>${escapeHtml(finding.title)}</h2><p><strong>What we found</strong>${escapeHtml(finding.whatWeFound)}</p><p><strong>Why it matters</strong>${escapeHtml(finding.whyItMatters)}</p><p><strong>What to do next</strong>${escapeHtml(finding.whatToDo)}</p></article>`).join("")
    : `<div class="note">No automated improvement items were identified in this review. This does not mean every part of the digital presence is perfect; ask us if you would like to discuss the checks that could not be confirmed.</div>`;
  const website = escapeHtml(report.website);
  const body = `<section class="card"><p class="eyebrow">Private customer report · Business Auditor</p><h1 class="h1">A clearer picture of ${escapeHtml(report.businessName)} online</h1><p class="lede">${escapeHtml(report.summary)}</p><div class="meta"><span>Prepared ${escapeHtml(report.reportDate)}</span>${report.location ? `<span>${escapeHtml(report.location)}</span>` : ""}<a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a></div><div class="note">This report is available to anyone who has its private link. It is not indexed by search engines and is scheduled to expire on ${escapeHtml(expiresAt)}.</div><div class="finding-list">${findings}</div><p class="scope">${escapeHtml(report.scopeNote)}</p><section class="reply" aria-labelledby="reply-title"><h2 id="reply-title">What would you like to do next?</h2><p class="reply-intro">Choose an option and leave a message if helpful. Your response goes to Straight Up Digital so the next step can be arranged.</p><p class="note">This is not a purchase or binding acceptance of paid work. Any work, scope and price will be set out separately in writing before you decide.</p><form method="post" action="/report/${encodeURIComponent(token)}" accept-charset="utf-8"><input type="hidden" name="started_at" value="${startedAt}"><div class="honeypot" aria-hidden="true"><label>Leave this field blank<input name="company_website_confirm" type="text" tabindex="-1" autocomplete="off"></label></div><div class="form-grid" style="margin-top:16px"><div class="field"><label for="client-name">Your name</label><input id="client-name" name="client_name" autocomplete="name" maxlength="120" required></div><div class="field"><label for="client-email">Email address</label><input id="client-email" name="client_email" type="email" autocomplete="email" maxlength="200" required></div><div class="field wide"><label for="next-step">Your preferred next step</label><select id="next-step" name="action" required><option value="">Choose one</option><option value="proceed">I’d like to discuss the recommended fixes</option><option value="meeting">Arrange a meeting</option><option value="question">I have a question about the report</option></select></div><div class="field wide"><label for="meeting-window">Best days or times to meet <span style="font-weight:400">(optional)</span></label><input id="meeting-window" name="meeting_window" maxlength="180" placeholder="For example: weekday mornings"></div><div class="field wide"><label for="client-message">Message <span style="font-weight:400">(optional)</span></label><textarea id="client-message" name="message" maxlength="2000" placeholder="Tell us which finding you want to discuss or anything else we should know."></textarea></div><div class="field wide"><div class="consent"><input id="response-consent" name="consent_given" type="checkbox" value="yes" required><label for="response-consent">I agree that Straight Up Digital may use my name, email address, selected next step and message to respond to this report. See the <a href="/privacy">privacy notice</a>.</label></div></div><div class="field wide"><button class="btn" type="submit">Send my response</button></div></div></form></section></section>`;
  return pageShell(`Online report for ${report.businessName}`, body);
}

export function renderResponseConfirmation(): string {
  return pageShell("Response received", `<section class="card"><p class="eyebrow">Business Auditor</p><h1 class="h1">Your response has been sent.</h1><p class="lede">Thank you. Straight Up Digital has received your next-step request and will follow up using the email address you provided.</p><p class="note">No paid work has been accepted or started. Any scope and price will be discussed separately.</p><p><a class="text-link" href="/">Back to Straight Up Digital</a></p></section>`);
}

export function renderResponseError(): string {
  return pageShell("Response not sent", `<section class="card"><p class="eyebrow">Business Auditor</p><h1 class="h1">We could not send your response yet.</h1><p class="lede">Please try again shortly, or email <a class="text-link" href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a> and mention the business name on the report.</p></section>`);
}
