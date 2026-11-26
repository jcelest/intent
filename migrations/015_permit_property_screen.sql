-- Migration 015: fail-closed parcel classification for every permit-derived record.

ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS property_type VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_use_code VARCHAR(80);
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_use_description TEXT;
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_evidence_url TEXT;
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_source_name TEXT;
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_match_method VARCHAR(30);
ALTER TABLE trade_demand_permits
  ADD COLUMN IF NOT EXISTS parcel_matched_at TIMESTAMPTZ;

ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(140);
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS property_type VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_use_code VARCHAR(80);
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_use_description TEXT;
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_evidence_url TEXT;
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_match_method VARCHAR(30);
ALTER TABLE oi_permit_records
  ADD COLUMN IF NOT EXISTS parcel_matched_at TIMESTAMPTZ;

ALTER TABLE oi_opportunities
  ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(140);
ALTER TABLE oi_opportunities
  ADD COLUMN IF NOT EXISTS property_type VARCHAR(20);
ALTER TABLE oi_opportunities
  ADD COLUMN IF NOT EXISTS parcel_use_code VARCHAR(80);
ALTER TABLE oi_opportunities
  ADD COLUMN IF NOT EXISTS parcel_use_description TEXT;
ALTER TABLE oi_opportunities
  ADD COLUMN IF NOT EXISTS parcel_evidence_url TEXT;

CREATE INDEX IF NOT EXISTS trade_demand_permits_property_type_idx
  ON trade_demand_permits(property_type, source_system);
CREATE INDEX IF NOT EXISTS oi_permit_records_property_type_idx
  ON oi_permit_records(property_type, source_id);
CREATE INDEX IF NOT EXISTS oi_opportunities_property_type_idx
  ON oi_opportunities(property_type, source_id);

CREATE TABLE IF NOT EXISTS trade_demand_permit_classification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  permit_records_seen INTEGER NOT NULL DEFAULT 0,
  parcel_records_matched INTEGER NOT NULL DEFAULT 0,
  commercial_count_before INTEGER NOT NULL DEFAULT 0,
  commercial_count_after INTEGER NOT NULL DEFAULT 0,
  reclassified_count INTEGER NOT NULL DEFAULT 0,
  residential_count INTEGER NOT NULL DEFAULT 0,
  unknown_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS permit_classification_runs_started_idx
  ON trade_demand_permit_classification_runs(source_system, started_at DESC);

CREATE TABLE IF NOT EXISTS trade_demand_permit_classification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES trade_demand_permit_classification_runs(id) ON DELETE SET NULL,
  permit_id UUID NOT NULL REFERENCES trade_demand_permits(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES trade_demand_opportunities(id) ON DELETE SET NULL,
  prior_property_type VARCHAR(20) NOT NULL,
  property_type VARCHAR(20) NOT NULL,
  parcel_id VARCHAR(255),
  parcel_use_code VARCHAR(80),
  parcel_use_description TEXT,
  parcel_evidence_url TEXT,
  parcel_match_method VARCHAR(30),
  was_commercial_visible BOOLEAN NOT NULL,
  is_commercial_visible BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS permit_classification_audit_permit_idx
  ON trade_demand_permit_classification_audit(permit_id, changed_at DESC);

-- Existing canonical property joins can be classified without a network lookup.
UPDATE oi_permit_records permit
SET property_type = CASE
      WHEN left(regexp_replace(COALESCE(property.property_use_code, ''), '[^0-9]', '', 'g'), 2) = '01'
        THEN 'RESIDENTIAL'
      ELSE 'COMMERCIAL'
    END,
    parcel_id = COALESCE(permit.parcel_id, property.parcel_id),
    parcel_use_code = property.property_use_code,
    parcel_use_description = property.property_use_description,
    parcel_evidence_url = property.source_url,
    parcel_match_method = 'property_id',
    parcel_matched_at = CURRENT_TIMESTAMP
FROM oi_properties property
WHERE permit.property_id = property.id
  AND property.property_use_code IS NOT NULL;

-- Legacy permits are only commercial when their joined parcel exists in the
-- commercial parcel registry. Unmatched legacy permits remain excluded.
UPDATE oi_permit_records permit
SET property_type = 'COMMERCIAL',
    parcel_id = COALESCE(permit.parcel_id, parcel.parcel_id),
    parcel_use_code = parcel.use_code,
    parcel_use_description = parcel.use_description,
    parcel_evidence_url = parcel.location_source_url,
    parcel_match_method = 'parcel_id',
    parcel_matched_at = CURRENT_TIMESTAMP
FROM fl_parcels parcel
WHERE permit.county = parcel.county
  AND permit.parcel_id = parcel.parcel_id
  AND permit.property_type = 'UNKNOWN';

