-- Migration 009: Universal Opportunity Intelligence Hub
-- Additive only. Existing procurement, parcel, permit, outreach, and client data remain intact.

CREATE TABLE IF NOT EXISTS oi_taxonomy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES oi_taxonomy_categories(id) ON DELETE SET NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_type VARCHAR(40) NOT NULL CHECK (category_type IN ('trade', 'service', 'equipment', 'relationship', 'opportunity')),
  trade_slug VARCHAR(80),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_taxonomy_parent_idx ON oi_taxonomy_categories(parent_id);
CREATE INDEX IF NOT EXISTS oi_taxonomy_type_trade_idx ON oi_taxonomy_categories(category_type, trade_slug, is_active);

CREATE TABLE IF NOT EXISTS oi_data_sources (
  id VARCHAR(140) PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_category VARCHAR(60) NOT NULL,
  access_method VARCHAR(60) NOT NULL,
  data_format VARCHAR(60),
  update_frequency VARCHAR(60),
  geographic_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  license_notes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'not_connected' CHECK (status IN ('connected_current', 'connected_stale', 'partial', 'not_connected', 'unavailable', 'access_restricted', 'error')),
  is_operational BOOLEAN NOT NULL DEFAULT FALSE,
  last_attempted_at TIMESTAMPTZ,
  last_successful_at TIMESTAMPTZ,
  records_ingested BIGINT NOT NULL DEFAULT 0,
  records_updated BIGINT NOT NULL DEFAULT 0,
  duplicates_detected BIGINT NOT NULL DEFAULT 0,
  missing_geography BIGINT NOT NULL DEFAULT 0,
  missing_critical_fields BIGINT NOT NULL DEFAULT 0,
  limitations TEXT,
  error_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_data_sources_status_idx ON oi_data_sources(status, source_category);

CREATE TABLE IF NOT EXISTS oi_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  legal_name TEXT NOT NULL,
  display_name TEXT,
  organization_type VARCHAR(80) NOT NULL,
  sunbiz_document_number VARCHAR(100),
  website TEXT,
  phone VARCHAR(60),
  public_email TEXT,
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  zip_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_count INTEGER,
  verification_status VARCHAR(40) NOT NULL DEFAULT 'unknown',
  source_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_hash VARCHAR(128),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_organizations_geo_idx ON oi_organizations(county, city, zip_code);
CREATE INDEX IF NOT EXISTS oi_organizations_type_idx ON oi_organizations(organization_type);
CREATE INDEX IF NOT EXISTS oi_organizations_coordinates_idx ON oi_organizations(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS oi_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  parcel_id VARCHAR(140),
  name TEXT,
  situs_address TEXT NOT NULL,
  city VARCHAR(100),
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  zip_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  boundary_geojson JSONB,
  property_use_code VARCHAR(80),
  property_use_description TEXT,
  building_sqft INTEGER,
  year_built INTEGER,
  building_count INTEGER,
  owner_name_raw TEXT,
  source_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_hash VARCHAR(128),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_properties_parcel_idx ON oi_properties(county, parcel_id);
CREATE INDEX IF NOT EXISTS oi_properties_geo_idx ON oi_properties(county, city, zip_code);
CREATE INDEX IF NOT EXISTS oi_properties_coordinates_idx ON oi_properties(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_properties_use_idx ON oi_properties(property_use_code);

CREATE TABLE IF NOT EXISTS oi_property_organizations (
  property_id UUID NOT NULL REFERENCES oi_properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES oi_organizations(id) ON DELETE CASCADE,
  relationship_type VARCHAR(60) NOT NULL CHECK (relationship_type IN ('owner', 'operator', 'property_manager', 'facility_manager', 'tenant', 'developer', 'contractor', 'other')),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  evidence_url TEXT,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  confidence VARCHAR(20) NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (property_id, organization_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS oi_property_org_relationship_idx ON oi_property_organizations(relationship_type, is_current);

CREATE TABLE IF NOT EXISTS oi_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  dedupe_hash VARCHAR(128) UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  trade_slug VARCHAR(80),
  service_category_id UUID REFERENCES oi_taxonomy_categories(id) ON DELETE SET NULL,
  classification VARCHAR(30) NOT NULL CHECK (classification IN ('confirmed', 'timing_based', 'asset_based', 'relationship', 'inferred')),
  status VARCHAR(40) NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'active', 'upcoming', 'awarded', 'expired', 'cancelled', 'archived', 'needs_review')),
  geographic_scope_type VARCHAR(30) NOT NULL DEFAULT 'unknown' CHECK (geographic_scope_type IN ('property', 'address', 'city', 'county', 'multi_county', 'statewide', 'regional', 'unknown')),
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  counties TEXT[] NOT NULL DEFAULT '{}',
  zip_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  documented_value NUMERIC,
  estimated_value NUMERIC,
  value_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  value_estimation_methodology TEXT,
  recurring_revenue_potential VARCHAR(20) NOT NULL DEFAULT 'unknown',
  physical_labor VARCHAR(20) NOT NULL DEFAULT 'unknown',
  technical_complexity VARCHAR(20) NOT NULL DEFAULT 'unknown',
  required_certifications TEXT[] NOT NULL DEFAULT '{}',
  procurement_deadline TIMESTAMPTZ,
  contract_award_date DATE,
  contract_start_date DATE,
  contract_expiration_date DATE,
  expiration_is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
  renewal_options TEXT,
  evidence_confidence SMALLINT CHECK (evidence_confidence BETWEEN 0 AND 100),
  classification_rationale TEXT NOT NULL,
  source_url TEXT,
  source_document_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovery_rule_id UUID,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_opportunities_classification_idx ON oi_opportunities(classification, status);
CREATE INDEX IF NOT EXISTS oi_opportunities_trade_idx ON oi_opportunities(trade_slug, service_category_id);
CREATE INDEX IF NOT EXISTS oi_opportunities_geo_idx ON oi_opportunities(county, city, zip_code);
CREATE INDEX IF NOT EXISTS oi_opportunities_coordinates_idx ON oi_opportunities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_opportunities_deadline_idx ON oi_opportunities(procurement_deadline) WHERE procurement_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_opportunities_expiration_idx ON oi_opportunities(contract_expiration_date) WHERE contract_expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_opportunities_discovered_idx ON oi_opportunities(discovered_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS oi_opportunities_source_idx ON oi_opportunities(source_id, source_record_id);

CREATE TABLE IF NOT EXISTS oi_opportunity_properties (
  opportunity_id UUID NOT NULL REFERENCES oi_opportunities(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES oi_properties(id) ON DELETE CASCADE,
  relationship_type VARCHAR(40) NOT NULL DEFAULT 'associated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (opportunity_id, property_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS oi_opportunity_organizations (
  opportunity_id UUID NOT NULL REFERENCES oi_opportunities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES oi_organizations(id) ON DELETE CASCADE,
  relationship_type VARCHAR(40) NOT NULL DEFAULT 'associated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (opportunity_id, organization_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS oi_opportunity_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES oi_opportunities(id) ON DELETE CASCADE,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  evidence_type VARCHAR(60) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  source_document_url TEXT,
  source_record_id TEXT,
  is_direct_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
  observed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  raw_excerpt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_evidence_opportunity_idx ON oi_opportunity_evidence(opportunity_id, is_direct_evidence);
CREATE UNIQUE INDEX IF NOT EXISTS oi_evidence_source_record_unique_idx ON oi_opportunity_evidence(opportunity_id, source_id, source_record_id, evidence_type);

CREATE TABLE IF NOT EXISTS oi_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES oi_properties(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES oi_organizations(id) ON DELETE SET NULL,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  equipment_type VARCHAR(100) NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  unit_count INTEGER,
  individual_capacity_tons NUMERIC,
  aggregate_capacity_tons NUMERIC,
  capacity_is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
  installation_date DATE,
  replacement_date DATE,
  controls_platform TEXT,
  documented_description TEXT,
  evidence_url TEXT,
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_equipment_property_type_idx ON oi_equipment(property_id, equipment_type);
CREATE INDEX IF NOT EXISTS oi_equipment_dates_idx ON oi_equipment(installation_date, replacement_date);

CREATE TABLE IF NOT EXISTS oi_permit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES oi_properties(id) ON DELETE SET NULL,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  permit_number VARCHAR(140) NOT NULL,
  permit_type VARCHAR(80) NOT NULL,
  permit_status VARCHAR(60),
  description TEXT,
  issue_date DATE,
  final_date DATE,
  job_value NUMERIC,
  contractor_name TEXT,
  contractor_license_number VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  zip_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source_url TEXT,
  source_document_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_permits_geo_date_idx ON oi_permit_records(county, permit_type, issue_date DESC);
CREATE INDEX IF NOT EXISTS oi_permits_coordinates_idx ON oi_permit_records(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS oi_procurement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES oi_opportunities(id) ON DELETE SET NULL,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  solicitation_number TEXT NOT NULL,
  purchasing_organization TEXT NOT NULL,
  title TEXT NOT NULL,
  scope_of_work TEXT,
  publication_date DATE,
  submission_deadline TIMESTAMPTZ,
  status VARCHAR(40) NOT NULL,
  procurement_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_licenses TEXT[] NOT NULL DEFAULT '{}',
  required_certifications TEXT[] NOT NULL DEFAULT '{}',
  mandatory_site_visit TEXT,
  associated_facilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  geographic_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT NOT NULL,
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  amendments JSONB NOT NULL DEFAULT '[]'::jsonb,
  record_hash VARCHAR(128),
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_procurement_status_deadline_idx ON oi_procurement_records(status, submission_deadline);

CREATE TABLE IF NOT EXISTS oi_contract_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id UUID REFERENCES oi_procurement_records(id) ON DELETE SET NULL,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_record_id TEXT,
  purchasing_organization TEXT NOT NULL,
  awarded_contractor TEXT,
  title TEXT NOT NULL,
  award_amount NUMERIC,
  award_date DATE,
  contract_start_date DATE,
  contract_expiration_date DATE,
  renewal_options TEXT,
  source_url TEXT NOT NULL,
  source_document_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_awards_dates_idx ON oi_contract_awards(award_date DESC, contract_expiration_date);

CREATE TABLE IF NOT EXISTS oi_organization_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES oi_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  property_count INTEGER,
  documented_square_feet BIGINT,
  geographic_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oi_discovery_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(140) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_type VARCHAR(80) NOT NULL,
  match_config JSONB NOT NULL,
  output_trade_slug VARCHAR(80),
  output_service_category_slug VARCHAR(120),
  output_classification VARCHAR(30) NOT NULL CHECK (output_classification IN ('timing_based', 'asset_based', 'relationship', 'inferred')),
  default_confidence SMALLINT NOT NULL CHECK (default_confidence BETWEEN 0 AND 100),
  rationale_template TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE oi_opportunities DROP CONSTRAINT IF EXISTS oi_opportunities_discovery_rule_id_fkey;
ALTER TABLE oi_opportunities ADD CONSTRAINT oi_opportunities_discovery_rule_id_fkey FOREIGN KEY (discovery_rule_id) REFERENCES oi_discovery_rules(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS oi_source_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) NOT NULL REFERENCES oi_data_sources(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  records_seen BIGINT NOT NULL DEFAULT 0,
  records_ingested BIGINT NOT NULL DEFAULT 0,
  records_updated BIGINT NOT NULL DEFAULT 0,
  duplicates_detected BIGINT NOT NULL DEFAULT 0,
  records_failed BIGINT NOT NULL DEFAULT 0,
  cursor_value TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS oi_sync_source_started_idx ON oi_source_sync_history(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS oi_saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR(40) NOT NULL CHECK (item_type IN ('opportunity', 'property', 'organization', 'region')),
  item_id UUID,
  region_geojson JSONB,
  title TEXT NOT NULL,
  notes TEXT,
  collection_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  saved_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_type, item_id, saved_by)
);

CREATE INDEX IF NOT EXISTS oi_saved_items_collection_idx ON oi_saved_items(collection_name, created_at DESC);

CREATE TABLE IF NOT EXISTS oi_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  geographic_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_evaluated_at TIMESTAMPTZ,
  last_match_count INTEGER,
  saved_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oi_geographic_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_type VARCHAR(40) NOT NULL CHECK (boundary_type IN ('county', 'zip', 'city', 'parcel', 'saved_area')),
  boundary_code VARCHAR(140) NOT NULL,
  name TEXT NOT NULL,
  county VARCHAR(100),
  geometry_geojson JSONB NOT NULL,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(boundary_type, boundary_code)
);

CREATE INDEX IF NOT EXISTS oi_boundaries_type_county_idx ON oi_geographic_boundaries(boundary_type, county);

INSERT INTO oi_taxonomy_categories (slug, name, category_type, trade_slug, sort_order) VALUES
  ('hvac-mechanical', 'HVAC & Mechanical', 'trade', 'hvac', 10),
  ('automation-controls', 'Automation & Controls', 'trade', 'automation_controls', 20),
  ('monitoring-diagnostics', 'Monitoring & Diagnostics', 'trade', 'monitoring', 30),
  ('energy-building-performance', 'Energy & Building Performance', 'trade', 'energy', 40),
  ('commercial-refrigeration', 'Commercial Refrigeration', 'trade', 'refrigeration', 50),
  ('roofing-envelope', 'Roofing & Building Envelope', 'trade', 'roofing', 60),
  ('electrical', 'Electrical', 'trade', 'electrical', 70),
  ('plumbing', 'Plumbing', 'trade', 'plumbing', 80),
  ('fire-protection', 'Fire Protection', 'trade', 'fire_protection', 90),
  ('facility-management', 'Facility Management', 'trade', 'facility_management', 100),
  ('commercial-construction', 'Commercial Construction', 'trade', 'commercial_construction', 110),
  ('security-access-control', 'Security & Access Control', 'trade', 'security', 120),
  ('property-maintenance', 'Property Maintenance', 'trade', 'property_maintenance', 130),
  ('commercial-relationships', 'Commercial Relationships', 'relationship', 'relationships', 140)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO oi_taxonomy_categories (slug, name, category_type, trade_slug, sort_order) VALUES
  ('commercial-hvac-maintenance', 'Commercial HVAC Maintenance', 'service', 'hvac', 10),
  ('preventive-maintenance-agreements', 'Preventive Maintenance Agreements', 'service', 'hvac', 20),
  ('hvac-inspections', 'HVAC Inspections', 'service', 'hvac', 30),
  ('equipment-replacement', 'Equipment Replacement', 'service', 'hvac', 40),
  ('mechanical-retrofits', 'Mechanical Retrofits', 'service', 'hvac', 50),
  ('rooftop-unit-servicing', 'Rooftop Unit Servicing', 'service', 'hvac', 60),
  ('chiller-servicing', 'Chiller Servicing', 'service', 'hvac', 70),
  ('cooling-tower-servicing', 'Cooling Tower Servicing', 'service', 'hvac', 80),
  ('boiler-servicing', 'Boiler Servicing', 'service', 'hvac', 90),
  ('refrigerant-leak-detection', 'Refrigerant Leak Detection', 'service', 'hvac', 100),
  ('bas-management', 'Building Automation System Management', 'service', 'automation_controls', 110),
  ('ddc-controls-programming', 'DDC Controls Programming', 'service', 'automation_controls', 120),
  ('niagara-servicing', 'Niagara System Servicing', 'service', 'automation_controls', 130),
  ('bacnet-integration', 'BACnet Integration', 'service', 'automation_controls', 140),
  ('controls-modernization', 'Controls Modernization', 'service', 'automation_controls', 150),
  ('remote-hvac-monitoring', 'Remote HVAC Monitoring', 'service', 'monitoring', 160),
  ('predictive-maintenance', 'Predictive Maintenance', 'service', 'monitoring', 170),
  ('fault-detection-diagnostics', 'Fault Detection & Diagnostics', 'service', 'monitoring', 180),
  ('indoor-air-quality-monitoring', 'Indoor Air Quality Monitoring', 'service', 'monitoring', 190),
  ('refrigeration-monitoring', 'Refrigeration Monitoring', 'service', 'monitoring', 200),
  ('energy-audits', 'Energy Audits', 'service', 'energy', 210),
  ('energy-optimization', 'Energy Optimization', 'service', 'energy', 220),
  ('retro-commissioning', 'Retro-Commissioning', 'service', 'energy', 230),
  ('demand-management', 'Demand Management', 'service', 'energy', 240),
  ('walk-in-cooler-servicing', 'Walk-In Cooler Servicing', 'service', 'refrigeration', 250),
  ('walk-in-freezer-servicing', 'Walk-In Freezer Servicing', 'service', 'refrigeration', 260),
  ('cold-storage-infrastructure', 'Cold Storage Infrastructure', 'service', 'refrigeration', 270),
  ('commercial-roof-inspections', 'Commercial Roof Inspections', 'service', 'roofing', 280),
  ('preventive-roof-maintenance', 'Preventive Roof Maintenance', 'service', 'roofing', 290),
  ('roof-replacement', 'Roof Replacement', 'service', 'roofing', 300),
  ('waterproofing', 'Waterproofing', 'service', 'roofing', 310),
  ('building-envelope-assessments', 'Building Envelope Assessments', 'service', 'roofing', 320),
  ('commercial-electrical-maintenance', 'Commercial Electrical Maintenance', 'service', 'electrical', 330),
  ('lighting-retrofits', 'Lighting Retrofits', 'service', 'electrical', 340),
  ('generator-servicing', 'Generator Servicing', 'service', 'electrical', 350),
  ('ev-charging-infrastructure', 'EV Charging Infrastructure', 'service', 'electrical', 360),
  ('commercial-plumbing-maintenance', 'Commercial Plumbing Maintenance', 'service', 'plumbing', 370),
  ('backflow-testing', 'Backflow Testing', 'service', 'plumbing', 380),
  ('leak-detection', 'Leak Detection', 'service', 'plumbing', 390),
  ('pump-servicing', 'Pump Servicing', 'service', 'plumbing', 400),
  ('fire-system-inspections', 'Fire System Inspections', 'service', 'fire_protection', 410),
  ('tenant-improvements', 'Tenant Improvements', 'service', 'commercial_construction', 420),
  ('building-renovations', 'Building Renovations', 'service', 'commercial_construction', 430),
  ('access-control', 'Access Control', 'service', 'security', 440),
  ('multi-trade-service-agreements', 'Multi-Trade Service Agreements', 'service', 'facility_management', 450)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO oi_discovery_rules (slug, name, description, evidence_type, match_config, output_trade_slug, output_service_category_slug, output_classification, default_confidence, rationale_template) VALUES
  ('documented-niagara-controls', 'Documented Niagara Controls', 'Recommends Niagara/BAS service when a source explicitly documents a Niagara platform.', 'equipment', '{"keywords":["niagara","tridium"]}'::jsonb, 'automation_controls', 'niagara-servicing', 'asset_based', 90, 'A source explicitly documents a Niagara or Tridium controls platform; this supports an asset-based servicing recommendation, not confirmed purchasing intent.'),
  ('documented-rooftop-units', 'Documented Rooftop Units', 'Recommends monitoring and preventive maintenance when rooftop units are documented.', 'equipment', '{"equipment_types":["rooftop unit","rtu"]}'::jsonb, 'hvac', 'preventive-maintenance-agreements', 'asset_based', 82, 'Documented rooftop equipment establishes service relevance; it does not establish an active need or purchasing decision.'),
  ('documented-walk-in-refrigeration', 'Documented Walk-In Refrigeration', 'Recommends refrigeration monitoring when walk-in equipment is documented.', 'equipment', '{"equipment_types":["walk-in cooler","walk-in freezer"]}'::jsonb, 'refrigeration', 'refrigeration-monitoring', 'asset_based', 88, 'Documented walk-in refrigeration supports a monitoring recommendation; no repair need is inferred.'),
  ('controls-contract-renewal-window', 'Controls Contract Renewal Window', 'Surfaces a timing-based controls opportunity from a documented approaching expiration.', 'contract', '{"days_before_expiration":180,"trade_keywords":["controls","automation","BAS","BMS"]}'::jsonb, 'automation_controls', 'bas-management', 'timing_based', 92, 'A documented controls contract expiration is approaching. This is a timing signal, not a confirmed future solicitation.'),
  ('published-hvac-maintenance-solicitation', 'Published HVAC Maintenance Solicitation', 'Creates a confirmed opportunity only from an active published solicitation.', 'procurement', '{"keywords":["HVAC maintenance","mechanical maintenance"],"statuses":["active","open"]}'::jsonb, 'hvac', 'commercial-hvac-maintenance', 'timing_based', 98, 'An official source documents an active HVAC or mechanical maintenance solicitation.'),
  ('documented-multi-location-operator', 'Documented Multi-Location Operator', 'Recommends a portfolio relationship opportunity when multiple operating locations are documented.', 'organization', '{"minimum_locations":2}'::jsonb, 'relationships', NULL, 'relationship', 85, 'A source documents multiple locations under this organization; common purchasing authority is not assumed.'),
  ('planned-commercial-development', 'Planned Commercial Development', 'Surfaces construction and mechanical relevance from documented planned development.', 'planning', '{"keywords":["planned development","capital improvement","new commercial construction"]}'::jsonb, 'commercial_construction', 'building-renovations', 'timing_based', 78, 'A public planning or capital document identifies planned commercial work; procurement timing and scope may remain unknown.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO oi_data_sources (id, source_name, source_url, source_category, access_method, data_format, update_frequency, geographic_coverage, license_notes, status, is_operational, limitations) VALUES
  ('fl-dor-cadastral', 'Florida Department of Revenue Property Data Portal', 'https://floridarevenue.com/property/Pages/DataPortal.aspx', 'property', 'bulk_download_and_gis', 'NAL / CSV / GIS', 'annual_with_county_updates', '{"state":"FL","counties":67}'::jsonb, 'Official public records; county field definitions and publication cadence vary.', 'partial', FALSE, 'Statewide tax-roll data is not a substitute for current county parcel geometry. Operational state is tracked per county in the county registry.'),
  ('fl-sunbiz', 'Florida Division of Corporations (Sunbiz)', 'https://dos.fl.gov/sunbiz/other-services/data-downloads/', 'corporate_registry', 'bulk_download', 'fixed_width_and_zip', 'daily_and_monthly_files', '{"state":"FL"}'::jsonb, 'Public corporate filing data subject to Florida Department of State terms.', 'partial', FALSE, 'Entity matching is probabilistic unless the filing identifier is directly documented.'),
  ('fl-dbpr-open-data', 'Florida DBPR Open Government Data', 'https://www2.myfloridalicense.com/open-government-data/', 'licensing', 'bulk_download', 'CSV', 'source_specific', '{"state":"FL"}'::jsonb, 'Official public licensing and establishment records.', 'partial', FALSE, 'DBPR license status does not establish contractor availability or purchasing intent.'),
  ('fl-ahca-facilities', 'Florida AHCA Facility Information', 'https://ahca.myflorida.com/health-care-policy-and-oversight/bureau-of-central-services/facility-information', 'facilities', 'bulk_download_and_search', 'CSV_and_web', 'source_specific', '{"state":"FL"}'::jsonb, 'Official public facility records.', 'not_connected', FALSE, 'Facility type and operating status require source-specific normalization; no active adapter is claimed.'),
  ('fl-mfmp', 'MyFloridaMarketPlace', 'https://vendor.myfloridamarketplace.com/', 'procurement', 'public_portal', 'web_and_documents', 'continuous', '{"state":"FL","level":"state"}'::jsonb, 'Official State of Florida procurement portal.', 'not_connected', FALSE, 'Portal access and document structures vary; no connected adapter is claimed by this migration.'),
  ('sam-gov', 'SAM.gov Contract Opportunities', 'https://sam.gov/content/opportunities', 'procurement', 'official_api', 'JSON', 'daily', '{"state":"FL","level":"federal"}'::jsonb, 'Subject to SAM.gov API terms and API-key requirements.', 'not_connected', FALSE, 'Requires an authorized API key and Florida place-of-performance filtering.'),
  ('us-census-tigerweb-counties', 'U.S. Census Bureau TIGERweb Counties', 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1', 'geographic_boundaries', 'arcgis_rest', 'GeoJSON', 'annual_vintage', '{"state_fips":"12","boundary_type":"county"}'::jsonb, 'U.S. Census Bureau public geographic data.', 'connected_current', TRUE, 'Cartographic boundaries support visualization and filtering; they are not parcel boundaries or legal surveys.'),
  ('openfreemap-basemap', 'OpenFreeMap Public Vector Basemap', 'https://openfreemap.org/', 'basemap', 'hosted_vector_tiles', 'MapLibre_vector_tiles', 'weekly_upstream_updates', '{"coverage":"global"}'::jsonb, 'Attribution required: OpenFreeMap © OpenMapTiles; data from OpenStreetMap. Public service is provided without an SLA.', 'connected_current', TRUE, 'Core application remains compatible with self-hosted PMTiles if the public service changes.'),
  ('openstreetmap', 'OpenStreetMap', 'https://www.openstreetmap.org/copyright', 'geography', 'upstream_map_data', 'OSM', 'continuous', '{"coverage":"global"}'::jsonb, 'Open Database License; attribution required.', 'connected_current', TRUE, 'Used for basemap geography through OpenFreeMap, not as evidence of ownership, equipment, or purchasing intent.'),
  ('overture-maps', 'Overture Maps Foundation Data', 'https://docs.overturemaps.org/', 'geography_and_places', 'cloud_native_bulk', 'GeoParquet', 'monthly', '{"coverage":"global"}'::jsonb, 'Dataset-specific licenses apply.', 'not_connected', FALSE, 'Useful for future place and building enrichment; no production adapter is claimed.'),
  ('fl-permit-jurisdictions', 'Florida County and Municipal Permit Systems', 'https://www.myfloridalicense.com/intentions2.asp?chBoard=true&boardid=05&SID=', 'permits', 'source_specific_registry', 'ArcGIS_CSV_HTML_documents', 'jurisdiction_specific', '{"state":"FL","coverage":"jurisdiction_specific"}'::jsonb, 'Access methods and public-record terms vary by jurisdiction.', 'partial', FALSE, 'There is no single statewide permit API. Each operational jurisdiction must be tracked independently.'),
  ('fl-local-procurement', 'Florida Local Public Procurement Portals', 'https://www.dms.myflorida.com/business_operations/state_purchasing', 'procurement', 'source_specific_registry', 'API_RSS_CSV_HTML_documents', 'source_specific', '{"state":"FL","coverage":"county_municipal_authority_district"}'::jsonb, 'Official portals only; third-party paid aggregators are not required.', 'partial', FALSE, 'Registry coverage is broader than connected ingestion. Each source row records its actual synchronization state.')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE oi_opportunities IS 'Universal source-traceable opportunity records. Inferred and asset-based records must never be presented as confirmed purchasing demand.';
COMMENT ON COLUMN oi_opportunities.latitude IS 'Documented coordinate only. Never populate from a county centroid or fabricated address geocode.';
COMMENT ON COLUMN oi_opportunities.documented_value IS 'Value explicitly documented by a source.';
COMMENT ON COLUMN oi_opportunities.estimated_value IS 'Estimate permitted only with value_estimation_methodology.';
