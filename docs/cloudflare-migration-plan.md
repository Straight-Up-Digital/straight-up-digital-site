# Cloudflare Workers migration plan

> **Current status — 20 November 2026:** The original public website is at `https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`. A separate Worker deployment with the CRM page is now at `https://straight-up-digital-cloudflare.straightupdigital.workers.dev`; it has a Cloudflare D1 binding and an empty CRM schema applied in region `WEUR` (Western Europe). The owner-password secret is configured, and live login plus the authenticated contacts API have been verified. No local customer records were migrated. The new Worker is a separate deployment, not a DNS cutover or update to the original host. Online audit-report publishing and Paystack checkout remain disabled/not implemented, and the custom domain is not active. Review cross-border data handling before adding real client data to the WEUR database. Sections below that describe the 16 November state are historical.

## Goal and safety boundary

Port the existing Astro site's Netlify-backed forms, private client reports, response workflow, report expiry, and local-CRM intake bridge on the `cloudflare-workers-migration` branch. Keep the Netlify implementation and current production site intact as rollback. Do not change public DNS, disable Netlify, or copy production client data during development. Use only synthetic records for Cloudflare tests. The isolated test Worker must remain unrouted from `workers.dev` as requested; do not switch the branded domain without separate explicit approval.

## Platform choice

The site is an Astro static site with dynamic API paths. Astro's current Cloudflare guidance says the Cloudflare Astro adapter no longer supports Pages and recommends Workers for dynamic Astro features; a static Astro build can still be served from static assets without an adapter [1]. The migration target is therefore a Cloudflare Worker serving the static `dist/` output and handling only dynamic API/report paths, rather than an SSR conversion or a Pages-only deployment.

Cloudflare's published Free limits include 100,000 Worker requests/day and 10 ms CPU per invocation; static asset requests are free and unlimited [2]. Firestore offers a separate free quota of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound data. Exactly one Firestore database per Google Cloud project qualifies for that quota; backups, PITR, restore, clone, and Firestore TTL require billing [3]. These are published limits, not a guarantee of future no-cost service. Both Firestore projects currently show Firebase Spark/no-cost and no billing account. No paid Firestore feature has been enabled.

## Intended architecture

- Build the existing static Astro site with its existing build command and serve `dist/` as Cloudflare Worker static assets. Intercept only API and report routes; let normal website paths fall through to the asset handler.
- Route enquiry submissions to a Worker API that reuses existing normalization and validation rules, honeypot/timing checks, Turnstile verification, safe response messages, and JSON logging that omits personal data.
- Route private client-report reads/responses, owner publication/revocation, and owner CRM sync through Worker handlers with explicit method, body-size, authorization, privacy-header, and environment gates matching the Netlify behavior.
- Store enquiries, private report records, and rate-limit buckets through Firestore's REST API. Test uses project `straight-up-digital-test`; production uses `straight-up-digital-prod`. Each project has its first/default Standard database in **`africa-south1` (Johannesburg)** with production-mode client rules and no scheduled backups. No D1 binding remains in application configuration.
- Do not treat Johannesburg database storage as a complete data-residency or POPIA guarantee: Cloudflare receives and processes live requests at the Worker edge, and Zoho receives notification emails. The current Netlify production deploy still uses Functions in `cmh` and Blob storage in `us-east-2`. Verify provider terms, Zoho's account data centre, retention, and public privacy notice before any cutover.
- Keep email delivery behind an injected adapter. Tests use a local sink and in-memory SMTP server; the Worker-compatible Zoho SMTP adapter uses TLS sockets. A real Cloudflare-to-Zoho delivery test is still mandatory before production. No email-provider secret is committed.
- Add Worker route and persistence tests for validation, duplicate-safe CRM intake, token authentication, report expiry/revocation, email failure behavior, and static-asset fallback. Keep all Netlify source and tests unchanged for rollback.

## Existing route inventory to port

- `submit-enquiry`: public contact/audit forms, spam checks, email send, then private CRM intake persistence.
- `publish-audit-report`: owner-token protected report create and delete/revoke, Production-only.
- `client-audit-report`: public private-link report display and client next-step form response.
- `crm-enquiries`: owner-token protected `GET`/`DELETE` intake queue, Production-only.
- `expire-audit-reports`: scheduled cleanup for expired private reports and rate-limit buckets.

The front-end URLs and current Netlify Blobs record semantics have been checked against source/tests and ported. Do not drop or weaken an existing safeguard merely to simplify the port.

## Email transport note

Cloudflare Workers exposes outbound TCP sockets through `cloudflare:sockets`; its docs prohibit connections to SMTP port 25. The branch includes a Worker-compatible Zoho SMTP transport using implicit TLS on port 465 or STARTTLS on port 587; it does not use Nodemailer. The fake SMTP protocol test verifies TLS mode, authentication sequencing, MIME encoding, and escaped customer text. A real end-to-end email from an isolated Cloudflare deployment remains untested and is required before production use [5].

## Local implementation and remote resource status (16 November 2026)

The `cloudflare-workers-migration` branch contains the Worker router, static asset config, enquiry, customer-report, owner publication/revocation and local-CRM routes, a Firestore REST adapter, daily expiry cleanup, and a local Zoho SMTP adapter. The adapter signs a short-lived Google OAuth JWT, uses the datastore scope, caches access tokens per Worker isolate, applies conditional writes and atomic rate-limit increments, and omits API response bodies from errors. The Netlify source and production path remain unchanged. The local Python CRM has separate optional Cloudflare URL/token settings; its Netlify settings remain the defaults.

The test project `straight-up-digital-test` and production project `straight-up-digital-prod` were created under the signed-in Google account on Firebase Spark, which the Console showed as no cost ($0/month). Each has one Standard `(default)` Firestore database. Both locations were verified in the Console as `africa-south1`; both use production-mode client rules, scheduled backups are disabled, and no billing account is attached. Both databases are empty. Their project IDs are configured separately in Wrangler. No service account, key, Worker secret, or production data has been created.

After configuring both project IDs, local verification passed: 56 website tests, Astro check with 0 errors, 0 warnings, and 0 hints, Worker TypeScript check, 11-page Astro build, test and production Wrangler dry-runs, 234 internal references, and `git diff --check`. The separate CRM repo remains clean at `8786418`; its last full suite passed 73 tests plus 10 subtests. A Wrangler dry-run validates packaging/configuration only; it does not prove live Firestore or email behavior.

The test Worker remains unrouted from `workers.dev`; the Firestore-backed Worker code has not been deployed because service-account and other Worker secrets are not configured. The former Cloudflare D1 test database was confirmed empty across enquiry, report, and rate-limit tables, then deleted; the account's D1 list is empty and the SQL migration file was removed. No production client data was copied. Netlify remains the live production path at commit `eaeb305`; its Functions run in `cmh` and its Blob region is `us-east-2`, so Johannesburg storage is not serving live enquiries. A 16 November synthetic Netlify report rendered with `noindex`/`no-store`, but its DELETE returned 405 because the deployed `eaeb305` handler is POST-only. The current `origin/main` source adds DELETE, but is not deployed. The synthetic record has no client data, the test script did not save or share its unguessable link, and the deployed function sets a 30-day expiry. Do not claim live Netlify revocation works until an approved deployment or expiry removes it.

## Remaining before any public cutover

1. Obtain explicit owner approval before creating service-account keys or configuring Cloudflare secrets. The current Worker adapter requires one service-account JSON secret per project, with project-scoped `roles/datastore.user` only. Set the matching `FIRESTORE_PROJECT_ID` and `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON`; configure the remaining separate Worker secrets (`RATE_LIMIT_HASH_SECRET`, CRM sync token, owner report token, Turnstile, and Zoho SMTP credentials) without placing values in Git or chat.
2. Deploy the Firestore version only to the unrouted test Worker, apply no customer data, and run synthetic enquiry, CRM sync/acknowledgement, report publish/revoke/expiry, and SMTP delivery checks. Keep the test route private.
3. Verify Zoho's data centre and mailbox retention; assess Cloudflare, Google, and Zoho processing terms; update the privacy notice with actual providers and transfers; and confirm opt-out/erasure procedures cover mailbox copies as well as Firestore records.
4. Keep Netlify production live until all tests pass. Domain purchase, DNS changes, Cloudflare production deployment, and Netlify shutdown remain separate owner decisions; do not buy or point the domain until the test and privacy gates are complete.

## References

[1]: https://docs.astro.build/en/guides/integrations-guide/cloudflare/ "Astro Cloudflare integration guidance"
[2]: https://developers.cloudflare.com/workers/platform/pricing/ "Cloudflare Workers pricing"
[3]: https://firebase.google.com/docs/firestore/pricing "Firestore pricing and free quota"
[4]: https://firebase.google.com/docs/firestore/locations "Firestore locations and immutable location selection"
[5]: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/ "Cloudflare Workers TCP sockets"
[6]: https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch "Firestore documents.patch"
[7]: https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery "Firestore documents.runQuery"
[8]: https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit "Firestore documents.commit"
[9]: https://developers.google.com/identity/protocols/oauth2/service-account "Google service-account OAuth"
[10]: https://cloud.google.com/datastore/docs/access/iam "Google Datastore IAM roles"
[11]: https://inforegulator.org.za/knowledge-base/popia-section-72/ "Information Regulator: POPIA section 72"
[12]: https://www.cloudflare.com/cloudflare-customer-dpa/ "Cloudflare Customer DPA"
