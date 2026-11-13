import assert from "node:assert/strict";
import test from "node:test";
import {
  isHoneypotFilled,
  isImplausiblyFast,
  validateEnquiry,
} from "../netlify/lib/validation.mts";
import { EmailConfigError, sendEnquiryEmail } from "../netlify/lib/email.mts";

const validAudit = {
  business_name: "Example Business",
  website_url: "example-business.co.za",
  email: "owner@example.co.za",
  phone: "021 555 0100",
  service_of_interest: "Digital presence audits",
  message: "Our contact page is broken and enquiries are down.",
  consent_given: "yes",
  consent_text_version: "privacy-draft-2026-11",
  consent_timestamp: "2026-11-13T10:00:00.000Z",
  form_type: "audit",
  source: "/digital-audit",
  started_at: String(Date.now() - 20_000),
};

test("accepts a complete audit request and normalises the website", () => {
  const result = validateEnquiry(validAudit);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.websiteUrl, "https://example-business.co.za");
  assert.equal(result.value.email, "owner@example.co.za");
  assert.equal(result.value.consentGiven, true);
  assert.equal(result.value.formType, "audit");
});

test("rejects missing business name, email and consent", () => {
  const result = validateEnquiry({
    ...validAudit,
    business_name: "",
    email: "",
    consent_given: "",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.business_name);
  assert.ok(result.errors.email);
  assert.ok(result.errors.consent_given);
});

test("rejects an invalid website and email", () => {
  const result = validateEnquiry({
    ...validAudit,
    website_url: "not a website",
    email: "not-an-email",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.website_url);
  assert.ok(result.errors.email);
});

test("an audit can proceed without a website, if it is explained", () => {
  const result = validateEnquiry({ ...validAudit, website_url: "" });
  assert.equal(result.ok, true);
});

test("contact enquiries require a name and a message", () => {
  const result = validateEnquiry({
    ...validAudit,
    type: undefined,
    form_type: "contact",
    name: "",
    message: "",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.name);
  assert.ok(result.errors.message);
});

test("a short phone number is rejected, an empty one is fine", () => {
  const invalid = validateEnquiry({ ...validAudit, phone: "123" });
  assert.equal(invalid.ok, false);
  const empty = validateEnquiry({ ...validAudit, phone: "" });
  assert.equal(empty.ok, true);
});

test("over-long messages are rejected", () => {
  const result = validateEnquiry({ ...validAudit, message: "x".repeat(2001) });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.message);
});

test("honeypot and timing checks detect obvious bots", () => {
  assert.equal(isHoneypotFilled({ company_website_confirm: "spam" }), true);
  assert.equal(isHoneypotFilled({ company_website_confirm: "" }), false);

  const body = validateEnquiry(validAudit);
  assert.equal(body.ok, true);
  if (!body.ok) return;
  assert.equal(isImplausiblyFast(body.value), false);
  assert.equal(
    isImplausiblyFast({ ...body.value, startedAt: Date.now() }),
    true,
  );
});

test("the console email transport is explicit and sends nothing", async () => {
  const body = validateEnquiry(validAudit);
  assert.equal(body.ok, true);
  if (!body.ok) return;

  const result = await sendEnquiryEmail(body.value, (key) =>
    key === "EMAIL_PROVIDER" ? "console" : undefined,
  );
  assert.equal(result.provider, "console");
});

test("a missing email provider is a configuration error, not a silent success", async () => {
  const body = validateEnquiry(validAudit);
  assert.equal(body.ok, true);
  if (!body.ok) return;

  await assert.rejects(
    () => sendEnquiryEmail(body.value, () => undefined),
    EmailConfigError,
  );
});

test("resend without an API key fails before any network call", async () => {
  const body = validateEnquiry(validAudit);
  assert.equal(body.ok, true);
  if (!body.ok) return;

  const env = (key) => {
    if (key === "EMAIL_PROVIDER") return "resend";
    if (key === "ENQUIRY_TO_EMAIL") return "inbox@example.co.za";
    if (key === "ENQUIRY_FROM_EMAIL") return "website@example.co.za";
    return undefined;
  };

  await assert.rejects(() => sendEnquiryEmail(body.value, env), EmailConfigError);
});
