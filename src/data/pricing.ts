/**
 * Pricing is not approved for publication. No price, package name or discount
 * may be added here until the owner supplies one in writing.
 *
 * Each slot is deliberately empty. The page renders an honest "details to be
 * published" state and marks the grid with data-placeholder="pricing-packages".
 */

export interface PackageSlot {
  id: string;
  /** Left empty on purpose until the owner approves a package name. */
  name: string;
  /** Left empty on purpose until the owner approves a price. */
  price: string;
  /** Left empty on purpose until the owner approves the inclusions. */
  includes: string[];
  status: "owner-to-approve";
}

export const packageSlots: PackageSlot[] = [
  { id: "01", name: "", price: "", includes: [], status: "owner-to-approve" },
  { id: "02", name: "", price: "", includes: [], status: "owner-to-approve" },
  { id: "03", name: "", price: "", includes: [], status: "owner-to-approve" },
];

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
