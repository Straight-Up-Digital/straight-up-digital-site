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
| Pricing | Auditor proposal rates remain mirrored from its private configuration. Owner-approved reseller tiers are Email & Starter Site R99/month (2 GB NVMe, up to 5 email accounts), Business Growth R149/month (5 GB NVMe, up to 15 email accounts), and Managed Care R399–R599/month (10 GB NVMe, monthly updates and backups). The suggested .co.za range is R149–R169/year and is explicitly indicative. | Homepage, `src/data/pricing.ts`, pricing page and pricing FAQs |
| Flagship product | Business Auditor | Homepage and digital-audit page; no automated public audit is claimed |
| Audit PDF contact details | `prepared_by`, `contact_email` and `contact_phone` are now filled in the private Auditor runtime config; its website link remains blank until custom DNS resolves | Private Auditor runtime config, not the public website |
| Netlify Forms notifications | The sole all-forms notification now targets `straightupdigital@zohomail.com`; the obsolete pending `Hello@straightupdigital.co.za` recipient was removed. Synthetic submissions from `/contact/` and `/digital-audit/` each produced a notification in Zoho on 15 November 2026. | Netlify Forms notification settings and the owner inbox; this is separate from report-response SMTP |

## Still to confirm or do

| Item | Current status | Action |
| --- | --- | --- |
| Legal identity and address | Not supplied. Straight Up Digital is the public trading identity; no company number or registered address is claimed. | Confirm the proprietor's full legal name and any public service/contact address that should appear in final legal notices. |
| Information Officer details | Not supplied or assumed. | Confirm the applicable Information Officer details and any registration/status with the Information Regulator or a South African legal adviser before finalising the privacy notice. |
| Retention and deletion | Customer report links stop working after 30 days and expired online-report records are removed by the daily cleanup job. No period is approved yet for general enquiries, quotes or other client records. | Decide how long general enquiries, quotes and client records are kept and how they are removed. |
| Legal review | Privacy notice and terms remain labelled drafts. | Obtain appropriate South African legal review before treating them as final. |
| Custom domain and DNS | `straightupdigital.co.za` is the requested address, but DNS lookups for the apex and `www` returned NXDOMAIN on 14 November 2026. The live Netlify hostname remains the working address. | Confirm the domain is registered and configure DNS at its registrar; only then attach/verify it in Netlify and change canonical/sitemap configuration. Do not change mail records blindly. |
| Hosting and domain resale | Retail tiers are displayed as on-request offers. Upstream reseller costs, account limits, registrar terms and payment automation are not confirmed; FOSSBilling with Paystack is planned, but online checkout and provisioning are not live. | Confirm the upstream plan, mailbox/resource limits, backup/restore terms, domain registration/renewal/transfer terms and fees. Test payment confirmation, webhooks, refunds and provisioning in staging before enabling live orders. |
| Git-connected deployments | GitHub Actions calls the Netlify production build hook, and the build-hook path has successfully published a production build. Netlify's GitHub connection remains for team-private Deploy Previews. | Keep the repository secret `NETLIFY_BUILD_HOOK` available and verify subsequent Actions runs and published builds. Treat any native Git production events as a separate path and confirm their status independently. |
| Founder photograph | Not supplied; no image is shown. | Optional: provide a photograph and permission to publish it. |
| Service availability | Digital presence audits Available; website design, on-page SEO, Google Business Profile support, content/social support, and hosting/domain registration On request; reputation/review checks Planned. | Confirm these statuses still describe launch capacity. The planned reputation service must not be sold as currently available. |
| Service area | South Africa is the supplied country; no towns/provinces/radius have been approved. | Supply locations only if specific service-area claims are wanted. |
| Social profiles | No controlled URLs supplied; social links stay hidden. | Provide the exact public profiles, if any. |
| Analytics | Tracking remains disabled. | Keep disabled or approve a specific tool and its privacy/consent wording. |
| Private CRM and report bridge | The Python CRM remains local-only. A reviewed, redacted customer report can be published by an owner-confirmed request to Netlify; the full audit and CRM are not exposed. Production passed a synthetic report-rendering and owner-email test on 15 November 2026. | Keep publishing manual and owner-reviewed, restrict Netlify environment scopes/contexts as tightly as available, and repeat a fabricated end-to-end test after material changes. The owner copies and emails the report link to the client; client actions are sent to the owner inbox. |
| Automated Business Auditor access | Visitors cannot run the Python engine. The owner manually runs the audit, previews its customer translation and publishes a private web report. | Keep describing the public service as human-reviewed; do not promise an instant live scan. |

## Pricing source and reconciliation

The website's former `packageSlots` were technical placeholders, not the full pricing source. The private Auditor's runtime `auditor_config.json` and its `DEFAULT_CONFIG` in `business_auditor.py` agree on the existing audit, website-build, hourly, edit and retainer rates. The reseller-hosting retail tiers are separate, owner-approved public prices and are not mirrored from that private configuration. Keep those sources distinct if either changes.

The published figures are: Business Auditor audit proposals at R40 per missing point out of 100; website build R1,500 once-off for up to five pages; reseller hosting at R99/month (2 GB, up to 5 email accounts), R149/month (5 GB, up to 15 email accounts), and R399–R599/month for Managed Care (10 GB, monthly updates and backups); suggested .co.za registration/renewal at R149–R169/year, subject to confirmation by extension and registrar; hourly work R650/hour with the proposal estimator's two-hour minimum; once-off edits of R150 for a small text change, R150 for a photo swap, R350 for an additional form and R650 for a new page; and five monthly retainers—Fresh Start R200, Steady Presence R400, Local Growth R700, Content Partner R1,000 and Digital Partner R1,500—with configured inclusions listed on the pricing page. Domain registration and renewal remain separate from hosting; other extensions, mailboxes beyond plan allowances, paid plugins, substantial copywriting and major revisions may cost extra. FOSSBilling/Paystack checkout remains planned, not live.

The digital presence audit's Available status describes a service that can be requested and human-reviewed; it does not mean visitors can run the private Python app. The public site does not expose the private app, database or CRM. Website enquiries use Netlify Forms by default; report-response emails use the separately configured Zoho SMTP function.
