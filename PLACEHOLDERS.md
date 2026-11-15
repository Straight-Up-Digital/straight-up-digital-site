# Owner-confirmed details and launch checklist

This checklist separates owner-confirmed public information from operational steps that still need to happen. Public copy uses only the locality supplied by the owner and does not invent a street address or company registration.

## Confirmed and reflected on the site

| Item | Published information or behavior |
| --- | --- |
| Business identity | St. John Ritchie trading as Straight Up Digital; described as a sole proprietor, not as a registered company. |
| Public locality | Port Alfred, Eastern Cape, South Africa. No street address is published. |
| Contact | `Hello@straightupdigital.co.za` and `+27 62 065 3503`. |
| Policies | Owner says the policies have been checked. Privacy notice and terms now show the supplied name/locality and no draft or owner-confirmation banners. The privacy contact is St. John Ritchie. |
| Audit limitations | Footer and terms say audits are human-reviewed assessments of public information and do not promise ranking, traffic or financial outcomes. The full scorecard and CRM remain private. |
| Netlify Forms | `straightupdigital@zohomail.com` receives notifications for all forms; synthetic contact and audit requests were both received in Zoho on 15 November 2026. |
| Hosting tiers | Email & Starter Site R99/month (2 GB, up to 5 mailboxes); Business Growth R149/month (5 GB, up to 15 mailboxes); Managed Care R399–R599/month (10 GB, monthly website updates and backups). Plan CTAs send a request with the chosen tier selected. |
| Domain pricing | Indicative .co.za registration/renewal range R149–R169 per year, subject to registrar and extension confirmation; domain charges are separate from hosting. |
| Payment copy | The site takes a plan request; owner confirms availability, recurring terms, payment method and start date before any payment or provisioning. |
| SEO origin | Canonical URLs, sitemap, social URLs and organization data use `https://straightupdigital.co.za/` in advance of DNS cutover. |
| Online audit reports | Owner manually runs the private audit, reviews the client-safe translation, and publishes only after confirmation. Links are private, no-index and expire after 30 days. Synthetic production rendering and response-email checks passed on 15 November 2026. |

## Still to do before the full launch

| Item | Current status | Action |
| --- | --- | --- |
| Custom domain and DNS | The requested custom domain is the canonical metadata origin, but public DNS lookups for the apex and `www` returned NXDOMAIN on 14 November 2026. The Netlify hostname remains reachable. | Confirm domain registration; set and verify DNS at the registrar; then attach the domain and HTTPS in Netlify. Do not change mail records without checking Zoho's current DNS requirements. |
| Hosting and domain reseller operations | Retail prices are approved, but the upstream host/registrar account, wholesale charges, limits, renewal/transfer rules, support responsibilities and backup/restore terms still need operational confirmation. | Confirm reseller terms and margin; check each advertised allowance against the actual upstream package; document cancellation, renewal, backup and restore steps before taking orders. |
| Paystack onboarding and integration | Checkout is not open. Paystack account activation/KYC, production credentials, plan codes and verified recurring method are not configured. The request flow is manual in the meantime. | Finish Paystack onboarding and test mode. Confirm supported recurring payment options and create monthly plan codes before implementing/activating checkout. Store secrets only in Netlify settings. Paystack's South African Capitec Pay option is once-off only; do not offer it for monthly recurring charges. See [`docs/paystack-setup.md`](docs/paystack-setup.md). |
| Enquiry and client-record handling | The privacy notice says records are kept only as needed and deleted/anonymised when no longer required; the 30-day online-report expiry is automated. Enquiry emails/forms can remain in provider systems. | Apply a practical retention/deletion routine to Netlify submissions, email and client records, subject to any records that must legally be retained. |
| Privacy contact/regulatory administration | St. John Ritchie is published as the privacy contact; no formal Information Officer registration status is claimed in public copy. | Confirm any appointment or registration obligations directly with the Information Regulator or the owner's adviser. |
| Service availability | Digital presence audits are available; web design, SEO, Google Business Profile, content/social, and hosting/domains are on request; reputation/review checks remain in development. | Confirm that these statuses still match actual capacity. Do not sell reputation checks as currently available. |
| Private CRM/report safeguards | The full Python Auditor and CRM remain local-only. A reviewed redacted report is published manually; client next-step responses are emailed to the owner. | Keep manual approval and tight secret scopes; repeat a fabricated end-to-end production test after material changes. |
| Analytics | Tracking is disabled. | Keep disabled unless a specific tool and appropriate notice/consent are approved. |
| Optional profile content | Operating locality is Port Alfred, Eastern Cape, South Africa. A founder photo and social-profile URLs have not been supplied; no additional service coverage is claimed. | Add a photo or profiles only if desired, with exact URLs and permission to publish. Confirm remote/service-area coverage case by case. |
| Production deployment | Commit `763c535` contains the footer de-duplication fix but Netlify skipped its production deploy due to exhausted account credits. Published production remains at `eaeb305`. | Wait for the next billing cycle or obtain explicit owner approval for any plan upgrade; then rerun the production workflow and verify the new commit. No paid change was made. |

## Pricing source and reconciliation

Business Auditor proposal rates remain separate from the owner-approved hosting/domain prices. Audit proposals use R40 per missing point out of 100; a website build is R1,500 once-off for up to five pages; hourly work is R650/hour with a two-hour estimate minimum; one-off edits are R150 for a small text change, R150 for a photo swap, R350 for an additional form and R650 for a new page. Monthly retainers remain Fresh Start R200, Steady Presence R400, Local Growth R700, Content Partner R1,000 and Digital Partner R1,500, with inclusions shown on the pricing page. Domain registration/renewal is separate from hosting. The customer price list does not guarantee any wholesale/reseller price or domain availability.
