-- Migration 014: defensible Tier 1 and Tier 2 commercial-channel coverage.
-- Procurement data is intentionally excluded from every object in this migration.

CREATE TABLE IF NOT EXISTS oi_channel_sources (
  source_key VARCHAR(120) PRIMARY KEY,
  channel_key VARCHAR(80) NOT NULL,
  tier SMALLINT NOT NULL CHECK (tier IN (1, 2)),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  authority_type VARCHAR(40) NOT NULL,
  refresh_frequency VARCHAR(60),
  status VARCHAR(40) NOT NULL DEFAULT 'not_connected',
  source_reported_count BIGINT,
  database_count BIGINT NOT NULL DEFAULT 0,
  snapshot_date DATE,
  last_attempted_at TIMESTAMPTZ,
  last_successful_at TIMESTAMPTZ,
  limitations TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_channel_sources_channel_idx
  ON oi_channel_sources(channel_key, status);

CREATE TABLE IF NOT EXISTS oi_channel_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_key VARCHAR(80) NOT NULL,
  tier SMALLINT NOT NULL CHECK (tier IN (1, 2)),
  source_key VARCHAR(120) NOT NULL REFERENCES oi_channel_sources(source_key) ON DELETE RESTRICT,
  source_record_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  dba_name TEXT,
  entity_type VARCHAR(80) NOT NULL,
  license_number VARCHAR(100),
  document_number VARCHAR(100),
  source_status VARCHAR(60),
  is_source_active BOOLEAN,
  pm_type VARCHAR(30) CHECK (pm_type IS NULL OR pm_type IN ('residential', 'commercial', 'mixed', 'unknown')),
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(10),
  zip_code VARCHAR(20),
  phone VARCHAR(60),
  phone_24_7 VARCHAR(60),
  website_url TEXT,
  has_website BOOLEAN,
  review_count INTEGER,
  location_count INTEGER,
  building_sqft BIGINT,
  tonnage_screen VARCHAR(40),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  evidence_url TEXT NOT NULL,
  source_snapshot_date DATE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_key, source_record_id)
);

CREATE INDEX IF NOT EXISTS oi_channel_entities_channel_county_idx
  ON oi_channel_entities(channel_key, county);
CREATE INDEX IF NOT EXISTS oi_channel_entities_license_idx
  ON oi_channel_entities(license_number) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_channel_entities_document_idx
  ON oi_channel_entities(document_number) WHERE document_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS oi_channel_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID NOT NULL REFERENCES oi_channel_entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES oi_channel_entities(id) ON DELETE CASCADE,
  relationship_type VARCHAR(80) NOT NULL,
  evidence_url TEXT NOT NULL,
  source_snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_entity_id, to_entity_id, relationship_type, evidence_url)
);

CREATE TABLE IF NOT EXISTS oi_search_query_budgets (
  provider VARCHAR(40) PRIMARY KEY,
  query_cap INTEGER NOT NULL CHECK (query_cap > 0),
  queries_used INTEGER NOT NULL DEFAULT 0 CHECK (queries_used >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reset_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (queries_used <= query_cap)
);

INSERT INTO oi_search_query_budgets(provider, query_cap, queries_used)
VALUES ('serper', 2500, 0)
ON CONFLICT (provider) DO UPDATE SET query_cap = LEAST(oi_search_query_budgets.query_cap, 2500);

CREATE TABLE IF NOT EXISTS oi_search_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  target_type VARCHAR(60),
  target_id TEXT,
  query_hash VARCHAR(64) NOT NULL,
  query_text TEXT NOT NULL,
  status VARCHAR(40) NOT NULL,
  result_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_search_query_log_provider_created_idx
  ON oi_search_query_log(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS oi_channel_verification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES oi_channel_entities(id) ON DELETE CASCADE,
  county VARCHAR(100),
  channel_key VARCHAR(80) NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 100,
  is_acceptance_test BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'VERIFIED', 'HUMAN_REVIEW', 'NOT_FOUND', 'CLOSED', 'UNVERIFIED_BUDGET', 'PROVIDER_NOT_CONFIGURED', 'FAILED')),
  not_before TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_id)
);

CREATE INDEX IF NOT EXISTS oi_channel_verification_queue_work_idx
  ON oi_channel_verification_queue(status, priority, created_at);

ALTER TABLE oi_channel_verification_queue ADD COLUMN IF NOT EXISTS is_acceptance_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS oi_client_platform_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES trade_demand_clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  platform_key VARCHAR(80) NOT NULL,
  platform_name TEXT NOT NULL,
  sort_order SMALLINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NOT_REGISTERED'
    CHECK (status IN ('NOT_REGISTERED', 'IN_PROGRESS', 'REGISTERED')),
  status_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_name, platform_key)
);

CREATE INDEX IF NOT EXISTS oi_client_platform_coverage_client_idx
  ON oi_client_platform_coverage(client_name, sort_order);

WITH platforms(platform_key, platform_name, sort_order) AS (
  VALUES
    ('servicechannel', 'ServiceChannel', 1),
    ('lessen', 'Lessen', 2),
    ('corrigopro', 'CorrigoPro', 3),
    ('vixxo', 'Vixxo', 4),
    ('dmg-pro', 'DMG Pro', 5),
    ('sms-assist', 'SMS Assist', 6),
    ('chain-store-maintenance', 'Chain Store Maintenance', 7),
    ('ferrandino-and-son', 'Ferrandino and Son', 8),
    ('cbre-vendor-system', 'CBRE vendor system', 9),
    ('jll-corrigo', 'JLL/Corrigo', 10)
), clients AS (
  SELECT id, name FROM trade_demand_clients WHERE active = TRUE
  UNION ALL
  SELECT NULL::uuid, 'Novation'
  WHERE NOT EXISTS (SELECT 1 FROM trade_demand_clients WHERE LOWER(name) = 'novation')
)
INSERT INTO oi_client_platform_coverage(client_id, client_name, platform_key, platform_name, sort_order)
SELECT clients.id, clients.name, platforms.platform_key, platforms.platform_name, platforms.sort_order
FROM clients CROSS JOIN platforms
ON CONFLICT (client_name, platform_key) DO UPDATE SET
  client_id = COALESCE(EXCLUDED.client_id, oi_client_platform_coverage.client_id),
  platform_name = EXCLUDED.platform_name,
  sort_order = EXCLUDED.sort_order,
  updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS oi_direct_account_county_coverage (
  county VARCHAR(100) PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_status VARCHAR(40) NOT NULL,
  parcels_count BIGINT NOT NULL DEFAULT 0,
  business_matched_count BIGINT NOT NULL DEFAULT 0,
  verified_active_count BIGINT NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  limitations TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO oi_channel_sources(
  source_key, channel_key, tier, source_name, source_url, authority_type,
  refresh_frequency, status, limitations
) VALUES
  ('dbpr-cam', 'cam_firms', 1, 'Florida DBPR Community Association Managers and Firms', 'https://www2.myfloridalicense.com/community-association-managers-and-firms/public-records/', 'authoritative_state_license', 'weekly', 'not_connected', 'Stage A is not complete until every active CAB firm and CAM individual in the weekly file is stored.'),
  ('sunbiz-associations', 'associations', 1, 'Florida Division of Corporations active nonprofit files', 'https://dos.fl.gov/sunbiz/other-services/data-downloads/quarterly-data/', 'authoritative_state_registry', 'quarterly_snapshot_daily_delta', 'not_connected', 'Association name matching is a candidate rule. A CAM relationship requires its own source evidence.'),
  ('pm-composite-directory', 'property_managers', 1, 'County search sweep, NARPM, IREM, and published business tax receipts', 'https://www.narpm.org/find/property-managers/', 'reconciled_directory_universe', 'quarterly', 'not_connected', 'No single authoritative statewide commercial property manager registry exists. Each component count and date must remain visible.'),
  ('fl-cadastral-direct', 'direct_accounts', 1, 'Florida county property appraiser and statewide cadastral records', 'https://floridarevenue.com/property/Pages/DataPortal.aspx', 'authoritative_property_records', 'county_specific', 'partial', 'Count only ingested parcels. Counties requiring records requests remain explicitly uncovered.'),
  ('dbpr-mold', 'restoration', 2, 'Florida DBPR Mold-Related Services', 'https://www2.myfloridalicense.com/mold-related-services/public-records/', 'authoritative_state_license', 'weekly', 'not_connected', 'DBPR licenses cover mold assessors and remediators, not the entire restoration-company universe.'),
  ('restoration-franchises', 'restoration', 2, 'SERVPRO, Paul Davis, and BELFOR official location directories', 'https://www.servpro.com/locations/fl', 'official_company_directory', 'monthly', 'not_connected', 'Each brand count must reconcile separately to its official locator.'),
  ('fm-platform-fixed', 'fm_platforms', 2, 'Intent fixed FM platform registration list', 'https://intentrev.net/admin/opportunity-intelligence/sources', 'client_operations_registry', 'on_change', 'connected_current', 'This is a fixed ten-platform client registration checklist, not a business opportunity count.'),
  ('chain-operator-composite', 'chains_operators', 2, 'Official chain locators, franchise disclosures, Sunbiz, and parcel ownership aggregation', 'https://dos.fl.gov/sunbiz/other-services/data-downloads/', 'reconciled_operator_universe', 'quarterly', 'not_connected', 'Operator relationships and facility contacts require direct public evidence.')
ON CONFLICT (source_key) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  authority_type = EXCLUDED.authority_type,
  refresh_frequency = EXCLUDED.refresh_frequency,
  limitations = EXCLUDED.limitations,
  updated_at = CURRENT_TIMESTAMP;

UPDATE oi_channel_sources
SET source_reported_count=10, database_count=10, snapshot_date=CURRENT_DATE,
    last_successful_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
WHERE source_key='fm-platform-fixed';
