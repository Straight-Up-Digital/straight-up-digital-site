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

export interface WebsiteBuildOption {
  title: string;
  summary: string;
  scope: string[];
}

/** Complex build categories are request-only until each project is scoped and quoted. */
export const websiteBuildOptions: WebsiteBuildOption[] = [
  {
    title: "Online shops",
    summary: "Set up a focused catalogue, cart and straightforward delivery rules; payment-provider activation is separate and subject to approval and testing.",
    scope: [
      "Product categories, product details, variants and stock rules",
      "Cart, delivery areas, shipping charges, returns and order emails",
      "Payment-provider selection and sandbox checkout testing; production activation only after separate approval, provider verification and end-to-end testing",
      "Product imports, payment fees and third-party subscriptions are listed separately in the quote",
    ],
  },
  {
    title: "Bookings and appointments",
    summary: "Let customers request or book a time through one compatible booking provider, subject to its features and fees.",
    scope: [
      "Service and staff details, available hours and booking rules",
      "Calendar, confirmation messages, reminders and cancellation flow",
      "Optional deposits or online payments are scoped only after provider approval and end-to-end testing",
      "Calendar, SMS, email and booking-platform fees are checked before the quote is approved",
    ],
  },
  {
    title: "Guest houses and tourism",
    summary: "Show rooms, stays, activities or tours with the practical details visitors need to plan.",
    scope: [
      "Room or experience pages, facilities, location and travel information",
      "Seasonal rates, availability, policies and enquiry or booking links",
      "Mobile-ready galleries and clear links to maps and local attractions",
      "Booking-engine connections and third-party listing fees are scoped separately",
    ],
  },
  {
    title: "Property listings and directories",
    summary: "Help visitors browse listings by area or type and send enquiries to the right person.",
    scope: [
      "Structured listing fields, search filters and enquiry routing",
      "Agent or member profiles and owner-controlled listing updates",
      "Import, moderation and removal rules for listing data",
      "Paid listings, maps, user accounts and large data imports require a separate scope",
    ],
  },
  {
    title: "Clinics and wellness practices",
    summary: "Explain services, practitioners, opening hours and appointment options clearly.",
    scope: [
      "Service pages, practitioner profiles, location and patient-facing instructions",
      "Appointment request or booking-provider integration",
      "Clear accessibility, privacy and contact information",
      "The public website should not collect health details unless secure handling and legal requirements are separately assessed",
    ],
  },
  {
    title: "Restaurants and food businesses",
    summary: "Make menus, opening hours, location and ordering options easy to find on a phone.",
    scope: [
      "Menu sections, prices, dietary and allergen information supplied by the client",
      "Opening hours, location, table enquiries or online-order links",
      "Seasonal menu updates and photo-gallery structure",
      "Ordering, delivery, reservations and point-of-sale integrations are scoped separately",
    ],
  },
  {
    title: "Membership and learning sites",
    summary: "Offer member-only content, courses or resources behind a sign-in area.",
    scope: [
      "Member access levels, sign-up, sign-in and password recovery",
      "Course or resource structure, progress tracking and content updates",
      "Payments, recurring billing, user support and access cancellation rules",
      "Account security, privacy, data migration and platform subscriptions are priced only after discovery",
    ],
  },
];

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
      "A free, human-reviewed six-category scorecard with evidence, confidence notes and a prioritised list of what to fix.",
    forWho:
      "Businesses that suspect their online presence is holding them back, but do not know where to start.",
    value:
      "You stop guessing. The report shows what is strong, what is missing and which fix is worth doing first.",
    receive: [
      "A free six-category scorecard",
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
      "Choose a fixed-scope website package, from a one-page starter to a small online shop. Custom features can be scoped separately.",
    forWho:
      "Businesses with an outdated site, a template that no longer fits, or no site at all.",
    value:
      "A credible first impression, a clear structure and a site that works on the phone your customers actually use.",
    receive: [
      "The pages, buttons, content types and revision rounds listed for the selected package",
      "Fixed prices range from the R1,500 One-Page Starter to the R7,500 Small Online Shop",
      "Client-supplied words, logo and photos for the Five-Page Business package",
      "Standalone builds: 50% to start and 50% at launch after a preview; discounted annual bundles are paid in full and include the first hosting year",
      "Hosting is separate for standalone builds from R129/month",
      "Booking-tool fees paid by the client for the Bookings & Appointments package",
      "Small Online Shop orders by WhatsApp or email; live Paystack checkout is not active and needs successful end-to-end testing and SinJin's confirmation",
    ],
  },
  {
    slug: "managed-hosting-and-domains",
    title: "Hosting and domain registration",
    status: "on-request",
    summary:
      "Three email and hosting tiers from R129/month, each with a managed domain, clear mailbox limits and monthly or annual recurring Plans.",
    forWho:
      "Businesses that want website hosting and domain support from the same digital partner.",
    value:
      "A clear hosting plan, known mailbox allowance and help coordinating the domain behind your website.",
    receive: [
      "Starter Brand, Business Pro and Team Unlimited choices",
      "A .co.za domain included, with .com available on Team Unlimited",
      "Monthly recurring billing or an annual recurring Plan; annual pricing includes the equivalent of two months free",
      "A written order and confirmed payment method after availability is checked",
    ],
    note:
      "Choose a plan to send a request. We confirm availability and the payment schedule in writing before collecting payment or provisioning the service.",
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
    note: "In development. Not offered yet. The audit already reports what public review signals it can verify.",
  },
];

export const serviceOptions = services.map((service) => service.title);
