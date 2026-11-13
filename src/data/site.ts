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
    "Straight Up Digital audits the digital presence of small and growing businesses, then helps fix what is holding it back. A clear score, honest coverage notes and practical next steps.",
  /** Used as the short line under the logo in the footer. */
  positioning:
    "Practical digital intelligence for small and growing businesses.",
} as const;

/** Owner-supplied contact details. All empty until approved. */
export const contact = {
  email: "",
  phone: "",
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
  founderName: "",
  founderBio: "",
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
