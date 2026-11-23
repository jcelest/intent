-- Migration 006: Opportunity Intelligence Six-Layer Outreach Architecture
-- Enforces: Property Appraiser Parcels, Sunbiz Entities, DBPR Licenses, Permits, Client Registrations, and Google Search Verification (No Places API).

-- Layer 1: County Property Appraiser Parcels (The Backbone)
CREATE TABLE IF NOT EXISTS fl_parcels (
  county VARCHAR(100) NOT NULL,
  parcel_id VARCHAR(100) NOT NULL,
  situs_address TEXT NOT NULL,
  situs_city VARCHAR(100),
  situs_zip VARCHAR(20),
  owner_name_raw TEXT NOT NULL,
  owner_mailing_address TEXT,
  use_code VARCHAR(50) NOT NULL,
  use_description TEXT NOT NULL,
  building_sqft INTEGER,
  year_built INTEGER,
  land_use_category VARCHAR(100) NOT NULL,
  channel VARCHAR(60) NOT NULL, -- association_cam, rental_residential, church, school, medical_clinic, retail, office, warehouse_industrial, hospitality, municipal, other
  sqft_band VARCHAR(40) NOT NULL, -- UNDER_10T_LIKELY, OVER_10T_POSSIBLE, CHILLER_LIKELY
  tonnage_risk VARCHAR(40) NOT NULL, -- UNDER_10T_LIKELY, OVER_10T_POSSIBLE, CHILLER_LIKELY
  last_mechanical_permit_date DATE,
  incumbent_contractor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county, parcel_id)
);

CREATE INDEX IF NOT EXISTS fl_parcels_county_idx ON fl_parcels(county);
CREATE INDEX IF NOT EXISTS fl_parcels_channel_idx ON fl_parcels(channel);
CREATE INDEX IF NOT EXISTS fl_parcels_sqft_band_idx ON fl_parcels(sqft_band);
CREATE INDEX IF NOT EXISTS fl_parcels_owner_name_idx ON fl_parcels(owner_name_raw);

-- Layer 2: Sunbiz Entity Matches
CREATE TABLE IF NOT EXISTS fl_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_county VARCHAR(100) NOT NULL,
  parcel_id VARCHAR(100) NOT NULL,
  owner_name_raw TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  entity_name TEXT,
  document_number VARCHAR(100),
  status VARCHAR(40) NOT NULL DEFAULT 'UNMATCHED', -- Active, Inactive, UNMATCHED
  filing_date DATE,
  principal_address TEXT,
  registered_agent TEXT,
  officers JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_confidence INTEGER NOT NULL DEFAULT 0, -- 0-100
  matched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parcel_county, parcel_id) REFERENCES fl_parcels(county, parcel_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS fl_entities_parcel_idx ON fl_entities(parcel_county, parcel_id);
CREATE INDEX IF NOT EXISTS fl_entities_status_idx ON fl_entities(status);
CREATE INDEX IF NOT EXISTS fl_entities_normalized_idx ON fl_entities(normalized_name);

-- Layer 3: DBPR Licenses
CREATE TABLE IF NOT EXISTS fl_licenses (
  license_number VARCHAR(80) PRIMARY KEY,
  licensee_name TEXT NOT NULL,
  business_name TEXT,
  license_type TEXT NOT NULL,
  status VARCHAR(60) NOT NULL, -- Current,Active, Delinquent, Inactive
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100) NOT NULL,
  original_license_date DATE,
  trade_category VARCHAR(60) NOT NULL, -- hvac, general_contractor, electrical, roofing, plumbing, property_management
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_licenses_county_idx ON fl_licenses(county);
CREATE INDEX IF NOT EXISTS fl_licenses_trade_idx ON fl_licenses(trade_category);
CREATE INDEX IF NOT EXISTS fl_licenses_status_idx ON fl_licenses(status);

-- Layer 4: Permits (Timing Signals)
CREATE TABLE IF NOT EXISTS fl_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_number VARCHAR(100) NOT NULL,
  parcel_county VARCHAR(100) NOT NULL,
  parcel_id VARCHAR(100) NOT NULL,
  permit_type VARCHAR(60) NOT NULL, -- mechanical, roofing, electrical, plumbing, new_construction
  description TEXT,
  issue_date DATE NOT NULL,
  contractor_name TEXT,
  contractor_license_number VARCHAR(80),
  job_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parcel_county, parcel_id) REFERENCES fl_parcels(county, parcel_id) ON DELETE CASCADE,
  UNIQUE(permit_number, parcel_county)
);

CREATE INDEX IF NOT EXISTS fl_permits_parcel_idx ON fl_permits(parcel_county, parcel_id);
CREATE INDEX IF NOT EXISTS fl_permits_issue_date_idx ON fl_permits(issue_date DESC);
CREATE INDEX IF NOT EXISTS fl_permits_type_idx ON fl_permits(permit_type);

-- Layer 5: Client Vendor Portal Registrations
CREATE TABLE IF NOT EXISTS fl_client_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  portal_name TEXT NOT NULL, -- Orange County Procurement, OCPS Vendor List, ServiceChannel, Lessen, DMG Pro, etc.
  portal_type VARCHAR(60) NOT NULL, -- county_government, school_district, aggregator, commercial_network
  status VARCHAR(40) NOT NULL DEFAULT 'NOT_REGISTERED', -- NOT_REGISTERED, IN_PROGRESS, REGISTERED
  registration_date DATE,
  renewal_date DATE,
  vendor_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, portal_name)
);

CREATE INDEX IF NOT EXISTS fl_client_registrations_client_idx ON fl_client_registrations(client_id);
CREATE INDEX IF NOT EXISTS fl_client_registrations_status_idx ON fl_client_registrations(status);

-- Client Account Exclusions (Never show accounts the client already has)
CREATE TABLE IF NOT EXISTS fl_client_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  account_name TEXT NOT NULL,
  parcel_id VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, account_name)
);

CREATE INDEX IF NOT EXISTS fl_client_exclusions_client_idx ON fl_client_exclusions(client_id);

-- Layer 6: Google Search Verifications (Replaces Places API, Strict Evidence & 30-Day Cache)
CREATE TABLE IF NOT EXISTS fl_search_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  county VARCHAR(100) NOT NULL,
  target_type VARCHAR(60) NOT NULL, -- parcel_owner, dbpr_licensee, general_contractor, property_manager
  target_id TEXT, -- parcel_id or license_number
  query_used TEXT NOT NULL,
  official_website_url TEXT,
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  gbp_signal VARCHAR(30) NOT NULL DEFAULT 'NOT_SEEN', -- LISTING_PRESENT, NOT_SEEN
  rating NUMERIC(3, 1),
  review_count INTEGER,
  phone VARCHAR(60),
  operating_status VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN', -- ACTIVE, PERMANENTLY_CLOSED, UNKNOWN
  verification_status VARCHAR(40) NOT NULL, -- VERIFIED_ACTIVE, LIKELY_ACTIVE, NOT_FOUND, AMBIGUOUS, CLOSED
  match_score INTEGER NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { url, query, verified_at }
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_search_verifications_cache_idx ON fl_search_verifications(business_name, city, verified_at DESC);
CREATE INDEX IF NOT EXISTS fl_search_verifications_status_idx ON fl_search_verifications(verification_status);
CREATE INDEX IF NOT EXISTS fl_search_verifications_review_idx ON fl_search_verifications(needs_review);
