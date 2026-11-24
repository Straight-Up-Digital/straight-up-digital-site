# Straight Up Digital launch checklist (updated 24 November 2026)

## Done

- [x] Website runs on a Cloudflare Worker with static assets. Netlify is removed from the code, build and workflow.
- [x] `straightupdigital.co.za` (registered with HostAfrica) uses Cloudflare DNS. The apex and `www` are attached to the Worker.
- [x] Enquiries are validated, emailed through the Zoho Mail API and stored in Firestore `africa-south1` (Johannesburg), with fail-open storage.
- [x] Private enquiry bridge for the Business Auditor CRM, owner-only report publisher, daily cleanup cron.

## Before telling customers about it

- [ ] Confirm HTTPS loads on `https://straightupdigital.co.za` and `https://www.straightupdigital.co.za`, then set `workers_dev` to `false` in `wrangler.jsonc` and redeploy.
- [ ] Add the MX record and Zoho Mail records for `Hello@straightupdigital.co.za` in Cloudflare DNS, then send a test email both ways.
- [ ] Confirm a test enquiry reaches the inbox and the CRM sync picks it up.
- [ ] Create a Turnstile widget for the domain, set `PUBLIC_TURNSTILE_SITE_KEY` at build time and `TURNSTILE_SECRET_KEY` as a Worker secret.
- [ ] Pause or delete the old Netlify site and its build hooks in the Netlify dashboard.

## Later

- [ ] Online client reports: generate a separate `AUDIT_REPORT_PUBLISH_TOKEN`, set it with Wrangler and the CRM `.env`, then enable and test. See [`docs/online-report-setup.md`](docs/online-report-setup.md).
- [ ] Review POPIA cross-border handling (Cloudflare edge, Zoho US data centre, mailbox and CRM retention).
- [ ] Paystack checkout. Current pricing buttons are manual requests. See [`docs/paystack-setup.md`](docs/paystack-setup.md).
- [ ] Reseller hosting operations. See [`docs/sa-hosting-and-domain-reseller-options.md`](docs/sa-hosting-and-domain-reseller-options.md).

## Owner-confirmed public details

- Identity: **St. John Ritchie trading as Straight Up Digital**. Do not describe the sole proprietorship as a registered company.
- Locality: Port Alfred, Eastern Cape, South Africa.
- Contact: `Hello@straightupdigital.co.za` and `+27 62 065 3503`.
- Hosting offers: Starter Brand R129/month, Business Pro R249/month, Team Unlimited R449/month. Customers submit a request; terms are confirmed before payment.
- Analytics and tracking are disabled.
