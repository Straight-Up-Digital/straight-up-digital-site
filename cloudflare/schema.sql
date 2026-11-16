PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS website_enquiries (
  id TEXT PRIMARY KEY NOT NULL,
  received_at TEXT NOT NULL,
  fields_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_website_enquiries_received
  ON website_enquiries (received_at, id);

CREATE TABLE IF NOT EXISTS client_audit_reports (
  token_key TEXT PRIMARY KEY NOT NULL,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_audit_reports_expiry
  ON client_audit_reports (expires_at);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_request_rate_limits_expiry
  ON request_rate_limits (expires_at);
