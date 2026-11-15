# Hosting tiers and pricing-page update

- [x] **Homepage hosting offer:** Show Email & Starter Site at R99/month (2 GB NVMe, up to 5 email accounts), Business Growth at R149/month (5 GB NVMe, up to 15 email accounts), and Managed Care at R399–R599/month (10 GB NVMe, monthly website updates and backups). Include domain registration as a separate annual add-on and link to full pricing.
- [x] **Pricing page and customer journey:** Show all three tiers and allowances, distinguish Managed Care scope, include the indicative .co.za registration/renewal range of R149–R169/year with registrar/TLD confirmation, and keep customers on a clear request path.
- [x] **Consistent service information:** Preserve Auditor proposal rates and distinguish owner-approved retail tiers from unconfirmed upstream reseller terms.

## Forms notification delivery

- [x] **Zoho recipient and production tests:** Keep `straightupdigital@zohomail.com` as the sole all-forms Netlify notification recipient; remove the obsolete pending `Hello@` notice; submit one synthetic contact enquiry and one audit request; verify both Zoho messages; leave both test emails unread.

## Owner-requested launch refinements (15 November 2026)

- [x] **Public business identity and owner-checked policies:** Publish St. John Ritchie trading as Straight Up Digital and the owner-approved locality, Port Alfred, Eastern Cape, South Africa. Remove obsolete draft/owner-confirmation banners from Privacy and Terms. Retain audit human-review/no-ranking/traffic/revenue limitation copy. No street address or company-registration claim is invented. Use one footer contact/location section and one linked legal notice.
- [x] **Plan-specific hosting requests:** Use “Select Starter Plan (R99/mo)”, “Select Business Growth (R149/mo)”, and “Request Managed Care Quote”. Each choice preselects the appropriate form option; the owner confirms availability, recurring payment terms, and start date before any payment or provisioned service. The request copy does not mention FOSSBilling.
- [x] **Domain-order route:** Add “Request a domain registration” actions on the homepage and pricing page. The contact form records the request and prompts for extension, availability, annual price and renewal terms; manual reseller action remains with the owner.
- [x] **Paystack technical approach researched:** Paystack's hosted checkout can call the REST API from a Netlify Function with Node's built-in `fetch`; no SDK dependency is required. Save the implementation/owner checklist in `docs/paystack-setup.md`. Capitec Pay is once-off-only in current South African documentation, not the method for recurring monthly hosting charges.
- [x] **WhatsApp message choices:** Add accessible prefilled options for audit, hosting, domains and general questions, linked to the owner-approved mobile number; use “Chat on WhatsApp” on desktop.
- [x] **Mobile action layout:** Group WhatsApp and logo-based back-to-top above the sticky audit dock with safe-area spacing and 48px touch targets.
- [x] **SEO metadata:** Use `https://straightupdigital.co.za/` for page canonicals, sitemap, Open Graph/Twitter URLs and organization structured data. Privacy/Terms are indexable and included in the sitemap. Build-output assertions confirm metadata and plan routes.
- [ ] **Paystack production checkout:** Merchant onboarding/KYC, supported recurring payment method, test transactions, subscription plan codes, webhook verification/idempotency, and Netlify production configuration are still required before opening checkout. Keep plan requests manual; never collect payment or provision service before verified payment/order handling is implemented.
- [ ] **Custom domain/DNS:** Register/configure `straightupdigital.co.za`, verify apex and `www` DNS plus HTTPS in Netlify, and check Zoho mail records remain intact. Canonicals intentionally point to the future domain already.
- [ ] **Reseller operations:** Confirm upstream host/registrar costs, account limits, allowances, renewal/transfer/cancellation terms, support and backup/restore details before taking orders. Use [`PLACEHOLDERS.md`](PLACEHOLDERS.md) for the broader launch list.

- [ ] **Publish the footer de-duplication fix:** Commit `763c535` is on GitHub, but Netlify skipped its deploy because production credits were exhausted. The live site remains at `eaeb305`. Wait for the next billing cycle or obtain explicit approval for a paid plan upgrade, then rerun and verify production. No upgrade was made.


## Private local-CRM enquiry bridge (15 November 2026)

- [x] **Push authenticated CRM intake source:** Website source now stores emailed enquiries in a private Netlify Blob queue and exposes only a token-authenticated, production-only read/ack endpoint. The changed functions were bundled locally and the source was pushed to GitHub; the production site has not yet received the change.
- [x] **Configure the private sync token:** `CRM_ENQUIRY_SYNC_TOKEN` is stored as a secret in Netlify's Production context and in the ignored local CRM `.env`. Netlify verifies the secret is scoped to Builds, Functions, and Runtime, with no value in preview, branch, or local-development contexts. Never put the token in Git or chat.
- [ ] **Deploy and test the private intake:** Netlify currently reports production deploys paused due to operational credits. Once deploys resume, verify the production endpoint, use the CRM's owner-clicked sync with one synthetic enquiry, confirm exactly one local import and remote acknowledgement, and verify Zoho email delivery remains unchanged.
- [ ] **Test explicit report revocation:** After deployment, verify owner-authenticated `DELETE` revokes a synthetic report link and rejects wrong tokens, unapproved URLs, and deploy previews.
