/**
 * Single source of truth for site-wide copy and owner-supplied details.
 *
 * Nothing in this file should be invented. Empty strings mean "not supplied
 * yet": the UI renders a neutral, clearly non-fictional placeholder and
 * PLACEHOLDERS.md records what the owner must supply. Do not fill these in
 * with example values.
 */

export const site = {
  name: "Straight Up Digital",
  shortName: "Straight Up",
  tagline: "Intelligence. Visibility. Growth.",
  description:
    "Business Auditor is Straight Up Digital's flagship digital intelligence product. Visitors can request a human-reviewed six-category digital presence audit; this website does not run automated live audits.",
  /** Used as the short line under the logo in the footer. */
  positioning:
    "Practical digital intelligence for small and growing businesses.",
} as const;

/** Owner-supplied public contact details. */
export const contact = {
  email: "Hello@straightupdigital.co.za",
  phone: "062 065 3503",
  phoneInternational: "+27 62 065 3503",
  /** Display-ready address, e.g. "1 Example Street, Cape Town". */
  address: "",
  /** Business hours, free text. */
  hours: "",
} as const;

/** Social profiles are hidden until the owner supplies real links. */
export const socialProfiles = {
  linkedin: "",
  facebook: "",
  instagram: "",
  x: "",
} as const;

/** Details that only the owner can provide. */
export const ownerSupplied = {
  legalEntity: "",
  informationOfficer: "",
  founderName: "St. John Ritchie",
  founderBio: [
    "St. John Ritchie is a South African business development and sales professional with approximately 20 years of experience helping businesses identify opportunities, build relationships and achieve commercial growth.",
    "His career spans business-to-business sales, international business development, sales management, team leadership, prospecting and customer acquisition. Throughout his career, he has worked with businesses across different industries, developing a practical understanding of what drives sales performance, customer relationships and sustainable business growth.",
    "Having managed sales teams, trained sales professionals and developed business development processes, St. John brings a commercially focused approach to Straight Up Digital.",
    "He established Straight Up Digital with a clear objective: to make professional digital intelligence and business growth services more accessible to businesses that want to compete, improve their visibility and attract more customers.",
    "His philosophy is straightforward. Businesses should understand how they are performing online, where they are losing opportunities and what practical steps they can take to improve.",
    "Through a combination of technology, intelligent analysis and personalised business services, Straight Up Digital aims to help businesses turn their digital presence into a stronger commercial asset.",
  ] as const,
  founderPhoto: "",
  /** Approved service areas. Empty means no location claims are made. */
  serviceAreas: [] as string[],
} as const;

/**
 * Set to true only after the owner approves a privacy-friendly analytics tool
 * and the cookie notice. The tag is never loaded while this is false.
 */
export const analytics = {
  enabled: false,
  provider: "",
  scriptSrc: "",
} as const;

/** Placeholder keys, used for data attributes and the PLACEHOLDERS checklist. */
export const placeholderKeys = {
  email: "business-email",
  phone: "business-phone",
  address: "public-address",
  legalEntity: "legal-entity",
  informationOfficer: "information-officer",
  founder: "founder-profile",
  serviceAreas: "service-areas",
  social: "social-profiles",
  pricing: "pricing-packages",
  analytics: "analytics-choice",
  domain: "domain-name",
} as const;

export const has = (value: string): boolean => value.trim().length > 0;
