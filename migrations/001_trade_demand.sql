CREATE TABLE IF NOT EXISTS trade_demand_trades (
  slug VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO trade_demand_trades (slug, name, sort_order)
VALUES
  ('hvac', 'HVAC', 10),
  ('plumbing', 'Plumbing', 20),
  ('electrical', 'Electrical', 30),
  ('roofing', 'Roofing', 40),
  ('painting', 'Painting', 50),
  ('landscaping', 'Landscaping', 60)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS trade_demand_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'running',
  window_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_added INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_unchanged INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS trade_demand_sync_runs_source_started_idx
  ON trade_demand_sync_runs (source_system, started_at DESC);

CREATE TABLE IF NOT EXISTS trade_demand_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(80) NOT NULL,
  source_record_id VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  jurisdiction VARCHAR(120),
  permit_number VARCHAR(255) NOT NULL,
  application_type VARCHAR(255),
  work_type VARCHAR(255),
  parcel_number VARCHAR(255),
  address TEXT,
  project_name TEXT,
  description TEXT,
  status VARCHAR(255),
  processed_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  finaled_at TIMESTAMPTZ,
  contractor_name TEXT,
  contractor_business_name TEXT,
  contractor_phone VARCHAR(80),
  contractor_address TEXT,
  property_owner_name TEXT,
  estimated_cost NUMERIC,
  square_footage NUMERIC,
  neighborhood VARCHAR(255),
  latitude NUMERIC,
  longitude NUMERIC,
  raw_data JSONB NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_system, source_record_id)
);

CREATE INDEX IF NOT EXISTS trade_demand_permits_processed_idx ON trade_demand_permits (processed_at DESC);
CREATE INDEX IF NOT EXISTS trade_demand_permits_parcel_idx ON trade_demand_permits (parcel_number);

CREATE TABLE IF NOT EXISTS trade_demand_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_key VARCHAR(500) UNIQUE,
  project_group_key VARCHAR(500) NOT NULL,
  primary_permit_id UUID REFERENCES trade_demand_permits(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  project_name TEXT,
  project_phase TEXT,
  service_territory TEXT,
  parcel_number VARCHAR(255),
  address TEXT,
  city VARCHAR(160),
  county VARCHAR(160),
  jurisdiction VARCHAR(160),
  trade_slug VARCHAR(80) REFERENCES trade_demand_trades(slug) ON DELETE SET NULL,
  job_type VARCHAR(160),
  qualification_requirements TEXT[] NOT NULL DEFAULT '{}',
  evidence_type VARCHAR(60) NOT NULL,
  evidence_summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  public_contact_name TEXT,
  public_contact_phone VARCHAR(100),
  public_contact_email TEXT,
  deadline TIMESTAMPTZ,
  deadline_timezone VARCHAR(100),
  deadline_needs_verification BOOLEAN NOT NULL DEFAULT FALSE,
  submission_route TEXT,
  bid_open BOOLEAN NOT NULL DEFAULT FALSE,
  prime_contract_status VARCHAR(40) NOT NULL DEFAULT 'unknown',
  stage VARCHAR(60) NOT NULL DEFAULT 'identified',
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  staff_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rank_score INTEGER NOT NULL DEFAULT 0,
  rank_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS trade_demand_opportunities_queue_idx
  ON trade_demand_opportunities (active, rank_score DESC, next_action_at ASC);
CREATE INDEX IF NOT EXISTS trade_demand_opportunities_buyer_idx
  ON trade_demand_opportunities (lower(buyer_name));
CREATE INDEX IF NOT EXISTS trade_demand_opportunities_group_idx
  ON trade_demand_opportunities (project_group_key);

CREATE TABLE IF NOT EXISTS trade_demand_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES trade_demand_opportunities(id) ON DELETE CASCADE,
  permit_id UUID REFERENCES trade_demand_permits(id) ON DELETE SET NULL,
  source_system VARCHAR(80) NOT NULL,
  source_record_id VARCHAR(500) NOT NULL,
  evidence_type VARCHAR(60) NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deadline TIMESTAMPTZ,
  deadline_timezone VARCHAR(100),
  submission_route TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  bid_open BOOLEAN NOT NULL DEFAULT FALSE,
  expired_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_system, source_record_id, evidence_type)
);

CREATE INDEX IF NOT EXISTS trade_demand_evidence_opportunity_idx
  ON trade_demand_evidence (opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trade_demand_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID UNIQUE REFERENCES agreements(acceptance_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone VARCHAR(100),
  trades TEXT[] NOT NULL DEFAULT '{}',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  job_types TEXT[] NOT NULL DEFAULT '{}',
  capacity_notes TEXT,
  qualifications TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_demand_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES trade_demand_opportunities(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES trade_demand_clients(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  warning_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (opportunity_id, client_id)
);

CREATE INDEX IF NOT EXISTS trade_demand_assignments_active_idx
  ON trade_demand_assignments (opportunity_id, status);

CREATE TABLE IF NOT EXISTS trade_demand_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES trade_demand_opportunities(id) ON DELETE CASCADE,
  activity_type VARCHAR(60) NOT NULL,
  summary TEXT NOT NULL,
  contact_name TEXT,
  confirmation_details TEXT,
  stage_from VARCHAR(60),
  stage_to VARCHAR(60),
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS trade_demand_activities_opportunity_idx
  ON trade_demand_activities (opportunity_id, occurred_at DESC);

ALTER TABLE trade_demand_permits ALTER COLUMN parcel_number TYPE TEXT;
ALTER TABLE trade_demand_opportunities ALTER COLUMN parcel_number TYPE TEXT;
ALTER TABLE trade_demand_opportunities ALTER COLUMN project_group_key TYPE TEXT;
