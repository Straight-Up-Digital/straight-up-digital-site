# Straight Up Digital — website

The public marketing site for Straight Up Digital: a six-category digital presence audit, the services that follow it, and one enquiry route that reaches a person.

It is a static Astro site with no client-side framework. Pages are pre-rendered, the only JavaScript is the mobile navigation, the Core animation, the services index and the enquiry form, and all fonts are served from this domain. Netlify hosts the site and receives enquiries through Netlify Forms by default.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro 7, static output | Fast HTML, no runtime framework, small payload |
| Styling | One hand-written CSS file | No utility framework or build step, full control of the brand |
| Type | Archivo + Instrument Sans, self-hosted WOFF2 | Approved brand typefaces, no font CDN requests |
| Hosting | Netlify | Git deploys, Forms, headers and redirects in one place |
| Forms | Netlify Forms (default) | No third-party account, submissions stored in Netlify |
| Optional forms | Netlify Function + Resend/Postmark | Only when the owner wants email delivery instead |
| Analytics | None | No tracking until a privacy-friendly tool is approved |

## Run it locally

Requires Node 22 or newer (the Netlify build pins Node 24).

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

## Where the content lives

Almost all copy is data, not markup. Edit the data file, rebuild, and every page that uses it updates.

| File | Contains |
| --- | --- |
| `src/data/site.ts` | Name, tagline, contact details, legal entity, founder, analytics switch |
| `src/data/services.ts` | Six services and their Available / On request / Planned status |
| `src/data/pricing.ts` | Pricing principles, cost factors and the package slots |
| `src/data/categories.ts` | The six audit categories, checks and example readings |
| `src/data/steps.ts` | The six-step journey |
| `src/data/faqs.ts` | Audit and pricing questions |
| `src/data/navigation.ts` | Header and footer navigation |

Page copy that is not repeated lives in the page files under `src/pages/`. Design tokens — colour, type, spacing, motion — are at the top of `src/styles/global.css`.

## Enquiries

There are two delivery modes, selected at build time by `PUBLIC_FORM_MODE`.

**`netlify` (default).** The form posts to Netlify Forms. Submissions appear under **Forms** in the Netlify dashboard, where a notification email can be added without touching code. This needs no email provider, no API key and no function. It is the recommended launch path.

**`email`.** The form posts to `/.netlify/functions/submit-enquiry`. The function validates the submission, filters spam, then sends it through Resend or Postmark. Configure it with the variables in `.env.example`; nothing else changes. If no provider is configured the function returns a clear 503 instead of pretending the message was sent.

Both modes use the same payload, including the consent timestamp and the privacy notice version. The form validates in the browser for a fast, accessible experience and again on the server, which is the authority. A honeypot, a timing check, platform rate limiting and optional Cloudflare Turnstile sit in front of delivery.

The private CRM is **not** connected. `netlify/lib/crm.mts` documents the future payload shape and is deliberately disabled; no CRM URL, token or request exists in this repository.

## Deploying to Netlify

The repository is ready to connect as a Git-based Netlify site.

1. In Netlify, choose **Add new site → Import an existing project**, connect GitHub and select this repository.
2. Accept the detected settings, or enter them explicitly: build command `npm run build`, publish directory `dist`, Node 24 (already pinned in `netlify.toml`).
3. Deploy. `netlify.toml` supplies the redirects, cache rules and security headers, including a Content-Security-Policy that allows no inline scripts.
4. Open **Forms → audit-request → Settings** and add the notification email address. Do the same for `contact-enquiry`.
5. Submit one real test through each form and confirm it appears in the Forms inbox.
6. Connect the custom domain under **Domain management**. Canonicals, the sitemap and the Open Graph URL use Netlify's site URL, so they update automatically. Set `PUBLIC_SITE_URL` only if you want to force a fixed address.

`netlify.toml` also redirects `/audit`, `/privacy-notice` and `/terms-and-conditions` to their current pages, so old links keep working.

## Security and privacy

This repository contains the public website only. It has no connection to the private Business Auditor application, its database or its CRM, and it must not be given one through a public endpoint.

There are no secrets in the repository. Function secrets belong in Netlify environment variables. The site sets a strict CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` and HSTS. Enquiries are used only to respond to the enquiry, as described in the draft privacy notice.

The privacy notice and terms of use are **drafts** and are marked as such on the page. They need a lawyer's review before launch.

## Before launch

`PLACEHOLDERS.md` lists every item the owner still needs to supply, where it appears and which file changes it. Nothing in that list has been filled with an invented value.

## Ownership

The site, brand assets and copy are proprietary to Straight Up Digital. Archivo and Instrument Sans are licensed under the SIL Open Font License; their licence permits self-hosting.
