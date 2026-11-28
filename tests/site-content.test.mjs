import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { websiteBuildHostingBundles, websiteHostingBundles } from "../src/data/bundles.ts";
import { readdirSync } from "node:fs";
import { primaryNav } from "../src/data/navigation.ts";
import { services } from "../src/data/services.ts";

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
const planShare = read("../src/components/PlanShare.astro");
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
const networkGlobeIllustration = read("../public/illustrations/network-globe.svg");
const backToTop = read("../src/components/BackToTopButton.astro");

test("public business identity uses nationwide branding without exposing a street address", () => {
  assert.match(siteData, /St\. John Ritchie trading as Straight Up Digital/);
  assert.match(siteData, /locationLabel: "PROUDLY SOUTH AFRICAN"/);
  const publicLocationCopy = `${siteData}\n${home}\n${about}\n${faqs}\n${layout}\n${footer}\n${terms}\n${privacy}\n${pricingPage}\n${bundlesPage}\n${pricing}\n${read("../src/pages/contact.astro")}\n${read("../src/pages/policies.astro")}\n${read("../src/pages/services/[slug].astro")}`;
  assert.doesNotMatch(publicLocationCopy, /PostalAddress|streetAddress|addressLocality|postalCode|contact\.address/i);
  assert.doesNotMatch(siteData, /^\s*address\s*:/m);
  assert.match(layout, /areaServed: \{ "@type": "Country", name: "South Africa" \}/);
  assert.match(privacy, /ownerSupplied\.legalEntity/);
  assert.match(terms, /ownerSupplied\.legalEntity/);
  assert.match(footer, /ownerSupplied\.legalEntity/);
  assert.match(footer, /South African law, including POPIA/);
  assert.doesNotMatch(`${privacy}\n${terms}`, /Draft for review|Owner to confirm|placeholder-note|privacy-draft|terms-draft/);
});

test("privacy notice names the live enquiry destination and Zoho routing path", () => {
  assert.match(privacy, /Version 1\.3 · Last updated 28 November 2026/);
  assert.match(siteData, /email: "hello@straightupdigital\.co\.za"/);
  assert.match(privacy, /<strong>Zoho Mail<\/strong>:[\s\S]*?<code>\{contact\.email\}<\/code> through the Zoho Mail API/);
  assert.match(privacy, /Cloudflare\s+Email Routing delivers this address to the verified Zoho mailbox/);
  assert.doesNotMatch(privacy, /straightupdigital@zohomail\.com/);
});

test("footer has a single navigation destination for legal and audit pages", () => {
  const footerNavData = footerNavigation.split("export const footerNav:")[1].split("export const isCurrent")[0];
  for (const [path, label] of [["/privacy", "Privacy"], ["/terms", "Terms"], ["/digital-audit", "Digital audit"]]) {
    assert.equal((footerNavData.match(new RegExp(`href: \"${path}\"`, "g")) ?? []).length, 1, `${label} should be listed once`);
  }
  assert.doesNotMatch(footer, /site-footer__bottom[\s\S]*<ul>/);
  assert.doesNotMatch(footer, /href=\"\/(?:privacy|terms|digital-audit)\"/);
  assert.doesNotMatch(footerNavigation, /downloads\/straight-up-digital-logo-kit\.zip|Brand kit/i);
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
  assert.match(home, /href="\/pricing#hosting-packages"/);
  assert.match(home, /href="\/bundles#bundle-packages"/);
  assert.match(pricingPage, /contact\?plan=\$\{plan\.slug\}&billing=monthly#enquiry/);
  assert.match(pricingPage, /contact\?plan=\$\{plan\.slug\}&billing=annual#enquiry/);
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
  assert.match(bundlesPage, /Buy now\s+opens a no-charge order enquiry; online checkout is not active and no\s+payment is taken here/);
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

test("all named website, hosting, support and bundle plans offer WhatsApp sharing", () => {
  assert.match(planShare, /https:\/\/wa\.me\/\?text=\$\{encodeURIComponent\(shareText\)\}/);
  assert.match(planShare, /new URL\(href, Astro\.site\)/);
  assert.match(planShare, /aria-label=\{`Share \$\{title\} on WhatsApp`\}/);
  assert.match(planShare, /target="_blank"[\s\S]*rel="noopener noreferrer"/);
  assert.equal((pricingPage.match(/<PlanShare\b/g) ?? []).length, 3);
  assert.equal((bundlesPage.match(/<PlanShare\b/g) ?? []).length, 2);
  const serviceDetail = read("../src/pages/services/[slug].astro");
  assert.equal((serviceDetail.match(/<PlanShare\b/g) ?? []).length, 2);
  for (const snippet of [
    "websiteBuildPackages.map((websitePackage) => (",
    "title={websitePackage.title}",
    "hostingPlans.map((plan) => (",
    "title={plan.name}",
    "monthlyRetainers.map((plan) => (",
    "href={`/pricing/#plan-website-${websitePackage.slug}`}",
    "href={`/pricing/#plan-hosting-${plan.slug}`}",
    "href={`/pricing/#plan-support-${plan.level}`}",
  ]) assert.ok(pricingPage.includes(snippet), `pricing page is missing ${snippet}`);
  for (const snippet of [
    "websiteHostingBundles.map((bundle) => (",
    "websiteBuildHostingBundles.map((bundle) => (",
    "href={`/bundles/#plan-bundle-${bundle.slug}`}",
    "href={`/bundles/#bundle-build-${bundle.slug}`}",
  ]) assert.ok(bundlesPage.includes(snippet), `bundles page is missing ${snippet}`);
  assert.match(serviceDetail, /href=\{`\/services\/website-design-and-development\/#package-\$\{websitePackage\.slug\}`\}/);
  assert.match(serviceDetail, /href=\{`\/services\/managed-hosting-and-domains\/#plan-\$\{plan\.slug\}`\}/);
});

test("plan cards no longer display the old decorative logo", () => {
  assert.doesNotMatch(pricingPage, /package-icon|brand\/symbol\.svg/);
  assert.doesNotMatch(bundlesPage, /package-icon|brand\/symbol\.svg/);
  assert.match(layout, /logo-horizontal-dark\.png/);
  assert.match(whatsapp, /src="\/brand\/symbol\.png"/);
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
  assert.match(home, /packageBySlug\("one-page-starter"\)/);
  assert.match(home, /Fixed-scope website packages from/);
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
  assert.match(home, /websiteBuildPackages/);
  assert.match(home, /packageBySlug\("online-shop"\)/);
  assert.match(home, /Compare all six website builds/);
  assert.match(bundlesPage, /Build list price:<\/strong>/);
  assert.match(bundlesPage, /After the included first year:<\/strong>/);
  assert.match(bundlesPage, /first hosting year/);
  assert.match(bundlesPage, /fixed-price website build/);
  assert.doesNotMatch(bundlesPage, /Booking and shop prices are starting prices/);
  assert.doesNotMatch(bundlesPage, /bundle total:<\/strong> From/);
});

test("fixed-price Buy now buttons are clear that checkout is not active", () => {
  const servicePackages = read("../src/pages/services/[slug].astro");
  assert.match(home, /Buy now opens a no-charge order enquiry/);
  assert.match(servicePackages, />Buy now<\/a>/);
  assert.match(bundlesPage, />Buy now<\/a>/);
  assert.match(pricingPage, />Buy now, monthly<\/a>/);
  assert.match(pricingPage, />Buy now, annually<\/a>/);
  assert.match(pricingPage, />Buy now<\/a>/);
  assert.match(servicePackages, /Buy now\s+starts a no-charge order enquiry/);
  assert.match(servicePackages, /Buy now starts a no-charge plan enquiry/);
  assert.match(bundlesPage, /Buy now\s+opens a no-charge order enquiry/);
  assert.match(pricingPage, /Buy now opens a no-charge order enquiry/);
  assert.match(pricing, /For now, Buy now opens a no-charge order enquiry/);
  assert.match(pricing, /Buy now opens a no-charge plan enquiry/);
  assert.match(faqs, /Paystack checkout is not active/i);
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
  assert.match(servicesPage, /href="#digital-presence-audits"/);
  assert.match(servicesPage, /id=\{service\.slug\} class="service-catalog__card"/);
  assert.match(servicesData, /slug: "digital-presence-audits"/);
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

test("specialist website gallery uses local, accessible and truthfully described concept images", () => {
  const serviceDetailPage = read("../src/pages/services/[slug].astro");
  const files = ["website-design.webp", "online-shop.webp", "guest-house.webp", "restaurant.webp", "clinic-practice.webp"];
  for (const file of files) {
    assert.ok(serviceDetailPage.includes(`/images/art-directed/${file}`), `missing gallery asset reference: ${file}`);
    assert.ok(readFileSync(new URL(`../public/images/art-directed/${file}`, import.meta.url)).length > 0, `missing gallery asset: ${file}`);
    assert.ok(imageCredits.includes(file), `missing image provenance entry: ${file}`);
  }
  assert.match(serviceDetailPage, /alt=\{image\.alt\}/);
  assert.match(serviceDetailPage, /loading="lazy"/);
  assert.match(serviceDetailPage, /alt:\s*"[^"]+"/);
  assert.match(imageCredits, /AI-generated for this website/i);
  assert.match(imageCredits, /illustrative concepts, not client work/i);
  assert.match(imageCredits, /not photographs sourced from Unsplash, Pexels/i);
  assert.doesNotMatch(imageCredits, /Photo page:|by \[[^\]]+\]\(https?:\/\//i);
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
  assert.match(whatsapp, /src="\/brand\/symbol\.png"/);
  assert.match(whatsapp, /class="whatsapp-button__badge"/);
  assert.match(styles, /\.whatsapp-button__mark\s*\{[^}]*background:\s*#f5f7f4/is);
  assert.match(styles, /\.whatsapp-button__badge\s*\{[^}]*background:\s*#25d366/is);
  assert.match(styles, /\.whatsapp-menu__panel\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
});

test("mobile floating actions clear the sticky audit bar and preserve touch targets", () => {
  assert.match(styles, /body\.has-sticky-audit \.floating-actions\s*\{\s*bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.whatsapp-button\s*\{[^}]*min-height: 52px[^}]*width: 52px/s);
  assert.match(styles, /\.back-to-top\s*\{[^}]*width: 48px/s);
  assert.match(styles, /\.whatsapp-menu__panel\s*\{[^}]*left: 0/s);
  assert.doesNotMatch(styles.match(/\.whatsapp-menu__panel\s*\{[^}]*\}/s)?.[0] ?? "", /right:\s*0/);
  assert.match(layout, /class="floating-actions" role="group"/);
});

test("back-to-top control has a clear arrow, scrolls to zero and clears a stale anchor", () => {
  assert.match(backToTop, /aria-label="Back to top"/);
  assert.match(backToTop, /class="back-to-top__icon"/);
  assert.match(backToTop, /window\.history\.replaceState/);
  assert.match(backToTop, /window\.location\.pathname/);
  assert.match(backToTop, /window\.location\.search/);
  assert.match(backToTop, /window\.scrollTo\(\{\s*top: 0,/);
  assert.match(styles, /\.back-to-top__icon\s*\{[^}]*width:\s*26px/s);
  assert.match(styles, /\.back-to-top\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
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
  assert.match(home, /images\/art-directed\/africa-network-hero\.webp/);
  assert.doesNotMatch(home, /local-business-digital\.svg/);
  assert.match(networkGlobeIllustration, /<svg/);
});

test("homepage follows the supplied visual sequence without invented portfolio claims", () => {
  for (const phrase of ["Intelligence.", "Visibility.", "Growth.", "Business Auditor", "Illustrative directions", "not client projects or case studies", "Ready to take a clearer next step?"]) {
    assert.ok(home.includes(phrase), `homepage is missing reference-led content: ${phrase}`);
  }
  assert.match(home, /images\/art-directed\/africa-network-hero\.webp/);
  assert.match(home, /home-solution-grid/);
  assert.match(home, /home-auditor-preview__badge/);
  assert.match(home, /request-and-human-review/);
  assert.match(home, /home-trust-strip/);
  assert.match(home, /home-concept-grid/);
});

test("homepage Products section shows priced product families and exact plan destinations", () => {
  for (const phrase of ["Products and plans", "Fixed-price website packages", "Website and business email", "Professional email plans", "Care and support plans"]) {
    assert.ok(home.includes(phrase), `homepage Products section is missing: ${phrase}`);
  }
  assert.match(home, /id="products"/);
  assert.match(home, /href="#products">Explore products and plans/);
  assert.match(home, /homeProductCards\.map/);
  assert.match(home, /websiteBuildPackages\.map/);
  assert.match(home, /websiteHostingBundles, \.\.\.websiteBuildHostingBundles/);
  assert.match(home, /zar\(hostingAnnualFrom\)\} per year, recurring annually/);
  assert.match(home, /50% to start and 50% at launch, after preview/);
  assert.match(home, /Online checkout is not active/);
  for (const href of [
    "/services/website-design-and-development#website-packages",
    "/bundles#bundle-packages",
    "/pricing#hosting-packages",
    "/pricing#support-packages",
  ]) {
    assert.ok(home.includes(href), `homepage product card must link to ${href}`);
  }
  const redesignStyles = read("../src/styles/redesign.css");
  assert.match(redesignStyles, /\.home-product-grid\s*\{[^}]*repeat\(auto-fit/s);
  assert.match(redesignStyles, /\.home-product-card:hover\s*\{[^}]*border-color:[^}]*183,255,0/s);
});

test("mobile hero keeps the Africa globe layered with centered, concise copy", () => {
  const redesignStyles = read("../src/styles/redesign.css");
  const mobileHero = redesignStyles.slice(redesignStyles.lastIndexOf("@media (max-width:960px) {"));
  assert.match(mobileHero, /\.home-hero__visual\s*\{[^}]*position:absolute/s);
  assert.match(mobileHero, /\.home-hero__globe\s*\{[^}]*left:50%/s);
  assert.match(mobileHero, /\.home-hero__visual\s*\{[^}]*justify-self:stretch/s);
  assert.match(mobileHero, /\.home-hero__copy\s*\{[^}]*text-align:center/s);
  assert.match(mobileHero, /\.page-hero__inner\s*\{[^}]*align-items:center/s);
  assert.match(mobileHero, /\.page-hero\s*\{[^}]*background-image:[\s\S]*?africa-network-hero\.webp/s);
  assert.match(mobileHero, /\.page-hero\s*\{[^}]*right -100px center/s);
  assert.match(mobileHero, /right -30px center/);
  assert.match(home, /Website builds, digital support and human-reviewed online audits for South African small businesses\./);
});

test("the intended custom domain is canonical and present in social/business metadata", () => {
  assert.match(astro, /https:\/\/straightupdigital\.co\.za/);
  assert.match(layout, /<link rel="canonical" href=\{canonical\}/);
  assert.match(layout, /property="og:url" content=\{canonical\}/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /areaServed: \{ "@type": "Country", name: "South Africa" \}/);
  assert.doesNotMatch(layout, /PostalAddress|streetAddress|addressLocality|postalCode/i);
  assert.match(robots, /Sitemap:/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/thank-you/);
  assert.match(read("../src/pages/404.astro"), /noindex/);
  assert.match(read("../src/pages/thank-you.astro"), /noindex/);
});

test("Services dropdown routes and section targets resolve", () => {
  const servicesMenu = primaryNav.find((item) => item.label === "Services");
  assert.ok(servicesMenu, "the primary Services menu should exist");
  const children = servicesMenu.children ?? [];
  assert.deepEqual(children.map((item) => item.href), [
    "/services/website-design-and-development#website-packages",
    "/bundles",
    "/pricing#hosting-packages",
    "/digital-audit",
    "/how-it-works",
  ]);

  for (const item of children) {
    const [path, fragment] = item.href.split("#");
    const isServiceRoute = path.startsWith("/services/");
    if (isServiceRoute) {
      assert.ok(services.some((service) => path === `/services/${service.slug}`), `${path} must be generated from the service catalog`);
    }
    const pageSource = isServiceRoute
      ? read("../src/pages/services/[slug].astro")
      : read(path === "/" ? "../src/pages/index.astro" : `../src/pages${path}.astro`);
    if (fragment) assert.ok(pageSource.includes(`id="${fragment}"`), `${item.label} must target a real section ID`);
  }
});

test("public website copy contains no em dashes or HTML em-dash entities", () => {
  const collectTextFiles = (directory) =>
    readdirSync(new URL(directory, import.meta.url), { withFileTypes: true }).flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return collectTextFiles(path);
      return /\.(astro|ts|tsx|html|css|svg|json|txt|md)$/i.test(entry.name) ? [path] : [];
    });
  const siteTextFiles = [...collectTextFiles("../src"), ...collectTextFiles("../public"), ...collectTextFiles("../docs")];
  const emDash = /(?:\u2014|&mdash;|&#0*8212;|&#x0*2014;|\\u2014)/i;

  for (const path of siteTextFiles) {
    assert.doesNotMatch(read(path), emDash, `${path} must use ordinary punctuation instead of an em dash`);
  }
});


test("Paystack readiness copy does not promise recurring Capitec Pay", () => {
  assert.match(paystack, /Capitec Pay.*once-off/);
  assert.match(paystack, /secret.*never be sent to browser code/i);
  assert.match(paystack, /plan codes/i);
});

test("public audit copy describes reviewed reports without promising the disabled online report feature", () => {
  assert.match(faqs, /After review, we share a customer-ready report/);
  assert.doesNotMatch(`${faqs}\n${digitalAudit}`, /private online report|report page|link expires after 30 days/);
  assert.match(faqs, /proudly South African and supports businesses across South Africa online/i);
  assert.match(faqs, /How do I request a hosting plan/);
  assert.match(digitalAudit, /After review, we\s+share a customer-ready report/);
  assert.match(digitalAudit, /Ask a question or arrange a discussion with us/);
});
