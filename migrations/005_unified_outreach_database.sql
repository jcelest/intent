-- Migration 005: Unified Outreach Database with Google Search Verification
-- Builds unified commercial & government outreach targets for registered Intent Revenue clients.

CREATE TABLE IF NOT EXISTS fl_outreach_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_name TEXT NOT NULL,
  target_type VARCHAR(60) NOT NULL, -- county_government, municipal_government, school_district, higher_ed, aviation_transit, utility_district, general_contractor, property_management, commercial_developer, healthcare_facility
  source_category VARCHAR(60) NOT NULL, -- florida_government_records, commercial_network, public_procurement
  county VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  primary_address TEXT,
  relevant_trades TEXT[] NOT NULL DEFAULT '{}',
  primary_contact_name TEXT,
  primary_contact_title TEXT,
  primary_contact_email TEXT,
  primary_contact_phone VARCHAR(60),
  official_url TEXT,
  procurement_portal_url TEXT,
  recent_activity_summary TEXT,
  active_solicitation_count INTEGER NOT NULL DEFAULT 0,
  google_verification_status VARCHAR(40) NOT NULL DEFAULT 'verified_active', -- verified_active, online_presence_active, pending_verification
  google_search_query TEXT,
  google_search_snippet TEXT,
  google_business_verified BOOLEAN NOT NULL DEFAULT TRUE,
  google_rating NUMERIC(3, 1),
  google_review_count INTEGER,
  google_last_verified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_name, county, target_type)
);

CREATE INDEX IF NOT EXISTS fl_outreach_targets_county_idx ON fl_outreach_targets(county);
CREATE INDEX IF NOT EXISTS fl_outreach_targets_type_idx ON fl_outreach_targets(target_type);
CREATE INDEX IF NOT EXISTS fl_outreach_targets_verification_idx ON fl_outreach_targets(google_verification_status);
