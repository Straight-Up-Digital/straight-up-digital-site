# Straight Up Digital launch checklist (updated 24 November 2026)

## Code and content ready (not proof of live operations)

- [x] Website code targets Cloudflare Workers with static assets; Netlify is removed from the code, build and workflow.
- [x] Service cards link to detail pages, and the specialist website-build page has credited free-use images.
- [x] Client-facing `/bundles` page pairs the R1,500 one-page starter with each current hosting tier. It uses an assumed 5% discount, rounded to the nearest R10; monthly discount applies to the first bill only. Prices are guide prices pending a verified margin, tax and terms review.
- [x] Enquiry form supports bundle prefill. The page remains quote-only; checkout is not enabled.
- [x] Enquiry, email, Firestore and private CRM bridge code has synthetic test coverage. Live Zoho delivery, Firestore configuration, and CRM receipt are not verified in this release.

## Before telling customers about it

- [ ] Confirm HTTPS loads on `https://straightupdigital.co.za` and `https://www.straightupdigital.co.za`, then set `workers_dev` to `false` in `wrangler.jsonc` and redeploy.
- [ ] Add the MX record and Zoho Mail records for `Hello@straightupdigital.co.za` in Cloudflare DNS, then send a test email both ways.
- [ ] Confirm a test enquiry reaches the inbox and the CRM sync picks it up.
- [ ] Create a Turnstile widget for the domain, set `PUBLIC_TURNSTILE_SITE_KEY` at build time and `TURNSTILE_SECRET_KEY` as a Worker secret.
- [ ] Pause or delete the old Netlify site and its build hooks in the Netlify dashboard.
- [ ] Review bundle prices and written renewal/payment terms against costs, rep commission, tax/VAT status, owner pay and buffer before treating them as approved commercial prices.

## Later

- [ ] Online client reports: generate a separate `AUDIT_REPORT_PUBLISH_TOKEN`, set it with Wrangler and the CRM `.env`, then enable and test. See [`docs/online-report-setup.md`](docs/online-report-setup.md). Self-service audit, final quote and accept/pay flow stay disabled until all audit, quote, payment and storage paths pass synthetic end-to-end tests.
- [ ] Review POPIA cross-border handling (Cloudflare edge, Zoho US data centre, mailbox and CRM retention).
- [ ] Paystack checkout. Current pricing buttons are manual requests. Configure test credentials and a durable idempotent order store, run end-to-end payment/webhook cases, then consider live keys. See [`docs/paystack-setup.md`](docs/paystack-setup.md).
- [ ] Reseller hosting operations. See [`docs/sa-hosting-and-domain-reseller-options.md`](docs/sa-hosting-and-domain-reseller-options.md).

## Owner-confirmed public details

- Identity: **St. John Ritchie trading as Straight Up Digital**. Do not describe the sole proprietorship as a registered company.
- Locality: Port Alfred, Eastern Cape, South Africa.
- Contact: `Hello@straightupdigital.co.za` and `+27 62 065 3503`.
- Hosting offers: Starter Brand R129/month, Business Pro R249/month, Team Unlimited R449/month. Customers submit a request; terms are confirmed before payment.
- Analytics and tracking are disabled.
