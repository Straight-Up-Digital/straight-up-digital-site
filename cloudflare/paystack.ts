import { websiteHostingBundles } from "../src/data/bundles.ts";
import { hostingPlans, onceOffEdits, websiteBuildPackages } from "../src/data/pricing.ts";
import { htmlResponse, jsonResponse, validEmail } from "./http.ts";
import type { CloudflareWorkerEnv } from "./types.ts";

export type PaymentOrderStatus = "pending" | "paid";

export interface PaymentOrder {
  reference: string;
  productId: string;
  amountSubunit: number;
  currency: "ZAR";
  status: PaymentOrderStatus;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentOrderStore {
  createOrder(order: PaymentOrder): Promise<void>;
  getOrder(reference: string): Promise<PaymentOrder | null>;
  markPaid(reference: string, paidAt: string): Promise<"paid" | "already_paid" | "missing">;
}

export interface PaystackRouteDeps {
  store?: PaymentOrderStore;
  fetcher?: typeof fetch;
  now?: () => number;
  newReference?: () => string;
}

interface TestProduct {
  label: string;
  amountZar: number;
}

const TEST_CATALOG: Record<string, TestProduct> = {
  ...Object.fromEntries(websiteBuildPackages.flatMap((websitePackage) => {
    const milestoneZar = websitePackage.priceZar / 2;
    return [
      [`website-${websitePackage.slug}-deposit`, { label: `${websitePackage.title} 50% start deposit`, amountZar: milestoneZar }],
    ];
  })),
  ...Object.fromEntries(hostingPlans.map((plan) => [`hosting-${plan.slug}-annual`, { label: `${plan.name} annual prepayment`, amountZar: plan.priceAnnualZar }])),
  ...Object.fromEntries(onceOffEdits.map((edit) => [`edit-${edit.slug}`, { label: edit.title, amountZar: edit.priceZar }])),
  ...Object.fromEntries(websiteHostingBundles.map((bundle) => [`bundle-${bundle.slug}-annual`, { label: `${bundle.name} annual bundle`, amountZar: bundle.annual.priceZar }])),
};

const PAYSTACK_API = "https://api.paystack.co";
const TEST_CALLBACK_URL = "https://straightupdigital.co.za/api/paystack/callback";
const MAX_CHECKOUT_BODY = 8_192;
const MAX_WEBHOOK_BODY = 32_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

const notFound = (): Response => new Response(null, {
  status: 404,
  headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
});

const methodNotAllowed = (allow: string): Response => new Response("Method not allowed", {
  status: 405,
  headers: { Allow: allow, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const testApiSecret = (env: CloudflareWorkerEnv): string | null => {
  const secret = env.PAYSTACK_SECRET_KEY || "";
  return env.APP_ENV === "test" && /^sk_test_[A-Za-z0-9_-]{16,256}$/.test(secret) ? secret : null;
};

const safeReference = (value: string): boolean => /^[A-Za-z0-9.=\-]{1,100}$/.test(value);

function fetcherFrom(deps: PaystackRouteDeps): typeof fetch {
  return deps.fetcher ?? globalThis.fetch.bind(globalThis);
}

async function readLimitedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > limit || !request.body) return null;
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
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  const bytes = await readLimitedBody(request, MAX_CHECKOUT_BODY);
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function parseResponseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
}

export async function handlePaystackInitialize(request: Request, env: CloudflareWorkerEnv, deps: PaystackRouteDeps = {}): Promise<Response> {
  if (env.APP_ENV !== "test") return notFound();
  if (request.method !== "POST") return methodNotAllowed("POST");
  const secret = testApiSecret(env);
  if (!secret || !deps.store) return jsonResponse({ ok: false, code: "checkout_unavailable" }, 503);

  const body = await parseJsonBody(request);
  if (!body) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const productId = typeof body.product_id === "string" ? body.product_id.trim() : "";
  const product = TEST_CATALOG[productId];
  if (!validEmail(email) || !product) return jsonResponse({ ok: false, code: "invalid_checkout_details" }, 422);

  const amountSubunit = Math.round(product.amountZar * 100);
  if (!Number.isSafeInteger(amountSubunit) || amountSubunit < 100) return jsonResponse({ ok: false, code: "invalid_catalog_amount" }, 503);
  const reference = (deps.newReference ?? (() => `sud-test-${crypto.randomUUID()}`))();
  if (!safeReference(reference)) return jsonResponse({ ok: false, code: "checkout_unavailable" }, 503);

  let paystackResponse: Response;
  try {
    const signal = timeoutSignal();
    paystackResponse = await fetcherFrom(deps)(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email,
        amount: amountSubunit,
        currency: "ZAR",
        reference,
        callback_url: TEST_CALLBACK_URL,
        metadata: { product_id: productId, app_environment: "test" },
      }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    console.warn(JSON.stringify({ event: "paystack_test_initialize_failed", reason: "upstream_unavailable" }));
    return jsonResponse({ ok: false, code: "checkout_temporarily_unavailable" }, 502);
  }

  const payload = await parseResponseJson(paystackResponse);
  const data = payload && isRecord(payload.data) ? payload.data : null;
  let authorizationUrl = "";
  try {
    const parsedUrl = new URL(typeof data?.authorization_url === "string" ? data.authorization_url : "");
    if (parsedUrl.protocol === "https:" && parsedUrl.hostname === "checkout.paystack.com" && !parsedUrl.username && !parsedUrl.password) authorizationUrl = parsedUrl.toString();
  } catch {
    // An invalid or unexpected redirect host is rejected below.
  }
  if (!paystackResponse.ok || payload?.status !== true || !data || !authorizationUrl || data.reference !== reference) {
    console.warn(JSON.stringify({ event: "paystack_test_initialize_failed", reason: "invalid_upstream_response" }));
    return jsonResponse({ ok: false, code: "checkout_temporarily_unavailable" }, 502);
  }

  const order: PaymentOrder = {
    reference,
    productId,
    amountSubunit,
    currency: "ZAR",
    status: "pending",
    createdAt: new Date((deps.now ?? Date.now)()).toISOString(),
  };
  try {
    await deps.store.createOrder(order);
  } catch {
    console.error(JSON.stringify({ event: "paystack_test_order_store_failed" }));
    return jsonResponse({ ok: false, code: "checkout_temporarily_unavailable" }, 503);
  }

  return jsonResponse({
    ok: true,
    authorization_url: authorizationUrl,
    reference,
    product_id: productId,
    amount_subunit: amountSubunit,
    currency: "ZAR",
    test_mode: true,
  });
}

interface VerifiedTransaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  domain: string;
  paidAt: string | null;
}

type VerificationResult =
  | { kind: "success"; transaction: VerifiedTransaction }
  | { kind: "not_paid"; status: string }
  | { kind: "mismatch" }
  | { kind: "unavailable" };

async function verifyTransaction(reference: string, order: PaymentOrder, env: CloudflareWorkerEnv, deps: PaystackRouteDeps): Promise<VerificationResult> {
  const secret = testApiSecret(env);
  if (!secret) return { kind: "unavailable" };
  let response: Response;
  try {
    const signal = timeoutSignal();
    response = await fetcherFrom(deps)(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (!response.ok) return { kind: "unavailable" };
  const payload = await parseResponseJson(response);
  const data = payload && isRecord(payload.data) ? payload.data : null;
  if (payload?.status !== true || !data || data.reference !== reference || data.domain !== "test" || typeof data.status !== "string") return { kind: "mismatch" };
  if (data.status !== "success") return { kind: "not_paid", status: data.status };
  if (data.amount !== order.amountSubunit || data.currency !== order.currency) return { kind: "mismatch" };
  return {
    kind: "success",
    transaction: {
      reference,
      status: data.status,
      amount: data.amount as number,
      currency: data.currency as string,
      domain: data.domain as string,
      paidAt: typeof data.paid_at === "string" ? data.paid_at : null,
    },
  };
}

const paymentResultPage = (paid: boolean, status = 200): Response => {
  const title = paid ? "Payment verified" : "Payment not confirmed";
  const detail = paid
    ? "Paystack confirmed this test payment. No service has been provisioned by this test-only integration."
    : "Paystack has not confirmed a successful payment. No service has been marked as paid.";
  return htmlResponse(`<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Straight Up Digital</title><meta name="robots" content="noindex"><style>body{margin:0;background:#080a09;color:#f2f4ef;font-family:system-ui,sans-serif;line-height:1.6}main{max-width:620px;margin:0 auto;padding:64px 24px}h1{font-size:1.8rem;line-height:1.1}p{color:#c9cfcb}a{color:#a8ff65}</style></head><body><main><h1>${title}</h1><p>${detail}</p><p><a href="/pricing">Return to pricing</a></p></main></body></html>`, status);
};

export async function handlePaystackCallback(request: Request, env: CloudflareWorkerEnv, deps: PaystackRouteDeps = {}): Promise<Response> {
  if (env.APP_ENV !== "test") return notFound();
  if (request.method !== "GET") return methodNotAllowed("GET");
  const secret = testApiSecret(env);
  if (!secret || !deps.store) return paymentResultPage(false, 503);
  const reference = new URL(request.url).searchParams.get("reference") || "";
  if (!safeReference(reference)) return paymentResultPage(false, 400);

  let order: PaymentOrder | null;
  try { order = await deps.store.getOrder(reference); }
  catch { return paymentResultPage(false, 503); }
  if (!order) return paymentResultPage(false, 404);

  const result = await verifyTransaction(reference, order, env, deps);
  if (result.kind === "unavailable") return paymentResultPage(false, 503);
  if (result.kind !== "success") return paymentResultPage(false, result.kind === "mismatch" ? 409 : 200);

  try {
    const stored = await deps.store.markPaid(reference, result.transaction.paidAt || new Date((deps.now ?? Date.now)()).toISOString());
    return stored === "missing" ? paymentResultPage(false, 503) : paymentResultPage(true);
  } catch {
    return paymentResultPage(false, 503);
  }
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512Hex(secret: string, bytes: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, input.buffer as ArrayBuffer)));
}

function constantTimeHexEqual(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(expected) || !/^[a-f0-9]{128}$/i.test(supplied)) return false;
  const left = expected.toLowerCase();
  const right = supplied.toLowerCase();
  let difference = 0;
  for (let index = 0; index < 128; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifyVersionedSignature(rawBody: Uint8Array, header: string, secrets: string[], nowMs: number): Promise<boolean> {
  if (header.length > 4_096) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === "t") {
      if (timestamp !== null || !/^\d{1,12}$/.test(value)) return false;
      timestamp = Number(value);
    } else if (name === "v1") {
      const colon = value.indexOf(":");
      if (colon < 1) continue;
      const keyId = value.slice(0, colon);
      const signature = value.slice(colon + 1);
      if (/^[A-Za-z0-9_-]{1,100}$/.test(keyId) && /^[a-f0-9]{128}$/i.test(signature)) signatures.push(signature);
    }
  }
  if (timestamp === null || signatures.length === 0 || !Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const prefix = encoder.encode(`${timestamp}.`);
  const signedBytes = new Uint8Array(prefix.byteLength + rawBody.byteLength);
  signedBytes.set(prefix, 0);
  signedBytes.set(rawBody, prefix.byteLength);
  for (const signingSecret of secrets) {
    if (!signingSecret || signingSecret.length > 512) continue;
    const expected = await hmacSha512Hex(signingSecret, signedBytes);
    for (const signature of signatures) if (constantTimeHexEqual(expected, signature)) return true;
  }
  return false;
}

export async function verifyPaystackWebhookSignature(rawBody: Uint8Array, headers: Headers, env: CloudflareWorkerEnv, nowMs = Date.now()): Promise<boolean> {
  const versionedHeader = headers.get("paystack-signature");
  if (versionedHeader) {
    const secrets = [env.PAYSTACK_WEBHOOK_SECRET, env.PAYSTACK_WEBHOOK_PREVIOUS_SECRET]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (!secrets.length) return false;
    return verifyVersionedSignature(rawBody, versionedHeader, secrets, nowMs);
  }

  const legacySignature = headers.get("x-paystack-signature") || "";
  const apiSecret = testApiSecret(env);
  if (!apiSecret || !/^[a-f0-9]{128}$/i.test(legacySignature)) return false;
  try {
    const expected = await hmacSha512Hex(apiSecret, rawBody);
    return constantTimeHexEqual(expected, legacySignature);
  } catch {
    return false;
  }
}

export async function handlePaystackWebhook(request: Request, env: CloudflareWorkerEnv, deps: PaystackRouteDeps = {}): Promise<Response> {
  if (env.APP_ENV !== "test") return notFound();
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!testApiSecret(env) || !deps.store) return jsonResponse({ ok: false, code: "webhook_unavailable" }, 503);
  const rawBody = await readLimitedBody(request, MAX_WEBHOOK_BODY);
  if (!rawBody) return jsonResponse({ ok: false, code: "invalid_webhook" }, 413);

  const validSignature = await verifyPaystackWebhookSignature(rawBody, request.headers, env, (deps.now ?? Date.now)());
  if (!validSignature) return jsonResponse({ ok: false, code: "invalid_signature" }, 401);

  let event: unknown;
  try { event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)); }
  catch { return jsonResponse({ ok: false, code: "invalid_webhook" }, 400); }
  if (!isRecord(event) || typeof event.event !== "string" || !isRecord(event.data)) return jsonResponse({ ok: false, code: "invalid_webhook" }, 400);
  if (event.event !== "charge.success") return jsonResponse({ ok: true, ignored: true });
  const reference = typeof event.data.reference === "string" ? event.data.reference : "";
  if (!safeReference(reference)) return jsonResponse({ ok: true, ignored: true });

  let order: PaymentOrder | null;
  try { order = await deps.store.getOrder(reference); }
  catch { return jsonResponse({ ok: false, code: "order_store_unavailable" }, 503); }
  if (!order) return jsonResponse({ ok: true, ignored: true });

  const result = await verifyTransaction(reference, order, env, deps);
  if (result.kind === "unavailable") return jsonResponse({ ok: false, code: "verification_temporarily_unavailable" }, 503);
  if (result.kind !== "success") return jsonResponse({ ok: true, ignored: true });

  try {
    const stored = await deps.store.markPaid(reference, result.transaction.paidAt || new Date((deps.now ?? Date.now)()).toISOString());
    return stored === "missing"
      ? jsonResponse({ ok: true, ignored: true })
      : jsonResponse({ ok: true, duplicate: stored === "already_paid" });
  } catch {
    return jsonResponse({ ok: false, code: "order_store_unavailable" }, 503);
  }
}
