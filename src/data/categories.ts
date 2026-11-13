/**
 * The six categories the audit engine scores.
 *
 * `example` values exist only for the clearly labelled example report and the
 * Digital Intelligence Core. They are made-up demo values, never client data.
 */

export interface AuditCategory {
  id: string;
  name: string;
  /** The plain-language question the category answers. */
  question: string;
  summary: string;
  checks: string[];
  /** Demo value, 0-100. Null means the example is not verified. */
  example: number | null;
  /** Why the example category could not be verified, when null. */
  exampleNote?: string;
}

export const categories: AuditCategory[] = [
  {
    id: "website-structure",
    name: "Website structure",
    question: "Can people and search engines understand the site?",
    summary:
      "How the pages are organised, how clearly they are written, and whether the technical basics are in place.",
    checks: [
      "Page titles, headings and meta descriptions",
      "Internal links and navigation",
      "Mobile viewport and layout basics",
      "Robots, sitemap and canonical signals",
      "Clear contact and enquiry routes",
    ],
    example: 74,
  },
  {
    id: "google-business-profile",
    name: "Google Business Profile",
    question: "Does the listing match the business behind it?",
    summary:
      "The public listing customers see in Maps and Search: whether it exists, how complete it is, and whether the details agree with the website.",
    checks: [
      "Listing presence and claimed status",
      "Business name, category and service consistency",
      "Hours, phone number and website link",
      "Photos and description completeness",
      "Review presence and owner responses",
    ],
    example: 61,
  },
  {
    id: "social-profiles",
    name: "Social profiles",
    question: "Are the profiles findable, current and linked?",
    summary:
      "Whether the business has a consistent social presence, and whether those profiles point people back to a working website.",
    checks: [
      "Profile presence on the main platforms",
      "Name, handle and description consistency",
      "Links from the website and back again",
      "Recent activity",
    ],
    example: null,
    exampleNote:
      "No public profile could be confidently matched to this example business.",
  },
  {
    id: "content-coverage",
    name: "Content coverage",
    question: "Does the site answer the questions customers ask?",
    summary:
      "Whether the pages explain what the business sells, who it serves, where it works and how to get started.",
    checks: [
      "Service and product pages",
      "Location and contact information",
      "Answers to common questions",
      "Depth and freshness of the main pages",
      "Missing topics a customer would expect",
    ],
    example: 58,
  },
  {
    id: "reputation",
    name: "Reputation",
    question: "What public trust signals exist?",
    summary:
      "The public reviews, ratings and directory mentions that shape a first impression, and whether the business responds to them.",
    checks: [
      "Public reviews and ratings",
      "Owner responses",
      "Directory and citation consistency",
      "Obvious gaps or contradictions",
    ],
    example: null,
    exampleNote:
      "Not enough public review data was available to score this category.",
  },
  {
    id: "business-identity",
    name: "Business identity",
    question: "Is it clear who you are and how to reach you?",
    summary:
      "The details that let a customer trust the business: a consistent name, address and phone number, clear ownership and real contact routes.",
    checks: [
      "Business name, address and phone consistency",
      "Legal and trading details where published",
      "Structured data and trust pages",
      "Working contact routes",
    ],
    example: 79,
  },
];

export const exampleScore = (() => {
  const scored = categories.filter((c) => c.example !== null);
  const total = scored.reduce((sum, c) => sum + (c.example ?? 0), 0);
  return Math.round(total / scored.length);
})();

export const exampleCoverage = {
  verified: categories.filter((c) => c.example !== null).length,
  total: categories.length,
  confidence: "Medium" as const,
};

export const notVerifiedDefinition =
  "Not verified means the audit could not confirm enough public information to score the category honestly. It is left out of the overall score rather than counted as zero.";
