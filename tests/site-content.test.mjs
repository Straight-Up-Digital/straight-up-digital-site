import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const siteData = read("../src/data/site.ts");
const privacy = read("../src/pages/privacy.astro");
const terms = read("../src/pages/terms.astro");
const pricing = read("../src/data/pricing.ts");
const home = read("../src/pages/index.astro");
const pricingPage = read("../src/pages/pricing.astro");
const form = read("../src/components/EnquiryForm.astro");
const whatsapp = read("../src/components/WhatsAppButton.astro");
const styles = read("../src/styles/global.css");
const layout = read("../src/layouts/BaseLayout.astro");
const footer = read("../src/components/SiteFooter.astro");
const astro = read("../astro.config.mjs");
const paystack = read("../docs/paystack-setup.md");
const faqs = read("../src/data/faqs.ts");
const digitalAudit = read("../src/pages/digital-audit.astro");

test("public business identity and locality are owner-supplied", () => {
  assert.match(siteData, /St\. John Ritchie trading as Straight Up Digital/);
  assert.match(siteData, /Port Alfred, Eastern Cape, South Africa/);
  assert.match(privacy, /ownerSupplied\.legalEntity/);
  assert.match(terms, /ownerSupplied\.legalEntity/);
  assert.match(footer, /ownerSupplied\.legalEntity/);
  assert.match(footer, /South African law, including POPIA/);
  assert.doesNotMatch(`${privacy}\n${terms}`, /Draft for review|Owner to confirm|placeholder-note|privacy-draft|terms-draft/);
});

test("each hosting plan has an exact request CTA and reaches the contact form with its plan slug", () => {
  for (const label of [
    "Select Starter Plan (R99/mo)",
    "Select Business Growth (R149/mo)",
    "Request Managed Care Quote",
  ]) {
    assert.ok(pricing.includes(label), `missing CTA: ${label}`);
  }
  assert.match(home, /contact\?plan=\$\{plan\.slug\}#enquiry/);
  assert.match(pricingPage, /contact\?plan=\$\{plan\.slug\}#enquiry/);
  assert.match(home, /contact\?plan=domain#enquiry/);
  assert.match(pricingPage, /contact\?plan=domain#enquiry/);
  assert.match(form, /Domain registration or renewal request/);
  assert.match(form, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(form, /serviceSelect\.value = requestedPlan/);
  assert.match(form, /Please confirm availability, payment terms and the start date/);
});

test("WhatsApp offers audit, hosting, domain and general enquiry intents", () => {
  for (const label of ["Digital audit", "Hosting plan", "Domain registration", "Something else"]) {
    assert.ok(whatsapp.includes(`label: "${label}"`), `missing WhatsApp topic: ${label}`);
  }
  assert.match(whatsapp, /wa\.me\/\$\{whatsappNumber\}/);
  assert.match(whatsapp, /aria-label=/);
  assert.match(whatsapp, /Chat on WhatsApp/);
});

test("mobile floating actions clear the sticky audit bar and preserve touch targets", () => {
  assert.match(styles, /body\.has-sticky-audit \.floating-actions\s*\{\s*bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.whatsapp-button\s*\{[^}]*min-height: 48px/s);
  assert.match(styles, /\.back-to-top\s*\{[^}]*width: 48px/s);
  assert.match(layout, /class="floating-actions" role="group"/);
});

test("the intended custom domain is canonical and present in social/business metadata", () => {
  assert.match(astro, /https:\/\/straightupdigital\.co\.za/);
  assert.match(layout, /<link rel="canonical" href=\{canonical\}/);
  assert.match(layout, /property="og:url" content=\{canonical\}/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /"@type": "PostalAddress"/);
  assert.match(layout, /addressLocality: "Port Alfred"/);
});

test("Paystack readiness copy does not promise recurring Capitec Pay", () => {
  assert.match(paystack, /Capitec Pay.*once-off/);
  assert.match(paystack, /secret.*never be sent to browser code/i);
  assert.match(paystack, /plan codes/i);
});

test("public FAQs describe live reviewed online reports and the owner-approved locality", () => {
  assert.match(faqs, /After review, we share a private online report/);
  assert.doesNotMatch(faqs, /when the online report service is enabled|Service areas are not published yet/);
  assert.match(faqs, /based in Port Alfred, Eastern Cape, South Africa/);
  assert.match(faqs, /How do I request a hosting plan/);
  assert.match(digitalAudit, /After review, we\s+share a private online report/);
  assert.match(digitalAudit, /link expires after 30 days/);
  assert.doesNotMatch(digitalAudit, /when the secure report service is enabled|Otherwise, we follow up directly/);
});
