-- Migration 011: operational source integrity, incremental sync state, and document provenance.

ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS last_status_checked_at TIMESTAMPTZ;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS stale_after TIMESTAMPTZ;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS amendment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE oi_opportunities ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128);

ALTER TABLE oi_procurement_records ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;
ALTER TABLE oi_procurement_records ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE oi_procurement_records ADD COLUMN IF NOT EXISTS last_status_checked_at TIMESTAMPTZ;
ALTER TABLE oi_procurement_records ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128);

ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS records_unchanged BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS documents_seen BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS documents_fetched BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS documents_changed BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS amendments_detected BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS cancellations_detected BIGINT NOT NULL DEFAULT 0;
ALTER TABLE oi_source_sync_history ADD COLUMN IF NOT EXISTS awards_detected BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS oi_source_sync_state (
  source_id VARCHAR(140) PRIMARY KEY REFERENCES oi_data_sources(id) ON DELETE CASCADE,
  adapter_key VARCHAR(140) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_minutes INTEGER NOT NULL CHECK (schedule_minutes >= 15),
  stale_after_minutes INTEGER NOT NULL CHECK (stale_after_minutes >= schedule_minutes),
  cursor JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_successful_at TIMESTAMPTZ,
  last_status VARCHAR(40) NOT NULL DEFAULT 'never_run',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS oi_source_sync_due_idx
  ON oi_source_sync_state(enabled, next_run_at) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS oi_source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) NOT NULL REFERENCES oi_data_sources(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES oi_opportunities(id) ON DELETE CASCADE,
  procurement_record_id UUID REFERENCES oi_procurement_records(id) ON DELETE CASCADE,
  source_record_id TEXT,
  document_url TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type VARCHAR(60) NOT NULL DEFAULT 'attachment',
  version_label TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  content_type TEXT,
  http_etag TEXT,
  http_last_modified TEXT,
  sha256 VARCHAR(64),
  byte_size BIGINT,
  original_content BYTEA,
  extracted_text TEXT,
  extraction_status VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'extracted', 'unsupported', 'failed', 'too_large')),
  extraction_error TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, document_url, version_number)
);

CREATE INDEX IF NOT EXISTS oi_source_documents_opportunity_idx
  ON oi_source_documents(opportunity_id, is_current, published_at DESC);
CREATE INDEX IF NOT EXISTS oi_source_documents_procurement_idx
  ON oi_source_documents(procurement_record_id, is_current);
CREATE INDEX IF NOT EXISTS oi_source_documents_text_idx
  ON oi_source_documents USING GIN (to_tsvector('english', COALESCE(extracted_text, '')));

CREATE TABLE IF NOT EXISTS oi_opportunity_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES oi_opportunities(id) ON DELETE CASCADE,
  source_id VARCHAR(140) REFERENCES oi_data_sources(id) ON DELETE SET NULL,
  previous_status VARCHAR(40),
  new_status VARCHAR(40) NOT NULL,
  change_reason TEXT NOT NULL,
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS oi_status_history_opportunity_idx
  ON oi_opportunity_status_history(opportunity_id, observed_at DESC);

ALTER TABLE oi_discovery_rules DROP CONSTRAINT IF EXISTS oi_discovery_rules_output_classification_check;
ALTER TABLE oi_discovery_rules ADD CONSTRAINT oi_discovery_rules_output_classification_check
  CHECK (output_classification IN ('confirmed', 'timing_based', 'asset_based', 'relationship', 'inferred'));

UPDATE oi_discovery_rules
SET output_classification = 'confirmed', updated_at = CURRENT_TIMESTAMP
WHERE slug = 'published-hvac-maintenance-solicitation';

-- Rows without a source adapter or source record are the retired demonstration fixtures.
DELETE FROM fl_commercial_bids WHERE source_id IS NULL;
DELETE FROM fl_permits WHERE permit_number IN (
  'BLD-2024-03912-MECH', 'OSC-2023-8821-HVAC', 'SEM-2024-1102-MECH',
  'ESC-2024-0551-MECH', 'SRC-2023-7410-MECH'
);
DELETE FROM fl_licenses WHERE license_number IN (
  'CMC1249821', 'CGC1518920', 'CCC1329012', 'EC13004812',
  'CMC056910', 'CAM48920', 'CAC1817402'
);

UPDATE fl_procurement_sources
SET status = 'discovered', error_status = NULL
WHERE last_successful_at IS NULL;

UPDATE oi_data_sources
SET status = CASE WHEN last_successful_at IS NULL THEN 'not_connected' ELSE status END,
    is_operational = CASE WHEN last_successful_at IS NULL THEN FALSE ELSE is_operational END,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO oi_data_sources (
  id, source_name, source_url, source_category, access_method, data_format,
  update_frequency, geographic_coverage, license_notes, status, is_operational, limitations
) VALUES
  ('fl-facts', 'Florida Accountability Contract Tracking System (FACTS)', 'https://facts.fldfs.com/Search/ContractSearch.aspx', 'contract_awards', 'public_web_search', 'HTML_and_documents', 'daily', '{"state":"FL","level":"state"}'::jsonb, 'Official Florida Department of Financial Services public contract records.', 'not_connected', FALSE, 'FACTS exposes an ASP.NET public search rather than a documented API; adapter verifies the response structure on every run.'),
  ('usaspending-fl', 'USAspending Florida Contract Awards', 'https://api.usaspending.gov/', 'contract_awards', 'official_api', 'JSON', 'daily', '{"state":"FL","level":"federal"}'::jsonb, 'Official U.S. government spending data; no API key required.', 'not_connected', FALSE, 'Award records document existing contracts. Renewal records derived from expiration dates are timing signals, not confirmed future solicitations.'),
  ('fl-fdot-lettings', 'Florida Department of Transportation Lettings', 'https://www.fdot.gov/contracts/lettings', 'procurement', 'official_html', 'HTML_and_documents', 'daily', '{"state":"FL","agency":"FDOT"}'::jsonb, 'Official FDOT public letting, addendum, and award information.', 'not_connected', FALSE, 'Central-office letting coverage; district and professional-services sources require separate adapters.'),
  ('miamidade-current-solicitations', 'Miami-Dade County Current Solicitations', 'https://wwwx.miamidade.gov/apps/ISD/stratproc/Home/CurrentSolicitations', 'procurement', 'official_html', 'HTML_and_documents', 'daily', '{"state":"FL","county":"Miami-Dade"}'::jsonb, 'Official Miami-Dade County Strategic Procurement public listing.', 'not_connected', FALSE, 'Public listing coverage; INFORMS may require vendor registration for submission and some document access.')
  ,('orlando-permits', 'City of Orlando Permit Applications', 'https://data.cityoforlando.net/Permitting/Permit-Applications/ryhf-m453', 'permits', 'socrata_api', 'JSON', 'daily', '{"state":"FL","county":"Orange","city":"Orlando"}'::jsonb, 'Official City of Orlando open data.', 'not_connected', FALSE, 'Permit activity documents permitted work; it does not by itself establish an open purchasing need.')
ON CONFLICT (id) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_category = EXCLUDED.source_category,
  access_method = EXCLUDED.access_method,
  data_format = EXCLUDED.data_format,
  update_frequency = EXCLUDED.update_frequency,
  geographic_coverage = EXCLUDED.geographic_coverage,
  license_notes = EXCLUDED.license_notes,
  limitations = EXCLUDED.limitations,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO oi_source_sync_state (source_id, adapter_key, schedule_minutes, stale_after_minutes) VALUES
  ('fl-mfmp', 'mfmp', 60, 180),
  ('fl-facts', 'facts', 1440, 2880),
  ('sam-gov', 'sam-gov', 360, 720),
  ('usaspending-fl', 'usaspending', 1440, 2880),
  ('fl-fdot-lettings', 'fdot-lettings', 360, 720),
  ('miamidade-current-solicitations', 'miamidade', 360, 720)
  ,('orlando-permits', 'orlando-permits', 1440, 2880)
ON CONFLICT (source_id) DO UPDATE SET
  adapter_key = EXCLUDED.adapter_key,
  schedule_minutes = EXCLUDED.schedule_minutes,
  stale_after_minutes = EXCLUDED.stale_after_minutes,
  updated_at = CURRENT_TIMESTAMP;

-- Retry files classified before filename and file-signature detection was available.
UPDATE oi_source_documents
SET extraction_status = 'pending', updated_at = CURRENT_TIMESTAMP
WHERE extraction_status = 'unsupported';

-- Previously generated fallback domains used a hyphenated search query as the host.
DELETE FROM fl_search_verifications
WHERE evidence::text LIKE '%Official Portal & Business Information%'
   OR evidence::text LIKE '%Verified commercial trade licensing and active regional presence%';
