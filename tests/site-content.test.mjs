import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { websiteBuildHostingBundles, websiteHostingBundles } from "../src/data/bundles.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const siteData = read("../src/data/site.ts");
const privacy = read("../src/pages/privacy.astro");
const terms = read("../src/pages/terms.astro");
const policies = read("../src/pages/policies.astro");
const pricing = read("../src/data/pricing.ts");
const home = read("../src/pages/index.astro");
const pricingPage = read("../src/pages/pricing.astro");
const bundlesPage = read("../src/pages/bundles.astro");
const bundleData = read("../src/data/bundles.ts");
const form = read("../src/components/EnquiryForm.astro");
const whatsapp = read("../src/components/WhatsAppButton.astro");
const styles = read("../src/styles/global.css");
const layout = read("../src/layouts/BaseLayout.astro");
const footer = read("../src/components/SiteFooter.astro");
const astro = read("../astro.config.mjs");
const robots = read("../src/pages/robots.txt.ts");
const paystack = read("../docs/paystack-setup.md");
const imageCredits = read("../docs/image-credits.md");
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
  assert.match(form, /annual recurring hosting/);
  assert.match(form, /accepted payment method/);
  assert.match(form, /onceOffEdits\.map/);
});

test("website and hosting bundles separate one-time builds from recurring hosting", () => {
  assert.deepEqual(
    [...websiteHostingBundles, ...websiteBuildHostingBundles].map((bundle) => bundle.annual.priceZar),
    [2650, 3790, 5690, 4550, 4980, 6640, 7590, 11390],
  );
  assert.match(bundleData, /bundleDiscountPercent = 5/);
  assert.match(bundleData, /buildPriceZar: websiteOffer\.buildOnceOffZar/);
  assert.match(bundleData, /hostingMonthlyZar: hostingPlan\.priceMonthlyZar/);
  assert.match(bundleData, /hostingAnnualZar: hostingPlan\.priceAnnualZar/);
  assert.match(bundleData, /roundToNearestTen\(listedTotalZar/);
  assert.match(bundleData, /savingZar: listedTotalZar - priceZar/);
  assert.match(bundlesPage, /Online checkout is not active from\s+this page/);
  assert.match(bundlesPage, /Build list price:<\/strong> .*once-off/s);
  assert.match(bundlesPage, /Discounted bundle total:<\/strong> \{formatZar\(bundle\.annual\.priceZar\)\} once-off, paid in full/s);
  assert.match(bundlesPage, /bundleDiscountPercent/);
  assert.match(bundlesPage, /After the included first year:<\/strong> .*recurring annually/s);
  assert.match(bundlesPage, /paid in full once-off and include the\s+website build plus the first year of hosting/s);
  assert.match(bundlesPage, /Standalone website\s+builds remain 50% to start and 50% at launch/);
  assert.match(bundlesPage, /bundleDiscountPercent\}% annual bundle discount/);
  assert.match(bundleData, /websiteOffer\.buildOnceOffZar \+ hostingPlan\.priceAnnualZar/);
  assert.match(bundleData, /websitePackage\.priceZar \+ hostingPlan\.priceAnnualZar/);
  assert.match(form, /websiteHostingBundles\.map/);
  assert.match(form, /5% discount/s);
  assert.match(form, /hosting renews at .*recurring annually/s);
  assert.match(styles, /\.bundle-prices\s*\{[^}]*display:\s*grid/s);
  assert.match(footerNavigation, /label: "Bundles", href: "\/bundles"/);
});

test("the R1,500 website price is limited to the one-page starter", () => {
  const pricingData = read("../src/data/pricing.ts");
  assert.match(pricingData, /buildOnceOffZar: 1500/);
  assert.match(pricingData, /maximumPages: 1/);
  assert.match(faqs, /One-Page Starter R1,500; Five-Page Business R3,500/i);
  assert.doesNotMatch(faqs, /five-page small-business website is R1,500/i);
  assert.match(form, /One-Page Starter/);
  assert.match(form, /R1,500/);
  assert.match(pricingPage, /One-page starter website/);
  const servicesData = read("../src/data/services.ts");
  assert.match(servicesData, /One-Page Starter/);
  assert.match(servicesData, /Hosting is separate for standalone builds from R129\/month/);
  assert.match(home, /service\.summary/);
  assert.doesNotMatch(servicesData, /five-page.*R1,500/i);
});

test("owner-confirmed website packages show fixed rates, scopes, milestones and Paystack guardrails", () => {
  const pricingData = read("../src/data/pricing.ts");
  const expectedPackages = [
    ["one-page-starter", 1500], ["five-page-business", 3500], ["restaurant-cafe", 3950],
    ["guesthouse", 4500], ["booking-site", 5500], ["online-shop", 7500],
  ];
  for (const [slug, price] of expectedPackages) {
    const start = pricingData.indexOf(`slug: "${slug}"`);
    assert.notEqual(start, -1, `missing package ${slug}`);
    const packageBlock = pricingData.slice(start).split("\n  },")[0];
    if (slug === "one-page-starter") {
      assert.match(packageBlock, /priceZar: websiteOffer\.buildOnceOffZar/);
    } else {
      assert.match(packageBlock, new RegExp(`priceZar: ${price}\\b`), `${slug} has the wrong price`);
    }
    assert.match(packageBlock, /priceIsFrom: false/, `${slug} should be a fixed price`);
  }
  assert.match(pricingData, /50% to start and 50% at launch/i);
  assert.match(pricingData, /Live Paystack checkout is not included; it will only be considered after end-to-end testing passes and SinJin confirms/i);
  assert.match(pricingData, /Up to six pages covering rooms, facilities, photos, location and enquiries/);
  for (const price of ["R1,500", "R3,500", "R3,950", "R4,500", "R5,500", "R7,500"]) {
    assert.ok(faqs.includes(price), `FAQ is missing ${price}`);
  }
  assert.match(faqs, /Paystack checkout is not active/i);
  assert.match(home, /websiteBuildPackages\.map/);
  assert.match(home, /See full scope/);
  assert.match(bundlesPage, /Build list price:<\/strong>/);
  assert.match(bundlesPage, /After the included first year:<\/strong>/);
  assert.match(bundlesPage, /first hosting year/);
  assert.match(bundlesPage, /fixed-price website build/);
  assert.doesNotMatch(bundlesPage, /Booking and shop prices are starting prices/);
  assert.doesNotMatch(bundlesPage, /bundle total:<\/strong> From/);
});

test("delivery, cancellation and refunds policy is linked and preserves legal rights", () => {
  assert.match(footerNavigation, /href: "\/policies"/);
  assert.match(policies, /do not ship physical\s+products/);
  assert.match(policies, /section 44 of the Electronic Communications and\s+Transactions Act/);
  assert.match(policies, /full refund within 30 days/);
  assert.match(policies, /service began with the consumer's consent/);
  assert.match(policies, /an appropriate remedy/);
  assert.match(policies, /Paystack states that customers generally receive a processed refund\s+within 3 to 10 working days/);
  assert.match(terms, /Delivery, cancellations and refunds policy/);
  assert.match(privacy, /Paystack payment option is offered/);
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

test("specialist website gallery uses local, accessible and credited photos", () => {
  const serviceDetailPage = read("../src/pages/services/[slug].astro");
  for (const file of ["ecommerce-shop.webp", "guest-accommodation.webp", "clinic-wellness.webp"]) {
    assert.ok(serviceDetailPage.includes(`/images/services/${file}`), `missing gallery asset: ${file}`);
    assert.ok(imageCredits.includes(file), `missing image credit: ${file}`);
  }
  assert.match(serviceDetailPage, /alt=\{image\.alt\}/);
  assert.match(serviceDetailPage, /loading="lazy"/);
  assert.match(imageCredits, /https:\/\/unsplash\.com\/license/);
  assert.match(imageCredits, /Unsplash\+ or other premium/i);
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
