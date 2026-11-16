# South African Firestore setup for Straight Up Digital

## Selected storage design and current status

The Cloudflare Worker code uses the Firestore REST API for enquiry records, private customer reports, and rate-limit buckets. Firestore is the intended persistent data store; the application has no D1 binding. The separate Firebase projects `straight-up-digital-test` and `straight-up-digital-prod` have each been created on the Spark plan, which the Console showed as no cost ($0/month). Both have a first/default Standard database in **`africa-south1` (Johannesburg)**, production-mode client rules, and no scheduled backups. Both databases are empty, and no billing account is attached. Both project IDs are configured separately in Wrangler.

No service accounts, service-account keys, Worker secrets, or production data have been created or configured. The test Worker remains unrouted from `workers.dev`, and the Firestore-backed Worker code has not yet been deployed.

This is a technical data-location choice, not a legal certification or a claim that every part of request processing remains in South Africa. Cloudflare receives and processes live form requests at the Worker edge, and Zoho receives notification emails. The current live Netlify site still serves the old production build and stores its Netlify Blob data in `us-east-2`; the Johannesburg Firestore migration has not been cut over. Confirm provider terms, processing locations, and the privacy notice before production cutover.

## No-cost guardrails

Google documents a Firestore free quota of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound data. **Exactly one database per Google Cloud project** qualifies for that free quota. Firestore TTL deletes, point-in-time recovery, backups, restores, and clones are not in the free quota and require billing. Each project has one Standard `(default)` database; scheduled backups are disabled. This implementation uses the Worker's scheduled cleanup instead of Firestore TTL.

Do not enable a billing account or select a paid plan for this setup. Both projects currently show Spark/no-cost and no billing account. If Google blocks an API operation unless billing is activated, stop and ask before changing billing. Keep usage below the published free quotas; if limits are exceeded without billing, requests may stop working. Google may change its terms, and no-cost use is not guaranteed beyond current limits.

## Database configuration

Firestore database location cannot be changed after creation. Google also notes the default database's location can be fixed indirectly by an earlier App Engine or related default-resource setup. Both projects were created separately, and Firestore was initialized as the location-sensitive database. The verified configuration is:

| Setting | Test | Production |
|---|---|---|
| Project ID | `straight-up-digital-test` | `straight-up-digital-prod` |
| Billing | Spark; no billing account ($0/month shown) | Spark; no billing account ($0/month shown) |
| Edition | Standard | Standard |
| Database ID | `(default)` | `(default)` |
| Location | `africa-south1` (Johannesburg) | `africa-south1` (Johannesburg) |
| Client security rules | Production mode; denies client SDK reads/writes | Production mode; denies client SDK reads/writes |
| Scheduled backups | Disabled | Disabled |
| Data | Empty; no client records | Empty; no client records |

The old Cloudflare D1 test database was verified empty and deleted. Do not recreate or use D1 for client data.

## Worker service-account access (not configured yet)

The Worker accesses Firestore server-to-server via the datastore OAuth scope and IAM. Firestore client security rules do not replace server IAM access control. The current Worker adapter expects a service-account JSON secret; it does not yet implement a keyless federation flow. No service account or key has been created. Obtain explicit owner approval before creating long-lived keys or placing them in Cloudflare secrets.

After separate approval, use a dedicated service account per project and grant only the project-scoped `roles/datastore.user` role; do not grant Owner or Editor. Keep test and production credentials separate. If a key is authorized, generate only the minimum required service-account key and revoke/rotate it if exposed. Never put it in Git, a public `.env`, a website bundle, or chat.

Configure these values separately for each Cloudflare Worker environment:

| Setting | Type | Purpose |
|---|---|---|
| `FIRESTORE_PROJECT_ID` | Non-secret environment variable | Exact project ID for that environment; both are configured in Wrangler |
| `GOOGLE_FIRESTORE_SERVICE_ACCOUNT_JSON` | Worker secret | Service-account JSON key; not configured |
| `RATE_LIMIT_HASH_SECRET` | Worker secret | Salt for hashed rate-limit identifiers |
| `CRM_ENQUIRY_SYNC_TOKEN` | Worker secret | Authenticates the local CRM sync endpoint |
| `AUDIT_REPORT_PUBLISH_TOKEN` | Worker secret | Authenticates owner report publication/revocation |
| `TURNSTILE_SECRET_KEY` | Worker secret | Optional form bot-verification secret, if enabled |
| `ZOHO_SMTP_PASSWORD` | Worker secret | Zoho SMTP app password; not configured for Cloudflare |

The local test suite mocks Google's API and does not need credentials. Keep all secret values out of Git and chat. Keep `AUDIT_REPORTS_ENABLED=false` until owner-only publication, authentication secrets, privacy notice, and a real email test have all been checked.

## Collections and retention

The Worker stores:

- `website_enquiries`: validated submission fields, consent metadata, a random record ID, and receipt time; the local CRM endpoint retrieves and acknowledges these records.
- `client_audit_reports`: customer-friendly online report content under a SHA-256 hash of the private access token, with an expiry timestamp.
- `request_rate_limits`: salted/hash-only rate-limit buckets with numeric expiry values.

The scheduled Worker cleanup deletes up to 450 expired report or rate-limit documents per run. Expired reports are rejected by the public route based on expiry even if cleanup is delayed. Enquiry records are removed through the authenticated CRM acknowledgement/delete workflow; database cleanup does not delete Zoho mailbox messages. Configure mailbox retention and erasure separately.

No production client data has been copied from Netlify or the former D1 database. Both new Firestore databases are empty.

## POPIA and production cutover checks

A South African Firestore region addresses storage location for the Firestore database, but does not by itself settle POPIA compliance or cross-border processing. Before cutover:

1. Confirm both project plans remain Spark/no-cost, both databases remain in `africa-south1`, and no billing account or paid feature is enabled.
2. Confirm Cloudflare's and Google's processing/operator terms for this exact use and region.
3. Verify the Zoho account's data centre and email-retention behavior; the mailbox address alone does not prove its data location.
4. Update the public privacy notice to name the actual deployed providers, purposes, retention, deletion/opt-out route, and any cross-border processing that applies.
5. Obtain explicit authorization before creating service-account keys and configuring Cloudflare secrets; then deploy only to the unrouted test Worker and run synthetic enquiry, CRM sync/acknowledgement, report expiry/revocation, and email checks.
6. Keep the test Worker's `workers.dev` route disabled and do not change DNS or the live Netlify site without separate owner approval.

This checklist is an implementation aid, not legal advice. A South African privacy professional should review the final data flow and notices if a formal POPIA assessment is required.

## Official sources

- [Cloud Firestore locations](https://firebase.google.com/docs/firestore/locations) — Johannesburg `africa-south1`; database location is immutable.
- [Cloud Firestore pricing and free quota](https://firebase.google.com/docs/firestore/pricing) — limits, one free database per project, and paid-only features.
- [Manage Firestore databases](https://firebase.google.com/docs/firestore/manage-databases) — database creation and security modes.
- [Firestore REST document PATCH](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch), [runQuery](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery), and [commit](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit) — API operations used by the Worker.
- [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account) — server-to-server JWT bearer flow.
- [Google Datastore IAM](https://cloud.google.com/datastore/docs/access/iam) — `roles/datastore.user` description.
- [POPIA section 72](https://inforegulator.org.za/knowledge-base/popia-section-72/) and [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) — sources for a separate transfer/operator review.
