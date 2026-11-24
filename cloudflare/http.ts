import type { RawEnquiry } from "../shared/validation.mts";

export const MAX_BODY_BYTES = 32_000;

export const jsonResponse = (body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) } });

export const reportJsonResponse = (body: Record<string, unknown>, status = 200): Response => jsonResponse(body, status, {
  "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
});

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));

export const enquiryErrorHtml = (message: string, status = 400): Response => new Response(`<!doctype html>
<html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enquiry not sent | Straight Up Digital</title><meta name="robots" content="noindex"><style>body{margin:0;background:#080a09;color:#f2f4ef;font-family:system-ui,sans-serif;line-height:1.6}main{max-width:620px;margin:0 auto;padding:64px 24px}h1{font-size:1.8rem;line-height:1.1}p{color:#c9cfcb}a{color:#a8ff65}</style></head><body><main><h1>Your enquiry was not sent</h1><p>${escapeHtml(message)}</p><p><a href="/contact">Go back to the contact form</a></p></main></body></html>`, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
});

async function readLimitedBytes(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > limit || !request.body) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch { return null; }
}

export async function readEnquiryBody(request: Request): Promise<RawEnquiry | null> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!["application/json", "application/x-www-form-urlencoded", "multipart/form-data"].includes(type)) return null;
  const bytes = await readLimitedBytes(request, MAX_BODY_BYTES); if (!bytes) return null;
  try {
    if (type === "application/json") {
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as RawEnquiry : null;
    }
    if (type === "application/x-www-form-urlencoded") {
      return Object.fromEntries(new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes))) as RawEnquiry;
    }
    const headers = new Headers({ "Content-Type": request.headers.get("content-type") || "" });
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    const form = await new Request(request.url, { method: "POST", headers, body }).formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""])) as RawEnquiry;
  } catch { return null; }
}

export async function readUrlEncodedLimited(request: Request, limit: number): Promise<URLSearchParams | null> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") return null;
  const bytes = await readLimitedBytes(request, limit); if (!bytes) return null;
  try { return new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return null; }
}

export const textField = (form: URLSearchParams, key: string, limit: number): string =>
  (form.get(key) || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, limit);

export const validEmail = (email: string): boolean => email.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email);

export const htmlResponse = (content: string, status = 200, headers: HeadersInit = {}): Response =>
  new Response(content, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", ...Object.fromEntries(new Headers(headers)) } });

export const reportMethodNotAllowed = (): Response => new Response("Method not allowed", { status: 405, headers: { "Allow": "GET, POST", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
