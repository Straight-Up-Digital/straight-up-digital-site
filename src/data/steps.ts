export interface Step {
  number: string;
  title: string;
  client: string;
  we: string;
  /** Short version used on the home page rail. */
  short: string;
}

export const steps: Step[] = [
  {
    number: "01",
    title: "Tell us about your business",
    client:
      "Share your business name, website and what you want to improve. Two minutes is enough to start.",
    we: "Confirm what the audit covers, what it costs and when you will receive it, in writing, before any work starts.",
    short: "You tell us what the business does and what is not working.",
  },
  {
    number: "02",
    title: "We assess your digital presence",
    client:
      "Nothing beyond what is already public. If something needs access, we ask first.",
    we: "Review your website, Google listing, social profiles, content, public reputation and business identity.",
    short: "We review what customers and search engines can actually see.",
  },
  {
    number: "03",
    title: "We identify strengths, weaknesses and opportunities",
    client: "Nothing at this stage.",
    we: "Score each category we can verify, and record what we could not verify instead of guessing.",
    short: "We score what can be verified and flag what cannot.",
  },
  {
    number: "04",
    title: "You receive a clear report and recommendations",
    client: "Read a plain-language report at your own pace.",
    we: "Explain the score, the coverage and the confidence behind it, then walk you through the priorities.",
    short: "You get a plain report with the next actions in order.",
  },
  {
    number: "05",
    title: "We help you implement improvements",
    client: "Choose what to fix first and who does the work.",
    we: "Implement the fixes, or guide your team and suppliers through them.",
    short: "We do the work, or guide the people who do.",
  },
  {
    number: "06",
    title: "We continue supporting your growth",
    client: "Decide whether ongoing support is useful.",
    we: "Maintain, monitor and improve the presence as the business changes.",
    short: "Support continues only if it earns its place.",
  },
];
