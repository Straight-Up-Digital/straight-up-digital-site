# Confirmed website-build prices and payment model

**Owner confirmation:** SinJin, 25 November 2026. These prices and scopes supersede the earlier proposed package rates.

## Confirmed packages

| Package | Once-off price | Confirmed included scope |
|---|---:|---|
| One-Page Starter | R1,500 | One mobile page, call or WhatsApp button, contact form and one round of changes. |
| Five-Page Business | R3,500 | Up to five pages, WhatsApp and map links, Google-ready page titles and two rounds of changes. Client supplies words, logo and photos. |
| Restaurant & Café | R3,950 | Up to five pages with menu, hours, map, gallery and WhatsApp order or booking button. One round of changes. |
| Guest House & Stay | R4,500 | Up to six pages for rooms, facilities, photos, location and enquiries, with links to the existing booking site. One round of changes. |
| Bookings & Appointments | R5,500 | Up to five pages plus one standard booking tool with email confirmations. The client pays booking-tool fees. |
| Small Online Shop | R7,500 | Up to 20 products and a basic cart, with orders by WhatsApp or email. Live Paystack checkout is conditional on successful end-to-end testing and SinJin's confirmation. |

For each standalone website build, 50% is due to start and 50% at launch after the client has seen the preview. Current published-site enquiries are not payments. The payment flow must keep that distinction and must not collect the balance before the preview/launch milestone.

## Confirmed discounted annual bundle exception - 25 November 2026

SinJin confirmed that discounted annual bundles are paid in full once-off. The discounted bundle price includes the website build and the first year of hosting; the recurring annual hosting Plan begins after that included first year. This is a bundle-only exception. Standalone website builds retain the 50% start / 50% launch milestones above. SinJin approved a 5% discount on the listed build price plus first annual hosting term, rounded to the nearest R10.

| Bundle | Build | First hosting year | Separate-price total | Discounted amount due once-off | Saving | Annual renewal after included year |
|---|---:|---:|---:|---:|---:|---:|
| One-Page Starter + Starter Brand | R1,500 | R1,290 | R2,790 | R2,650 | R140 | R1,290/year |
| One-Page Starter + Business Pro | R1,500 | R2,490 | R3,990 | R3,790 | R200 | R2,490/year |
| One-Page Starter + Team Unlimited | R1,500 | R4,490 | R5,990 | R5,690 | R300 | R4,490/year |
| Five-Page Business + Starter Brand | R3,500 | R1,290 | R4,790 | R4,550 | R240 | R1,290/year |
| Restaurant & Café + Starter Brand | R3,950 | R1,290 | R5,240 | R4,980 | R260 | R1,290/year |
| Guest House & Stay + Business Pro | R4,500 | R2,490 | R6,990 | R6,640 | R350 | R2,490/year |
| Bookings & Appointments + Business Pro | R5,500 | R2,490 | R7,990 | R7,590 | R400 | R2,490/year |
| Small Online Shop + Team Unlimited | R7,500 | R4,490 | R11,990 | R11,390 | R600 | R4,490/year |

## 50/50 milestone amounts

| Package | Start payment (50%) | Launch payment (50%) |
|---|---:|---:|
| One-Page Starter | R750 | R750 |
| Five-Page Business | R1,750 | R1,750 |
| Restaurant & Café | R1,975 | R1,975 |
| Guest House & Stay | R2,250 | R2,250 |
| Bookings & Appointments | R2,750 | R2,750 |
| Small Online Shop | R3,750 | R3,750 |

For Paystack API amounts, convert rand to cents (multiply by 100). For example, a R1,750 milestone is sent as 175000. The server must look up the milestone price from its trusted catalogue; it must not accept a client-supplied amount.

## Correct Paystack resource

Do **not** create these once-off builds as Paystack subscription Plans. The Plan API requires a billing interval such as daily, weekly, monthly, quarterly, biannually or annually, and Paystack describes Plans as the recurring-billing foundation for subscriptions. That would not match the confirmed one-off total split into a deposit and a launch balance. [1] [2]

If fixed Paystack links are needed, the Payment Pages API supports a fixed `amount` and a `type` of `payment`; the amount is in the currency's subunit. Alternatively, the existing test-only server transaction initializer can accept an approved product/milestone ID and initialize a one-time transaction. Each package therefore needs a deposit transaction and a separate balance transaction. Only issue the balance payment after the client has seen the preview and the build is ready for launch. [3] [4]

Paystack remains test-only. Do not expose any payment button on the public site or activate a live key for these packages until an end-to-end test passes and SinJin separately confirms live activation. The Small Online Shop package currently promises WhatsApp/email ordering, not Paystack checkout.

## References

[1]: https://paystack.com/docs/api/plan/ "Paystack Plan API"
[2]: https://paystack.com/docs/payments/subscriptions/ "Paystack Subscriptions"
[3]: https://paystack.com/docs/api/page/ "Paystack Payment Pages API"
[4]: https://paystack.com/docs/payments/accept-payments/ "Paystack Accept Payments"
