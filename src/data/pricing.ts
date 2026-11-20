/**
 * Public pricing combines Auditor proposal rates with separate owner-approved
 * reseller-hosting and domain prices. Keep the two sources distinct.
 */

export const auditPricing = {
  maximumScore: 100,
  auditPriceZar: 0,
  pricePerMissingPointZar: 40,
} as const;

export const websiteOffer = {
  buildOnceOffZar: 1500,
  hostingMonthlyZar: 129,
  maximumPages: 5,
  guardrail:
    "Website builds are once-off. A hosting plan is required from R129/month; the selected plan includes its stated domain, mailboxes and storage. Online payment is arranged after you approve the written order.",
} as const;

export interface HostingPlan {
  slug: "starter-brand" | "business-pro" | "team-unlimited";
  name: string;
  priceMonthlyZar: number;
  priceAnnualZar: number;
  headline: string;
  bestFor: string;
  whatYouGet: string[];
  technicalFeatures: string[];
  featured?: boolean;
}

export const hostingPlans: HostingPlan[] = [
  {
    slug: "starter-brand",
    name: "Starter Brand",
    priceMonthlyZar: 129,
    priceAnnualZar: 1290,
    headline: "Look professional from day one with your own custom business email.",
    bestFor: "Freelancers, sole proprietors and side hustles upgrading from a free email address.",
    whatYouGet: [
      "A registered and managed .co.za domain",
      "2 custom mailboxes for addresses such as info@ and yourname@",
      "2 GB shared mail storage for quotes, invoices and client messages",
      "Access from webmail, a phone or desktop mail apps",
    ],
    technicalFeatures: [
      "Browser-based webmail",
      "IMAP/POP3 and SMTP sync",
      "Spam and virus filtering",
      "Autoresponders, out-of-office replies, forwarders and aliases",
      "SSL encryption and a step-by-step self-setup guide",
    ],
  },
  {
    slug: "business-pro",
    name: "Business Pro",
    priceMonthlyZar: 249,
    priceAnnualZar: 2490,
    headline: "Reliable, secure company email built for growing South African teams.",
    bestFor: "Small businesses, contractors and local teams with 3–10 staff members.",
    whatYouGet: [
      "A .co.za domain with annual registration and renewal managed for you",
      "Up to 10 custom mailboxes for your team and departments",
      "10 GB shared mail storage for client threads, contracts and attachments",
      "Done-for-you domain authentication setup",
      "Priority local WhatsApp and email support",
    ],
    technicalFeatures: [
      "Everything in Starter Brand",
      "SPF, DKIM and DMARC anti-spoofing setup",
      "Automated daily cloud backups and email restore support",
      "Delivery tracking and bounce logs",
      "Shared aliases such as team@ that can route to multiple staff",
    ],
    featured: true,
  },
  {
    slug: "team-unlimited",
    name: "Team Unlimited",
    priceMonthlyZar: 449,
    priceAnnualZar: 4490,
    headline: "Unlimited mailboxes, generous storage and hands-on onboarding for your team.",
    bestFor: "Agencies, clinics, real-estate offices and established firms.",
    whatYouGet: [
      "Your choice of a .co.za or .com domain",
      "Unlimited custom mailboxes and domain aliases",
      "25 GB high-capacity shared mail storage",
      "Remote setup assistance for staff phones and computers",
      "Dedicated account management and same-day support response",
    ],
    technicalFeatures: [
      "Everything in Business Pro",
      "Priority server-resource allocation",
      "JetBackup restore points",
      "Hands-on onboarding to Outlook and mobile mail apps",
    ],
  },
];

export const domainOffer = {
  additionalExtensionsFromZar: 149,
  billing: "per year",
  note: "Extra extensions such as .com, .africa or .org.za are quoted by extension before registration.",
} as const;

export const hostingBillingNotice =
  "Choose monthly billing or pay annually up front and get two months free. A plan request does not charge you; we confirm availability, inclusions and start date in writing, then send the secure online payment option you approve.";

export interface MonthlyRetainer {
  level: number;
  name: string;
  priceZarPerMonth: number;
  headline: string;
  bestFor: string;
  includedHosting: string;
  whatYouGet: string[];
  deliverables: string[];
  featured?: boolean;
}

export const monthlyRetainers: MonthlyRetainer[] = [
  {
    level: 1,
    name: "Basic Care",
    priceZarPerMonth: 249,
    headline: "Keep your website online, backed up and up to date without lifting a finger.",
    bestFor: "Solo tradespeople who want their website and domain looked after.",
    includedHosting: "Starter Brand hosting, normally R129/month",
    whatYouGet: [
      "Worry-free hosting, .co.za domain management and security checks",
      "A quick monthly text or photo update on request",
    ],
    deliverables: [
      "1 .co.za domain, 2 mailboxes and 2 GB shared storage",
      "Monthly off-site backups and uptime monitoring",
      "1 minor text or photo update each month",
    ],
  },
  {
    level: 2,
    name: "Local Visibility",
    priceZarPerMonth: 449,
    headline: "Stay active on Google so local customers can choose you with confidence.",
    bestFor: "Salons, mechanics, cafés and local shops that rely on Google Maps and local search.",
    includedHosting: "Starter Brand hosting, normally R129/month",
    whatYouGet: [
      "Fresh Google Business Profile updates and photos through the month",
      "Review monitoring so you do not miss new customer feedback",
    ],
    deliverables: [
      "Everything in Basic Care",
      "2 Google Business Profile posts or photo updates each month",
      "Seasonal hours and holiday schedule updates",
      "Monthly review monitoring and alert summary",
    ],
  },
  {
    level: 3,
    name: "Active Growth",
    priceZarPerMonth: 699,
    headline: "Answer real customer questions and reach nearby Eastern Cape towns every month.",
    bestFor: "Guest houses, B&Bs, contractors and growing service businesses.",
    includedHosting: "Business Pro hosting, normally R249/month",
    whatYouGet: [
      "Upgraded team email with up to 10 mailboxes and 10 GB storage",
      "A useful service page or FAQ shaped around what customers search for",
    ],
    deliverables: [
      "Everything in Local Visibility",
      "1 local FAQ or service article each month",
      "Up to 3 website content or gallery updates each month",
      ".co.za domain plus SPF, DKIM and DMARC setup",
    ],
    featured: true,
  },
  {
    level: 4,
    name: "Lead Builder",
    priceZarPerMonth: 1049,
    headline: "Build a steady weekly presence and catch new gaps before they cost you leads.",
    bestFor: "Estate agents, clinics and established service companies in competitive categories.",
    includedHosting: "Business Pro hosting, normally R249/month",
    whatYouGet: [
      "Weekly Google Business Profile updates to keep your listing current",
      "A fresh digital presence score check every quarter",
    ],
    deliverables: [
      "Everything in Active Growth",
      "Weekly Google Business Profile updates and photo refreshes",
      "Quarterly re-score with practical fix recommendations",
    ],
  },
  {
    level: 5,
    name: "Full Digital Desk",
    priceZarPerMonth: 1549,
    headline: "Your outsourced digital department, with priority edits and reputation care.",
    bestFor: "Multi-branch businesses, tourism operators and busy owners who want a team behind them.",
    includedHosting: "Team Unlimited hosting, normally R449/month",
    whatYouGet: [
      "Unlimited mailboxes, 25 GB storage and remote staff-device setup",
      "Priority same-business-day website edits and seasonal promo banners",
      "A steady social rhythm and public reputation checks",
    ],
    deliverables: [
      "Everything in Lead Builder",
      "Ongoing social rhythm and public reputation checks",
      "Monthly plain-language summary of completed work and next steps",
    ],
  },
];

export const auditFixPackage = {
  name: "Audit Fix Package",
  pricePerMissingPointZar: 40,
  description:
    "Pay only for gaps tied to your free audit score. The quote is based on the verified missing points and agreed fix scope.",
  deliverables: [
    "Resolution of technical and listing gaps identified in the audit",
    "On-page title, heading and metadata cleanup",
    "Google Business Profile contact, category and service-area alignment",
    "A before-and-after six-category re-score",
  ],
} as const;

export const websiteBuildDeliverables = [
  "Up to 5 custom pages: Home, Services, About, Gallery/Reviews and Contact",
  "Click-to-WhatsApp, click-to-call and a direct enquiry form",
  "Google Maps embed, indexing and local town-focused page titles and headings",
  "POPIA-friendly Privacy Notice and Terms of Use pages",
  "1 structured revision round before launch",
  "Excludes online stores and custom booking engines",
] as const;

export const hostingAddOns: { name: string; price: string; billing: string }[] = [
  { name: "Email migration", price: "R450", billing: "once-off" },
  { name: "Extra 10 GB storage", price: "R60", billing: "per month" },
  { name: "Additional domain extensions", price: "From R149", billing: "per year" },
];

export const onceOffEdits: { slug: string; title: string; priceZar: number }[] = [
  { slug: "quick-update", title: "Quick text, price or hours update", priceZar: 150 },
  { slug: "gallery-refresh", title: "Photo and gallery refresh", priceZar: 200 },
  { slug: "service-page", title: "New service page or promo banner", priceZar: 350 },
  { slug: "gbp-cleanup", title: "Google Business Profile claim and cleanup", priceZar: 450 },
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
