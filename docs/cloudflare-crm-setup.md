# Cloudflare CRM setup and status

## Live endpoint

- CRM: `https://straight-up-digital-cloudflare.straightupdigital.workers.dev/crm/`
- Worker API: same host under `/api/crm/`
- D1 database: `straight-up-digital-crm` (`693b8ec7-2463-4387-8903-987e91a8ee8c`)
- Database location: `WEUR` (Western Europe)

The CRM interface and D1 schema are deployed. The database is empty, and sign-in is intentionally unavailable until `CRM_ADMIN_PASSWORD` is configured. This Worker hostname is separate from the existing public website hostname `straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`; it is not a DNS or custom-domain cutover.

## Enable owner sign-in

1. Generate a unique password with a password manager (at least 32 random characters). Do not use a client password or reuse another service's credential.
2. From the website repository, run:

   ```powershell
   npx wrangler secret put CRM_ADMIN_PASSWORD --env production
   ```

3. Paste the password only into Wrangler's secure prompt. Do not put it in source, a command argument, Git, chat, or a checked-in `.env` file.
4. Open the CRM URL over HTTPS, sign in, and sign out when finished. Do not use a shared/public computer without signing out.

The production secret is not currently configured. Until it is, login returns `503 crm_auth_not_configured`, by design.

## Scope and data handling

The current cloud CRM supports owner authentication, contact search/listing, contact create/edit, pipeline stages, follow-up dates, notes, consent fields, and activity history. Quote, invoice, payment, recurring-item, project, and audit tables exist in D1, but their management screens and APIs are not implemented. The existing Python/SQLite CRM data and audit engine have not been migrated. Do not import customer records until the owner has reviewed the WEUR data location, POPIA obligations, retention/deletion needs, and the migration mapping.

Online client audit reports remain disabled. Paystack checkout and webhook handling are not implemented. Do not describe the CRM, report flow, or payments as launch-ready until those items are complete and tested.
