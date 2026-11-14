# Straight Up Digital — website

The public marketing site for Straight Up Digital. **Business Auditor is the flagship product.** The site accepts requests for owner-run digital presence audits and can display a customer-friendly online report after the owner manually runs and reviews the full audit in the private Python CRM. It does not run the audit engine for visitors or expose the CRM.

This is a static Astro site with no client-side framework. Pages are pre-rendered, fonts are self-hosted, and Netlify hosts the public site. Netlify Forms is the default enquiry route; a separate owner-authenticated Function accepts only the deliberately curated customer report from the private local CRM.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7, static output | Fast HTML, no runtime framework, small payload |
| Styling | One hand-written CSS file | No utility framework or styling build dependency |
| Type | Montserrat + Inter, self-hosted WOFF2 | Approved brand typefaces, no font CDN requests |
| Hosting | Netlify | Git deploys, Forms, headers and redirects |
| Forms | Netlify Forms (default) | Submissions stored in Netlify; notifications are configured separately |
| Optional email | Netlify Function + Zoho SMTP, Resend or Postmark | Alternative email transport, only when intentionally configured |
| Analytics | None | Tracking remains disabled |

## Run it locally

Requires Node 22 or newer (Netlify builds pin Node 24).

```bash
npm install
npm run dev
```

The site is then at `http://localhost:4321`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm test` | Validation, function and email-adapter tests |
| `npm run test:links` | Checks every internal link in `dist/` |
| `npm run netlify:dev` | Netlify Dev, including functions and headers |

## Where content lives

| File | Contains |
| --- | --- |
| `src/data/site.ts` | Brand, owner-supplied contacts, founder profile and analytics switch |
| `src/data/services.ts` | Six existing services and their Available / On request / Planned status |
| `src/data/pricing.ts` | Published rates mirrored from the Auditor proposal configuration |
| `src/data/categories.ts` | Six audit categories, checks and example readings |
| `src/data/steps.ts` | Six-step customer journey |
| `src/data/faqs.ts` | Audit and pricing answers |
| `src/data/navigation.ts` | Header and footer navigation |
| `public/__forms.html` | Static Netlify Forms definitions for the two Astro forms |

The pricing figures were verified against `C:\Users\Saint\business_auditor\auditor_config.json` and the matching `DEFAULT_CONFIG` in `business_auditor.py`. If those proposal settings change, update `src/data/pricing.ts` and the private configuration together. Published rates include the audit point rate, website build/hosting, hourly and once-off edits, and all five configured retainers and inclusions.

## Enquiries

There are two delivery modes, selected at build time by `PUBLIC_FORM_MODE`.

**`netlify` (default).** Both forms are statically declared in `public/__forms.html` for Netlify's build-time detection; the browser submits URL-encoded fields to that static form endpoint. Submissions are stored under **Forms** in the Netlify dashboard. Form detection must be enabled in Netlify, and email notifications must be configured separately for `audit-request` and `contact-enquiry`. The notification recipient may need to be an active Netlify team member. A working inbox address on the website does not by itself create a Netlify notification.

**`email`.** The form posts to `/.netlify/functions/submit-enquiry`. The function validates submissions and filters spam before sending through Zoho SMTP, Resend or Postmark. Configure it with the variables in `.env.example`; it returns a clear error if no provider is configured.

Both modes share the form fields and consent version. The form validates in the browser; the optional function also validates server-side. Honeypot and timing checks are used, with rate limiting in the function path and optional Cloudflare Turnstile.

Online customer reports are **owner-published only**. The private local CRM previews a strict issue/impact/fix report and, after explicit owner confirmation, sends that redacted payload to an authenticated Netlify Function. The site stores it behind a random, expiring, noindex link; client responses can be emailed to the owner. The complete audit, pricing, internal service-fit analysis and CRM records stay private. See [`docs/online-report-setup.md`](docs/online-report-setup.md) for configuration and owner workflow. The feature is disabled until its private environment variables are configured.

The private CRM is not hosted by or exposed through this website. No public request can trigger a full audit or access CRM routes/data.

## Deployment and domain

The private GitHub repository is connected to the public Netlify production site. Build settings are `npm run build`, publish directory `dist`, Node 24, and functions under `netlify/functions`. `netlify.toml` supplies redirects, caching and security headers, including the Content-Security-Policy.

**Continuous deployment:** `.github/workflows/netlify-production.yml` calls the Netlify production build hook for every push to `main` (and supports manual runs) using the private GitHub Actions secret `NETLIFY_BUILD_HOOK`; never commit the hook URL. Build-hook deploys bypass the private-repository contributor check. Keep Netlify’s GitHub connection in place for Deploy Previews, which are team-private. Native Git production events can still be blocked by Netlify’s contributor policy; add `[skip netlify]` to a commit message to suppress that blocked native attempt while the GitHub Actions hook still runs. Production remains public.

The current production hostname is `https://straight-up-digital-site.netlify.app/`. The requested custom domain is `straightupdigital.co.za`, but DNS for both the apex and `www` returned NXDOMAIN when checked on 14 November 2026. Keep the Netlify hostname as the live canonical address until the domain resolves and is verified in Netlify. Configure DNS at the registrar; do not overwrite mail-related DNS records without checking the existing email setup. Once connected, set `PUBLIC_SITE_URL` to the verified custom domain and redeploy so canonical URLs and the sitemap align.

The `netlify.toml` redirects `/audit`, `/privacy-notice` and `/terms-and-conditions` to their current pages.

## Security and privacy

This repository contains the public website and the receiving side of a narrowly scoped report publisher. The private Python Business Auditor, its database and CRM remain local and are never publicly served. Only an owner-authenticated request can publish a whitelisted customer report; visitors cannot trigger the full audit engine. The website does not claim that visitors can run an instant live audit.

There are no secrets in the repository. Function secrets belong in Netlify environment variables. The site sets a strict CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` and HSTS. The privacy notice and terms are still **drafts** and need appropriate South African legal review; owner identity/address, Information Officer details and record-retention decisions remain open.

See [`PLACEHOLDERS.md`](PLACEHOLDERS.md) for current owner actions and launch dependencies. Do not invent legal details or describe the sole-proprietor trading identity as a registered company.

## Ownership

The site, brand assets and copy are proprietary to Straight Up Digital. Montserrat and Inter are self-hosted under the SIL Open Font License; the corresponding license files are included alongside the report's font assets.
