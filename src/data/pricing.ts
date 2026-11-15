/**
 * Public pricing combines Auditor proposal rates with separate owner-approved
 * reseller-hosting and domain prices. Keep the two sources distinct.
 */

export const auditPricing = {
  maximumScore: 100,
  pricePerMissingPointZar: 40,
} as const;

export const websiteOffer = {
  buildOnceOffZar: 1500,
  hostingMonthlyZar: 99,
  maximumPages: 5,
  guardrail:
    "Website builds are scoped separately. Hosting plans list their storage and mailbox allowances; domain registration and renewal, extras above plan limits, paid plugins, substantial copywriting and major revisions are additional unless a written quote says otherwise.",
} as const;

export interface HostingPlan {
  name: string;
  price: string;
  summary: string;
  includes: string[];
}

export const hostingPlans: HostingPlan[] = [
  {
    name: "Email & Starter Site",
    price: "R99",
    summary: "A practical starting point for a small business website.",
    includes: ["2 GB NVMe storage", "Up to 5 email accounts"],
  },
  {
    name: "Business Growth",
    price: "R149",
    summary: "More room for a growing website and team.",
    includes: ["5 GB NVMe storage", "Up to 15 email accounts"],
  },
  {
    name: "Managed Care",
    price: "R399–R599",
    summary: "Hosting with a recurring website-care allowance.",
    includes: [
      "10 GB NVMe storage",
      "Monthly website updates",
      "Monthly backups",
      "Final price based on agreed update and support scope",
    ],
  },
];

export const domainOffer = {
  coZaPrice: "R149–R169",
  billing: "per year",
  note: "Final price and annual renewal terms depend on the domain extension and registrar and are confirmed before registration.",
} as const;

export const hostingBillingNotice =
  "FOSSBilling with Paystack is the planned billing and checkout route. Online payment and automated provisioning are not live yet; request a quote for now.";

export interface MonthlyRetainer {
  name: string;
  priceZarPerMonth: number;
  includes: string[];
}

export const monthlyRetainers: MonthlyRetainer[] = [
  {
    name: "Fresh Start",
    priceZarPerMonth: 200,
    includes: [
      "One monthly content idea",
      "Monthly listing and contact-detail check",
      "Short progress note",
    ],
  },
  {
    name: "Steady Presence",
    priceZarPerMonth: 400,
    includes: [
      "Two social/content ideas each month",
      "One profile or review-response check",
      "Monthly action list",
    ],
  },
  {
    name: "Local Growth",
    priceZarPerMonth: 700,
    includes: [
      "One short website update or FAQ each month",
      "Two social post drafts",
      "Local profile and review check",
      "Monthly progress note",
    ],
  },
  {
    name: "Content Partner",
    priceZarPerMonth: 1000,
    includes: [
      "Two website content updates or one article brief each month",
      "Four social post drafts",
      "Monthly SEO and profile check",
      "Monthly priorities call or written review",
    ],
  },
  {
    name: "Digital Partner",
    priceZarPerMonth: 1500,
    includes: [
      "Four agreed content updates or briefs each month",
      "Weekly social content prompts",
      "Monthly website, local-profile and review checks",
      "Monthly performance and next-step report",
    ],
  },
];

export const onceOffEdits: { title: string; priceZar: number }[] = [
  { title: "Small text change", priceZar: 150 },
  { title: "Photo swap", priceZar: 150 },
  { title: "Additional form", priceZar: 350 },
  { title: "New page", priceZar: 650 },
];

export const hourlyPricing = {
  rateZar: 650,
  minimumEstimateHours: 2,
} as const;

export const costFactors: { title: string; body: string }[] = [
  {
    title: "The size of the site",
    body: "Five pages and fifty pages are different jobs. The page count, templates and amount of existing content set the base.",
  },
  {
    title: "The condition of what is there",
    body: "A clean build with good content is quicker to improve than a broken site with duplicated pages and missing information.",
  },
  {
    title: "How much writing is needed",
    body: "If the words already exist, the work is structure and editing. If they do not, research and writing are part of the scope.",
  },
  {
    title: "How competitive the search results are",
    body: "Local search work depends on how many other businesses are competing for the same searches in the same area.",
  },
  {
    title: "How much you want us to do",
    body: "Some clients want the work done for them. Others want a plan and guidance for their own team. The scope follows that choice.",
  },
  {
    title: "Timing and urgency",
    body: "A normal schedule costs less than a compressed one. If something is time-critical, say so and it will be reflected in the quote.",
  },
];

export const pricingPrinciples: { title: string; body: string }[] = [
  {
    title: "Scope first",
    body: "We agree what is included, what is not, and what done looks like before any invoice exists.",
  },
  {
    title: "One written quote",
    body: "You receive the price, the deliverables and the timing in one document. No verbal estimates that change later.",
  },
  {
    title: "No surprise extras",
    body: "If the scope needs to change, we stop, explain why and agree the difference with you first.",
  },
];
