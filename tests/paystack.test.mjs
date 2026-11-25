import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handlePaystackCallback, handlePaystackInitialize, handlePaystackWebhook } from "../cloudflare/paystack.ts";
import { handleWorkerRequest } from "../cloudflare/router.ts";
import { FirestorePaystackOrderStore } from "../cloudflare/paystack-store.ts";

const testSecret = "sk_test_synthetic0123456789abcdef";
const reference = "sud-test-synthetic-ref-0001";
const now = 1_800_000_000_000;
const testEnv = { APP_ENV: "test", PAYSTACK_SECRET_KEY: testSecret };
const starterOrder = () => ({
  reference,
  productId: "website-one-page-starter-deposit",
  amountSubunit: 75_000,
  currency: "ZAR",
  status: "pending",
  createdAt: new Date(now).toISOString(),
});

class MemoryPaymentStore {
  orders = new Map();
  paidTransitions = 0;
  async createOrder(order) { this.orders.set(order.reference, structuredClone(order)); }
  async getOrder(orderReference) { return structuredClone(this.orders.get(orderReference) ?? null); }
  async markPaid(orderReference, paidAt) {
    const order = this.orders.get(orderReference);
    if (!order) return "missing";
    if (order.status === "paid") return "already_paid";
    this.orders.set(orderReference, { ...order, status: "paid", paidAt });
    this.paidTransitions += 1;
    return "paid";
  }
}

const jsonRequest = (url, body) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const verifyPayload = (overrides = {}) => ({
  reference,
  domain: "test",
  status: "success",
  amount: 75_000,
  currency: "ZAR",
  paid_at: new Date(now).toISOString(),
  ...overrides,
});

const verificationFetcher = (data, onCall = () => {}) => async (input, init = {}) => {
  const url = new URL(input);
  assert.equal(url.hostname, "api.paystack.co");
  assert.equal(url.pathname, `/transaction/verify/${reference}`);
  assert.equal(init.method, "GET");
  assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${testSecret}`);
  onCall();
  return Response.json({ status: true, data });
};

const legacySignature = (body, secret = testSecret) => createHmac("sha512", secret).update(body).digest("hex");
const versionedSignature = (body, timestamp, secret) => createHmac("sha512", secret).update(`${timestamp}.${body}`).digest("hex");

function webhookRequest(body, signature, header = "x-paystack-signature") {
  return new Request("https://test.example/api/paystack/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", [header]: signature },
    body,
  });
}

const successEventBody = () => JSON.stringify({ event: "charge.success", data: { reference } });


test("test initialization uses only server-owned ZAR pricing and creates a minimal pending order", async () => {
  const store = new MemoryPaymentStore();
  let initializePayload;
  const response = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", {
    email: "  Buyer@Example.co.za ",
    product_id: "website-one-page-starter-deposit",
    amount: 1,
  }), testEnv, {
    store,
    now: () => now,
    newReference: () => reference,
    fetcher: async (input, init) => {
      assert.equal(new URL(input).pathname, "/transaction/initialize");
      assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${testSecret}`);
      initializePayload = JSON.parse(String(init.body));
      return Response.json({ status: true, data: { authorization_url: "https://checkout.paystack.com/synthetic", reference } });
    },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.test_mode, true);
  assert.equal(result.amount_subunit, 75_000);
  assert.equal(result.currency, "ZAR");
  assert.equal(result.authorization_url, "https://checkout.paystack.com/synthetic");
  assert.equal(initializePayload.email, "buyer@example.co.za");
  assert.equal(initializePayload.amount, 75_000);
  assert.equal(initializePayload.currency, "ZAR");
  assert.equal(initializePayload.reference, reference);
  assert.equal(initializePayload.callback_url, "https://straightupdigital.co.za/api/paystack/callback");
  assert.equal(Object.hasOwn(initializePayload, "plan"), false);
  assert.deepEqual(store.orders.get(reference), starterOrder());
  assert.equal(Object.hasOwn(store.orders.get(reference), "email"), false);
  assert.doesNotMatch(JSON.stringify(result), /sk_test_/);
});


test("all six confirmed website packages expose server-priced deposits and keep balances disabled pending preview authorization", async () => {
  const packageRows = [
    ["one-page-starter", 75_000], ["five-page-business", 175_000], ["restaurant-cafe", 197_500],
    ["guesthouse", 225_000], ["booking-site", 275_000], ["online-shop", 375_000],
  ];
  for (const [slug, expectedAmount] of packageRows) {
    const store = new MemoryPaymentStore();
    let sentAmount;
    let upstreamCalls = 0;
    const deps = { store, newReference: () => `${reference}-${slug}-deposit`, fetcher: async (_input, init) => {
      upstreamCalls += 1;
      const body = JSON.parse(String(init.body));
      sentAmount = body.amount;
      return Response.json({ status: true, data: { authorization_url: "https://checkout.paystack.com/synthetic", reference: body.reference } });
    }};
    const deposit = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", {
      email: "buyer@example.co.za", product_id: `website-${slug}-deposit`, amount: 1,
    }), testEnv, deps);
    assert.equal(deposit.status, 200, `${slug} deposit should be available in the test catalog`);
    assert.equal(sentAmount, expectedAmount);

    const balance = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", {
      email: "buyer@example.co.za", product_id: `website-${slug}-balance`, amount: 1,
    }), testEnv, deps);
    assert.equal(balance.status, 422, `${slug} balance must remain unavailable until preview authorization is enforced`);
    assert.equal(upstreamCalls, 1, `${slug} balance must not reach Paystack`);
  }
});

test("initialization rejects browser amounts and recurring product IDs cannot determine a charge", async () => {
  const store = new MemoryPaymentStore();
  let upstreamCalls = 0;
  const deps = { store, newReference: () => reference, fetcher: async () => { upstreamCalls += 1; throw new Error("must_not_call"); } };
  const monthly = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", {
    email: "buyer@example.co.za", product_id: "hosting-starter-brand-monthly", amount: 1,
  }), testEnv, deps);
  assert.equal(monthly.status, 422);
  assert.equal(upstreamCalls, 0);
  const noProduct = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", {
    email: "buyer@example.co.za", amount: 1,
  }), testEnv, deps);
  assert.equal(noProduct.status, 422);
  assert.equal(upstreamCalls, 0);
});


test("callback verifies Paystack before marking paid and a repeat callback is idempotent", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  let verificationCalls = 0;
  const deps = { store, now: () => now, fetcher: verificationFetcher(verifyPayload(), () => { verificationCalls += 1; }) };
  const url = `https://test.example/api/paystack/callback?reference=${encodeURIComponent(reference)}`;
  const first = await handlePaystackCallback(new Request(url), testEnv, deps);
  assert.equal(first.status, 200);
  assert.match(await first.text(), /Payment verified/);
  assert.equal(store.orders.get(reference).status, "paid");
  const second = await handlePaystackCallback(new Request(url), testEnv, deps);
  assert.equal(second.status, 200);
  assert.match(await second.text(), /Payment verified/);
  assert.equal(store.paidTransitions, 1);
  assert.equal(verificationCalls, 2);
});


test("declined transactions are not marked paid", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const declined = await handlePaystackCallback(
    new Request(`https://test.example/api/paystack/callback?reference=${reference}`),
    testEnv,
    { store, fetcher: verificationFetcher(verifyPayload({ status: "failed" })) },
  );
  assert.equal(declined.status, 200);
  assert.match(await declined.text(), /Payment not confirmed/);
  assert.equal(store.orders.get(reference).status, "pending");
  assert.equal(store.paidTransitions, 0);
});


test("callback rejects missing references and successful-verification amount, currency, and reference mismatches", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const noReference = await handlePaystackCallback(new Request("https://test.example/api/paystack/callback"), testEnv, { store });
  assert.equal(noReference.status, 400);

  for (const mismatch of [
    { amount: 149_999 },
    { currency: "USD" },
    { reference: "sud-test-other-reference" },
  ]) {
    const response = await handlePaystackCallback(
      new Request(`https://test.example/api/paystack/callback?reference=${reference}`),
      testEnv,
      { store, fetcher: verificationFetcher(verifyPayload(mismatch)) },
    );
    assert.equal(response.status, 409);
    assert.equal(store.orders.get(reference).status, "pending");
  }
  assert.equal(store.paidTransitions, 0);
});


test("legacy webhook signature must match exact raw body; invalid signatures never call verification", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const body = successEventBody();
  let verificationCalls = 0;
  const invalid = await handlePaystackWebhook(webhookRequest(body, "0".repeat(128)), testEnv, {
    store, fetcher: verificationFetcher(verifyPayload(), () => { verificationCalls += 1; }),
  });
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { ok: false, code: "invalid_signature" });
  assert.equal(verificationCalls, 0);

  const valid = await handlePaystackWebhook(webhookRequest(body, legacySignature(body)), testEnv, {
    store, fetcher: verificationFetcher(verifyPayload(), () => { verificationCalls += 1; }),
  });
  assert.equal(valid.status, 200);
  assert.equal(verificationCalls, 1);
});


test("timestamped webhook signing accepts a matching rotated v1 signature and rejects stale replay", async () => {
  const body = successEventBody();
  const oldSecret = "whsec_previous_synthetic_secret";
  const activeSecret = "whsec_active_synthetic_secret";
  const timestamp = Math.floor(now / 1000);
  const good = versionedSignature(body, timestamp, oldSecret);
  const multiple = `t=${timestamp},v1=old:${"0".repeat(128)},v1=new:${good}`;
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const env = { ...testEnv, PAYSTACK_WEBHOOK_SECRET: activeSecret, PAYSTACK_WEBHOOK_PREVIOUS_SECRET: oldSecret };
  const accepted = await handlePaystackWebhook(webhookRequest(body, multiple, "paystack-signature"), env, {
    store, now: () => now, fetcher: verificationFetcher(verifyPayload()),
  });
  assert.equal(accepted.status, 200);
  assert.equal(store.orders.get(reference).status, "paid");

  const staleTimestamp = timestamp - 301;
  const staleHeader = `t=${staleTimestamp},v1=old:${versionedSignature(body, staleTimestamp, oldSecret)}`;
  const replay = await handlePaystackWebhook(webhookRequest(body, staleHeader, "paystack-signature"), env, {
    store, now: () => now, fetcher: verificationFetcher(verifyPayload()),
  });
  assert.equal(replay.status, 401);
});


test("duplicate valid webhook delivery verifies but changes paid state only once", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const body = successEventBody();
  let verificationCalls = 0;
  const deps = { store, now: () => now, fetcher: verificationFetcher(verifyPayload(), () => { verificationCalls += 1; }) };
  const signature = legacySignature(body);
  const first = await handlePaystackWebhook(webhookRequest(body, signature), testEnv, deps);
  const second = await handlePaystackWebhook(webhookRequest(body, signature), testEnv, deps);
  assert.deepEqual(await first.json(), { ok: true, duplicate: false });
  assert.deepEqual(await second.json(), { ok: true, duplicate: true });
  assert.equal(store.paidTransitions, 1);
  assert.equal(verificationCalls, 2);
});


test("webhook success event with mismatched amount or currency is acknowledged without paid-state change", async () => {
  const store = new MemoryPaymentStore();
  await store.createOrder(starterOrder());
  const body = successEventBody();
  for (const mismatch of [{ amount: 1 }, { currency: "USD" }]) {
    const response = await handlePaystackWebhook(webhookRequest(body, legacySignature(body)), testEnv, {
      store, fetcher: verificationFetcher(verifyPayload(mismatch)),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, ignored: true });
    assert.equal(store.orders.get(reference).status, "pending");
  }
});


test("Firestore paid-state transition is compare-and-set idempotent under concurrent duplicate delivery", async () => {
  const documents = new Map([[reference, {
    name: `projects/straight-up-digital-test/databases/(default)/documents/test_paystack_orders/${reference}`,
    updateTime: "v1",
    fields: {
      reference: { stringValue: reference },
      productId: { stringValue: "website-one-page-starter" },
      amountSubunit: { integerValue: "150000" },
      currency: { stringValue: "ZAR" },
      status: { stringValue: "pending" },
      createdAt: { stringValue: new Date(now).toISOString() },
    },
  }]]);
  let version = 1;
  let paidTransitions = 0;
  const fakeClient = {
    documentName: (collection, id) => `projects/straight-up-digital-test/databases/(default)/documents/${collection}/${id}`,
    async getDocument(_collection, id) { return structuredClone(documents.get(id) ?? null); },
    async patchDocument() { throw new Error("not_used_by_transition_test"); },
    async commit(writes) {
      assert.equal(writes.length, 1);
      const write = writes[0];
      const documentId = write.update.name.split("/").at(-1);
      const existing = documents.get(documentId);
      if (!existing || existing.updateTime !== write.currentDocument.updateTime) throw new Error("stale_compare_and_set");
      assert.ok(write.updateMask.fieldPaths.includes("status"));
      const wasPaid = existing.fields.status.stringValue === "paid";
      const updated = { ...existing, updateTime: `v${++version}`, fields: { ...existing.fields, ...structuredClone(write.update.fields) } };
      documents.set(documentId, updated);
      if (!wasPaid && updated.fields.status.stringValue === "paid") paidTransitions += 1;
    },
  };
  const store = new FirestorePaystackOrderStore({ APP_ENV: "test", FIRESTORE_PROJECT_ID: "straight-up-digital-test" }, () => fakeClient);
  const results = await Promise.all([
    store.markPaid(reference, new Date(now).toISOString()),
    store.markPaid(reference, new Date(now).toISOString()),
  ]);
  assert.deepEqual(results.sort(), ["already_paid", "paid"]);
  assert.equal(paidTransitions, 1);
  assert.equal(documents.get(reference).fields.status.stringValue, "paid");

  const productionStore = new FirestorePaystackOrderStore({ APP_ENV: "production", FIRESTORE_PROJECT_ID: "straight-up-digital-prod" }, () => fakeClient);
  await assert.rejects(() => productionStore.markPaid(reference, new Date(now).toISOString()), /test_payment_store_disabled/);
});


test("all Paystack routes reject production and a live key cannot be used in the test Worker", async () => {
  const syntheticLiveKey = ["sk", "live", "synthetic0123456789abcdef"].join("_");
  const productionEnv = { APP_ENV: "production", PAYSTACK_SECRET_KEY: syntheticLiveKey };
  const init = await handlePaystackInitialize(jsonRequest("https://site.example/api/paystack/initialize", { email: "buyer@example.co.za", product_id: "website-one-page-starter" }), productionEnv, { store: new MemoryPaymentStore() });
  const callback = await handlePaystackCallback(new Request(`https://site.example/api/paystack/callback?reference=${reference}`), productionEnv, { store: new MemoryPaymentStore() });
  const hookBody = successEventBody();
  const webhook = await handlePaystackWebhook(webhookRequest(hookBody, legacySignature(hookBody, productionEnv.PAYSTACK_SECRET_KEY)), productionEnv, { store: new MemoryPaymentStore() });
  assert.equal(init.status, 404);
  assert.equal(callback.status, 404);
  assert.equal(webhook.status, 404);

  const assets = { fetch: async () => new Response("asset") };
  for (const path of ["initialize", "callback", "webhook"]) {
    const route = path === "callback" ? "GET" : "POST";
    const request = new Request(`https://site.example/api/paystack/${path}`, { method: route, ...(route === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
    const response = await handleWorkerRequest(request, { ...productionEnv, ASSETS: assets });
    assert.equal(response.status, 404);
  }

  const liveKeyInTest = await handlePaystackInitialize(jsonRequest("https://test.example/api/paystack/initialize", { email: "buyer@example.co.za", product_id: "website-one-page-starter" }), { APP_ENV: "test", PAYSTACK_SECRET_KEY: productionEnv.PAYSTACK_SECRET_KEY }, { store: new MemoryPaymentStore() });
  assert.equal(liveKeyInTest.status, 503);
});
