/**
 * The service catalog. Change `status` to move a service between Available,
 * On request and Planned. That single field drives every label on the site.
 *
 * The status field drives every public label. Services marked on request are
 * manually scoped and confirmed before the owner accepts an order.
 */

export type ServiceStatus = "available" | "on-request" | "planned";

export interface Service {
  slug: string;
  title: string;
  status: ServiceStatus;
  summary: string;
  /** Who the service is for, in the customer's words. */
  forWho: string;
  /** The business value. Never a guarantee. */
  value: string;
  /** What the client actually receives. */
  receive: string[];
  /** Optional short note, e.g. for a planned service. */
  note?: string;
}

export const serviceStatusMeta: Record<
  ServiceStatus,
  { label: string; description: string }
> = {
  available: {
    label: "Available",
    description: "Offered now and scoped in a written proposal.",
  },
  "on-request": {
    label: "On request",
    description: "Scoped and quoted for each project.",
  },
  planned: {
    label: "Planned",
    description: "In development. Not offered yet.",
  },
};

export const services: Service[] = [
  {
    slug: "digital-presence-audits",
    title: "Digital presence audits",
    status: "available",
    summary:
      "A structured read of your website, listings, profiles, content and reputation, with a prioritised list of what to fix.",
    forWho:
      "Businesses that suspect their online presence is holding them back, but do not know where to start.",
    value:
      "You stop guessing. The report shows what is strong, what is missing and which fix is worth doing first.",
    receive: [
      "A scored report across six categories",
      "Coverage and confidence notes for every category",
      "Prioritised recommendations with practical next steps",
      "A walkthrough conversation about the findings",
    ],
  },
  {
    slug: "website-design-and-development",
    title: "Website design and development",
    status: "on-request",
    summary:
      "Fast, accessible websites built around one job: helping the right customer take the next step.",
    forWho:
      "Businesses with an outdated site, a template that no longer fits, or no site at all.",
    value:
      "A credible first impression, a clear structure and a site that works on the phone your customers actually use.",
    receive: [
      "Page plan and content structure",
      "Design and build",
      "Mobile, accessibility and performance checks",
      "Handover with editing guidance",
    ],
  },
  {
    slug: "managed-hosting-and-domains",
    title: "Hosting and domain registration",
    status: "on-request",
    summary:
      "Reseller hosting with stated storage and email allowances, plus domain registration and renewal as a separate add-on.",
    forWho:
      "Businesses that want website hosting and domain support from the same digital partner.",
    value:
      "A clear hosting plan, known mailbox allowance and help coordinating the domain behind your website.",
    receive: [
      "A hosting tier with its storage and email allowance stated up front",
      "Domain registration and renewal quoted separately by extension",
      "Monthly website updates and backups only with the Managed Care tier",
      "A written confirmation of availability, payment terms and service start date before an order",
    ],
    note:
      "Select a plan to send a request. The owner confirms availability, recurring payment terms, any domain charges and the start date before accepting an order.",
  },
  {
    slug: "website-improvements-and-on-page-seo",
    title: "Website improvements and on-page SEO",
    status: "on-request",
    summary:
      "Targeted fixes to the pages you already have: structure, copy, metadata, internal links and page speed.",
    forWho:
      "Businesses with a site that gets visitors but few enquiries, or pages that never show up in search.",
    value:
      "More value from the pages you already paid for, without starting over.",
    receive: [
      "Page-by-page review",
      "Title, heading and metadata fixes",
      "Internal linking and content improvements",
      "A short before-and-after summary",
    ],
  },
  {
    slug: "google-business-profile-support",
    title: "Google Business Profile support",
    status: "on-request",
    summary:
      "Set up, clean up and maintain the Google listing customers see before they ever reach your website.",
    forWho:
      "Local businesses that are hard to find in Maps, or whose listing has the wrong hours, categories or contact details.",
    value:
      "A listing that matches the business behind it, so customers find the right details on the first try.",
    receive: [
      "Profile review and corrections",
      "Category, service and hours setup",
      "Photo and description guidance",
      "A simple maintenance checklist",
    ],
  },
  {
    slug: "content-and-social-media-support",
    title: "Content and social media support",
    status: "on-request",
    summary:
      "Plain-language content that answers customer questions, plus a social rhythm you can keep up.",
    forWho:
      "Businesses that post occasionally, repeat themselves, or have a website that does not answer basic questions.",
    value:
      "A consistent presence that builds trust between one enquiry and the next.",
    receive: [
      "Content plan and topics",
      "Website and profile copy",
      "Post templates and a simple calendar",
      "Guidance on what is worth measuring",
    ],
  },
  {
    slug: "online-reputation-and-review-checks",
    title: "Online reputation and review checks",
    status: "planned",
    summary:
      "A review of the public signals customers check before they contact you, and a practical way to improve them.",
    forWho:
      "Businesses that are unsure what reviews, directories and public profiles say about them.",
    value:
      "A clearer picture of the trust signals around your business, and a process for improving them.",
    receive: [
      "Review and directory audit",
      "Response templates",
      "A review request process",
      "Guidance on handling criticism",
    ],
    note: "In development. Not offered yet — the audit already reports what public review signals it can verify.",
  },
];

export const serviceOptions = services.map((service) => service.title);
