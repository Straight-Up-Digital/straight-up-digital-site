# Straight Up Digital launch checklist — updated 18 November 2026

## Cloudflare migration: verified

- [x] **Static site is serving from Workers.** Production Worker `straight-up-digital-cloudflare` is reachable at `https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`. Read-only checks returned HTTP 200 for `/`, `/contact/` and `/privacy/`.
- [x] **South African Firestore storage is active.** Production uses project `straight-up-digital-prod` in `africa-south1` (Johannesburg). `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON` is configured as a Cloudflare secret.
- [x] **Zoho API email path is active.** Production uses `EMAIL_PROVIDER=zoho-mail-api` with `ZOHO_API_CLIENT_ID` and `ZOHO_API_CLIENT_SECRET`; the obsolete `ZOHO_SMTP_PASSWORD` secret was removed. The API accepted the synthetic contact send; inbox arrival was not independently verified.
- [x] **Enquiries fail open on Firestore outages.** Validation and spam checks run first, then best-effort rate limiting, then email, then best-effort Firestore storage. A Firestore rate/storage outage cannot lose a genuine enquiry after Zoho accepts it; an explicit over-limit result is still blocked. Per-instance in-memory hashed-IP limiting is the fallback.
- [x] **Local CRM intake verified synthetically.** One `TEST - ignore` contact row was imported by the real sync function into an isolated SQLite CRM database, acknowledged, and removed from the Firestore queue. No real customer record was used.
- [x] **Temporary diagnostic route removed.** No Firestore diagnostic endpoint or diagnostic token is intended to ship.
- [x] **Data-flow documentation corrected.** The privacy notice and setup guides now describe Cloudflare, Johannesburg Firestore, Zoho's United States data centre, local CRM handling and current report availability. Legal review of cross-border safeguards remains outstanding.
- [x] **No custom-domain changes.** No domain was purchased and no DNS records were changed.

## Still required before using online reports or broader public launch

- [ ] **Enable and test online client reports.** Production currently has `AUDIT_REPORTS_ENABLED=false`; `AUDIT_REPORT_PUBLISH_TOKEN` is not configured. The local CRM's `CLOUDFLARE_AUDIT_REPORT_PUBLISH_TOKEN` is also unset. Generate a separate high-entropy token, configure it through Wrangler and the ignored local `.env`, add the workers.dev hostname to `PUBLIC_REPORT_HOSTS`, then test synthetic publish, render, response email, revoke and expiry. Keep the feature disabled until this complete flow passes. See [`docs/online-report-setup.md`](docs/online-report-setup.md).
- [ ] **Review POPIA cross-border handling.** Firestore's Johannesburg region does not by itself establish compliance. Review Cloudflare edge processing, Zoho's US-based mail processing, provider terms, legal grounds/safeguards, mailbox retention and local CRM retention with the owner/adviser before relying on the flow for real client data.
- [ ] **Register and connect the custom domain only after approval.** `straightupdigital.co.za` remains unpurchased/unconfigured; public DNS previously returned NXDOMAIN. Verify apex and `www` DNS, HTTPS and existing Zoho mail records after a separate owner decision.
- [ ] **Paystack checkout.** Merchant onboarding/KYC, recurring-payment method, test keys and plan codes, Worker transaction initialization, signature-verified/idempotent webhook, and production secrets are not configured. Current pricing CTAs are manual requests; they do not charge or provision service. See [`docs/paystack-setup.md`](docs/paystack-setup.md).
- [ ] **Activate reseller operations.** Supplier accounts and paid services have not been created. Confirm actual wholesale prices, VAT, top-up rules, mailbox quotas, backups/restores, cancellation, support, renewals and margins before taking orders. Current due-diligence notes are in [`docs/sa-hosting-and-domain-reseller-options.md`](docs/sa-hosting-and-domain-reseller-options.md).
- [ ] **Retire the Netlify GitHub workflow only with separate approval.** `.github/workflows/netlify-production.yml` remains in the repository and is configured for `main` pushes/manual dispatch. It was not changed here. Do not push/merge to `main` or trigger Netlify.
- [ ] **Independent email receipt check.** The Zoho Mail API accepted the synthetic enquiry, but the matching message was not independently located in the inbox during this session. Confirm mailbox arrival before treating delivery as fully end-to-end verified.

## Owner-confirmed public details

- Identity: **St. John Ritchie trading as Straight Up Digital**; do not describe the sole proprietorship as a registered company.
- Locality: Port Alfred, Eastern Cape, South Africa. No street address or registration claim is invented.
- Contact details: `Hello@straightupdigital.co.za` and `+27 62 065 3503`.
- Hosting offers: Starter Brand R129/month, Business Pro R249/month, and Team Unlimited R449/month. Customers submit a request; availability and terms are confirmed before payment or provisioning.
- Analytics/tracking remain disabled. Reputation/review checks remain in development; do not market them as currently available.
- The Python Business Auditor and CRM remain private and bound to `127.0.0.1`; customer reports are manually prepared and reviewed by the owner.
