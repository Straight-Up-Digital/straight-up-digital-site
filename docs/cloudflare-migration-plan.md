# Cloudflare Workers migration plan

## Goal and safety boundary

Port the existing Astro site's Netlify-backed forms, private client reports, response workflow, report expiry, and local-CRM intake bridge on the `cloudflare-workers-migration` branch. Keep the Netlify implementation and current production site intact as rollback. Do not change public DNS, disable Netlify, or copy production client data during development. Use synthetic records for all Cloudflare tests. Deploy only to an isolated test URL after the local tests pass, and do not switch the branded domain without a separate explicit approval.

## Platform choice

The site is an Astro static site with several dynamic API paths. Astro's current Cloudflare guidance says the Cloudflare Astro adapter no longer supports Pages and recommends Workers for dynamic Astro features; a static Astro build can still be served from static assets without an adapter [1]. The migration target is therefore a Cloudflare Worker serving the static `dist/` output and handling only dynamic API/report paths, rather than an SSR conversion or a Pages-only deployment.

Cloudflare's published Free limits currently include up to 500 Pages builds/month, and Worker Free includes 100,000 Worker requests/day with 10 ms CPU per invocation; requests to static assets are free and unlimited [2] [3]. Worker/Pages Functions remain quota-limited. D1 Free currently includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage; exceeding daily query limits causes queries to fail until reset [4]. Netlify Free currently includes 300 monthly credits, production deployment costs 15 credits, and form submissions are listed as free [5]. These are current documented limits, not a guarantee that either provider will remain free or that all features fit a quota.

## Intended architecture

- Build the existing static Astro site with its existing build command and serve `dist/` as Cloudflare Worker static assets. Intercept only API and report routes; let normal website paths fall through to the asset handler.
- Route enquiry submissions to a Worker API that reuses the existing normalization and validation rules, honeypot/timing checks, Turnstile verification, safe response messages, and JSON logging that omits personal data.
- Route private client-report reads/responses, owner publication/revocation, and owner CRM sync through Worker handlers with explicit method, body-size, authorization, privacy-header, and environment gates matching the Netlify behavior.
- Use an isolated D1 database for enquiry metadata and small JSON client-report records, with a scheduled Worker cleanup for expired records. Consider R2 only if report payloads or uploads later need object storage. Preview/test bindings and secrets must be separate from Production; tests use mocks and synthetic rows only.
- Keep email delivery behind an injected adapter. Tests use a local sink and an in-memory SMTP server; the Worker-compatible Zoho SMTP adapter uses TLS sockets. A real Cloudflare-to-Zoho delivery test is still mandatory before production. Cloudflare's Email Sending binding is an alternative, but needs a verified sender domain [6]. No real email-provider secret is committed.
- Add Worker route and persistence tests for validation, duplicate-safe CRM intake, token authentication, report expiry/revocation, email failure behavior, and static-asset fallback. Keep all Netlify source and tests unchanged for rollback.

## Existing route inventory to port

- `submit-enquiry`: public contact/audit forms, spam checks, email send, then private CRM intake persistence.
- `publish-audit-report`: owner-token protected report create and delete/revoke, Production-only.
- `client-audit-report`: public private-link report display and client next-step form response.
- `crm-enquiries`: owner-token protected `GET`/`DELETE` intake queue, Production-only.
- `expire-audit-reports`: scheduled cleanup for expired private reports.

The front-end URLs and current `Netlify Blobs` record semantics have been checked against source/tests and ported. Do not drop or weaken an existing safeguard merely to simplify the port.

## References

[1]: https://docs.astro.build/en/guides/integrations-guide/cloudflare/ "Astro Cloudflare integration guidance"
[2]: https://developers.cloudflare.com/pages/platform/limits/ "Cloudflare Pages limits"
[3]: https://developers.cloudflare.com/workers/platform/pricing/ "Cloudflare Workers pricing"
[4]: https://developers.cloudflare.com/d1/platform/pricing/ "Cloudflare D1 pricing"
[5]: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ "Netlify credit-based pricing plans"
[6]: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/ "Cloudflare Email Sending Workers API"


## Email transport note

Cloudflare Workers exposes outbound TCP sockets through `cloudflare:sockets`; its docs explicitly prohibit connections to SMTP port 25. The branch now includes a small Worker-compatible Zoho SMTP transport using implicit TLS on port 465 or STARTTLS on port 587; it does not use Nodemailer. The fake SMTP protocol test verifies TLS mode, authentication sequencing, MIME encoding, and escaped customer text. A real end-to-end email from an isolated Cloudflare deployment remains untested and is required before production use. Cloudflare's Email Sending binding remains an alternative only after a sender domain is verified [7].

[7]: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/ "Cloudflare Workers TCP sockets"


## Local implementation status (16 November 2026)

The `cloudflare-workers-migration` branch now contains the Worker router, static asset config, API routes for enquiries, customer reports, owner publication/revocation and local-CRM sync, D1 schema/migration, daily expiry task, and a local Zoho SMTP adapter. The existing Netlify source and production path remain unchanged. The local Python CRM has separate optional `workers.dev` URL/token settings; Netlify remains its default and is not overwritten.

Validation completed locally: 50 website tests passed; Astro check returned zero errors/warnings; Worker TypeScript check, static Astro build, Wrangler Worker dry-run, and local D1 migration all passed. The Worker HTTP smoke served the homepage (200), accepted one synthetic legacy-path audit request (200) via the console mail sink, and kept the private CRM endpoint closed in `APP_ENV=test` (404); an aggregate-only local D1 query verified one synthetic enquiry row and one rate-limit bucket. The CRM's complete Python suite passed 73 tests and 10 subtests, including six synthetic Worker-host/Netlify-default tests. `wrangler.jsonc` keeps the test environment at `APP_ENV=test`, uses a separate D1 binding, disables report publishing, and uses the console mail sink.

Still pending: no Cloudflare account deployment or remote D1 resources have been created; Wrangler database IDs are placeholders; no Cloudflare secrets or `.dev.vars` have been set; SMTP delivery to Zoho and live Turnstile have not been tested from a Worker; no client data has been copied; Netlify remains live; and no DNS or branded-domain cutover has occurred. Any public-domain cutover requires separate owner approval.
