# Owner-confirmed details and current launch checklist

Updated 25 November 2026. This file distinguishes public facts from operational work that remains. No company-registration number, founder photo, or unapproved service-area claim is invented.

## Confirmed public details

| Item | Current information |
| --- | --- |
| Business identity | St. John Ritchie trading as Straight Up Digital. Do not call the sole proprietorship a registered company. |
| Public address | 6 Jacks Close, Port Alfred, South Africa, 6170. |
| Contact | `Hello@straightupdigital.co.za` and `+27 62 065 3503`. |
| Hosting tiers | Starter Brand R129/month, Business Pro R249/month, and Team Unlimited R449/month. Customers submit a request; availability and terms are confirmed before payment or provisioning. |
| Domains | Domain registration is a separate annual add-on; the published .co.za range is indicative and must be confirmed with the reseller. |
| Audits | The free audit is owner-run in the private Business Auditor. Online customer reports are disabled in production; the owner reviews findings before sharing results. |
| Analytics | Tracking is disabled. Reputation/review checks remain in development and are not currently offered as a finished service. |
| Canonical metadata | Uses `https://straightupdigital.co.za/`; this does not mean the domain has been registered or connected. |

## Cloudflare production status

The static Astro site is served by the Cloudflare Worker `straight-up-digital-cloudflare` on `https://straightupdigital.co.za` and `https://www.straightupdigital.co.za` (the generated `workers.dev` address stays on until the custom domain is verified). The public contact/audit forms use the Cloudflare Worker API. Production email uses Zoho Mail API and the recipient is `straightupdigital@zohomail.com`. The production Firestore database is in `africa-south1` (Johannesburg).

A synthetic contact submission returned HTTP 200. The Zoho API accepted the email request, but inbox arrival was not independently verified. The same synthetic Firestore row was imported by the real CRM sync routine into an isolated SQLite database, acknowledged, and removed from the Firestore queue. It contained fake test data only.

## Data handling and privacy

The updated privacy notice describes Cloudflare edge processing, Firestore storage in Johannesburg, Zoho Mail processing in its United States data centre, and the local CRM import. A South African Firestore region alone does not establish POPIA compliance. The owner/adviser still needs to review the legal basis and safeguards for cross-border processing and decide/document retention for Zoho mailbox and local CRM copies.

The Python Business Auditor and CRM remain private and bound to `127.0.0.1`; do not expose them through a public tunnel. Enquiry rows are kept in Firestore until the owner imports and acknowledges them; the queue copy is then deleted. The local CRM and mailbox copies do not have an automated deletion schedule configured.

## Still to complete before broader launch

| Item | Current status and next action |
| --- | --- |
| Online customer reports | Disabled in production (`AUDIT_REPORTS_ENABLED=false`); `AUDIT_REPORT_PUBLISH_TOKEN` is not set on the Worker, and the local `CLOUDFLARE_AUDIT_REPORT_PUBLISH_TOKEN` is unset. Configure a separate secret, allowlist the workers.dev hostname, and run synthetic publish/render/respond/revoke/expiry tests before enabling. See [`docs/online-report-setup.md`](docs/online-report-setup.md). |
| Zoho inbox verification | API acceptance was observed, but the message was not independently located in the inbox during this session. Verify before calling email delivery fully end-to-end. |
| Custom domain and DNS | `straightupdigital.co.za` is registered with HostAfrica and its DNS is hosted on Cloudflare. The apex and `www` are attached to the Worker. Add an MX record and the Zoho Mail records before relying on `Hello@straightupdigital.co.za`. |
| Paystack | Test-mode plans and guarded Worker handlers exist, but public checkout is inactive and no live Paystack secret is configured on the production Worker. Bundle payments are once-off and include year one; standard subscription pages charge at signup, so they cannot implement year-two bundle renewals. See [`docs/paystack-setup.md`](docs/paystack-setup.md). |
| Hosting/domain resellers | No supplier account or paid service was created. Confirm current wholesale terms, VAT, quotas, backups, cancellation, support, renewals and margins before taking orders. |
| Netlify | The production workflow is removed on `launch-cleanup`; merge and Cloudflare deployment remain to be completed. The Netlify dashboard project and build hooks have not been inspected or deleted. |
| Social/profile assets | No founder photo or social-profile URLs were supplied. Add only with exact approved assets/URLs and permission. |

See [`TODO.md`](TODO.md) for the detailed technical completion record and current priorities.
