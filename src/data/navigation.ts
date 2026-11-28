export interface NavItem {
  label: string;
  href: string;
  /** Short label used in the footer. */
  shortLabel?: string;
  /** Optional dropdown links shown under this item. */
  children?: NavItem[];
}

export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Services",
    href: "/services",
    children: [
      { label: "Website packages", href: "/services/website-design-and-development#website-packages" },
      { label: "Website and hosting bundles", href: "/bundles" },
      { label: "Hosting plans", href: "/pricing#hosting-packages" },
      { label: "Free business audit", href: "/digital-audit" },
      { label: "How it works", href: "/how-it-works" },
    ],
  },
  { label: "Examples", href: "/#examples" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "Services", href: "/services" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Digital audit", href: "/digital-audit" },
      { label: "Bundles", href: "/bundles" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Pricing", href: "/pricing" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Policies",
    items: [
      { label: "Privacy notice", href: "/privacy", shortLabel: "Privacy" },
      { label: "Terms of use", href: "/terms", shortLabel: "Terms" },
      { label: "Delivery, cancellations and refunds", href: "/policies", shortLabel: "Delivery & refunds" },
    ],
  },
];

export const isCurrent = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};
