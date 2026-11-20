# Online Business Auditor report: Cloudflare setup and owner workflow

## Current production status

The Cloudflare Worker is live at `https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`. Its production Firestore project is `straight-up-digital-prod` in `africa-south1` (Johannesburg), and enquiry email uses the Zoho Mail API. **Online report publishing and client responses are currently disabled**: production has `AUDIT_REPORTS_ENABLED=false`, and the Cloudflare secret `AUDIT_REPORT_PUBLISH_TOKEN` has not been configured. No production customer report should be published until the remaining setup and synthetic test below are complete.

The CRM interface is separately deployed at `https://straight-up-digital-cloudflare.straightupdigital.workers.dev/crm/`, backed by an empty D1 database in `WEUR` (Western Europe). Its owner-password secret is not set, so login is fail-closed; no customer records have been migrated. This does not migrate the Python audit engine, and the different Worker hostname is not a custom-domain cutover. Review cross-border processing before putting real client data in D1.

The email API has accepted a synthetic contact enquiry, but a report-response message has not yet been tested. The public report flow is separate from contact/audit enquiries.

## Customer journey

The public form does not run the full audit engine. Until that engine is migrated, the owner reviews the request and manually runs the audit in the existing local Business Auditor app. The owner previews the customer-safe version, checks the wording and accuracy, then explicitly publishes it. The Worker accepts only the normalized customer report, not the full internal scorecard, pricing, service-fit analysis, competitor strategy or CRM data.

A published report opens as a branded web page, not a PDF download. Each finding explains what was found, why it matters to the business, and what the customer can do next. A client can ask a question, request a meeting, or indicate that they want to discuss the proposed fixes. These choices are non-binding. The response is emailed to `straightupdigital@zohomail.com`; it is not stored in the website's report collection.

Report links are unguessable bearer links, use `noindex`/`no-store` protections, and expire after 30 days. The daily Cloudflare scheduled cleanup removes expired Firestore report records. The owner can revoke an individual link from the local CRM before expiry.

## Required configuration before enabling reports

1. Generate a new, high-entropy token locally, distinct from any Netlify token. Keep it private. In the website repository, run `npx wrangler secret put AUDIT_REPORT_PUBLISH_TOKEN --env production` and enter the token directly into Wrangler's prompt. Do not put the value in Git, chat, or a command line that saves shell history.
2. In the production `wrangler.jsonc` environment, set `AUDIT_REPORTS_ENABLED` to `true`. Add the exact production `workers.dev` hostname (`straight-up-digital-cloudflare.stjohn-toperformer.workers.dev`) to `PUBLIC_REPORT_HOSTS`; that allowlist is required for safe report revocation. When a custom domain is approved and live, include its exact hostname(s) too.
3. In the ignored local Business Auditor `.env`, set these names using the same token and the current production endpoint. Never commit `.env` or share values:

   ```text
   CLOUDFLARE_WORKER_HOST=straight-up-digital-cloudflare.stjohn-toperformer.workers.dev
   CLOUDFLARE_AUDIT_REPORT_PUBLISH_URL=https://straight-up-digital-cloudflare.stjohn-toperformer.workers.dev/api/publish-audit-report
   CLOUDFLARE_AUDIT_REPORT_PUBLISH_TOKEN=<same token stored as the Worker secret>
   ```

4. Verify the production Worker still has `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON`, `RATE_LIMIT_HASH_SECRET`, `ZOHO_API_CLIENT_ID` and `ZOHO_API_CLIENT_SECRET` configured. The active email provider is `zoho-mail-api`; do not re-add or use the retired SMTP password.
5. Run the site's tests and production dry-run, then deploy only to Cloudflare. The current site build commands are `npm run build:cloudflare` and `npx wrangler deploy --env production`.
6. Use a clearly synthetic report to test publish, browser rendering, client response email to the business inbox, delete/revocation and daily expiry behavior. Verify the response contains no internal scorecard or pricing. Do not use real customer information until the owner has reviewed the updated privacy notice and cross-border data-processing obligations.

## Local CRM settings and operating steps

The CRM publisher reads `CLOUDFLARE_WORKER_HOST`, `CLOUDFLARE_AUDIT_REPORT_PUBLISH_URL` and `CLOUDFLARE_AUDIT_REPORT_PUBLISH_TOKEN` from the private local `.env`. It permits only the known Straight Up Digital report route on HTTPS and requires the returned link hostname to be allowlisted. `CLOUDFLARE_WORKER_HOST` must be the exact hostname only, without a scheme, path or port.

After the feature is enabled and synthetic tests pass:

1. Review the enquiry and verify the business and website.
2. Run the complete audit in the private CRM.
3. Preview the customer-facing version. Correct or remove anything that is not useful, accurate or safe to disclose.
4. Confirm the review in the CRM and publish. Share the generated link manually by email; the site does not automatically send the report link.
5. When a client responds, follow up manually. Agree any scope, price and contract separately in writing.
6. If the report or contact is deleted from the CRM, revoke its online report first. The CRM blocks unsafe local erasure if Cloudflare revocation fails.

The full audit engine and CRM must remain bound to `127.0.0.1`; never expose the local CRM through a public tunnel. A private report link is still a bearer credential: share it only with the intended client, and do not include it in public posts or analytics.
