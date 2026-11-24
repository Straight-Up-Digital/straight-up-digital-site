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
const robots = read("../src/pages/robots.txt.ts");
const paystack = read("../docs/paystack-setup.md");
const faqs = read("../src/data/faqs.ts");
const digitalAudit = read("../src/pages/digital-audit.astro");
const footerNavigation = read("../src/data/navigation.ts");
const about = read("../src/pages/about.astro");
const core = read("../src/components/Core.astro");
const businessIllustration = read("../public/illustrations/local-business-digital.svg");

test("public business identity and locality are owner-supplied", () => {
  assert.match(siteData, /St\. John Ritchie trading as Straight Up Digital/);
  assert.match(siteData, /Port Alfred, Eastern Cape, South Africa/);
  assert.match(privacy, /ownerSupplied\.legalEntity/);
  assert.match(terms, /ownerSupplied\.legalEntity/);
  assert.match(footer, /ownerSupplied\.legalEntity/);
  assert.match(footer, /South African law, including POPIA/);
  assert.doesNotMatch(`${privacy}\n${terms}`, /Draft for review|Owner to confirm|placeholder-note|privacy-draft|terms-draft/);
});

test("footer has a single navigation destination for legal and audit pages", () => {
  const footerNavData = footerNavigation.split("export const footerNav:")[1].split("export const isCurrent")[0];
  for (const [path, label] of [["/privacy", "Privacy"], ["/terms", "Terms"], ["/digital-audit", "Digital audit"]]) {
    assert.equal((footerNavData.match(new RegExp(`href: \"${path}\"`, "g")) ?? []).length, 1, `${label} should be listed once`);
  }
  assert.doesNotMatch(footer, /site-footer__bottom[\s\S]*<ul>/);
  assert.doesNotMatch(footer, /href=\"\/(?:privacy|terms|digital-audit)\"/);
});

test("hosting tiers show both billing choices and prefill the requested plan", () => {
  for (const label of [
    "Starter Brand",
    "Business Pro",
    "Team Unlimited",
    "priceMonthlyZar: 129",
    "priceAnnualZar: 1290",
    "priceMonthlyZar: 249",
    "priceAnnualZar: 2490",
    "priceMonthlyZar: 449",
    "priceAnnualZar: 4490",
    "Basic Care",
    "Local Visibility",
    "Active Growth",
    "Lead Builder",
    "Full Digital Desk",
    "priceZarPerMonth: 1549",
  ]) {
    assert.ok(pricing.includes(label), `missing package content: ${label}`);
  }
  assert.match(home, /contact\?plan=\$\{plan\.slug\}&billing=monthly#enquiry/);
  assert.match(pricingPage, /contact\?plan=\$\{plan\.slug\}&billing=monthly#enquiry/);
  assert.match(pricingPage, /contact\?plan=\$\{plan\.slug\}&billing=annual#enquiry/);
  assert.match(home, /contact\?plan=domain#enquiry/);
  assert.match(pricingPage, /contact\?plan=domain#enquiry/);
  assert.match(form, /Additional domain registration or renewal request/);
  assert.match(form, /data-plan-requests=\{JSON\.stringify\(planRequests\)\}/);
  assert.match(form, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(form, /serviceSelect\.value = requestedPlan/);
  assert.match(form, /annual prepayment \(two months free\)/);
  assert.match(form, /accepted payment method/);
  assert.match(form, /onceOffEdits\.map/);
});

test("the R1,500 website price is limited to the one-page starter", () => {
  const pricingData = read("../src/data/pricing.ts");
  assert.match(pricingData, /buildOnceOffZar: 1500/);
  assert.match(pricingData, /maximumPages: 1/);
  assert.match(faqs, /one-page starter website begins at R1,500/i);
  assert.doesNotMatch(faqs, /five-page small-business website is R1,500/i);
  assert.match(form, /One-page starter website — from R1,500 once-off/);
  assert.match(pricingPage, /One-page starter website/);
});

test("services open dedicated pages and expose specialist build scopes and plan links", () => {
  const servicesPage = read("../src/pages/services.astro");
  const servicesData = read("../src/data/services.ts");
  const serviceDetailPage = read("../src/pages/services/[slug].astro");

  assert.match(servicesPage, /href=\{`\/services\/\$\{service\.slug\}`\}/);
  assert.match(servicesPage, /href="\/pricing#monthly-support"/);
  assert.match(servicesPage, /href="\/pricing#hosting-packages"/);
  assert.match(form, /Object\.fromEntries\(services\.map/);
  assert.match(serviceDetailPage, /getStaticPaths/);
  assert.match(serviceDetailPage, /\/contact\?plan=/);
  assert.match(serviceDetailPage, /canonicalPath=\{`\/services\/\$\{service\.slug\}`\}/);
  assert.match(serviceDetailPage, /websiteBuildOptions\.map/);
  assert.match(serviceDetailPage, /hostingPlans\.map/);
  assert.match(servicesData, /Online shops/);
  assert.match(servicesData, /Bookings and appointments/);
  assert.match(servicesData, /Guest houses and tourism/);
  assert.match(servicesData, /Clinics and wellness practices/);
  assert.match(servicesData, /payment fees and third-party subscriptions are listed separately/i);
  assert.match(servicesData, /should not collect health details unless secure handling and legal requirements are separately assessed/i);
});

test("WhatsApp offers audit, hosting, domain and general enquiry intents", () => {
  for (const label of ["Digital audit", "Hosting plan", "Domain registration", "Something else"]) {
    assert.ok(whatsapp.includes(`label: "${label}"`), `missing WhatsApp topic: ${label}`);
  }
  assert.match(whatsapp, /Starter Brand, Business Pro and Team Unlimited/);
  assert.doesNotMatch(whatsapp, /Business Growth|Managed Care/);
  assert.match(whatsapp, /wa\.me\/\$\{whatsappNumber\}/);
  assert.match(whatsapp, /aria-label=/);
  assert.match(whatsapp, /Chat on WhatsApp/);
  assert.match(styles, /\.whatsapp-menu__panel\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
});

test("mobile floating actions clear the sticky audit bar and preserve touch targets", () => {
  assert.match(styles, /body\.has-sticky-audit \.floating-actions\s*\{\s*bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.whatsapp-button\s*\{[^}]*min-height: 48px/s);
  assert.match(styles, /\.back-to-top\s*\{[^}]*width: 48px/s);
  assert.match(styles, /\.whatsapp-menu__panel\s*\{[^}]*left: 0/s);
  assert.doesNotMatch(styles.match(/\.whatsapp-menu__panel\s*\{[^}]*\}/s)?.[0] ?? "", /right:\s*0/);
  assert.match(layout, /class="floating-actions" role="group"/);
});

test("brand and founder treatments are larger, responsive and use only supplied imagery", () => {
  assert.match(styles, /\.brand img\s*\{[^}]*height: 40px/s);
  assert.match(styles, /\.brand img\s*\{[^}]*height: 36px/s);
  assert.match(about, /ownerSupplied\.founderPhoto/);
  assert.match(about, /founder-panel__brand/);
  assert.match(about, /founder-panel__bio/);
  assert.match(core, /animateScore/);
  assert.match(core, /prefers-reduced-motion/);
  assert.match(core, /data-core-needle/);
  assert.match(core, /needle\.setAttribute\("transform"/);
  assert.match(home, /local-business-digital\.svg/);
  assert.match(businessIllustration, /<svg/);
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

test("public audit copy describes reviewed reports without promising the disabled online report feature", () => {
  assert.match(faqs, /After review, we share a customer-ready report/);
  assert.doesNotMatch(`${faqs}\n${digitalAudit}`, /private online report|report page|link expires after 30 days/);
  assert.match(faqs, /based in Port Alfred, Eastern Cape, South Africa/);
  assert.match(faqs, /How do I request a hosting plan/);
  assert.match(digitalAudit, /After review, we\s+share a customer-ready report/);
  assert.match(digitalAudit, /Ask a question or arrange a discussion with us/);
});
