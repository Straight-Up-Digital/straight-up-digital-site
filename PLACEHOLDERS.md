# Owner-supplied details and launch checklist

This checklist records what the owner has now supplied, what the site reflects, and what still needs an owner or Netlify action. No legal identity, registration number, address, Information Officer, service area or retention period has been invented.

## Confirmed and now reflected

| Item | Confirmed information | Where it is used |
| --- | --- | --- |
| Trading identity | Straight Up Digital | Site-wide branding and legal drafts |
| Business email | `Hello@straightupdigital.co.za` | Contact page, footer, privacy notice |
| Telephone | `062 065 3503`; international dialing format `+27 62 065 3503` | Contact page and footer; links use `tel:+27620653503` |
| Country | South Africa | Site language and founder profile; no unconfirmed nationwide service claim |
| Business structure | Owner describes the planned business as a sole proprietorship to be established through Capitec | Carefully qualified wording in draft legal pages; not described as a registered company |
| Founder | St. John Ritchie | About page and site data |
| Founder profile | Owner-approved business development and sales biography, approximately 20 years' experience | About page |
| Pricing | Rates mirrored from `C:\Users\Saint\business_auditor\auditor_config.json` and the matching defaults in `business_auditor.py` | `src/data/pricing.ts`, pricing page and pricing FAQs |
| Flagship product | Business Auditor | Homepage and digital-audit page; no automated public audit is claimed |
| Audit PDF contact details | `prepared_by`, `contact_email` and `contact_phone` are now filled in the private Auditor runtime config; its website link remains blank until custom DNS resolves | Private Auditor runtime config, not the public website |

## Still to confirm or do

| Item | Current status | Action |
| --- | --- | --- |
| Legal identity and address | Not supplied. Straight Up Digital is the public trading identity; no company number or registered address is claimed. | Confirm the proprietor's full legal name and any public service/contact address that should appear in final legal notices. |
| Information Officer details | Not supplied or assumed. | Confirm the applicable Information Officer details and any registration/status with the Information Regulator or a South African legal adviser before finalising the privacy notice. |
| Retention and deletion | No approved retention period or deletion schedule. | Decide how long enquiries, quotes and client records are kept and how they are removed. |
| Legal review | Privacy notice and terms remain labelled drafts. | Obtain appropriate South African legal review before treating them as final. |
| Custom domain and DNS | `straightupdigital.co.za` is the requested address, but DNS lookups for the apex and `www` returned NXDOMAIN on 14 November 2026. The live Netlify hostname remains the working address. | Confirm the domain is registered and configure DNS at its registrar; only then attach/verify it in Netlify and change canonical/sitemap configuration. Do not change mail records blindly. |
| Netlify Forms setup | Detection is enabled. One email notification is configured for all forms at `Hello@straightupdigital.co.za`, but Netlify says it is waiting for the recipient to confirm. | Click the confirmation link in the business inbox. After the new deploy registers both forms, test each form and confirm the messages arrive. |
| Git-connected deployments | Netlify’s native Git integration is configured to deploy `main`; the commit identity is standardized to the verified team account. Production is public and Deploy Previews are private. | Verify that the corrected-history push deploys successfully and future `main` pushes continue to trigger production builds. |
| Founder photograph | Not supplied; no image is shown. | Optional: provide a photograph and permission to publish it. |
| Service availability | Existing statuses are retained: digital presence audits Available; website design, on-page SEO, Google Business Profile support, and content/social support On request; reputation/review checks Planned. | Confirm these statuses still describe launch capacity. The planned reputation service must not be sold as currently available. |
| Service area | South Africa is the supplied country; no towns/provinces/radius have been approved. | Supply locations only if specific service-area claims are wanted. |
| Social profiles | No controlled URLs supplied; social links stay hidden. | Provide the exact public profiles, if any. |
| Analytics | Tracking remains disabled. | Keep disabled or approve a specific tool and its privacy/consent wording. |
| CRM | Integration remains intentionally disabled. | Do not connect until the private CRM has reviewed authentication, database and narrow intake endpoint requirements. |
| Automated Business Auditor access | The Python application remains separate from the public website. | Do not advertise self-service/live automated audits until a secure public integration is deliberately built and tested. Current website requests are for human-reviewed audits. |

## Pricing source and reconciliation

The website's former `packageSlots` were technical placeholders, not the full pricing source. The private Auditor's runtime `auditor_config.json` and its `DEFAULT_CONFIG` in `business_auditor.py` agree on the current rates. Those established figures are now shown in the website's pricing data and page. Keep `src/data/pricing.ts` synchronized if the private proposal configuration changes.

The published figures are: Business Auditor audit proposals at R40 per missing point out of 100; website build R1,500 once-off for up to five pages; hosting R99/month; hourly work R650/hour with the proposal estimator's two-hour minimum; once-off edits of R150 for a small text change, R150 for a photo swap, R350 for an additional form and R650 for a new page; and five monthly retainers—Fresh Start R200, Steady Presence R400, Local Growth R700, Content Partner R1,000 and Digital Partner R1,500—with their configured inclusions listed on the pricing page. Domain, email, paid plugins, substantial copywriting and major revisions may be extra as stated in the Auditor configuration.

The digital presence audit's Available status describes a service that can be requested and human-reviewed; it does not mean the private Python app is exposed. The public site does not expose the private app, database or CRM. Website enquiries use Netlify Forms by default; this is separate from the optional email-provider function.
