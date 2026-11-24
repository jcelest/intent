-- Opportunity map activation: preserve official parcel centroids and define
-- conservative, source-backed property service signals.

ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS source_object_id BIGINT;
ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS location_source_url TEXT;
ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS location_method VARCHAR(60);
ALTER TABLE fl_parcels ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fl_parcels_coordinates_idx
  ON fl_parcels(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS fl_parcels_source_object_idx
  ON fl_parcels(source_object_id)
  WHERE source_object_id IS NOT NULL;

INSERT INTO oi_discovery_rules (
  slug,
  name,
  description,
  evidence_type,
  match_config,
  output_trade_slug,
  output_service_category_slug,
  output_classification,
  default_confidence,
  rationale_template
) VALUES (
  'documented-large-commercial-property',
  'Documented Large Commercial Property',
  'Surfaces an inferred commercial HVAC and facility-service profile when an official parcel record documents at least 15,000 square feet.',
  'property',
  '{"minimum_building_sqft":15000,"requires_documented_centroid":true}'::jsonb,
  'hvac',
  'preventive-maintenance-agreements',
  'inferred',
  68,
  'An official parcel record documents a large commercial building. Building scale supports service relevance only; it does not establish installed equipment, current need, budget, or purchasing intent.'
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  match_config = EXCLUDED.match_config,
  default_confidence = EXCLUDED.default_confidence,
  rationale_template = EXCLUDED.rationale_template,
  updated_at = CURRENT_TIMESTAMP;

COMMENT ON COLUMN fl_parcels.latitude IS 'Official parcel centroid latitude supplied by the source GIS service; never a county centroid.';
COMMENT ON COLUMN fl_parcels.longitude IS 'Official parcel centroid longitude supplied by the source GIS service; never a county centroid.';
COMMENT ON COLUMN fl_parcels.location_method IS 'Method used to establish the point location, currently official_arcgis_parcel_centroid.';
