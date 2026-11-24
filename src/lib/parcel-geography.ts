import { sql } from "@/lib/db";
import { COUNTY_NAME_TO_DOR, DOR_COUNTY_OID_START } from "@/lib/florida-dor-meta";
import {
  FLORIDA_CADASTRAL_LAYER_URL,
  parseParcelCentroid,
  type ArcGisCentroidFeature,
  type ParcelCentroid,
} from "@/lib/parcel-geography-validation";

export { FLORIDA_CADASTRAL_LAYER_URL, isFloridaCoordinate, parseParcelCentroid, type ParcelCentroid } from "@/lib/parcel-geography-validation";

type DbRow = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<DbRow[]> };
const queryDb = (query: string, params: unknown[] = []) =>
  (sql as unknown as Queryable).query(query, params);

function escapeArcGisLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function fetchOfficialParcelCentroids(
  dorCode: number,
  parcelIds: string[],
  signal?: AbortSignal,
) {
  const uniqueIds = Array.from(new Set(parcelIds.map((value) => value.trim()).filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, ParcelCentroid>();
  const literals = uniqueIds.map(escapeArcGisLiteral).join(",");
  const body = new URLSearchParams({
    where: `CO_NO = ${dorCode} AND (PARCEL_ID IN (${literals}) OR PARCELNO IN (${literals}))`,
    outFields: "OBJECTID,PARCEL_ID,PARCELNO,CO_NO",
    returnGeometry: "false",
    returnCentroid: "true",
    outSR: "4326",
    resultRecordCount: String(Math.max(100, uniqueIds.length * 2)),
    f: "json",
  });
  const response = await fetch(`${FLORIDA_CADASTRAL_LAYER_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });
  if (!response.ok) throw new Error(`Florida cadastral centroid query failed with ${response.status}`);
  const payload = await response.json() as { error?: { message?: string }; features?: ArcGisCentroidFeature[] };
  if (payload.error) throw new Error(payload.error.message || "Florida cadastral centroid query failed");
  const results = new Map<string, ParcelCentroid>();
  for (const feature of payload.features || []) {
    const centroid = parseParcelCentroid(feature);
    if (centroid) results.set(centroid.parcelId, centroid);
  }
  return results;
}

export async function fetchOfficialCountyCentroids(
  dorCode: number,
  targetParcelIds: string[],
  pageSize = 1000,
) {
  const targets = new Set(targetParcelIds.map((value) => value.trim()).filter(Boolean));
  const results = new Map<string, ParcelCentroid>();
  if (!targets.size) return results;
  const startOid = DOR_COUNTY_OID_START[dorCode] || 1;
  const scanLimit = Math.max(500, Math.ceil(targets.size * 1.75) + 500);
  let offset = 0;
  while (offset < scanLimit && results.size < targets.size) {
    const body = new URLSearchParams({
      where: `OBJECTID >= ${startOid} AND CO_NO = ${dorCode} AND (DOR_UC LIKE '01%' OR DOR_UC LIKE '02%' OR DOR_UC LIKE '03%' OR DOR_UC LIKE '04%' OR DOR_UC LIKE '07%' OR DOR_UC LIKE '08%') AND OWN_NAME IS NOT NULL`,
      outFields: "OBJECTID,PARCEL_ID,PARCELNO,CO_NO",
      returnGeometry: "false",
      returnCentroid: "true",
      outSR: "4326",
      orderByFields: "OBJECTID ASC",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: "json",
    });
    let features: ArcGisCentroidFeature[] | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2 && !features; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      try {
        const response = await fetch(`${FLORIDA_CADASTRAL_LAYER_URL}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Florida cadastral county query failed with ${response.status}`);
        const payload = await response.json() as { error?: { message?: string }; features?: ArcGisCentroidFeature[] };
        if (payload.error) throw new Error(payload.error.message || "Florida cadastral county query failed");
        features = payload.features || [];
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!features) throw lastError instanceof Error ? lastError : new Error("Florida cadastral county query failed");
    for (const feature of features) {
      const centroid = parseParcelCentroid(feature);
      if (centroid && targets.has(centroid.parcelId)) results.set(centroid.parcelId, centroid);
    }
    if (features.length < pageSize) break;
    offset += features.length;
  }
  return results;
}

async function updateParcelCentroids(county: string, centroids: ParcelCentroid[]) {
  if (!centroids.length) return 0;
  const parcelIds = centroids.map((item) => item.parcelId);
  const latitudes = centroids.map((item) => item.latitude);
  const longitudes = centroids.map((item) => item.longitude);
  const objectIds = centroids.map((item) => item.sourceObjectId);
  const sourceUrls = centroids.map((item) => item.sourceUrl);
  const rows = await queryDb(
    `UPDATE fl_parcels parcel SET
       latitude = location.latitude,
       longitude = location.longitude,
       source_object_id = location.source_object_id,
       location_source_url = location.source_url,
       location_method = 'official_arcgis_parcel_centroid',
       location_verified_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     FROM UNNEST($2::varchar[], $3::double precision[], $4::double precision[], $5::bigint[], $6::text[])
       AS location(parcel_id, latitude, longitude, source_object_id, source_url)
     WHERE parcel.county = $1 AND parcel.parcel_id = location.parcel_id
     RETURNING parcel.parcel_id`,
    [county, parcelIds, latitudes, longitudes, objectIds, sourceUrls],
  );
  return rows.length;
}

export async function syncMappedParcelsToOpportunityHub() {
  const properties = await queryDb(
    `WITH upserted AS (
     INSERT INTO oi_properties (
       source_id, source_record_id, parcel_id, name, situs_address, city, county, zip_code,
       latitude, longitude, property_use_code, property_use_description, building_sqft, year_built,
       owner_name_raw, source_url, source_payload, record_hash, last_verified_at
     )
     SELECT
       'fl-dor-cadastral', concat(parcel.county, ':', parcel.parcel_id), parcel.parcel_id,
       NULL, parcel.situs_address, parcel.situs_city, parcel.county, parcel.situs_zip,
       parcel.latitude, parcel.longitude, parcel.use_code, parcel.use_description,
       parcel.building_sqft, parcel.year_built, parcel.owner_name_raw, parcel.location_source_url,
       jsonb_build_object(
         'sourceObjectId', parcel.source_object_id,
         'locationMethod', parcel.location_method,
         'channel', parcel.channel,
         'sqftBand', parcel.sqft_band,
         'tonnageRisk', parcel.tonnage_risk
       ),
       md5(concat_ws('|', parcel.county, parcel.parcel_id, parcel.updated_at::text)),
       parcel.location_verified_at
     FROM fl_parcels parcel
     WHERE parcel.latitude IS NOT NULL AND parcel.longitude IS NOT NULL
     ON CONFLICT (source_id, source_record_id) DO UPDATE SET
       parcel_id = EXCLUDED.parcel_id,
       situs_address = EXCLUDED.situs_address,
       city = EXCLUDED.city,
       county = EXCLUDED.county,
       zip_code = EXCLUDED.zip_code,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       property_use_code = EXCLUDED.property_use_code,
       property_use_description = EXCLUDED.property_use_description,
       building_sqft = EXCLUDED.building_sqft,
       year_built = EXCLUDED.year_built,
       owner_name_raw = EXCLUDED.owner_name_raw,
       source_url = EXCLUDED.source_url,
       source_payload = EXCLUDED.source_payload,
       record_hash = EXCLUDED.record_hash,
       last_verified_at = EXCLUDED.last_verified_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id
     ) SELECT count(*)::int AS count FROM upserted`,
  );

  const opportunityStats = await queryDb(
    `WITH rule AS (
       SELECT id, default_confidence, rationale_template
       FROM oi_discovery_rules
       WHERE slug = 'documented-large-commercial-property'
       LIMIT 1
     ), category AS (
       SELECT id FROM oi_taxonomy_categories
       WHERE slug = 'preventive-maintenance-agreements'
       LIMIT 1
     ), candidates AS (
       SELECT parcel.*
       FROM fl_parcels parcel
       WHERE parcel.latitude IS NOT NULL
         AND parcel.longitude IS NOT NULL
         AND parcel.building_sqft >= 15000
         AND parcel.situs_address IS NOT NULL
         AND parcel.situs_address NOT LIKE '%Commercial Site'
     ), upserted AS (
       INSERT INTO oi_opportunities (
         source_id, source_record_id, dedupe_hash, title, summary, trade_slug, service_category_id,
         classification, status, geographic_scope_type, address, city, county, counties, zip_code,
         latitude, longitude, recurring_revenue_potential, physical_labor, technical_complexity,
         evidence_confidence, classification_rationale, source_url, source_payload,
         discovery_rule_id, last_verified_at
       )
       SELECT
         'fl-dor-cadastral',
         concat('large-commercial-property:', parcel.county, ':', parcel.parcel_id),
         md5(concat('fl-dor-cadastral|large-commercial-property:', parcel.county, ':', parcel.parcel_id)),
         concat('Commercial HVAC service profile: ', parcel.situs_address),
         concat(to_char(parcel.building_sqft, 'FM999,999,999'), ' sq ft ', COALESCE(parcel.use_description, 'commercial property'), ' documented by the official statewide cadastral source.'),
         'hvac',
         category.id,
         'inferred',
         'discovered',
         'property',
         parcel.situs_address,
         parcel.situs_city,
         parcel.county,
         ARRAY[parcel.county]::text[],
         parcel.situs_zip,
         parcel.latitude,
         parcel.longitude,
         'possible',
         'likely',
         CASE WHEN parcel.sqft_band = 'CHILLER_LIKELY' THEN 'high' ELSE 'moderate' END,
         rule.default_confidence,
         concat(rule.rationale_template, ' The documented building area is ', to_char(parcel.building_sqft, 'FM999,999,999'), ' square feet.'),
         parcel.location_source_url,
         jsonb_build_object(
           'parcelId', parcel.parcel_id,
           'ownerName', parcel.owner_name_raw,
           'propertyUse', parcel.use_description,
           'buildingSqft', parcel.building_sqft,
           'yearBuilt', parcel.year_built,
           'locationMethod', parcel.location_method
         ),
         rule.id,
         CURRENT_TIMESTAMP
       FROM candidates parcel
       CROSS JOIN rule
       LEFT JOIN category ON TRUE
       ON CONFLICT (source_id, source_record_id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         county = EXCLUDED.county,
         counties = EXCLUDED.counties,
         zip_code = EXCLUDED.zip_code,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         evidence_confidence = EXCLUDED.evidence_confidence,
         classification_rationale = EXCLUDED.classification_rationale,
         source_url = EXCLUDED.source_url,
         source_payload = EXCLUDED.source_payload,
         discovery_rule_id = EXCLUDED.discovery_rule_id,
         last_verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING (xmax = 0) AS was_inserted
     )
     SELECT
       count(*)::int AS eligible,
       count(*) FILTER (WHERE was_inserted)::int AS created,
       count(*) FILTER (WHERE NOT was_inserted)::int AS updated
     FROM upserted`,
  );

  await queryDb(
    `INSERT INTO oi_opportunity_properties (opportunity_id, property_id, relationship_type)
     SELECT opportunity.id, property.id, 'subject'
     FROM oi_opportunities opportunity
     JOIN oi_properties property
       ON property.source_id = 'fl-dor-cadastral'
      AND opportunity.source_record_id = concat('large-commercial-property:', property.county, ':', property.parcel_id)
     WHERE opportunity.source_id = 'fl-dor-cadastral'
       AND opportunity.source_record_id LIKE 'large-commercial-property:%'
     ON CONFLICT DO NOTHING`,
  );

  await queryDb(
    `INSERT INTO oi_opportunity_evidence (
         opportunity_id, source_id, evidence_type, title, description, source_url,
         source_record_id, is_direct_evidence, confidence, verified_at
       )
       SELECT
         opportunity.id,
         'fl-dor-cadastral',
         'property_profile',
         concat('Official parcel record: ', property.situs_address),
         concat(to_char(property.building_sqft, 'FM999,999,999'), ' documented building square feet; use: ', COALESCE(property.property_use_description, 'commercial'), '.'),
         property.source_url,
         property.source_record_id,
         TRUE,
         100,
         CURRENT_TIMESTAMP
       FROM oi_opportunities opportunity
       JOIN oi_properties property
         ON property.source_id = 'fl-dor-cadastral'
        AND opportunity.source_record_id = concat('large-commercial-property:', property.county, ':', property.parcel_id)
       WHERE opportunity.source_id = 'fl-dor-cadastral'
         AND opportunity.source_record_id LIKE 'large-commercial-property:%'
       ON CONFLICT (opportunity_id, source_id, source_record_id, evidence_type) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         source_url = EXCLUDED.source_url,
         confidence = EXCLUDED.confidence,
         verified_at = CURRENT_TIMESTAMP`,
  );

  return {
    propertiesSynced: Number(properties[0]?.count || 0),
    eligibleProperties: Number(opportunityStats[0]?.eligible || 0),
    opportunitiesCreated: Number(opportunityStats[0]?.created || 0),
    opportunitiesUpdated: Number(opportunityStats[0]?.updated || 0),
  };
}

export async function backfillOfficialParcelGeography(options: { pageSize?: number } = {}) {
  const pageSize = Math.min(2000, Math.max(100, options.pageSize || 1000));
  const rows = await queryDb(
    `SELECT county, parcel_id
     FROM fl_parcels
     WHERE latitude IS NULL OR longitude IS NULL
     ORDER BY county, parcel_id`,
  );
  const byCounty = new Map<string, string[]>();
  for (const row of rows) {
    const county = String(row.county);
    const parcelId = String(row.parcel_id);
    byCounty.set(county, [...(byCounty.get(county) || []), parcelId]);
  }

  let requested = 0;
  let matched = 0;
  let updated = 0;
  const countyResults: Array<{ county: string; requested: number; matched: number; error?: string }> = [];
  const countyEntries = Array.from(byCounty.entries());
  let cursor = 0;
  const worker = async () => {
    while (cursor < countyEntries.length) {
      const index = cursor++;
      const [county, parcelIds] = countyEntries[index];
      const dorCode = COUNTY_NAME_TO_DOR.get(county.toLowerCase())?.dorCode;
      if (!dorCode) {
        countyResults.push({ county, requested: parcelIds.length, matched: 0 });
        continue;
      }
      requested += parcelIds.length;
      try {
        const locations = await fetchOfficialCountyCentroids(dorCode, parcelIds, pageSize);
        const centroids = Array.from(locations.values());
        const countyMatched = centroids.length;
        matched += countyMatched;
        updated += await updateParcelCentroids(county, centroids);
        countyResults.push({ county, requested: parcelIds.length, matched: countyMatched });
      } catch (error) {
        countyResults.push({ county, requested: parcelIds.length, matched: 0, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, countyEntries.length) }, () => worker()));

  const hub = await syncMappedParcelsToOpportunityHub();
  return { requested, matched, updated, countyResults, hub };
}
