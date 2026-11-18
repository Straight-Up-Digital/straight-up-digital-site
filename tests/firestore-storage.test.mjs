import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { FirestoreDataStore, createReportKey, decodeCursor } from "../cloudflare/storage.ts";
import { FirestoreError } from "../cloudflare/firestore.ts";

const makeCredentials = async () => {
  const pair = await webcrypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const der = new Uint8Array(await webcrypto.subtle.exportKey("pkcs8", pair.privateKey));
  const encoded = Buffer.from(der).toString("base64").match(/.{1,64}/g).join("\n");
  const keyId = `test-${crypto.randomUUID()}`;
  const credential = {
    type: "service_account",
    project_id: "sud-test",
    private_key_id: keyId,
    private_key: `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----\n`,
    client_email: "sud-test-worker@sud-test.iam.gserviceaccount.com",
  };
  return { keyId, json: JSON.stringify(credential) };
};

const makeFetcher = (apiHandler, onAuth = () => {}) => async (input, init = {}) => {
  const url = new URL(input);
  if (url.href === "https://oauth2.googleapis.com/token") {
    const form = new URLSearchParams(String(init.body));
    assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const assertion = form.get("assertion");
    assert.ok(assertion);
    const [headerPart, claimPart, signaturePart] = assertion.split(".");
    const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    onAuth({ header: decode(headerPart), claims: decode(claimPart), signaturePart });
    return Response.json({ access_token: "synthetic-access-token", expires_in: 3600 });
  }
  assert.equal(new Headers(init.headers).get("Authorization"), "Bearer synthetic-access-token");
  return apiHandler(url, init);
};

const makeStore = async (apiHandler, options = {}) => {
  const credentials = await makeCredentials();
  const env = {
    FIRESTORE_PROJECT_ID: "sud-test",
    GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: credentials.json,
  };
  return { store: new FirestoreDataStore(env, { fetcher: makeFetcher(apiHandler, options.onAuth), now: options.now }), credentials };
};

const document = (id, receivedAt, fields = {}) => ({
  name: `projects/sud-test/databases/(default)/documents/website_enquiries/${id}`,
  fields: {
    id: { stringValue: id },
    receivedAt: { stringValue: receivedAt },
    sortKey: { stringValue: `${receivedAt}|${id}` },
    fieldsJson: { stringValue: JSON.stringify({ name: "Ada", email: "ada@example.co.za", ...fields }) },
  },
});

 test("service-account JWT requests the Firestore datastore scope and REST calls use only the access token", async () => {
  let auth;
  let captured;
  const { store } = await makeStore(async (url, init) => {
    captured = { url: url.toString(), method: init.method, body: JSON.parse(String(init.body)) };
    return Response.json({ name: url.pathname, fields: captured.body.fields });
  }, { onAuth: (value) => { auth = value; } });
  const receivedAt = "2026-11-16T12:00:00.000Z";
  const id = "11111111-1111-4111-8111-111111111111";
  await store.saveDeliveredEnquiry({ name: "Ada", businessName: "Example", email: "ada@example.co.za", consentGiven: true }, receivedAt, id);
  assert.equal(auth.header.alg, "RS256");
  assert.equal(auth.header.typ, "JWT");
  assert.equal(auth.claims.scope, "https://www.googleapis.com/auth/datastore");
  assert.equal(auth.claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(auth.claims.iss, "sud-test-worker@sud-test.iam.gserviceaccount.com");
  assert.ok(auth.claims.exp - auth.claims.iat <= 3600);
  assert.ok(auth.signaturePart.length > 100);
  assert.equal(captured.method, "PATCH");
  assert.match(captured.url, /website_enquiries\/11111111-1111-4111-8111-111111111111/);
  assert.equal(new URL(captured.url).searchParams.get("currentDocument.exists"), "false");
  assert.equal(captured.body.fields.receivedAt.stringValue, receivedAt);
  assert.equal(captured.body.fields.fieldsJson.stringValue.includes("ada@example.co.za"), true);
});

test("CRM sync pagination uses an ordered Firestore cursor and returns opaque-compatible cursors", async () => {
  let query;
  const firstId = "00000000-0000-4000-8000-000000000001";
  const secondId = "00000000-0000-4000-8000-000000000002";
  const { store } = await makeStore(async (url, init) => {
    assert.equal(url.pathname.endsWith("/documents:runQuery"), true);
    query = JSON.parse(String(init.body)).structuredQuery;
    return Response.json([
      { document: document(firstId, "2026-11-16T12:01:00.000Z") },
      { document: document(secondId, "2026-11-16T12:02:00.000Z") },
      { done: true },
    ]);
  });
  const page = await store.listEnquiries(["2026-11-16T12:00:00.000Z", "00000000-0000-4000-8000-000000000000"], 1);
  assert.equal(query.orderBy[0].field.fieldPath, "sortKey");
  assert.equal(query.startAt.values[0].stringValue, "2026-11-16T12:00:00.000Z|00000000-0000-4000-8000-000000000000");
  assert.equal(query.startAt.inclusive, false);
  assert.equal(query.limit, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, firstId);
  assert.equal(page.hasMore, true);
  assert.deepEqual(decodeCursor(page.nextCursor), ["2026-11-16T12:01:00.000Z", firstId]);
});

test("report records are created conditionally, retrieved by hashed token, and duplicates are not overwritten", async () => {
  const report = { businessName: "Example", findings: [{ title: "Make the text easier to read" }] };
  const token = "R".repeat(43);
  const key = await createReportKey(token);
  let patchCount = 0;
  let storedReport;
  const { store } = await makeStore(async (_url, init) => {
    if (init.method === "PATCH") {
      patchCount += 1;
      if (patchCount > 1) return Response.json({ error: { code: 409 } }, { status: 409 });
      storedReport = JSON.parse(String(init.body));
      return Response.json(storedReport);
    }
    if (init.method === "GET") return Response.json(storedReport);
    throw new Error("unexpected_firestore_method");
  });
  assert.equal(await store.createReport(key, report, "2026-12-16T00:00:00.000Z", "2026-11-16T00:00:00.000Z"), true);
  assert.match(storedReport.name, /client_audit_reports\/[a-f0-9]{64}$/);
  assert.equal(await store.createReport(key, { businessName: "Do not overwrite" }, "2026-12-16T00:00:00.000Z", "2026-11-16T00:00:00.000Z"), false);
  assert.deepEqual(await store.getReport(key), { report, expiresAt: "2026-12-16T00:00:00.000Z" });
});

test("rate-limit buckets use a conditional first write and atomic Firestore increment transforms", async () => {
  const id = `rate_${"a".repeat(64)}_1000`;
  let count = 0;
  let writes = [];
  const { store } = await makeStore(async (url, init) => {
    const path = url.pathname;
    if (init.method === "GET") {
      if (count === 0) return new Response(null, { status: 404 });
      return Response.json({ name: path, fields: { count: { integerValue: String(count) } } });
    }
    if (init.method === "PATCH") {
      count = 1;
      return Response.json({ name: path, fields: JSON.parse(String(init.body)).fields });
    }
    if (path.endsWith("/documents:commit")) {
      writes = JSON.parse(String(init.body)).writes;
      count += 1;
      return Response.json({ writeResults: [{ updateTime: "2026-11-16T12:00:00Z" }] });
    }
    throw new Error("unexpected_firestore_method");
  });
  assert.equal(await store.incrementRateLimit("a".repeat(64), 1000, 2000), 1);
  assert.equal(await store.incrementRateLimit("a".repeat(64), 1000, 2000), 2);
  assert.match(id, /^rate_a+_1000$/);
  assert.equal(writes[0].transform.document, `projects/sud-test/databases/(default)/documents/request_rate_limits/${id}`);
  assert.deepEqual(writes[0].transform.fieldTransforms, [{ fieldPath: "count", increment: { integerValue: "1" } }]);
});

test("expiry cleanup issues bounded Firestore queries and deletes only returned document names", async () => {
  const commits = [];
  const queries = [];
  const { store } = await makeStore(async (url, init) => {
    if (url.pathname.endsWith("/documents:runQuery")) {
      const query = JSON.parse(String(init.body)).structuredQuery;
      queries.push(query);
      const collection = query.from[0].collectionId;
      return Response.json([{ document: { name: `projects/sud-test/databases/(default)/documents/${collection}/expired-1` } }]);
    }
    if (url.pathname.endsWith("/documents:commit")) {
      commits.push(JSON.parse(String(init.body)).writes);
      return Response.json({ writeResults: [{}] });
    }
    throw new Error("unexpected_firestore_method");
  });
  assert.equal(await store.deleteExpiredReports("2026-11-16T12:00:00.000Z"), 1);
  assert.equal(await store.deleteExpiredRateLimits(1_800_000_000_000), 1);
  assert.equal(queries[0].where.fieldFilter.field.fieldPath, "expiresAt");
  assert.equal(queries[0].where.fieldFilter.value.stringValue, "2026-11-16T12:00:00.000Z");
  assert.equal(queries[1].where.fieldFilter.value.integerValue, "1800000000000");
  assert.ok(queries.every((query) => query.limit <= 450));
  assert.equal(commits.length, 2);
  assert.equal(commits[0][0].delete.endsWith("client_audit_reports/expired-1"), true);
});

test("missing Firestore configuration fails closed and API errors do not expose response bodies", async () => {
  const unconfigured = new FirestoreDataStore({});
  await assert.rejects(() => unconfigured.deleteExpiredReports("2026-11-16T00:00:00.000Z"), FirestoreError);
  const { store } = await makeStore(async () => new Response(JSON.stringify({ error: "private-client@example.co.za" }), { status: 403 }));
  await assert.rejects(() => store.deleteExpiredReports("2026-11-16T00:00:00.000Z"), (error) => {
    assert.ok(error instanceof FirestoreError);
    assert.equal(error.status, 403);
    assert.doesNotMatch(error.message, /private-client@example/);
    return true;
  });
});

test("default fetch retains the globalThis receiver required by Cloudflare Workers", async () => {
  const credentials = await makeCredentials();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async function(input) {
    assert.equal(this, globalThis, "Worker fetch must be invoked with its global receiver");
    const url = new URL(input);
    calls.push(url.href);
    if (url.href === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access-token", expires_in: 3600 });
    assert.equal(url.pathname.endsWith("/documents:runQuery"), true);
    return Response.json([{ done: true }]);
  };
  try {
    const store = new FirestoreDataStore({ FIRESTORE_PROJECT_ID: "sud-test", GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: credentials.json });
    assert.equal(await store.deleteExpiredReports("2026-11-16T00:00:00.000Z"), 0);
    assert.equal(calls.length, 2);
    assert.equal(new URL(calls[0]).hostname, "oauth2.googleapis.com");
    assert.equal(new URL(calls[1]).hostname, "firestore.googleapis.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OAuth token-fetch errors retain only the network exception name and message", async () => {
  const credentials = await makeCredentials();
  const store = new FirestoreDataStore({ FIRESTORE_PROJECT_ID: "sud-test", GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON: credentials.json }, {
    fetcher: async () => { throw new TypeError("Failed to fetch"); },
  });
  await assert.rejects(() => store.deleteExpiredReports("2026-11-16T00:00:00.000Z"), (error) => {
    assert.ok(error instanceof FirestoreError);
    assert.equal(error.name, "FirestoreError");
    assert.equal(error.message, "firestore_authentication_failed");
    assert.equal(error.stage, "oauth_fetch");
    assert.equal(error.failureType, "network");
    assert.equal(error.causeName, "TypeError");
    assert.equal(error.causeMessage, "Failed to fetch");
    assert.doesNotMatch(error.causeMessage, /private_key|client_email|token/i);
    return true;
  });
});
