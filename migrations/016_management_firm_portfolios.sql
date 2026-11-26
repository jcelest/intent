-- Migration 016: evidence-backed portfolio size for PM and CAM firms.
-- Legacy managed_properties_count values are not portfolio evidence.

ALTER TABLE fl_management_firms
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN county DROP NOT NULL,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL,
  ALTER COLUMN managed_properties_count DROP DEFAULT;

UPDATE fl_management_firms
SET managed_properties_count = NULL
WHERE managed_properties_count IS NOT NULL;

ALTER TABLE fl_management_firms
  ADD COLUMN IF NOT EXISTS portfolio_floor INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_range_low INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_range_high INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_tier VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS parcels_matched_by_mailing_address INTEGER,
  ADD COLUMN IF NOT EXISTS eviction_filings_trailing_12mo INTEGER,
  ADD COLUMN IF NOT EXISTS permit_properties_trailing_12mo INTEGER,
  ADD COLUMN IF NOT EXISTS sunbiz_associations_managed INTEGER,
  ADD COLUMN IF NOT EXISTS association_units_total INTEGER,
  ADD COLUMN IF NOT EXISTS claimed_doors INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_calculated_at TIMESTAMPTZ;

ALTER TABLE fl_management_firms
  DROP CONSTRAINT IF EXISTS fl_management_firms_portfolio_tier_check;

ALTER TABLE fl_management_firms
  ADD CONSTRAINT fl_management_firms_portfolio_tier_check
  CHECK (portfolio_tier IN ('UNDER_100', 'FROM_100_TO_300', 'OVER_300', 'UNKNOWN'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_fl_mgmt_firms_license_unique
  ON fl_management_firms(license_number)
  WHERE license_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fl_mgmt_firms_portfolio_floor
  ON fl_management_firms(portfolio_floor DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_fl_mgmt_firms_portfolio_tier
  ON fl_management_firms(portfolio_tier);

CREATE TABLE IF NOT EXISTS fl_management_firm_portfolio_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES fl_management_firms(id) ON DELETE CASCADE,
  evidence_layer VARCHAR(60) NOT NULL,
  evidence_count INTEGER NOT NULL CHECK (evidence_count >= 0),
  range_low INTEGER,
  range_high INTEGER,
  source_name TEXT NOT NULL,
  source_url TEXT,
  as_of_date DATE NOT NULL,
  methodology TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firm_id, evidence_layer),
  CHECK (evidence_layer IN (
    'tax_mailing_address',
    'eviction_filings',
    'permit_contact',
    'sunbiz_associations',
    'association_units',
    'claimed_doors'
  )),
  CHECK (range_low IS NULL OR range_low >= 0),
  CHECK (range_high IS NULL OR range_high >= COALESCE(range_low, 0))
);

CREATE INDEX IF NOT EXISTS fl_management_firm_portfolio_evidence_firm_idx
  ON fl_management_firm_portfolio_evidence(firm_id, evidence_layer);

COMMENT ON COLUMN fl_management_firms.portfolio_floor IS
  'Highest directly verified property or unit count. Derived estimates and claimed doors are excluded.';
COMMENT ON COLUMN fl_management_firms.claimed_doors IS
  'Self-reported door count. It is never used as a verified portfolio floor.';
