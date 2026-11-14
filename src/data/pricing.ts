/**
 * Public pricing mirrored from the Business Auditor's proposal configuration
 * (`business_auditor.py` defaults and `auditor_config.json`). Keep the figures
 * synchronized when the private proposal configuration changes.
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
    "Basic website scope and hosting limits must be agreed before sale; domain, email, paid plugins, substantial copywriting and major revisions may be extra.",
} as const;

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
