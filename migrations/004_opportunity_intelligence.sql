-- Migration 004: Intent Opportunity Intelligence - Florida Edition

CREATE TABLE IF NOT EXISTS fl_procurement_sources (
  id VARCHAR(100) PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_type VARCHAR(60) NOT NULL, -- state, county, municipality, school_district, higher_ed, utility, airport_transit, water_district, federal
  county VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  portal_url TEXT NOT NULL,
  publishing_platform VARCHAR(60) NOT NULL, -- OpenGov, DemandStar, Bonfire, BidNet Direct, PlanetBids, Custom Portal, SAM.gov
  collection_method VARCHAR(60) NOT NULL, -- api, rss_feed, json_feed, html_table, manual_public
  supported_format VARCHAR(40) NOT NULL DEFAULT 'json',
  access_requirements VARCHAR(60) NOT NULL DEFAULT 'free_public',
  status VARCHAR(40) NOT NULL DEFAULT 'active', -- active, configured, tested, discovered, unsupported, failed
  collection_frequency VARCHAR(40) NOT NULL DEFAULT 'daily',
  last_attempted_at TIMESTAMPTZ,
  last_successful_at TIMESTAMPTZ,
  error_status TEXT,
  indexed_bids_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_procurement_sources_county_idx ON fl_procurement_sources(county);
CREATE INDEX IF NOT EXISTS fl_procurement_sources_type_idx ON fl_procurement_sources(agency_type);
CREATE INDEX IF NOT EXISTS fl_procurement_sources_status_idx ON fl_procurement_sources(status);

CREATE TABLE IF NOT EXISTS fl_commercial_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(100) REFERENCES fl_procurement_sources(id) ON DELETE SET NULL,
  solicitation_number VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  agency_name TEXT NOT NULL,
  agency_type VARCHAR(60) NOT NULL,
  county VARCHAR(100),
  city VARCHAR(100),
  zip_code VARCHAR(20),
  trade_slug VARCHAR(80),
  estimated_value NUMERIC,
  estimated_value_display VARCHAR(100),
  posted_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closing_date TIMESTAMPTZ,
  status VARCHAR(40) NOT NULL DEFAULT 'open', -- open, under_review, awarded, closed, cancelled
  source_url TEXT NOT NULL,
  submission_method TEXT,
  qualification_requirements TEXT[] NOT NULL DEFAULT '{}',
  pre_bid_conference TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone VARCHAR(60),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(solicitation_number, agency_name)
);

CREATE INDEX IF NOT EXISTS fl_commercial_bids_county_idx ON fl_commercial_bids(county);
CREATE INDEX IF NOT EXISTS fl_commercial_bids_trade_idx ON fl_commercial_bids(trade_slug);
CREATE INDEX IF NOT EXISTS fl_commercial_bids_status_closing_idx ON fl_commercial_bids(status, closing_date);
CREATE INDEX IF NOT EXISTS fl_commercial_bids_posted_idx ON fl_commercial_bids(posted_date DESC);

CREATE TABLE IF NOT EXISTS fl_commercial_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type VARCHAR(60) NOT NULL, -- general_contractor, property_management, developer, commercial_owner, facility_operator, healthcare_network, hospitality
  county VARCHAR(100),
  city VARCHAR(100),
  zip_code VARCHAR(20),
  address TEXT,
  trades_hired TEXT[] NOT NULL DEFAULT '{}',
  primary_contact_name TEXT,
  primary_contact_title TEXT,
  primary_contact_email TEXT,
  primary_contact_phone VARCHAR(60),
  website TEXT,
  vendor_intake_url TEXT,
  annual_commercial_volume VARCHAR(100),
  active_projects_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, county)
);

CREATE INDEX IF NOT EXISTS fl_commercial_networks_county_idx ON fl_commercial_networks(county);
CREATE INDEX IF NOT EXISTS fl_commercial_networks_type_idx ON fl_commercial_networks(org_type);

CREATE TABLE IF NOT EXISTS fl_saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES fl_commercial_bids(id) ON DELETE CASCADE,
  network_id UUID REFERENCES fl_commercial_networks(id) ON DELETE CASCADE,
  opportunity_type VARCHAR(40) NOT NULL DEFAULT 'bid', -- bid, network
  title TEXT NOT NULL,
  agency_or_company TEXT NOT NULL,
  county VARCHAR(100),
  trade_slug VARCHAR(80),
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  saved_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_saved_opportunities_bid_idx ON fl_saved_opportunities(bid_id);
CREATE INDEX IF NOT EXISTS fl_saved_opportunities_network_idx ON fl_saved_opportunities(network_id);

CREATE TABLE IF NOT EXISTS fl_outreach_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID,
  opportunity_title TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_type VARCHAR(40) NOT NULL DEFAULT 'public_agency', -- public_agency, general_contractor, property_manager, developer
  stage VARCHAR(40) NOT NULL DEFAULT 'identified', -- identified, qualified, contacted, proposal_ready, submitted, won, lost
  client_id UUID REFERENCES trade_demand_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  estimated_value NUMERIC,
  next_followup_at TIMESTAMPTZ,
  next_action TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone VARCHAR(60),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_outreach_pipeline_stage_idx ON fl_outreach_pipeline(stage);
CREATE INDEX IF NOT EXISTS fl_outreach_pipeline_client_idx ON fl_outreach_pipeline(client_id);
CREATE INDEX IF NOT EXISTS fl_outreach_pipeline_followup_idx ON fl_outreach_pipeline(next_followup_at ASC);

CREATE TABLE IF NOT EXISTS fl_collection_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(60) NOT NULL, -- all_sources, state_procurement, county_procurement, municipal, sam_gov, single_source
  target_source_id VARCHAR(100),
  status VARCHAR(40) NOT NULL DEFAULT 'completed', -- queued, running, completed, failed
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_added INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  triggered_by VARCHAR(60) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS fl_collection_jobs_started_idx ON fl_collection_jobs(started_at DESC);

CREATE TABLE IF NOT EXISTS fl_geo_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  territory_scope JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
