export interface NavItem {
  label: string;
  href: string;
  /** Short label used in the footer. */
  shortLabel?: string;
}

export const primaryNav: NavItem[] = [
  { label: "Services", href: "/services" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Digital audit", href: "/digital-audit" },
  { label: "Pricing", href: "/pricing" },
  { label: "Bundles", href: "/bundles" },
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
    title: "Legal",
    items: [
      { label: "Privacy notice", href: "/privacy", shortLabel: "Privacy" },
      { label: "Terms of use", href: "/terms", shortLabel: "Terms" },
    ],
  },
];

export const isCurrent = (pathname: string, href: string): boolean => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};
