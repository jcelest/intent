-- Migration 018: statewide, measurement-safe portfolio acquisition.
-- A licensed operator is valid portfolio evidence but is never relabeled as a
-- third-party property manager. Properties, units, buildings, and area remain
-- separate measurements throughout reconciliation.

ALTER TABLE fl_management_firms
  ADD COLUMN IF NOT EXISTS portfolio_external_key TEXT,
  ADD COLUMN IF NOT EXISTS verified_properties_total INTEGER,
  ADD COLUMN IF NOT EXISTS verified_units_total INTEGER,
  ADD COLUMN IF NOT EXISTS verified_buildings_total INTEGER,
  ADD COLUMN IF NOT EXISTS verified_square_feet_total BIGINT,
  ADD COLUMN IF NOT EXISTS service_relevant_properties INTEGER,
  ADD COLUMN IF NOT EXISTS service_relevant_units INTEGER,
  ADD COLUMN IF NOT EXISTS service_relevant_buildings INTEGER,
  ADD COLUMN IF NOT EXISTS service_relevant_square_feet BIGINT,
  ADD COLUMN IF NOT EXISTS vendor_accessible_properties INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_accessible_units INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_accessible_buildings INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_accessible_square_feet BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS fl_management_firms_external_key_idx
  ON fl_management_firms(portfolio_external_key)
  WHERE portfolio_external_key IS NOT NULL;

ALTER TABLE fl_management_portfolio_relationships
  ADD COLUMN IF NOT EXISTS is_verified_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS location_count INTEGER,
  ADD COLUMN IF NOT EXISTS building_count INTEGER,
  ADD COLUMN IF NOT EXISTS square_feet BIGINT,
  ADD COLUMN IF NOT EXISTS service_relevant BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maintenance_scope JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE fl_management_portfolio_relationships
SET is_verified_portfolio = TRUE
WHERE is_verified_management = TRUE
  AND is_verified_portfolio = FALSE;

ALTER TABLE fl_management_portfolio_relationships
  DROP CONSTRAINT IF EXISTS fl_management_portfolio_relationships_relationship_kind_check,
  DROP CONSTRAINT IF EXISTS fl_management_portfolio_relationships_property_kind_check;

ALTER TABLE fl_management_portfolio_relationships
  ADD CONSTRAINT fl_management_portfolio_relationships_relationship_kind_check
  CHECK (relationship_kind IN (
    'verified_management',
    'licensed_operator',
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
  ADD CONSTRAINT fl_management_portfolio_relationships_property_kind_check
  CHECK (property_kind IN (
    'building', 'rental_unit', 'condominium_unit', 'community',
    'commercial_location', 'association', 'multifamily_property',
    'vacation_rental_portfolio', 'unknown'
  )),
  ADD CONSTRAINT fl_management_portfolio_relationships_location_count_check
  CHECK (location_count IS NULL OR location_count > 0),
  ADD CONSTRAINT fl_management_portfolio_relationships_building_count_check
  CHECK (building_count IS NULL OR building_count > 0),
  ADD CONSTRAINT fl_management_portfolio_relationships_square_feet_check
  CHECK (square_feet IS NULL OR square_feet > 0),
  ADD CONSTRAINT fl_management_portfolio_relationships_verified_portfolio_check
  CHECK (
    NOT is_verified_portfolio
    OR relationship_kind IN ('verified_management', 'licensed_operator')
  );

CREATE INDEX IF NOT EXISTS fl_management_portfolio_verified_idx
  ON fl_management_portfolio_relationships(firm_id, is_current, is_verified_portfolio);

CREATE TABLE IF NOT EXISTS fl_management_portfolio_county_coverage (
  source_key VARCHAR(100) NOT NULL REFERENCES fl_management_portfolio_sources(source_key) ON DELETE CASCADE,
  county VARCHAR(40) NOT NULL,
  source_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  verified_firms INTEGER NOT NULL DEFAULT 0,
  verified_properties INTEGER NOT NULL DEFAULT 0,
  verified_units INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  limitation TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_key, county),
  CHECK (status IN ('covered', 'partial', 'no_records', 'blocked', 'pending'))
);

ALTER TABLE fl_management_firm_portfolio_evidence
  DROP CONSTRAINT IF EXISTS fl_management_firm_portfolio_evidence_evidence_layer_check;

ALTER TABLE fl_management_firm_portfolio_evidence
  ADD CONSTRAINT fl_management_firm_portfolio_evidence_evidence_layer_check
  CHECK (evidence_layer IN (
    'tax_mailing_address', 'eviction_filings', 'permit_contact',
    'sunbiz_associations', 'association_units', 'claimed_doors',
    'verified_managed_properties', 'verified_association_units',
    'published_portfolio', 'verified_communities',
    'management_responsibilities', 'maintenance_responsibilities',
    'vendor_accessible_portfolio', 'verified_properties', 'verified_units',
    'verified_buildings', 'verified_square_feet', 'service_relevant_portfolio'
  ));

COMMENT ON COLUMN fl_management_portfolio_relationships.is_verified_portfolio IS
  'Direct authoritative or first-party portfolio evidence. Licensed operators remain distinct from verified third-party managers.';
COMMENT ON COLUMN fl_management_portfolio_relationships.maintenance_scope IS
  'Source-documented responsibility flags only: individual_unit_repairs, common_area_maintenance, and commercial_building_systems.';
