# South African Firestore setup for Straight Up Digital

## Selected storage design

The Cloudflare Worker now uses the Firestore REST API for enquiry records, private customer reports, and rate-limit buckets. The intended database location is **`africa-south1` (Johannesburg, South Africa)**. The Worker uses the default Firestore database and sends no personal data to Cloudflare D1. Test and production should use separate Google Cloud projects, each with its own default Firestore database, so synthetic test records cannot mix with client records.

This is a technical data-location choice, not a legal certification or a claim that every part of request processing remains in South Africa. Cloudflare receives and processes form requests at the Worker edge, and Zoho receives the notification emails. Confirm the applicable operator agreements, processing locations, and privacy notice before production cutover.

## No-cost guardrails

Google documents a Firestore free quota of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound data. **Exactly one database per Google Cloud project** qualifies for that free quota. Firestore TTL deletes, point-in-time recovery, backups, restores, and clones are not in the free quota and require billing. This implementation uses the Worker’s scheduled cleanup rather than Firestore TTL and does not enable backups, PITR, or other paid features.

Do not enable a billing account or select a paid plan for this setup. If Google’s console blocks creation or enabling an API unless billing is activated, stop and ask before changing billing. Keep usage below the documented free quotas; Google may change its terms, and no-cost use is not guaranteed beyond those current published limits.

## Create each database carefully

Firestore database location cannot be changed after creation. Google also notes the default database’s location can be fixed indirectly by an earlier App Engine or related default-resource setup. Use a **new project dedicated to this application/environment**, check that no default-resource location has already been set, and create Firestore as the first location-sensitive resource. Choose:

- **Edition:** Standard
- **Database ID:** `(default)`
- **Location:** `africa-south1` (Johannesburg)
- **Security rules:** production mode (the Worker uses server-side IAM, not public client access)

Repeat in a separate project for test and production. Before continuing, verify the created database shows `africa-south1` in the console. Never create it in `eur3`, `WEUR`, or another region and assume it can later be moved.

## Create a service account for the Worker

After the database exists, create a service account in that project and grant only the project-scoped `roles/datastore.user` role for application read/write access. Do not grant Owner or Editor. Generate a JSON key only if no keyless federation option is configured; keep it private and rotate/revoke it if exposed. The Worker uses the Firestore datastore OAuth scope and sends all Firestore requests server-to-server.

Configure these values separately for each Cloudflare Worker environment:

| Setting | Type | Purpose |
|---|---|---|
| `FIRESTORE_PROJECT_ID` | non-secret environment variable | The exact Google Cloud project ID for that environment |
| `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON` | Worker secret | The service account JSON key; never put it in Git, a public `.env`, a website bundle, or chat |

Set the secret using Cloudflare’s Worker secret settings or the authenticated Wrangler secret command. Keep it separate between test and production. The project ID is intentionally blank in `wrangler.jsonc` until the owner creates the Google projects. The local test suite mocks Google’s API and does not need credentials.

The service account is used only by the Worker; Firestore client security rules are not a substitute for keeping this key private. Do not expose the credential to the browser. Keep `AUDIT_REPORTS_ENABLED=false` until the owner-only publication route, authentication secrets, privacy notice, and real email test have all been checked.

## Collections and retention

The Worker stores:

- `website_enquiries`: validated submission fields, consent metadata, a random record ID, and receipt time; the local CRM endpoint retrieves and acknowledges these records.
- `client_audit_reports`: customer-friendly online report content under a SHA-256 hash of the private access token, with an expiry timestamp.
- `request_rate_limits`: salted/hash-only rate-limit buckets with numeric expiry values.

The scheduled Worker cleanup deletes up to 450 expired report or rate-limit documents per run. Expired reports are rejected by the public route based on their expiry even if cleanup is delayed. Enquiry records are removed through the authenticated CRM acknowledgement/delete workflow; the database cleanup does not delete corresponding Zoho mailbox messages. Configure mailbox retention and erasure separately.

No production client data is copied from Netlify or the old test database by this migration. The prior Cloudflare D1 test database is not bound to the application; it was used only for synthetic development checks.

## POPIA and production cutover checks

A South African Firestore region addresses storage location for the Firestore database, but does not by itself settle POPIA compliance or cross-border processing. Before cutover:

1. Confirm Cloudflare’s and Google’s processing/operator terms for this exact use and region.
2. Verify the Zoho account’s data centre and email-retention behavior; the mailbox address alone does not prove its data location.
3. Update the public privacy notice to name the actual deployed providers, purposes, retention, deletion/opt-out route, and any cross-border processing that applies.
4. Test a synthetic enquiry, owner CRM sync and acknowledgement, report expiry/revocation, and email delivery before receiving real client data.
5. Keep the test Worker’s `workers.dev` route disabled and do not change DNS or the live Netlify site without separate owner approval.

This checklist is an implementation aid, not legal advice. A South African privacy professional should review the final data flow and notices if a formal POPIA assessment is required.

## Official sources

- [Cloud Firestore locations](https://firebase.google.com/docs/firestore/locations) — Johannesburg `africa-south1`; database location is immutable.
- [Cloud Firestore pricing and free quota](https://firebase.google.com/docs/firestore/pricing) — limits, one free database per project, and paid-only features.
- [Manage Firestore databases](https://firebase.google.com/docs/firestore/manage-databases) — database creation and production/test security modes.
- [Firestore REST document PATCH](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch), [runQuery](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery), and [commit](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit) — API operations used by the Worker.
- [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account) — server-to-server JWT bearer flow.
- [Google Datastore IAM](https://cloud.google.com/datastore/docs/access/iam) — `roles/datastore.user` description.
- [POPIA section 72](https://inforegulator.org.za/knowledge-base/popia-section-72/) and [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) — sources for a separate transfer/operator review.
