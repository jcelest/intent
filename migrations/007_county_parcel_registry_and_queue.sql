-- Migration 007: Per-County Parcel Source Registry & Continuous Layer Queue
-- Implements:
-- 1. fl_county_parcel_registry: Official Property Appraiser GIS sources, endpoints, field mappings, records request procedures.
-- 2. fl_ingestion_queue: Scheduled queue across all 5 layers with priority queueing and rate-limited batching.
-- 3. Updates fl_collection_jobs with county and layer fields for granular audit logging.

-- 1. County Parcel Source Registry
CREATE TABLE IF NOT EXISTS fl_county_parcel_registry (
  county VARCHAR(100) PRIMARY KEY,
  fips VARCHAR(10) NOT NULL,
  region VARCHAR(60) NOT NULL,
  population_rank INTEGER NOT NULL,
  population INTEGER NOT NULL,
  appraiser_name TEXT NOT NULL,
  official_portal_url TEXT NOT NULL,
  gis_download_url TEXT,
  file_format VARCHAR(60) NOT NULL DEFAULT 'ArcGIS_FeatureServer', -- ArcGIS_FeatureServer, ArcGIS_REST, FTP_Shapefile, CSV_Export, Portal_Direct, RECORDS_REQUEST_REQUIRED
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'DIRECT_DOWNLOAD', -- DIRECT_DOWNLOAD, RECORDS_REQUEST_REQUIRED, INGESTED, STALE
  records_request_procedure TEXT,
  records_request_contact TEXT,
  commercial_parcels_count INTEGER NOT NULL DEFAULT 0,
  full_depth_threshold INTEGER NOT NULL DEFAULT 500,
  is_priority_county BOOLEAN NOT NULL DEFAULT FALSE,
  last_parcels_pull_at TIMESTAMPTZ,
  last_permits_pull_at TIMESTAMPTZ,
  last_licenses_pull_at TIMESTAMPTZ,
  last_verifications_pull_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fl_county_parcel_registry_status_idx ON fl_county_parcel_registry(status);
CREATE INDEX IF NOT EXISTS fl_county_parcel_registry_pop_rank_idx ON fl_county_parcel_registry(population_rank ASC);
CREATE INDEX IF NOT EXISTS fl_county_parcel_registry_priority_idx ON fl_county_parcel_registry(is_priority_county);

-- 2. Ingestion Queue
CREATE TABLE IF NOT EXISTS fl_ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county VARCHAR(100) NOT NULL,
  layer VARCHAR(40) NOT NULL, -- parcels, entities, licenses, permits, verifications
  priority_order INTEGER NOT NULL DEFAULT 100, -- 1-5 priority counties, 6-67 population order
  status VARCHAR(40) NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED, WAITING_CADENCE
  batch_offset INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 250,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_run_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(county, layer)
);

CREATE INDEX IF NOT EXISTS fl_ingestion_queue_run_idx ON fl_ingestion_queue(status, next_run_at ASC, priority_order ASC);
CREATE INDEX IF NOT EXISTS fl_ingestion_queue_layer_idx ON fl_ingestion_queue(layer);

-- 3. Enhance fl_collection_jobs with county and layer for audit trail
ALTER TABLE fl_collection_jobs ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE fl_collection_jobs ADD COLUMN IF NOT EXISTS layer VARCHAR(40);
CREATE INDEX IF NOT EXISTS fl_collection_jobs_county_idx ON fl_collection_jobs(county);
CREATE INDEX IF NOT EXISTS fl_collection_jobs_layer_idx ON fl_collection_jobs(layer);
