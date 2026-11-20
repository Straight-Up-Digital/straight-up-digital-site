PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_expiry ON crm_sessions (expires_at);

CREATE TABLE IF NOT EXISTS crm_login_attempts (
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (ip_hash, window_start)
);
CREATE INDEX IF NOT EXISTS idx_crm_login_attempts_window
  ON crm_login_attempts (window_start);

CREATE TABLE IF NOT EXISTS crm_contacts (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  town TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  lead_status TEXT NOT NULL DEFAULT 'new',
  pipeline_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (pipeline_stage IN ('new', 'contacted', 'quoted', 'accepted', 'live', 'lost')),
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  audit_score INTEGER CHECK (audit_score IS NULL OR (audit_score BETWEEN 0 AND 100)),
  audit_date TEXT NOT NULL DEFAULT '',
  next_follow_up_date TEXT NOT NULL DEFAULT '',
  quote_amount_cents INTEGER CHECK (quote_amount_cents IS NULL OR quote_amount_cents >= 0),
  monthly_fee_cents INTEGER CHECK (monthly_fee_cents IS NULL OR monthly_fee_cents >= 0),
  hosting_enabled INTEGER NOT NULL DEFAULT 0 CHECK (hosting_enabled IN (0, 1)),
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0, 1)),
  consent_text_version TEXT NOT NULL DEFAULT '',
  consent_recorded_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant_updated
  ON crm_contacts (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant_stage
  ON crm_contacts (tenant_id, pipeline_stage, next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant_business
  ON crm_contacts (tenant_id, business_name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS crm_activities (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'outbound',
  summary TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact
  ON crm_activities (tenant_id, contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_quotes (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  sent_at TEXT NOT NULL DEFAULT '',
  due_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, quote_number),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_contact
  ON crm_quotes (tenant_id, contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_invoices (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  quote_id TEXT,
  invoice_number TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  issued_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'part_paid', 'paid', 'void')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, invoice_number),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, quote_id) REFERENCES crm_quotes (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_due
  ON crm_invoices (tenant_id, status, due_on);

CREATE TABLE IF NOT EXISTS crm_payments (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  invoice_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_on TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'manual',
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES crm_invoices (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_crm_payments_contact
  ON crm_payments (tenant_id, contact_id, paid_on DESC);

CREATE TABLE IF NOT EXISTS crm_recurring_items (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('hosting', 'retainer', 'domain_renewal', 'other')),
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'annual')),
  next_due_on TEXT NOT NULL DEFAULT '',
  last_paid_on TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_crm_recurring_due
  ON crm_recurring_items (tenant_id, active, next_due_on);

CREATE TABLE IF NOT EXISTS crm_projects (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_content'
    CHECK (status IN ('waiting_content', 'in_design', 'in_build', 'review', 'live', 'paused')),
  domain TEXT NOT NULL DEFAULT '',
  hosting_notes TEXT NOT NULL DEFAULT '',
  project_notes TEXT NOT NULL DEFAULT '',
  started_on TEXT NOT NULL DEFAULT '',
  go_live_on TEXT NOT NULL DEFAULT '',
  next_milestone TEXT NOT NULL DEFAULT '',
  next_milestone_on TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, contact_id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_audits (
  tenant_id TEXT NOT NULL DEFAULT 'straight-up-digital',
  id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  audit_date TEXT NOT NULL,
  score INTEGER CHECK (score IS NULL OR (score BETWEEN 0 AND 100)),
  coverage INTEGER CHECK (coverage IS NULL OR (coverage BETWEEN 0 AND 100)),
  confidence TEXT NOT NULL DEFAULT '',
  summary_json TEXT NOT NULL DEFAULT '{}',
  report_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES crm_contacts (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_crm_audits_contact
  ON crm_audits (tenant_id, contact_id, audit_date DESC);
