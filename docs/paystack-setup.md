# Paystack setup for Straight Up Digital

The hosting pages currently accept a **plan request**, not a payment. A selected tier is passed into the contact form. Domain registration has its own manual enquiry route; the owner confirms the extension, availability, price and renewal terms before placing the registration with a reseller. Straight Up Digital confirms hosting availability, recurring payment terms and the start date in writing before the customer pays or service is provisioned.

## What can be prepared now

The site is static Astro output served by a Cloudflare Worker. Paystack's hosted redirect flow can be integrated in a Worker API route using the built-in `fetch`; no browser SDK or Node server is required. No checkout route, merchant keys, plan codes, webhook, or live payment processing is currently configured. Keep the secret server-side in Cloudflare Worker secrets. The secret must never be sent to browser code, committed to Git, or pasted into chat.

## Important South African payment distinction

Using a Capitec Business account to receive or settle proceeds is separate from offering **Capitec Pay** to customers. Paystack's current South African help article says Capitec Pay and Ozow Instant EFT are once-off methods and require merchant enablement plus additional KYC. Paystack's Subscriptions documentation says automatic subscriptions use configured plan codes and supports Card and Direct Debit (Nigeria); therefore Capitec Pay must not be described as the recurring monthly method for these hosting plans. Confirm with Paystack which recurring method is enabled for the merchant account before accepting subscription orders.

## Before enabling checkout

1. Complete the Paystack business onboarding and KYC, and confirm the merchant account's settlement arrangement with Capitec.
2. In Paystack test mode, create the recurring plans for the fixed monthly tiers and record the resulting plan codes. Managed Care remains quote-only because its monthly price varies from R399 to R599.
3. Confirm which methods the business account can actually use for recurring charges. Treat Capitec Pay and EFT as once-off only unless Paystack confirms a change in writing.
4. Implement the checkout initializer on the server, with fixed plan/amount mapping, validated customer email, a unique transaction reference and an allowed callback URL. Do not accept an amount supplied by the browser.
5. Configure a Paystack webhook endpoint. Verify `x-paystack-signature` using HMAC-SHA512 over the raw request body and the server-side secret. Verify the transaction status, ZAR currency and expected amount before recording it as paid. Make the event handler idempotent and do not provision merely because a customer visited the callback page.
6. Test successful, declined, abandoned, repeated and mismatched-amount transactions using test keys. Confirm that owner notification, cancellations, refunds and service start/stop decisions are handled before enabling live orders.
7. Add the live secret as a Cloudflare Worker secret and store only non-secret plan identifiers in server-side Worker configuration. Keep production checkout disabled until the webhook and all tested order states work.

## Primary sources

- [Paystack Accept Payments](https://paystack.com/docs/payments/accept-payments/): backend transaction initialization, hosted authorization URL, and verify-before-delivery guidance.
- [Paystack Transaction API](https://paystack.com/docs/api/transaction/): required email and subunit amount, currency, callback, metadata, channels and plan parameters.
- [Paystack Webhooks](https://paystack.com/docs/payments/webhooks/): raw-body HMAC-SHA512 signature validation and delivery/acknowledgement behavior.
- [Paystack Subscriptions](https://paystack.com/docs/payments/subscriptions/): plan codes and recurring billing behavior.
- [Paystack South African Pay-by-Bank methods](https://support.paystack.com/en/articles/2132482): Capitec Pay/Ozow activation and once-off-only recurring limitation.
