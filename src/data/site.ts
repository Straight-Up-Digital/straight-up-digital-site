/**
 * Single source of truth for site-wide copy and owner-supplied details.
 *
 * Confirmed public identity and contact information live here so site-wide
 * components stay consistent. Optional profile links and media remain empty
 * until supplied; never replace them with invented values.
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
  email: "hello@straightupdigital.co.za",
  phone: "062 065 3503",
  phoneInternational: "+27 62 065 3503",
  /** Public nationwide position, not a storefront address. */
  locationLabel: "PROUDLY SOUTH AFRICAN",
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
  legalEntity: "St. John Ritchie trading as Straight Up Digital",
  informationOfficer: "St. John Ritchie",
  founderName: "St. John Ritchie",
  founderBio: [
    "A South African business development and sales professional with approximately 20 years of experience in B2B sales, international business development, sales management and team leadership.",
    "Across that work, he has helped businesses identify opportunities, build customer relationships and improve sales performance. He has also trained sales professionals and developed practical prospecting and business-development processes.",
    "He founded Straight Up Digital to make professional digital intelligence and practical growth support more accessible to small and growing South African businesses.",
    "His approach is straightforward: understand what customers see online, show where opportunities may be slipping away, and focus effort on clear, useful improvements.",
  ] as const,
  founderPhoto: "/images/founder-stjohn-ritchie.webp",
  /** Approved public service area. This does not imply a storefront. */
  serviceAreas: ["South Africa"] as const,
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

/** Placeholder keys used only for optional details not yet supplied. */
export const placeholderKeys = {
  email: "business-email",
  phone: "business-phone",
  founder: "founder-profile",
  serviceAreas: "service-areas",
  social: "social-profiles",
  pricing: "pricing-packages",
  analytics: "analytics-choice",
  domain: "domain-name",
} as const;

export const has = (value: string): boolean => value.trim().length > 0;
