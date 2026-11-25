import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCustomerReport,
  reportFlowReady,
  reportKeyForToken,
  reportSecurityHeaders,
  renderReportPage,
} from "../shared/client-report.mts";

const reportInput = {
  schemaVersion: 1,
  businessName: "Example Garden Services",
  website: "https://example.co.za/",
  location: "Cape Town",
  reportDate: "2026-11-14",
  summary: "This review found 1 area to check or improve.",
  scopeNote: "This review uses public evidence and does not measure sales.",
  findings: [{
    title: "<script>alert(1)</script>Make the contact path clearer",
    priority: "Start here",
    whatWeFound: "The main contact action is not clear on every important page.",
    whyItMatters: "A visitor may leave without asking a question.",
    whatToDo: "Add a clear contact link beside service details.",
  }],
  scorecard: { score: 42, categoryScores: [2, 9] },
  privatePricing: "Never show this",
};

const readyEnv = {
  AUDIT_REPORTS_ENABLED: "true",
  EMAIL_PROVIDER: "zoho-mail-api",
  ENQUIRY_TO_EMAIL: "straightupdigital@zohomail.com",
  ENQUIRY_FROM_EMAIL: "straightupdigital@zohomail.com",
  ZOHO_API_CLIENT_ID: "example-client-id",
  ZOHO_API_CLIENT_SECRET: "example-client-secret",
};
const reader = (config) => (key) => config[key];


test("customer report normalisation whitelists only the intended client fields", () => {
  const report = normalizeCustomerReport(reportInput);
  assert.ok(report);
  assert.equal(report.businessName, "Example Garden Services");
  assert.equal(report.findings.length, 1);
  assert.equal("scorecard" in report, false);
  assert.equal("privatePricing" in report, false);
  assert.equal("scorecard" in report.findings[0], false);
});


test("invalid URLs, dates, priorities and oversized findings are refused", () => {
  assert.equal(normalizeCustomerReport({ ...reportInput, website: "javascript:alert(1)" }), null);
  assert.equal(normalizeCustomerReport({ ...reportInput, reportDate: "tomorrow" }), null);
  assert.equal(normalizeCustomerReport({ ...reportInput, findings: [{ ...reportInput.findings[0], priority: "Critical internal score" }] }), null);
  assert.equal(normalizeCustomerReport({ ...reportInput, findings: Array(13).fill(reportInput.findings[0]) }), null);
});


test("customer report rendering escapes content and emits noindex and no-store policy", () => {
  const report = normalizeCustomerReport(reportInput);
  const html = renderReportPage(report, "14/12/2026", "A".repeat(43));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /not a purchase or binding acceptance/i);
  assert.match(html, /Send my response/);
  const headers = reportSecurityHeaders();
  assert.match(headers.get("x-robots-tag"), /noindex/);
  assert.match(headers.get("cache-control"), /no-store/);
  assert.match(headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(headers.get("content-security-policy"), /font-src 'self'/);
  assert.match(html, /href="\/report-fonts\.css"/);
});


test("public report tokens are never used as storage keys directly", () => {
  const token = "random-owner-generated-report-token";
  const key = reportKeyForToken(token);
  assert.match(key, /^reports\/[a-f0-9]{64}$/);
  assert.equal(key.includes(token), false);
});


test("report flow requires explicit feature flag and a Zoho mailbox configuration", () => {
  assert.equal(reportFlowReady(reader(readyEnv)), true);
  assert.equal(reportFlowReady(reader({ ...readyEnv, AUDIT_REPORTS_ENABLED: "false" })), false);
  assert.equal(reportFlowReady(reader({ ...readyEnv, ZOHO_API_CLIENT_SECRET: "" })), false);
  assert.equal(reportFlowReady(reader({ ...readyEnv, ENQUIRY_TO_EMAIL: "elsewhere@example.com" })), false);
});


