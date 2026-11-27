-- Migration 019: statewide maintenance purchasing intelligence.
-- Collection, refresh, and coverage are uniform across all 67 Florida counties.
-- Evidence class is explicit so first-party statements, authoritative records,
-- indirect signals, and administrator confirmations are never conflated.

ALTER TABLE fl_management_firms
  ADD COLUMN IF NOT EXISTS portfolio_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS maintenance_trades TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS maintenance_delivery_model VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS vendor_onboarding_status VARCHAR(30) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS vendor_registration_url TEXT,
  ADD COLUMN IF NOT EXISTS purchasing_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS purchasing_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS purchasing_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS documented_maintenance_contracts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documented_purchasing_activities INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documented_contractor_relationships INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documented_service_volume INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_by_service_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS maintenance_intelligence_updated_at TIMESTAMPTZ;

ALTER TABLE fl_management_firms
  DROP CONSTRAINT IF EXISTS fl_management_firms_maintenance_delivery_model_check,
  DROP CONSTRAINT IF EXISTS fl_management_firms_vendor_onboarding_status_check;

ALTER TABLE fl_management_firms
  ADD CONSTRAINT fl_management_firms_maintenance_delivery_model_check
    CHECK (maintenance_delivery_model IN ('in_house', 'outsourced', 'mixed', 'unknown')),
  ADD CONSTRAINT fl_management_firms_vendor_onboarding_status_check
    CHECK (vendor_onboarding_status IN ('public', 'invitation_required', 'documented_no_public_path', 'unknown'));

CREATE INDEX IF NOT EXISTS fl_management_firms_portfolio_types_idx
  ON fl_management_firms USING GIN(portfolio_types);
CREATE INDEX IF NOT EXISTS fl_management_firms_maintenance_trades_idx
  ON fl_management_firms USING GIN(maintenance_trades);
CREATE INDEX IF NOT EXISTS fl_management_firms_vendor_onboarding_idx
  ON fl_management_firms(vendor_onboarding_status);

CREATE TABLE IF NOT EXISTS fl_maintenance_intelligence_sources (
  source_key VARCHAR(120) PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_url TEXT NOT NULL,
  geographic_scope VARCHAR(30) NOT NULL DEFAULT 'statewide',
  refresh_interval_hours INTEGER NOT NULL DEFAULT 168 CHECK (refresh_interval_hours > 0),
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  last_record_count INTEGER,
  content_hash VARCHAR(64),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_type IN (
    'authoritative_government', 'official_company_website', 'official_vendor_portal',
    'public_management_agreement', 'public_procurement_record', 'facility_document',
    'manual_confirmation', 'other_authoritative'
  )),
  CHECK (geographic_scope IN ('statewide', 'national', 'firm', 'property', 'county'))
);

CREATE TABLE IF NOT EXISTS fl_maintenance_purchasing_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES fl_management_firms(id) ON DELETE CASCADE,
  source_key VARCHAR(120) NOT NULL REFERENCES fl_maintenance_intelligence_sources(source_key) ON DELETE RESTRICT,
  source_record_id TEXT NOT NULL,
  intelligence_type VARCHAR(40) NOT NULL,
  verification_class VARCHAR(30) NOT NULL,
  fact_status VARCHAR(20) NOT NULL,
  portfolio_type VARCHAR(30),
  trade_category VARCHAR(50),
  service_category VARCHAR(80),
  county VARCHAR(40),
  zip_code VARCHAR(10),
  delivery_model VARCHAR(20),
  responsibility_scope VARCHAR(50),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  purchasing_contact_name TEXT,
  purchasing_contact_email TEXT,
  purchasing_contact_phone TEXT,
  vendor_registration_url TEXT,
  documented_volume INTEGER CHECK (documented_volume IS NULL OR documented_volume >= 0),
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT NOT NULL,
  source_as_of_date DATE NOT NULL,
  valid_through DATE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  permanent BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firm_id, source_key, source_record_id, intelligence_type),
  CHECK (intelligence_type IN (
    'portfolio_type', 'maintenance_responsibility', 'maintenance_delivery_model',
    'vendor_onboarding', 'vendor_requirement', 'purchasing_contact',
    'maintenance_contract', 'purchasing_activity', 'contractor_relationship',
    'service_volume', 'geographic_portfolio'
  )),
  CHECK (verification_class IN ('authoritative', 'first_party_self_reported', 'indirect', 'manual_confirmed')),
  CHECK (fact_status IN ('verified', 'self_reported', 'indirect', 'unknown')),
  CHECK (portfolio_type IS NULL OR portfolio_type IN (
    'multifamily', 'single_family_rental', 'commercial', 'hoa', 'condominium',
    'hospitality', 'vacation_rental', 'other'
  )),
  CHECK (delivery_model IS NULL OR delivery_model IN ('in_house', 'outsourced', 'mixed', 'unknown')),
  CHECK (NOT permanent OR verification_class = 'manual_confirmed'),
  CHECK (verification_class <> 'manual_confirmed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS fl_maintenance_intelligence_firm_idx
  ON fl_maintenance_purchasing_intelligence(firm_id, is_current, intelligence_type);
CREATE INDEX IF NOT EXISTS fl_maintenance_intelligence_geo_idx
  ON fl_maintenance_purchasing_intelligence(county, zip_code);
CREATE INDEX IF NOT EXISTS fl_maintenance_intelligence_trade_idx
  ON fl_maintenance_purchasing_intelligence(trade_category, service_category);
CREATE INDEX IF NOT EXISTS fl_maintenance_intelligence_search_idx
  ON fl_maintenance_purchasing_intelligence USING GIN(to_tsvector('english', title || ' ' || summary));

CREATE TABLE IF NOT EXISTS fl_maintenance_intelligence_source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(120) NOT NULL REFERENCES fl_maintenance_intelligence_sources(source_key) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  fetched_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (status IN ('running', 'succeeded', 'failed', 'not_modified', 'skipped'))
);

CREATE TABLE IF NOT EXISTS fl_maintenance_intelligence_county_coverage (
  source_key VARCHAR(120) NOT NULL REFERENCES fl_maintenance_intelligence_sources(source_key) ON DELETE CASCADE,
  county VARCHAR(40) NOT NULL,
  source_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  firms_with_evidence INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  limitation TEXT,
  last_success_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(source_key, county),
  CHECK (status IN ('covered', 'partial', 'no_records', 'blocked', 'pending'))
);

CREATE TABLE IF NOT EXISTS fl_maintenance_website_scan_state (
  firm_id UUID PRIMARY KEY REFERENCES fl_management_firms(id) ON DELETE CASCADE,
  official_website_url TEXT NOT NULL,
  verification_id UUID REFERENCES fl_search_verifications(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  pages_checked INTEGER NOT NULL DEFAULT 0,
  facts_accepted INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  content_hash VARCHAR(64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending', 'succeeded', 'failed', 'no_facts'))
);

CREATE INDEX IF NOT EXISTS fl_maintenance_website_scan_due_idx
  ON fl_maintenance_website_scan_state(next_scan_at, status);

-- Remove historical acceptance-test and placeholder-client behavior. Real
-- client rows remain intact, and administrators choose filters at query time.
UPDATE oi_channel_verification_queue
SET priority = 100, is_acceptance_test = FALSE, updated_at = CURRENT_TIMESTAMP;

UPDATE fl_ingestion_queue
SET priority_order = 100, updated_at = CURRENT_TIMESTAMP;

UPDATE fl_county_parcel_registry
SET is_priority_county = FALSE, updated_at = CURRENT_TIMESTAMP;

DELETE FROM oi_client_platform_coverage
WHERE client_id IS NULL AND LOWER(client_name) = 'novation';

COMMENT ON TABLE fl_maintenance_purchasing_intelligence IS
  'Source-attributed maintenance purchasing facts. Relationship intelligence is not an active solicitation unless a separate procurement record proves demand.';
COMMENT ON COLUMN fl_maintenance_purchasing_intelligence.permanent IS
  'Administrator-confirmed records are retained across collector refreshes and may only be superseded by another attributed record.';
