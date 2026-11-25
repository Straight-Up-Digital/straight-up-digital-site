# Straight Up Digital launch checklist (updated 25 November 2026)

## Code and content ready (not proof of live operations)

- [x] Website code targets Cloudflare Workers with static assets; Netlify is removed from the code, build and workflow.
- [x] Service cards link to detail pages, and the specialist website-build page has credited free-use images.
- [x] Client-facing `/bundles` page pairs website packages with annual hosting. The owner-approved 5% discount applies to the build plus first hosting year, rounded to the nearest R10. The once-off bundle includes year one; annual hosting renews after it.
- [x] Enquiry form supports bundle prefill. The page remains quote-only; checkout is not enabled.
- [x] Enquiry, email, Firestore and private CRM bridge code has synthetic test coverage. Live Zoho delivery, Firestore configuration, and CRM receipt are not verified in this release.

## Before telling customers about it

- [ ] After promotion, confirm HTTPS and the public pages on `https://straightupdigital.co.za` and `https://www.straightupdigital.co.za`; production custom domains are already configured on the Cloudflare Worker.
- [ ] Add the MX record and Zoho Mail records for `Hello@straightupdigital.co.za` in Cloudflare DNS, then send a test email both ways.
- [ ] Confirm a test enquiry reaches the inbox and the CRM sync picks it up.
- [ ] Create a Turnstile widget for the domain, set `PUBLIC_TURNSTILE_SITE_KEY` at build time and `TURNSTILE_SECRET_KEY` as a Worker secret.
- [ ] After merging the workflow removal, inspect the Netlify dashboard and separately confirm whether the old site/build hooks should be deleted.
- [ ] Review bundle prices and written renewal/payment terms against costs, rep commission, tax/VAT status, owner pay and buffer before treating them as approved commercial prices.

## Later

- [ ] Online client reports: generate a separate `AUDIT_REPORT_PUBLISH_TOKEN`, set it with Wrangler and the CRM `.env`, then enable and test. See [`docs/online-report-setup.md`](docs/online-report-setup.md). Self-service audit, final quote and accept/pay flow stay disabled until all audit, quote, payment and storage paths pass synthetic end-to-end tests.
- [ ] Review POPIA cross-border handling (Cloudflare edge, Zoho US data centre, mailbox and CRM retention).
- [ ] Paystack checkout. The 11 approved Test Mode Plans exist; no Payment Pages or customer subscriptions have been created. One earlier R750 QA transaction was confirmed abandoned. A later controlled R750 Test Mode Starter Brand deposit completed successfully, its callback showed **Payment verified**, and its isolated EU D1 order is paid; no service was provisioned. Webhook delivery remains unverified because Paystack’s new webhook-history route is access-restricted for this non-live/non-compliant account and the legacy route is not found; do not treat the callback or D1 row as webhook proof. After the test, the Test Worker was redeployed at version `d9107085-0d47-4673-bc19-17c7fdb5953c` with `workers_dev=false`; Wrangler reported no routing targets. The saved Test Mode callback/webhook URLs therefore currently point to a closed route. Keep Live Mode and production checkout disabled. Re-enable the Test route only when resuming webhook verification, then confirm the `charge.success` event and successful 2xx response. Add owner notifications, CRM/service lifecycle, cancellation/refund handling, and production secret setup before live readiness. Standalone annual hosting collects its first payment at signup; bundles remain one-off and include year one, with hosting renewal after that year. See [`docs/paystack-setup.md`](docs/paystack-setup.md).
- [ ] Reseller hosting operations. See [`docs/sa-hosting-and-domain-reseller-options.md`](docs/sa-hosting-and-domain-reseller-options.md).

## Owner-confirmed public details

- Identity: **St. John Ritchie trading as Straight Up Digital**. Do not describe the sole proprietorship as a registered company.
- Public address: 6 Jacks Close, Port Alfred, South Africa, 6170.
- Contact: `Hello@straightupdigital.co.za` and `+27 62 065 3503`.
- Hosting offers: Starter Brand R129/month, Business Pro R249/month, Team Unlimited R449/month. Customers submit a request; terms are confirmed before payment.
- Analytics and tracking are disabled.
