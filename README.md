# Straight Up Digital — website

The public marketing site for Straight Up Digital. **Business Auditor is the flagship product.** The site accepts requests for free, owner-run digital presence audits. The online customer-report feature is currently disabled in production; the owner manually runs and reviews the full audit in the private Python CRM. The public site does not run the audit engine or expose the CRM.

This is a static Astro site with no client-side framework. Pages are pre-rendered and fonts are self-hosted. The Cloudflare target serves the static `dist/` output through Workers Static Assets and handles enquiry, report and CRM APIs in `cloudflare/worker.ts`. Netlify source remains as a legacy rollback path; a Cloudflare deployment must use `npm run build:cloudflare`.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7, static output | Fast HTML, no runtime framework, small payload |
| Styling | One hand-written CSS file | No utility framework or styling build dependency |
| Type | Montserrat + Inter, self-hosted WOFF2 | Approved brand typefaces, no font CDN requests |
| Hosting | Cloudflare Worker + Workers Static Assets | Static Astro output plus a custom Worker router |
| Data | Google Firestore, `africa-south1` (Johannesburg) | Production enquiry records and private reports are stored in the South African region |
| Forms | Cloudflare Worker on Cloudflare builds | `/api/enquiries` validates, screens, emails and optionally stores a private CRM copy |
| Legacy path | Netlify source remains in the repository | Not used by the Cloudflare build; do not trigger a Netlify publish |
| Analytics | None | Tracking remains disabled |

## Run it locally

Requires Node 22 or newer, as declared in `package.json`.

```bash
npm ci
npm run dev
```

The site is then at `http://localhost:4321`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm run check` | Astro diagnostics |
| `npm run check:worker` | Type-checks Cloudflare Worker code |
| `npm test` | Validation, function and email-adapter tests |
| `npm run test:links` | Checks every internal link in `dist/` |
| `npm run build:cloudflare` | Static Astro build in Cloudflare email mode; removes the Netlify-only form declaration |
| `npm run worker:dev` | Builds Cloudflare output, then starts Wrangler locally |
| `npm run worker:dry-run` | Builds and dry-runs Wrangler for the test environment |
| `npm run netlify:dev` | Legacy Netlify-only local mode; not used for Cloudflare deployment |

## Where content lives

| File | Contains |
| --- | --- |
| `src/data/site.ts` | Brand, owner-supplied contacts, founder profile and analytics switch |
| `src/data/services.ts` | Seven services and their Available / On request / Planned status, including hosting and domains |
| `src/data/pricing.ts` | Auditor proposal rates plus separately managed reseller-hosting and domain tiers |
| `src/data/categories.ts` | Six audit categories, checks and example readings |
| `src/data/steps.ts` | Six-step customer journey |
| `src/data/faqs.ts` | Audit and pricing answers |
| `src/data/navigation.ts` | Header and footer navigation |
| `public/__forms.html` | Legacy Netlify Forms definitions; excluded from Cloudflare `dist/` |
| `public/_redirects` | Cloudflare Static Assets compatibility redirects |
| `public/_headers` | Cloudflare Static Assets cache and security headers |

Audit, website-build, hourly, once-off-edit and monthly-retainer rates were verified against `C:\Users\Saint\business_auditor\auditor_config.json` and the matching `DEFAULT_CONFIG` in `business_auditor.py`; keep those figures synchronized if that proposal configuration changes. The owner-approved reseller-hosting tiers and indicative .co.za domain range in `src/data/pricing.ts` are separate public offers and must not be treated as Auditor proposal defaults. Hosting buttons send a plan-specific manual request; no payment is taken until the owner confirms the written order details. Paystack activation and recurring plan configuration remain outstanding. See [`docs/paystack-setup.md`](docs/paystack-setup.md).

## Enquiries

The Cloudflare build sets `PUBLIC_FORM_MODE=email`. Both forms submit to the Cloudflare-native `/api/enquiries` Worker route. Production uses the Zoho Mail API and the `straight-up-digital-prod` Firestore project in Johannesburg. The Worker validates the request, checks honeypot/timing signals and applies a Firestore-backed rate limit. It sends the email before best-effort Firestore storage. If Firestore is unavailable, it falls back to a per-Worker-instance hashed-IP limit, logs a warning and still acknowledges an email accepted by Zoho; the local CRM queue copy can be missing if storage fails. On 18 November 2026, one synthetic contact submission returned HTTP 200, was imported through the local CRM sync into an isolated test database and was acknowledged/deleted from Firestore. Zoho's API accepted the send; mailbox arrival was not independently verified in that test.

The plain `npm run build` remains in legacy Netlify Forms mode. Its static declarations are in `public/__forms.html`; they are retained for rollback but are removed from the Cloudflare build output. Netlify-style API URLs remain only as compatibility aliases in `cloudflare/router.ts`; the Cloudflare forms do not use them.

Online customer reports are **owner-published only**. The private local CRM previews a strict issue/impact/fix report and, after explicit owner confirmation, can send only that redacted payload to an authenticated Cloudflare Worker route. Production report publishing is currently disabled (`AUDIT_REPORTS_ENABLED=false`); the production publish token is not configured. Until that separate setup is completed and tested, the public online report and response flow is unavailable. The complete audit, pricing, internal service-fit analysis and CRM records stay private. See [`docs/online-report-setup.md`](docs/online-report-setup.md) for the remaining setup.

The private Python/SQLite CRM is not hosted on Cloudflare or exposed through this website. Migrating the CRM and audit queue to Cloudflare remains outstanding. No public request can trigger a full audit or access CRM routes/data.

## Deployment and domain

The Cloudflare target is the Worker named `straight-up-digital-cloudflare` in `wrangler.jsonc`, deployed at `https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`. The homepage, contact page and privacy page were verified with HTTP 200 on 18 November 2026. The site is static Astro output, not SSR, and does not use `@astrojs/cloudflare`. To build and deploy the current Cloudflare branch, use:

```bash
npm ci
npm run build:cloudflare
npx wrangler deploy --env production
```

Production `workers_dev` is temporarily enabled so the Worker can be reached on its generated `workers.dev` hostname. Disable it once the custom domain is live. Canonical URLs and the sitemap target `https://straightupdigital.co.za/`. The domain has not been purchased or connected in this migration task; the last DNS check found the apex and `www` unresolved. Verify before any DNS change and do not overwrite Zoho mail records.

`public/_redirects` and `public/_headers` replace the static redirects, cache rules and security headers formerly configured in `netlify.toml`. `_headers` covers static assets; `cloudflare/worker.ts` also attaches site security headers to Worker-generated responses. `netlify.toml`, `netlify/functions/` and `public/__forms.html` remain as legacy source but are not used by the Cloudflare build. `.github/workflows/netlify-production.yml` remains in the repository and listens to pushes on `main` and manual dispatch; it was not changed. Do not merge this branch into `main` until the owner separately authorizes how to retire that Netlify workflow.

## Security and privacy

This repository contains the public website and the receiving side of a narrowly scoped report publisher. The private Python Business Auditor, its database and CRM remain local and are never publicly served. Only an owner-authenticated request can publish a whitelisted customer report; visitors cannot trigger the full audit engine. The website does not claim that visitors can run an instant live audit.

There are no secrets in the repository. Production Worker secret names currently configured are `CRM_ENQUIRY_SYNC_TOKEN`, `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON`, `RATE_LIMIT_HASH_SECRET`, `ZOHO_API_CLIENT_ID` and `ZOHO_API_CLIENT_SECRET`. The obsolete `ZOHO_SMTP_PASSWORD` has been removed. `AUDIT_REPORT_PUBLISH_TOKEN` is not configured and `AUDIT_REPORTS_ENABLED` is `false`; no production Turnstile secret is configured. Production variables include `APP_ENV`, `EMAIL_PROVIDER=zoho-mail-api`, `ENQUIRY_TO_EMAIL`, `ENQUIRY_FROM_EMAIL`, `AUDIT_REPORTS_ENABLED`, `FIRESTORE_PROJECT_ID` and `PUBLIC_REPORT_HOSTS` (the SMTP host/port variables are legacy and unused by the selected provider). Store values only in Cloudflare settings/secrets and the ignored local CRM `.env`, never in Git or chat.

Firestore stores enquiry data in Johannesburg, but Cloudflare may process requests at global edge locations and Zoho Mail uses a United States data centre. This means information may be processed outside South Africa; regional Firestore storage alone does not establish POPIA compliance. The privacy notice now describes these flows, but provider terms, cross-border-transfer safeguards and retention should be reviewed by the owner or an adviser before broader live use. The owner-confirmed identity is St. John Ritchie trading as Straight Up Digital, based in Port Alfred. Paystack secrets must stay server-side; Capitec Pay is once-off only and must not be presented as monthly recurring billing.

See [`PLACEHOLDERS.md`](PLACEHOLDERS.md) for current owner actions and launch dependencies. Do not invent legal details or describe the sole-proprietor trading identity as a registered company.

## Ownership

The site, brand assets and copy are proprietary to Straight Up Digital. Montserrat and Inter are self-hosted under the SIL Open Font License; the corresponding license files are included alongside the report's font assets.
