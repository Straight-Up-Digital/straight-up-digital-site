# Owner-supplied details

This file is the launch checklist for everything only the owner can provide. Nothing here has been invented or filled with example data. Until an item is supplied, the site either hides it or renders a neutral sentence that is true.

## How placeholders behave

Empty strings in `src/data/site.ts` mean "not supplied". The contact page, footer and legal pages render a short neutral sentence instead of a fake address or phone number. Social links and service areas are hidden entirely while empty. The pricing page shows three empty package slots rather than invented packages. Each affected block also carries a `data-placeholder="..."` attribute so it can be found in the built HTML.

## Launch checklist

| # | Item | Where it appears | What to supply | File or place to edit | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Business email | Contact page, footer, email replies | A monitored inbox, e.g. `hello@straightupdigital.co.za` | `src/data/site.ts` → `contact.email` | Not supplied |
| 2 | Phone number | Contact page, footer | Public number, including country code if used internationally | `src/data/site.ts` → `contact.phone` | Not supplied |
| 3 | Public address | Contact page, footer | Display-ready address, or a decision to publish none | `src/data/site.ts` → `contact.address` | Not supplied |
| 4 | Business hours | Available for future use; not currently rendered | Hours, or "by appointment" | `src/data/site.ts` → `contact.hours` | Not supplied |
| 5 | Legal entity | Privacy notice, terms, footer | Registered name, registration number and registered address | `src/data/site.ts` → `ownerSupplied.legalEntity`, then the legal pages | Not supplied |
| 6 | Information Officer | Privacy notice | Name and direct contact details, as required by POPIA | `src/data/site.ts` → `ownerSupplied.informationOfficer` | Not supplied |
| 7 | Founder profile | About page | Name, short biography and a photograph with permission to publish | `src/data/site.ts` and `src/pages/about.astro` | Placeholder panel |
| 8 | Service areas | Not currently claimed anywhere | Towns, provinces or a radius, only if the owner wants location claims | `src/data/site.ts` → `ownerSupplied.serviceAreas` | Empty on purpose |
| 9 | Social profiles | Footer or header, once real | LinkedIn, Facebook, Instagram or X URLs that the owner controls | `src/data/site.ts` → `socialProfiles` | Hidden |
| 10 | Service statuses | Services page and home service list | Confirm each service as Available, On request or Planned | `src/data/services.ts` → `status` on each service | Conservative defaults |
| 11 | Package names, inclusions and prices | Pricing page | Two to four approved packages, or a decision to sell by quote only | `src/data/pricing.ts` → `packageSlots` and the pricing page | Empty grid |
| 12 | Analytics decision | Every page | Either "no analytics" or an approved privacy-friendly tool and its consent wording | `src/data/site.ts` → `analytics` | Disabled |
| 13 | Domain name | Canonicals, sitemap, Open Graph | The final domain, connected in Netlify | Netlify domain settings, or `PUBLIC_SITE_URL` | Not connected |
| 14 | Form notification inbox | Netlify Forms | The address that should receive each enquiry | Netlify dashboard → Forms → Settings | To set after deploy |
| 15 | Email provider (optional) | Only if `PUBLIC_FORM_MODE=email` | Resend or Postmark account, verified sender and destination inbox | Netlify environment variables | Not selected |
| 16 | Turnstile keys (optional) | Enquiry form | Site key and secret key if the challenge is wanted | Netlify environment variables | Not configured |
| 17 | Data retention period | Privacy notice | How long enquiries, quotes and client records are kept | `src/pages/privacy.astro` | To confirm |
| 18 | Legal review | Privacy notice and terms | A lawyer's review of both drafts, liability wording and governing law | `src/pages/privacy.astro`, `src/pages/terms.astro` | Draft |
| 19 | Testimonials and case studies | Not published | Real quotes or projects, with written permission | New content, not yet built | None, deliberately |
| 20 | CRM connection | Not connected | Phase 2 decision only, after the private CRM has authentication and a narrow intake endpoint | `netlify/lib/crm.mts` (disabled) | Disabled by design |

## Design values awaiting approval

Two supporting colours are proposals, kept in one place at the top of `src/styles/global.css`: silver `#C9CFCB` and muted `#9AA39D`. The approved palette — Obsidian `#080A09`, Graphite `#252B27`, Ivory `#F2F4EF`, Lime `#A8FF65` — is used as supplied.

## What is already final

The six audit categories, the six-step process, the service descriptions, the report structure and the honest-limits wording are written and ready. The audit itself is marked Available because the engine exists. The other five services carry conservative statuses until the owner confirms what can be delivered at launch.
