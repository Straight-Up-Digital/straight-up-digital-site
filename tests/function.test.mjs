import assert from "node:assert/strict";
import test from "node:test";
import handler, { config } from "../netlify/functions/submit-enquiry.mts";

const context = { ip: "203.0.113.10" };

const validBody = {
  name: "Sam Mokoena",
  business_name: "Example Bakery",
  website_url: "example-bakery.co.za",
  email: "sam@example-bakery.co.za",
  phone: "021 555 0100",
  service_of_interest: "Website design and development",
  message: "We need a site that explains our bread and takes orders.",
  consent_given: "yes",
  consent_text_version: "privacy-1.0-2026-11-15",
  consent_timestamp: "2026-11-13T10:00:00.000Z",
  form_type: "contact",
  source: "/contact",
  started_at: String(Date.now() - 15_000),
};

const post = (body, headers = {}) =>
  new Request("https://example.com/.netlify/functions/submit-enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("GET is rejected with 405", async () => {
  const response = await handler(
    new Request("https://example.com/x", { method: "GET" }),
    context,
  );
  assert.equal(response.status, 405);
});

test("invalid JSON is rejected with 400", async () => {
  const response = await handler(
    new Request("https://example.com/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    }),
    context,
  );
  assert.equal(response.status, 400);
});

test("invalid fields return 422 with a field map", async () => {
  const response = await handler(post({ ...validBody, email: "bad" }), context);
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.ok(data.errors.email);
});

test("a filled honeypot is acknowledged without sending", async () => {
  const response = await handler(
    post({ ...validBody, company_website_confirm: "https://spam.example" }),
    context,
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
});

test("a submission faster than a human is acknowledged without sending", async () => {
  const response = await handler(
    post({ ...validBody, started_at: String(Date.now()) }),
    context,
  );
  assert.equal(response.status, 200);
});

test("a valid submission is delivered through the console transport in tests", async () => {
  process.env.EMAIL_PROVIDER = "console";
  const response = await handler(post(validBody), context);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  delete process.env.EMAIL_PROVIDER;
});

test("an HTML form post redirects to the thank-you page", async () => {
  process.env.EMAIL_PROVIDER = "console";
  const body = new URLSearchParams(
    Object.entries(validBody).map(([key, value]) => [key, String(value)]),
  );
  const response = await handler(
    new Request("https://example.com/x", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body: body.toString(),
    }),
    context,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/thank-you");
  delete process.env.EMAIL_PROVIDER;
});

test("an oversized body is rejected before parsing", async () => {
  const response = await handler(
    new Request("https://example.com/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, message: "x".repeat(40_000) }),
    }),
    context,
  );
  assert.equal(response.status, 400);
});

test("a configured Turnstile secret requires a token", async () => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  const response = await handler(post(validBody), context);
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.ok(data.errors.turnstile);
  delete process.env.TURNSTILE_SECRET_KEY;
});

test("the function declares IP rate limiting", () => {
  assert.equal(config.rateLimit?.action, "rate_limit");
  assert.equal(config.rateLimit?.aggregateBy, "ip");
});
