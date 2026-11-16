# Cloudflare Workers migration plan

## Goal and safety boundary

Port the existing Astro site's Netlify-backed forms, private client reports, response workflow, report expiry, and local-CRM intake bridge on the `cloudflare-workers-migration` branch. Keep the Netlify implementation and current production site intact as rollback. Do not change public DNS, disable Netlify, or copy production client data during development. Use only synthetic records for Cloudflare tests. The isolated test Worker must remain unrouted from `workers.dev` as requested; do not switch the branded domain without separate explicit approval.

## Platform choice

The site is an Astro static site with several dynamic API paths. Astro's current Cloudflare guidance says the Cloudflare Astro adapter no longer supports Pages and recommends Workers for dynamic Astro features; a static Astro build can still be served from static assets without an adapter [1]. The migration target is therefore a Cloudflare Worker serving the static `dist/` output and handling only dynamic API/report paths, rather than an SSR conversion or a Pages-only deployment.

Cloudflare's published Free limits include 100,000 Worker requests/day and 10 ms CPU per invocation; static asset requests are free and unlimited [2]. Firestore offers a separate free quota of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound data. Exactly one Firestore database per Google Cloud project qualifies for that quota; backups, PITR, restore, clone, and Firestore TTL require billing [3]. These are published limits, not a guarantee of future no-cost service. This setup intentionally does not enable billing or those paid Firestore features.

## Intended architecture

- Build the existing static Astro site with its existing build command and serve `dist/` as Cloudflare Worker static assets. Intercept only API and report routes; let normal website paths fall through to the asset handler.
- Route enquiry submissions to a Worker API that reuses the existing normalization and validation rules, honeypot/timing checks, Turnstile verification, safe response messages, and JSON logging that omits personal data.
- Route private client-report reads/responses, owner publication/revocation, and owner CRM sync through Worker handlers with explicit method, body-size, authorization, privacy-header, and environment gates matching the Netlify behavior.
- Store enquiries, private report records, and rate-limit buckets through Firestore's REST API. The database must be Firestore Standard in **`africa-south1` (Johannesburg)**. Its location is immutable after creation [4]. Use separate new Google Cloud projects for test and production, each with its own first/default database, to keep synthetic and real client records separate while retaining the free quota [3]. The Worker's project ID is a non-secret variable; its service-account JSON is a secret. No D1 binding remains in the application configuration.
- Do not treat Johannesburg database storage as a complete data-residency or POPIA guarantee: Cloudflare receives and processes the live request at the Worker edge, and Zoho receives notification emails. Verify provider terms, Zoho's account data centre, retention, and the public privacy notice before cutover.
- Keep email delivery behind an injected adapter. Tests use a local sink and an in-memory SMTP server; the Worker-compatible Zoho SMTP adapter uses TLS sockets. A real Cloudflare-to-Zoho delivery test is still mandatory before production. No real email-provider secret is committed.
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

## Local implementation status (16 November 2026)

The `cloudflare-workers-migration` branch contains the Worker router, static asset config, API routes for enquiries, customer reports, owner publication/revocation and local-CRM sync, a Firestore REST storage adapter, daily expiry cleanup, and a local Zoho SMTP adapter. The adapter signs a short-lived Google OAuth JWT, uses the datastore scope, caches access tokens per Worker isolate, applies conditional writes and atomic rate-limit increments, and omits API response bodies from errors. The Netlify source and production path remain unchanged. The local Python CRM has separate optional Cloudflare URL/token settings; its Netlify settings remain the defaults.

Verification is complete: all 56 website tests pass, including the new Firestore adapter tests; Astro check reports 0 errors, 0 warnings, and 0 hints; Worker TypeScript check passes; the static Astro build produces 11 pages; Wrangler's test-environment dry-run packages 70 static files with the test route still disabled; 234 internal references pass; and the local CRM suite passes 73 tests plus 10 subtests. The Wrangler dry-run validates packaging/configuration only—it does not prove live Firestore or email behavior.

The previously deployed test Worker remains unrouted from `workers.dev`; its Firestore-backed code has not been deployed because there is no Google Cloud project, Firestore database, or service-account secret configured. The former test D1 database was confirmed empty across the enquiry, report, and rate-limit tables, then deleted from Cloudflare; the account's D1 list is now empty. Its SQL migration file was removed from the application branch. No production client data was copied. Netlify remains the live production path.

## Remaining before any public cutover

1. Create separate Google Cloud test and production projects; create each first/default Firestore database in `africa-south1`; verify the region before proceeding. No billing activation or paid Firestore features are authorized.
2. Create an application service account per project, grant only `roles/datastore.user`, and add its key as the matching Cloudflare environment secret. Set each environment's `FIRESTORE_PROJECT_ID` and separate Worker secrets (`RATE_LIMIT_HASH_SECRET`, CRM sync token, owner report token, Turnstile, and Zoho SMTP credentials) without placing values in Git or chat.
3. Deploy the Firestore version only to the unrouted test Worker, apply no customer data, and run synthetic enquiry, CRM sync/acknowledgement, report publish/revoke/expiry, and SMTP delivery checks.
4. Verify Zoho's data centre and mailbox retention; assess Cloudflare, Google, and Zoho processing terms; update the privacy notice with actual providers and transfers; and confirm opt-out/erasure procedures cover mailbox copies as well as Firestore records.
5. Keep Netlify production live until all tests pass. Domain purchase, DNS changes, Cloudflare production deployment, and Netlify shutdown remain outside this branch-only authorization and require separate owner approval.

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
