# Paystack setup for Straight Up Digital

The hosting pages currently accept a **plan request**, not a payment. A selected tier is passed into the contact form. Domain registration has its own manual enquiry route; the owner confirms the extension, availability, price and renewal terms before placing the registration with a reseller. Straight Up Digital confirms hosting availability, recurring payment terms and the start date in writing before the customer pays or service is provisioned.

## Current package prices to configure

The public pricing page uses these owner-confirmed amounts. Annual hosting uses recurring annual Plans at the listed rates; the annual price is equivalent to ten monthly payments. The owner selected **Option A**: the first annual hosting payment is collected at signup, with subsequent charges annually. This timing applies to standalone annual hosting, not bundles.

| Offer | Monthly | Annual recurring | Payment model |
| --- | ---: | ---: | --- |
| Starter Brand | R129 | R1,290/year | Monthly or annual recurring |
| Business Pro | R249 | R2,490/year | Monthly or annual recurring |
| Team Unlimited | R449 | R4,490/year | Monthly or annual recurring |
| Basic Care | R249 | — | Monthly recurring |
| Local Visibility | R449 | — | Monthly recurring |
| Active Growth | R699 | — | Monthly recurring |
| Lead Builder | R1,049 | — | Monthly recurring |
| Full Digital Desk | R1,549 | — | Monthly recurring |

The six website-build packages are fixed-price one-time projects. Standalone builds use a 50% start deposit and a 50% launch balance after the client has seen a preview. A discounted annual bundle is a separate offer: its full amount is paid once-off and includes the build plus the first year of hosting; annual hosting renews after that included year. SinJin approved a 5% discount on the build price plus first annual hosting term, rounded to the nearest R10. Current published bundle totals are Starter Brand one-page R2,650; Business Pro one-page R3,790; Team Unlimited one-page R5,690; Five-Page Business R4,550; Restaurant & Café R4,980; Guest House & Stay R6,640; Bookings & Appointments R7,590; and Small Online Shop R11,390. The hosting plan renews annually at its listed annual rate after the included first year. Do not create recurring Paystack Plans for one-time build or bundle prices. Use trusted server-catalogue amounts, never browser-supplied amounts.

The customer-facing site buttons still create an enquiry with the selected package and billing preference. They do not call checkout or charge a transaction. Test-only API handlers now exist in the Worker, but no pricing-page UI invokes them. Keep the public buttons as request buttons; production checkout remains disabled.

## What can be prepared now

The site is static Astro output served by a Cloudflare Worker. Test-only Paystack initialization, callback verification and webhook handlers are implemented in `cloudflare/paystack.ts`; they require `APP_ENV === "test"` and an `sk_test_` key, and production requests fail closed. The dedicated Test Worker uses the isolated EU D1 database `straight-up-digital-crm-test-eu` for a minimal ledger containing reference, product, amount, currency and status timestamps; it does not store customer email, create CRM leads, or provision services. Production has no Paystack secret and no payment-store binding. No live checkout, customer-facing checkout UI, CRM payment integration or payment fulfillment is enabled. A Paystack secret must never be sent to browser code, committed to Git, or pasted into chat; keep it server-side.

## Important South African payment distinction

Using a Capitec Business account to receive or settle proceeds is separate from offering **Capitec Pay** to customers. Paystack's current South African help article says Capitec Pay and Ozow Instant EFT are once-off methods and require merchant enablement plus additional KYC. Paystack's Subscriptions documentation says automatic subscriptions use configured plan codes and supports Card and Direct Debit (Nigeria); therefore Capitec Pay must not be described as the recurring monthly method for these hosting plans. Confirm with Paystack which recurring method is enabled for the merchant account before accepting subscription orders.

## Before enabling checkout

1. Complete the Paystack business onboarding and KYC, and confirm the merchant account's settlement arrangement with Capitec.
2. In Paystack Test Mode, recurring Plans may be used for genuinely recurring monthly retainers and monthly or annual hosting tiers. A Plan does not itself charge a customer; a separate subscription or checkout flow is required. Do not create recurring Plans for the six once-off website builds or their 50/50 project milestones.
3. Confirm which methods the business account can actually use for recurring charges. Treat Capitec Pay and EFT as once-off only unless Paystack confirms a change in writing.
4. The test-only initializer uses fixed server-owned prices for the six 50% start deposits, validates customer email, creates its own reference and fixes the callback URL. Browser-supplied amounts are ignored. Launch-balance product IDs are deliberately not accepted: there is not yet an order-specific server-side preview approval record, so the balance cannot be initiated until that gate exists. No pricing-page checkout UI is active.
5. Test-only callback and webhook handlers are implemented. They verify through Paystack's transaction API and check test domain, `data.status`, reference, ZAR currency and server-expected amount before marking an order paid. They support timestamped `Paystack-Signature` when a dedicated signing secret is configured, and legacy `X-Paystack-Signature` over exact raw bytes while the dedicated header is not active. Timestamped signatures enforce a 300-second window, constant-time comparison and multiple `v1` signatures. Duplicate paid events do not create a second paid-state transition; callback visits alone do not fulfill orders.
6. Synthetic tests cover initialization, declines, successful and mismatched callbacks, invalid legacy signatures, stale timestamped replay, rotated `v1` signatures, duplicate webhook delivery, production-route rejection and rejection of balance requests without preview authorization. These are mocked/synthetic tests, not an end-to-end transaction against a deployed test Worker. Before any live enablement, complete a deployed test-mode transaction and verify owner notifications, abandonment, cancellations, refunds and service start/stop decisions. Keep production checkout disabled meanwhile.
7. Keep production checkout disabled. Only after a deployed test-mode end-to-end flow passes and SinJin separately confirms live activation should live credentials be installed. Keep all secret keys server-side. These website-build milestones are one-time transactions, not subscription Plans.

## Primary sources

- [Paystack Accept Payments](https://paystack.com/docs/payments/accept-payments/): backend transaction initialization, hosted authorization URL, and verify-before-delivery guidance.
- [Paystack Transaction API](https://paystack.com/docs/api/transaction/): required email and subunit amount, currency, callback, metadata, channels and plan parameters.
- [Paystack Webhooks](https://paystack.com/docs/payments/webhooks/): raw-body HMAC-SHA512 signature validation and delivery/acknowledgement behavior.
- [Paystack Subscriptions](https://paystack.com/docs/payments/subscriptions/): plan codes and recurring billing behavior.
- [Paystack South African Pay-by-Bank methods](https://support.paystack.com/en/articles/2132482): Capitec Pay/Ozow activation and once-off-only recurring limitation.


## Paystack documentation checked on 25 November 2026

Paystack requires transaction initialization from the server. Its response includes a hosted `authorization_url` and unique `reference`; the callback URL receives the reference, but visiting the callback is not proof of payment. Verify through the server-side Verify Transaction API and check the transaction's own `data.status`, expected amount, currency and reference before treating an order as paid. The API amount is in the currency subunit; Paystack's South Africa documentation confirms ZAR and that 500,000 cents represents R5,000.

The general webhook guide still documents `X-Paystack-Signature` as HMAC-SHA512 over the exact raw body using the API secret. The newer versioned webhook guide documents `Paystack-Signature` when a separate `whsec_...` signing secret is active: sign `<unix-seconds>.<raw-body>`, enforce a 300-second clock window, compare signatures in constant time, and accept any matching `v1` during a signing-secret overlap. If the dedicated header is not active, Paystack says to retain legacy verification. Test webhook deliveries retry hourly for up to 10 hours and time out at 30 seconds; acknowledge valid events promptly.

The current test Worker has `PAYSTACK_SECRET_KEY` only; a separate test `whsec_...` key has not been installed. Test code may therefore support the legacy signature for test mode and prefer the dedicated header if a dedicated test secret is later configured. Live initialization and webhook handling must remain disabled until production credentials and dedicated signing-secret readiness are separately verified.

Sources: [Accept Payments](https://paystack.com/docs/payments/accept-payments/), [Transaction API](https://paystack.com/docs/api/transaction/), [Verify Payments](https://paystack.com/docs/payments/verify-payments/), [API currency table](https://paystack.com/docs/api/), [South Africa developer documentation](https://paystack.com/docs/v2/za), [general Webhooks guide](https://paystack.com/docs/payments/webhooks/), and [versioned Webhook signing documentation](https://paystack.com/docs/v2/ke/developer-tools/integration/webhooks).


## Monthly Plan API verification — 25 November 2026

Paystack's official Plan API uses `POST /plan` with `name`, integer `amount` in the currency's subunit, and `interval: "monthly"`; `currency: "ZAR"` should be explicit because examples may default to NGN. Plan inventory is read with `GET /plan` and `perPage` / `page` pagination. Plan creation alone does not charge a customer: a customer charge/subscription requires a separate subscription flow or a transaction initialized with a plan code and paid. The subscription guide lists Card and Direct Debit (Nigeria) as supported recurring methods, so do not enable public recurring checkout until the South African merchant's card-subscription flow is verified.

Paystack's official currency table identifies ZAR's subunit as cents, so amounts are multiplied by 100. Eight monthly Plans cover the hosting tiers and retainers; three additional annual Plans cover the annual hosting terms. Website builds remain once-off projects, not Plans.
The account inventory was inspected in Test Mode before Plan creation. The requested monthly and annual Plans were created through the authenticated dashboard; their exact codes and detail checks are recorded below. No customer subscriptions or subscription pages were created. No Paystack keys, live integrations, or checkout settings were changed, and the obsolete test key previously pasted in conversation was not reused.

Official sources: [Plan API](https://paystack.com/docs/api/plan/), [Subscriptions](https://paystack.com/docs/payments/subscriptions/), [API currency table](https://paystack.com/docs/api/), and [South Africa developer documentation](https://paystack.com/docs/v2/za).


Test-mode Plan created through the authenticated Paystack Dashboard on 25 November 2026: `Starter Brand (Monthly)` — ZAR 129.00/month, plan code `PLN_b4o4wglar2s1sne`. Dashboard showed the plan active, with 0 subscriptions, 0 subscribers, and 0 subscription pages; public subscription-page creation was left unchecked.

Test-mode Plan created: `Business Pro (Monthly)` — ZAR 249.00/month, plan code `PLN_v6nnf5dpa4n1n7d`. Dashboard showed Monthly interval, maximum payments 0 (no limit), 0 subscriptions, 0 subscribers, and 0 subscription pages; the subscription-page option remained unchecked.

Test-mode Plan created: `Team Unlimited (Monthly)` — ZAR 449.00/month, plan code `PLN_ae4ds5h07uvjrup`. Dashboard confirmed Monthly interval, no payment limit, 0 subscriptions, 0 subscribers, and 0 subscription pages; the subscription-page option was left unchecked.


### Test Mode dashboard inventory — verified 25 November 2026

The active Plans inventory includes eight monthly Plans and three annual hosting Plans. All are in Test Mode, show Active status and ZAR amounts, and have 0 subscriptions. Detail views checked show 0 subscribers and 0 subscription pages. Maximum payments is 0 (unlimited); subscription-page creation was left unchecked. No customer subscription or public subscription page was created.

| Plan | Amount | Plan code |
|---|---:|---|
| Starter Brand (Monthly) | ZAR 129/month | `PLN_b4o4wglar2s1sne` |
| Business Pro (Monthly) | ZAR 249/month | `PLN_v6nnf5dpa4n1n7d` |
| Team Unlimited (Monthly) | ZAR 449/month | `PLN_ae4ds5h07uvjrup` |
| Basic Care (Monthly) | ZAR 249/month | `PLN_xtfeg6bxzfvyf6n` |
| Local Visibility (Monthly) | ZAR 449/month | `PLN_vwq4p80779w1981` |
| Active Growth (Monthly) | ZAR 699/month | `PLN_07tofskr5mzf7yd` |
| Lead Builder (Monthly) | ZAR 1,049/month | `PLN_xplldz3vjmdotxf` |
| Full Digital Desk (Monthly) | ZAR 1,549/month | `PLN_ojjv4euqg8fbpyw` |

| Starter Brand (Annual) | ZAR 1,290/year | `PLN_djlp0040be2rao7` |
| Business Pro (Annual) | ZAR 2,490/year | `PLN_su56detxajp08kt` |
| Team Unlimited (Annual) | ZAR 4,490/year | `PLN_qnf4nd7sjbb8y3x` |

The malformed predecessor Plans were not reused. Local Visibility `PLN_m4t6t81yimgqz4r` and Full Digital Desk `PLN_3e5267dfldxx0q7` had 0 subscriptions; each detail page also showed 0 subscribers and 0 subscription pages before deletion. Paystack confirmed both predecessors were deleted successfully. The replacement monthly Plans use descriptions aligned with the current service catalogue.

All 11 current Plans show 0 subscriptions. The three annual Plans use the `Annually` interval, their catalogue prices, and have 0 subscription pages; page creation was left unchecked. No subscription, subscription page, live key, or Live Mode checkout was created or enabled.

These metadata defects do not change the approved pricing, interval, or service scope in `src/data/pricing.ts`. Keep Paystack test-only: live checkout remains disabled until end-to-end verification is completed and the owner separately confirms launch. No key, live setting, CRM file, deployment, or repository history was changed.


## Annual recurring hosting and bundle checkout research — 25 November 2026

**This section supersedes earlier statements in this note that annual hosting must be a once-off prepayment or must not use recurring Plans.** Paystack supports annual Plan intervals (`annually`). Its Dashboard can create a Subscription Payment Page when creating a Plan, or a page can later be connected to an existing Plan. A standard subscription page collects the first payment at signup, then the Plan controls later recurring charges. The owner selected this **at-signup** timing for standalone annual hosting. [Paystack Subscriptions and Plans](https://support.paystack.com/en/articles/2133058) [Paystack Payment Pages](https://support.paystack.com/en/articles/2132546)

Paystack's developer guide says a `plan`/`plan_code` passed when initializing a transaction overrides the supplied transaction amount and charges the Plan amount. Therefore a standard Plan-based subscription checkout does not collect a separate fixed website-build amount and a different annual hosting amount in one charge. A bundle that takes both amounts at the same time needs separate one-time and subscription checkouts/transactions or a custom server-side checkout flow. A standard Subscription Payment Page is tied to one recurring Plan; it is not a combined one-time-plus-subscription page. [Paystack Subscriptions API](https://paystack.com/docs/payments/subscriptions/) [How subscriptions work](https://paystack.com/docs/v2/payments/recurring/subscriptions)

Paystack's ordinary hosted Subscription Payment Page initiates a subscription when the customer pays. The Subscription API separately documents an optional ISO 8601 `start_date` for the first debit, but its create-subscription endpoint requires a customer who has already completed a transaction. The owner selected at-signup billing for standalone annual hosting, so no deferred-start flow is required for those offers. Bundles are a distinct one-off payment: the discounted amount includes the build and first hosting year; hosting renews after that included year. Do not use an ordinary subscription page for a bundle's initial payment or year-two renewal.

SinJin explicitly confirmed that discounted annual bundles are paid in full once-off, include the build and first hosting year, and renew annually after that year; the bundle discount is 5% of the build price plus first hosting year, rounded to the nearest R10. This is a bundle-only exception; standalone builds retain the 50% start / 50% launch milestones. Standalone annual hosting's first payment is collected at signup. Customer subscriptions have not been created. Test Mode Plans exist, but Payment Pages remain uncreated until the deployed test payment and webhook path is verified. Keep Live Mode and production checkout disabled meanwhile.

Official sources checked:
- [Paystack Subscriptions and Plans](https://support.paystack.com/en/articles/2133058) — intervals include annually; the Plan flow can create or later attach a subscription page; Plans without subscriptions may be deleted.
- [Paystack Payment Pages](https://support.paystack.com/en/articles/2132546) — subscription pages are recurring; first payment starts the subscription; page connects to a Plan.
- [Paystack Subscriptions API](https://paystack.com/docs/payments/subscriptions/) — `plan_code` in transaction initialization overrides the transaction amount and charges the Plan amount.
- [Paystack Subscription API](https://paystack.com/docs/api/subscription/) — the create-subscription endpoint accepts an optional ISO 8601 `start_date` for the first debit and requires an existing customer transaction/authorization.
- [Paystack Transaction API](https://paystack.com/docs/api/transaction/) — adding a Plan code invalidates the amount supplied in transaction initialization.
- [How subscriptions work](https://paystack.com/docs/v2/payments/recurring/subscriptions) — lifecycle and subscription start options.


## Deployed Test Mode checkout — 25 November 2026

The Test Mode callback and webhook URLs were re-opened after saving and verified to persist after a dashboard refresh. The account remained in Test Mode. The configured endpoints are `https://straight-up-digital-migration-test.stjohn-toperformer.workers.dev/api/paystack/callback` and `https://straight-up-digital-migration-test.stjohn-toperformer.workers.dev/api/paystack/webhook`.

One controlled hosted Test Mode checkout completed successfully for the server-catalogued One-Page Starter 50% deposit: ZAR 750 (75,000 subunits), product ID `website-one-page-starter-deposit`, reference `sud-test-0b1bc5a7-c3db-417d-8de5-da9451ea85f6`. The hosted checkout displayed its TEST marker and offered a Test Mode “Success” simulation; that option was selected. The Paystack Test Mode transaction list showed one successful ZAR 750 card transaction. The callback returned **Payment verified** and stated that the test-only integration did not provision service. The isolated EU D1 row for this reference is `paid`, with `paid_at` `2026-11-25T13:35:01.000Z`; the ledger stores no customer email. An earlier R750 QA transaction remains abandoned, as separately confirmed in the all-status transaction view.

**Webhook delivery is not yet verified.** The D1 paid state cannot identify which route performed the transition because both callback and webhook can mark the order paid. Paystack’s new Dashboard Webhooks history route (`/v2/developers/webhooks`) returned `404?reason=not_active_business` with an access-restricted notice that the page is available only to live and compliant businesses. The legacy `#/developers/webhooks` route returned Page not found. The transaction detail page confirmed payment success but exposed no webhook status or server response. Therefore the deployed webhook check remains unresolved; do not infer delivery or HTTP success from the callback, the transaction success screen, or D1 status alone.

Keep production checkout and Paystack Live Mode disabled. After the controlled checkout, Test-only deployment `d9107085-0d47-4673-bc19-17c7fdb5953c` set `workers_dev` to `false`; Wrangler reported **No targets deployed**, so the Test Worker no longer has a public workers.dev route. The callback and webhook URLs remain saved in Paystack Test Mode but currently point to that closed route. To resume diagnostics, re-enable `workers_dev` for Test only and redeploy; then, once the merchant can access Webhook Events, inspect this reference’s `charge.success` event and confirm a successful 2xx response/body. Do not resend unless the delivery record shows a failure and the result is reviewed; duplicate deliveries must remain idempotent. Owner notifications, CRM/service lifecycle, cancellation/refund handling, and production secret setup remain separate launch blockers.

Official sources: [Test Mode and Live Mode](https://support.paystack.com/en/articles/2129922), [Test Payments](https://paystack.com/docs/payments/test-payments/), [Webhooks](https://paystack.com/docs/payments/webhooks/), [Viewing and resending webhooks from your Dashboard](https://support.paystack.com/en/articles/10609026), and [Webhook Events API](https://paystack.com/docs/api/webhook-events/).
