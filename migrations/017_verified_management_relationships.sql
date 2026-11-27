-- Migration 017: source-grounded, deduplicated management relationships.
-- Indirect evidence remains searchable but never establishes a verified portfolio floor.

ALTER TABLE fl_management_firms
  ADD COLUMN IF NOT EXISTS published_portfolio_size INTEGER,
  ADD COLUMN IF NOT EXISTS individually_verified_managed_properties INTEGER,
  ADD COLUMN IF NOT EXISTS verified_association_units INTEGER,
  ADD COLUMN IF NOT EXISTS verified_communities INTEGER,
  ADD COLUMN IF NOT EXISTS verified_buildings INTEGER,
  ADD COLUMN IF NOT EXISTS verified_rental_units INTEGER,
  ADD COLUMN IF NOT EXISTS verified_condominium_units INTEGER,
  ADD COLUMN IF NOT EXISTS verified_commercial_locations INTEGER,
  ADD COLUMN IF NOT EXISTS verified_residential_properties INTEGER,
  ADD COLUMN IF NOT EXISTS verified_commercial_properties INTEGER,
  ADD COLUMN IF NOT EXISTS documented_management_responsibilities INTEGER,
  ADD COLUMN IF NOT EXISTS documented_maintenance_responsibilities INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_accessible_portfolio_size INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_by_county JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS portfolio_by_zip JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS fl_management_portfolio_sources (
  source_key VARCHAR(100) PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_url TEXT NOT NULL,
  jurisdiction TEXT,
  refresh_interval_hours INTEGER NOT NULL DEFAULT 168 CHECK (refresh_interval_hours > 0),
  etag TEXT,
  last_modified TEXT,
  content_hash VARCHAR(64),
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ,
  last_record_count INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_type IN (
    'official_government_extract',
    'official_firm_portfolio',
    'managed_community_directory',
    'public_leasing_listing',
    'association_website',
    'public_management_agreement',
    'county_parcel_record',
    'corporate_filing',
    'published_portfolio_report'
  ))
);

CREATE TABLE IF NOT EXISTS fl_management_firm_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES fl_management_firms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_kind VARCHAR(40) NOT NULL,
  verification_status VARCHAR(30) NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firm_id, normalized_alias),
  CHECK (alias_kind IN ('legal_name', 'dba', 'published_name', 'manager_name', 'former_name')),
  CHECK (verification_status IN ('authoritative', 'first_party', 'corroborated', 'supplementary'))
);

CREATE INDEX IF NOT EXISTS fl_management_firm_aliases_normalized_idx
  ON fl_management_firm_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS fl_management_portfolio_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES fl_management_firms(id) ON DELETE CASCADE,
  source_key VARCHAR(100) NOT NULL REFERENCES fl_management_portfolio_sources(source_key) ON DELETE RESTRICT,
  source_record_id TEXT NOT NULL,
  discovery_direction VARCHAR(30) NOT NULL,
  relationship_kind VARCHAR(40) NOT NULL,
  verification_level VARCHAR(30) NOT NULL,
  is_verified_management BOOLEAN NOT NULL DEFAULT FALSE,
  property_kind VARCHAR(30) NOT NULL DEFAULT 'unknown',
  canonical_property_key TEXT NOT NULL,
  property_name TEXT,
  property_address TEXT,
  city TEXT,
  county TEXT,
  state VARCHAR(2) DEFAULT 'FL',
  zip_code VARCHAR(10),
  parcel_id TEXT,
  association_project_number TEXT,
  unit_count INTEGER CHECK (unit_count IS NULL OR unit_count > 0),
  published_portfolio_size INTEGER CHECK (published_portfolio_size IS NULL OR published_portfolio_size > 0),
  commercial_classification VARCHAR(20) NOT NULL DEFAULT 'unknown',
  management_responsibility BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_responsibility BOOLEAN NOT NULL DEFAULT FALSE,
  vendor_accessible BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT NOT NULL,
  corroborating_source_url TEXT,
  evidence_summary TEXT NOT NULL,
  source_as_of_date DATE NOT NULL,
  source_updated_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_hash VARCHAR(64) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_key, source_record_id, firm_id, relationship_kind),
  CHECK (discovery_direction IN ('firm_to_property', 'property_to_firm')),
  CHECK (relationship_kind IN (
    'verified_management',
    'published_self_report',
    'ownership',
    'registered_agent',
    'mailing_address_match',
    'management_contact',
    'leasing_activity',
    'maintenance_responsibility',
    'vendor_access',
    'other_indirect'
  )),
  CHECK (verification_level IN ('authoritative', 'first_party', 'corroborated', 'supplementary', 'unverified')),
  CHECK (property_kind IN ('building', 'rental_unit', 'condominium_unit', 'community', 'commercial_location', 'association', 'unknown')),
  CHECK (commercial_classification IN ('residential', 'commercial', 'mixed', 'unknown')),
  CHECK (NOT is_verified_management OR relationship_kind = 'verified_management')
);

CREATE INDEX IF NOT EXISTS fl_management_portfolio_relationships_firm_idx
  ON fl_management_portfolio_relationships(firm_id, is_current, is_verified_management);

CREATE INDEX IF NOT EXISTS fl_management_portfolio_relationships_property_idx
  ON fl_management_portfolio_relationships(canonical_property_key, county, zip_code);

CREATE INDEX IF NOT EXISTS fl_management_portfolio_relationships_source_idx
  ON fl_management_portfolio_relationships(source_key, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS fl_management_portfolio_source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key VARCHAR(100) NOT NULL REFERENCES fl_management_portfolio_sources(source_key) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  fetched_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  updated_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  unchanged BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (status IN ('running', 'succeeded', 'failed', 'not_modified'))
);

CREATE INDEX IF NOT EXISTS fl_management_portfolio_source_runs_source_idx
  ON fl_management_portfolio_source_runs(source_key, started_at DESC);

ALTER TABLE fl_management_firm_portfolio_evidence
  DROP CONSTRAINT IF EXISTS fl_management_firm_portfolio_evidence_evidence_layer_check;

ALTER TABLE fl_management_firm_portfolio_evidence
  ADD CONSTRAINT fl_management_firm_portfolio_evidence_evidence_layer_check
  CHECK (evidence_layer IN (
    'tax_mailing_address',
    'eviction_filings',
    'permit_contact',
    'sunbiz_associations',
    'association_units',
    'claimed_doors',
    'verified_managed_properties',
    'verified_association_units',
    'published_portfolio',
    'verified_communities',
    'management_responsibilities',
    'maintenance_responsibilities',
    'vendor_accessible_portfolio'
  ));

COMMENT ON COLUMN fl_management_firms.portfolio_floor IS
  'Conservative floor from explicit, deduplicated management relationships only. Mailing, ownership, registered-agent, leasing, eviction, and self-reported evidence are excluded.';

COMMENT ON TABLE fl_management_portfolio_relationships IS
  'Source-cited firm-to-property and property-to-firm evidence. Direct management is explicitly separated from supplementary signals.';
