# Owner-confirmed details and current launch checklist

Updated 18 November 2026. This file distinguishes public facts from operational work that remains. No street address, company-registration number, founder photo, or unapproved service-area claim is invented.

## Confirmed public details

| Item | Current information |
| --- | --- |
| Business identity | St. John Ritchie trading as Straight Up Digital. Do not call the sole proprietorship a registered company. |
| Locality | Port Alfred, Eastern Cape, South Africa. No street address is published. |
| Contact | `Hello@straightupdigital.co.za` and `+27 62 065 3503`. |
| Hosting tiers | Starter Brand R129/month, Business Pro R249/month, and Team Unlimited R449/month. Customers submit a request; availability and terms are confirmed before payment or provisioning. |
| Domains | Domain registration is a separate annual add-on; the published .co.za range is indicative and must be confirmed with the reseller. |
| Audits | The free audit is owner-run in the private Business Auditor. Online customer reports are disabled in production; the owner reviews findings before sharing results. |
| Analytics | Tracking is disabled. Reputation/review checks remain in development and are not currently offered as a finished service. |
| Canonical metadata | Uses `https://straightupdigital.co.za/`; this does not mean the domain has been registered or connected. |

## Cloudflare production status

The static Astro site is live on `https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`. Read-only checks returned HTTP 200 for the homepage, contact page and privacy page. The public contact/audit forms use the Cloudflare Worker API, not Netlify Forms. Production email uses Zoho Mail API and the recipient is `straightupdigital@zohomail.com`. The production Firestore database is in `africa-south1` (Johannesburg).

A synthetic contact submission returned HTTP 200. The Zoho API accepted the email request, but inbox arrival was not independently verified. The same synthetic Firestore row was imported by the real CRM sync routine into an isolated SQLite database, acknowledged, and removed from the Firestore queue. It contained fake test data only.

## Data handling and privacy

The updated privacy notice describes Cloudflare edge processing, Firestore storage in Johannesburg, Zoho Mail processing in its United States data centre, and the local CRM import. A South African Firestore region alone does not establish POPIA compliance. The owner/adviser still needs to review the legal basis and safeguards for cross-border processing and decide/document retention for Zoho mailbox and local CRM copies.

The Python Business Auditor and CRM remain private and bound to `127.0.0.1`; do not expose them through a public tunnel. Enquiry rows are kept in Firestore until the owner imports and acknowledges them; the queue copy is then deleted. The local CRM and mailbox copies do not have an automated deletion schedule configured.

## Still to complete before broader launch

| Item | Current status and next action |
| --- | --- |
| Online customer reports | Disabled in production (`AUDIT_REPORTS_ENABLED=false`); `AUDIT_REPORT_PUBLISH_TOKEN` is not set on the Worker, and the local `CLOUDFLARE_AUDIT_REPORT_PUBLISH_TOKEN` is unset. Configure a separate secret, allowlist the workers.dev hostname, and run synthetic publish/render/respond/revoke/expiry tests before enabling. See [`docs/online-report-setup.md`](docs/online-report-setup.md). |
| Zoho inbox verification | API acceptance was observed, but the message was not independently located in the inbox during this session. Verify before calling email delivery fully end-to-end. |
| Custom domain and DNS | `straightupdigital.co.za` remains unpurchased/unconfigured; public DNS previously returned NXDOMAIN. Do not purchase or change DNS without separate owner approval. Preserve Zoho mail records if a domain cutover is later approved. |
| Paystack | No merchant onboarding/KYC, recurring method, test keys/plan codes, Worker checkout endpoint, verified webhook or production secret is configured. Current calls to action are manual plan requests. See [`docs/paystack-setup.md`](docs/paystack-setup.md). |
| Hosting/domain resellers | No supplier account or paid service was created. Confirm current wholesale terms, VAT, quotas, backups, cancellation, support, renewals and margins before taking orders. |
| Netlify leftovers | Legacy Netlify functions/config/forms remain in the repository. `.github/workflows/netlify-production.yml` still listens to `main` pushes/manual dispatch and was not changed. Do not push/merge to `main`, trigger Netlify or alter its build hooks without separate approval. |
| Social/profile assets | No founder photo or social-profile URLs were supplied. Add only with exact approved assets/URLs and permission. |

See [`TODO.md`](TODO.md) for the detailed technical completion record and current priorities.
