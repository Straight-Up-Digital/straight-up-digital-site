export interface Faq {
  question: string;
  answer: string;
}

export const auditFaqs: Faq[] = [
  {
    question: "What does the audit actually look at?",
    answer:
      "Six categories: website structure, Google Business Profile, social profiles, content coverage, reputation and business identity. It uses public information only — the pages anyone can open, the listings anyone can search and the profiles anyone can find.",
  },
  {
    question: "What does it not measure?",
    answer:
      "It does not measure traffic, search volume, revenue or conversions, and it does not guarantee rankings. It cannot see your analytics or sales data. The report states these limits rather than implying otherwise.",
  },
  {
    question: "Why is a category sometimes marked Not verified?",
    answer:
      "Sometimes there is not enough public information to score a category honestly — for example, no public profile can be confidently matched to the business. That category is left out of the overall score instead of being counted as zero. The report shows coverage, so you can see what the score is based on.",
  },
  {
    question: "What do I receive?",
    answer:
      "A written report with the overall score, a score for each verified category, coverage and confidence notes, a prioritised list of recommendations and practical next steps. We then talk through the findings and answer questions.",
  },
  {
    question: "How long does an audit take?",
    answer:
      "It depends on the size of the site and how quickly the public profiles can be checked. We confirm the timing in writing before any work starts, so you are not left guessing.",
  },
  {
    question: "Do you guarantee better rankings?",
    answer:
      "No. Search results change with location, device, competition and the search engine's own decisions. We can improve the things customers and search engines look for, but nobody can honestly guarantee a position.",
  },
  {
    question: "Can you audit a business with no website?",
    answer:
      "Yes. A missing website, an incomplete listing or an empty profile is a finding, not a reason to skip the audit. The report will show what exists and what needs to be built first.",
  },
  {
    question: "What happens after I send the request?",
    answer:
      "A person reads it, checks that the business and website details match what is public, and comes back with the next step. If work is involved, you receive a written scope, cost and timing before anything starts.",
  },
];

export const pricingFaqs: Faq[] = [
  {
    question: "How are these prices determined?",
    answer:
      "The published rates mirror the existing Business Auditor proposal configuration. The audit proposal uses R40 per missing point out of 100; website builds, editing rates and the five monthly retainers are shown on this page. The written proposal confirms the exact scope and deliverables before work begins.",
  },
  {
    question: "How do I get a quote?",
    answer:
      "Send an enquiry with the website address and what you want to improve. We ask the questions we need, then send one written quote with the deliverables, the cost and the timing.",
  },
  {
    question: "Is the audit included in a project?",
    answer:
      "The audit is quoted as its own piece of work unless a written proposal says otherwise. If you go ahead with implementation, the proposal will show exactly what is included and what is not.",
  },
  {
    question: "What if I only need one fix?",
    answer:
      "That is a valid scope. One page, one listing or one report can be quoted on its own. You do not have to buy a package to get a straight answer.",
  },
  {
    question: "Do you work outside South Africa?",
    answer:
      "The site is written for South African businesses and South African search behaviour. Service areas are not published yet, so ask before assuming cover in your area. We will tell you honestly if we are not the right fit.",
  },
  {
    question: "What is not included?",
    answer:
      "Paid advertising, ongoing ad spend, third-party software licences and work by other suppliers are not included unless a written quote says so. We will name anything that sits outside the scope before you commit.",
  },
];
