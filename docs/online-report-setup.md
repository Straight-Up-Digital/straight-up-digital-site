# Online Business Auditor report: owner setup and workflow

## How the customer journey works

The public form collects an audit request; it does **not** run the private Python engine. The owner reviews the request and manually runs the full audit in the local, private Business Auditor CRM. In the CRM, the owner previews the customer version, confirms its wording and accuracy, then publishes it. Only the deliberately whitelisted report is sent over HTTPS to a production-only Netlify Function. The full scorecard, pricing, internal service-fit analysis, competitor strategy and CRM data remain in the local private application.

The published report opens as a branded webpage. It describes each finding as **what we found, why it matters and what to do next**. It includes no PDF download or internal scorecard. The owner can open the generated private link in the CRM and share it with the client by email. Link delivery is deliberately manual; the system does not send a report link to a client automatically.

On the report page, the client may say they want to discuss the fixes, request a meeting, or ask a question. Their name, email, selected next step, optional meeting preference, message and consent timestamp are sent to `straightupdigital@zohomail.com`. This response is not a purchase or binding acceptance. The full audit is not attached to the owner notification; the owner already has it in the local CRM. Reports use unguessable bearer links, are marked noindex/no-store, stop working after 30 days and are deleted by the daily cleanup function after expiry.

## Configuration required before the report feature can go live

The website feature is **disabled by default** and fails closed. Set the following as production-context Netlify environment variables with **Functions** scope. Do not put real values in `netlify.toml`, Git, email, or chat.

```text
AUDIT_REPORTS_ENABLED=true
AUDIT_REPORT_PUBLISH_TOKEN=<same high-entropy token as the local CRM>
EMAIL_PROVIDER=zoho-smtp
ENQUIRY_TO_EMAIL=straightupdigital@zohomail.com
ENQUIRY_FROM_EMAIL=straightupdigital@zohomail.com
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USERNAME=straightupdigital@zohomail.com
ZOHO_SMTP_PASSWORD=<Zoho app-specific password>
```

Generate a token locally with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Put the same value in Netlify's `AUDIT_REPORT_PUBLISH_TOKEN` and the ignored local `business_auditor/.env` file. In that private `.env`, set `AUDIT_REPORT_PUBLISH_URL=https://straight-up-digital-site.netlify.app/.netlify/functions/publish-audit-report`. Never commit `.env`. If Zoho displays different SMTP details in its account-specific Server Configurations page, use those values; with two-factor authentication, Zoho may require an app-specific password.

After changing Netlify environment variables, trigger a new production deployment so the Function runtime receives the values. The existing GitHub Actions build-hook workflow is the deployment path; no paid plan change is needed. Netlify Functions and Blobs consume the account's included usage credits, so monitor usage; the Free plan can pause usage at its hard limit.

## Separate initial-request email setting

The public audit request form currently uses **Netlify Forms**, which is separate from the Zoho Function that handles customer report responses. In Netlify Forms, change the existing notification recipient from `Hello@straightupdigital.co.za` to `straightupdigital@zohomail.com`, confirm the new notification from that inbox, and test the initial audit request. Do not assume that configuring Zoho SMTP changes Netlify Forms notifications.

## Owner operating checklist

1. Review the incoming request and verify the business identity/website; the public site does not run audits automatically.
2. Run the full audit in the private local CRM.
3. Open the customer report preview. Check that the findings are accurate and understandable, then confirm the review checkbox and publish.
4. Open the report from the CRM and send its private link to the client using your normal email. The CRM shows the expiry date; a refreshed report creates a new link and the older link remains live until its expiry.
5. When the client responds, the chosen next step and message arrive by email at the configured business inbox. Follow up manually and agree any scope and price separately in writing.

Test the complete flow using a fabricated audit and an address you control before sending any real client's report. Deploy-preview report routes intentionally return unavailable/not found and must not be used for live report data, because Netlify Blobs stores are shared across deploy contexts.
