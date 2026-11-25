import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { COUNTY_BY_NAME, FLORIDA_COUNTIES } from "@/lib/florida-geo";

export type OpportunityClassification =
  | "confirmed"
  | "timing_based"
  | "asset_based"
  | "relationship"
  | "inferred";

export interface OpportunityRecord {
  id: string;
  sourceType: "universal" | "legacy_procurement";
  title: string;
  summary: string | null;
  tradeSlug: string | null;
  serviceCategory: string | null;
  classification: OpportunityClassification;
  status: string;
  geographicScopeType: string;
  address: string | null;
  city: string | null;
  county: string | null;
  counties: string[];
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  documentedValue: number | null;
  estimatedValue: number | null;
  valueEstimationMethodology: string | null;
  recurringRevenuePotential: string;
  physicalLabor: string;
  technicalComplexity: string;
  procurementDeadline: string | null;
  contractAwardDate: string | null;
  contractExpirationDate: string | null;
  expirationIsEstimated: boolean;
  evidenceConfidence: number | null;
  classificationRationale: string;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceDocumentUrl: string | null;
  isStale: boolean;
  amendmentCount: number;
  discoveredAt: string;
  lastVerifiedAt: string | null;
}

export interface OpportunityQuery {
  search?: string;
  trades?: string[];
  services?: string[];
  classifications?: OpportunityClassification[];
  statuses?: string[];
  counties?: string[];
  cities?: string[];
  zips?: string[];
  sources?: string[];
  equipmentTypes?: string[];
  minDocumentedValue?: number;
  maxDocumentedValue?: number;
  minEstimatedValue?: number;
  deadlineBefore?: string;
  expirationBefore?: string;
  confidenceMin?: number;
  freshnessDays?: number;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export interface HubOverview {
  indexedOpportunities: number;
  confirmedActive: number;
  timingBased: number;
  assetBased: number;
  relationship: number;
  inferred: number;
  documentedActiveValue: number;
  upcomingRenewals: number;
  recentSolicitations: number;
  commercialProperties: number;
  documentedEquipment: number;
  recentPermits: number;
  mappedRecords: number;
  byTrade: Array<{ label: string; count: number }>;
  byCounty: Array<{ label: string; count: number }>;
  byClassification: Array<{ label: string; count: number }>;
}

type DbRow = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<DbRow[]> };
const queryDb = (query: string, params: unknown[] = []) => (sql as unknown as Queryable).query(query, params);

const UNIVERSAL_FEED_SQL = `
  SELECT
    o.id::text AS id,
    'universal'::text AS source_type,
    o.title,
    o.summary,
    o.trade_slug,
    t.name AS service_category,
    o.classification,
    o.status,
    o.geographic_scope_type,
    o.address,
    o.city,
    o.county,
    o.counties,
    o.zip_code,
    o.latitude,
    o.longitude,
    o.documented_value,
    o.estimated_value,
    o.value_estimation_methodology,
    o.recurring_revenue_potential,
    o.physical_labor,
    o.technical_complexity,
    o.procurement_deadline,
    o.contract_award_date,
    o.contract_expiration_date,
    o.expiration_is_estimated,
    o.evidence_confidence,
    o.classification_rationale,
    s.source_name,
    o.source_url,
    o.source_document_url,
    o.is_stale,
    o.amendment_count,
    o.discovered_at,
    o.last_verified_at
  FROM oi_opportunities o
  LEFT JOIN oi_taxonomy_categories t ON t.id = o.service_category_id
  LEFT JOIN oi_data_sources s ON s.id = o.source_id

  UNION ALL

  SELECT
    b.id::text AS id,
    'legacy_procurement'::text AS source_type,
    b.title,
    b.description AS summary,
    b.trade_slug,
    NULL::text AS service_category,
    'confirmed'::text AS classification,
    CASE
      WHEN b.status = 'open' AND (b.closing_date IS NULL OR b.closing_date >= CURRENT_TIMESTAMP) THEN 'active'
      WHEN b.status = 'cancelled' THEN 'cancelled'
      WHEN b.status = 'awarded' THEN 'awarded'
      ELSE 'expired'
    END AS status,
    CASE WHEN b.zip_code IS NOT NULL THEN 'city' ELSE 'county' END AS geographic_scope_type,
    NULL::text AS address,
    b.city,
    b.county,
    CASE WHEN b.county IS NULL THEN '{}'::text[] ELSE ARRAY[b.county]::text[] END AS counties,
    b.zip_code,
    NULL::double precision AS latitude,
    NULL::double precision AS longitude,
    NULL::numeric AS documented_value,
    b.estimated_value,
    CASE WHEN b.estimated_value IS NOT NULL THEN 'Legacy source-provided estimate; verify against the linked procurement document before use.' ELSE NULL END AS value_estimation_methodology,
    'unknown'::text AS recurring_revenue_potential,
    'unknown'::text AS physical_labor,
    'unknown'::text AS technical_complexity,
    b.closing_date AS procurement_deadline,
    NULL::date AS contract_award_date,
    NULL::date AS contract_expiration_date,
    FALSE AS expiration_is_estimated,
    95::smallint AS evidence_confidence,
    'Active or historical solicitation collected by an operational source adapter. Classification reflects the procurement record, not an inferred need.'::text AS classification_rationale,
    ps.agency_name AS source_name,
    b.source_url,
    NULL::text AS source_document_url,
    FALSE AS is_stale,
    0::integer AS amendment_count,
    b.created_at AS discovered_at,
    ps.last_successful_at AS last_verified_at
  FROM fl_commercial_bids b
  JOIN fl_procurement_sources ps ON ps.id = b.source_id
  WHERE ps.last_successful_at IS NOT NULL
    AND b.source_url IS NOT NULL
    AND b.source_url <> ''
    AND NOT EXISTS (
      SELECT 1 FROM oi_opportunities migrated
      WHERE migrated.source_id = 'legacy:' || ps.id
        AND migrated.source_record_id = b.id::text
    )
`;

function text(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapOpportunity(row: DbRow): OpportunityRecord {
  return {
    id: String(row.id),
    sourceType: row.source_type === "legacy_procurement" ? "legacy_procurement" : "universal",
    title: String(row.title),
    summary: text(row.summary),
    tradeSlug: text(row.trade_slug),
    serviceCategory: text(row.service_category),
    classification: String(row.classification) as OpportunityClassification,
    status: String(row.status),
    geographicScopeType: String(row.geographic_scope_type || "unknown"),
    address: text(row.address),
    city: text(row.city),
    county: text(row.county),
    counties: Array.isArray(row.counties) ? row.counties.map(String) : [],
    zipCode: text(row.zip_code),
    latitude: number(row.latitude),
    longitude: number(row.longitude),
    documentedValue: number(row.documented_value),
    estimatedValue: number(row.estimated_value),
    valueEstimationMethodology: text(row.value_estimation_methodology),
    recurringRevenuePotential: String(row.recurring_revenue_potential || "unknown"),
    physicalLabor: String(row.physical_labor || "unknown"),
    technicalComplexity: String(row.technical_complexity || "unknown"),
    procurementDeadline: iso(row.procurement_deadline),
    contractAwardDate: text(row.contract_award_date),
    contractExpirationDate: text(row.contract_expiration_date),
    expirationIsEstimated: Boolean(row.expiration_is_estimated),
    evidenceConfidence: number(row.evidence_confidence),
    classificationRationale: String(row.classification_rationale || "No rationale recorded."),
    sourceName: text(row.source_name),
    sourceUrl: text(row.source_url),
    sourceDocumentUrl: text(row.source_document_url),
    isStale: Boolean(row.is_stale),
    amendmentCount: number(row.amendment_count) || 0,
    discoveredAt: iso(row.discovered_at) || new Date(0).toISOString(),
    lastVerifiedAt: iso(row.last_verified_at),
  };
}

function addArrayFilter(where: string[], params: unknown[], column: string, values?: string[]) {
  const clean = values?.map((value) => value.trim()).filter(Boolean);
  if (!clean?.length) return;
  params.push(clean);
  where.push(`${column} = ANY($${params.length}::text[])`);
}

export async function queryOpportunities(filters: OpportunityQuery = {}) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length} OR address ILIKE $${params.length} OR source_name ILIKE $${params.length})`);
  }
  addArrayFilter(where, params, "trade_slug", filters.trades);
  addArrayFilter(where, params, "service_category", filters.services);
  addArrayFilter(where, params, "classification", filters.classifications);
  addArrayFilter(where, params, "status", filters.statuses);
  addArrayFilter(where, params, "county", filters.counties);
  addArrayFilter(where, params, "city", filters.cities);
  addArrayFilter(where, params, "zip_code", filters.zips);
  addArrayFilter(where, params, "source_name", filters.sources);

  if (Number.isFinite(filters.minDocumentedValue)) {
    params.push(filters.minDocumentedValue);
    where.push(`documented_value >= $${params.length}`);
  }
  if (Number.isFinite(filters.maxDocumentedValue)) {
    params.push(filters.maxDocumentedValue);
    where.push(`documented_value <= $${params.length}`);
  }
  if (Number.isFinite(filters.minEstimatedValue)) {
    params.push(filters.minEstimatedValue);
    where.push(`estimated_value >= $${params.length}`);
  }
  if (filters.deadlineBefore) {
    params.push(filters.deadlineBefore);
    where.push(`procurement_deadline <= $${params.length}::timestamptz`);
  }
  if (filters.expirationBefore) {
    params.push(filters.expirationBefore);
    where.push(`contract_expiration_date <= $${params.length}::date`);
  }
  if (Number.isFinite(filters.confidenceMin)) {
    params.push(filters.confidenceMin);
    where.push(`evidence_confidence >= $${params.length}`);
  }
  if (Number.isFinite(filters.freshnessDays) && Number(filters.freshnessDays) > 0) {
    params.push(filters.freshnessDays);
    where.push(`COALESCE(last_verified_at, discovered_at) >= CURRENT_TIMESTAMP - ($${params.length}::text || ' days')::interval`);
  }

  if (filters.cursor) {
    const [timestamp, id] = Buffer.from(filters.cursor, "base64url").toString("utf8").split("|");
    if (timestamp && id) {
      params.push(timestamp, id);
      where.push(`(discovered_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::text)`);
    }
  }

  const sortMap: Record<string, string> = {
    documented_value: "documented_value DESC NULLS LAST, discovered_at DESC, id DESC",
    estimated_value: "estimated_value DESC NULLS LAST, discovered_at DESC, id DESC",
    evidence: "evidence_confidence DESC NULLS LAST, discovered_at DESC, id DESC",
    deadline: "procurement_deadline ASC NULLS LAST, discovered_at DESC, id DESC",
    renewal: "contract_expiration_date ASC NULLS LAST, discovered_at DESC, id DESC",
    newest: "discovered_at DESC, id DESC",
  };
  const orderBy = sortMap[filters.sort || "newest"] || sortMap.newest;
  const limit = Math.min(250, Math.max(1, filters.limit || 50));
  params.push(limit + 1);

  const rows = await queryDb(
    `WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL})
     SELECT *, count(*) OVER()::int AS filtered_total
     FROM opportunity_feed
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT $${params.length}`,
    params,
  );

  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const records = visibleRows.map(mapOpportunity);
  const last = records.at(-1);

  return {
    records,
    total: rows.length ? Number(rows[0].filtered_total || 0) : 0,
    hasMore,
    nextCursor: hasMore && last
      ? Buffer.from(`${last.discoveredAt}|${last.id}`, "utf8").toString("base64url")
      : null,
  };
}

export async function getOpportunityDetail(id: string) {
  const rows = await queryDb(
    `WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT * FROM opportunity_feed WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!rows.length) return null;
  const opportunity = mapOpportunity(rows[0]);

  if (opportunity.sourceType === "legacy_procurement") {
    return { opportunity, properties: [], organizations: [], evidence: [], equipment: [], documents: [], statusHistory: [] };
  }

  const [properties, organizations, evidence, equipment, documents, statusHistory, procurement] = await Promise.all([
    queryDb(`SELECT p.*, op.relationship_type FROM oi_opportunity_properties op JOIN oi_properties p ON p.id = op.property_id WHERE op.opportunity_id = $1 ORDER BY p.situs_address`, [id]),
    queryDb(`SELECT org.*, oo.relationship_type FROM oi_opportunity_organizations oo JOIN oi_organizations org ON org.id = oo.organization_id WHERE oo.opportunity_id = $1 ORDER BY org.legal_name`, [id]),
    queryDb(`SELECT * FROM oi_opportunity_evidence WHERE opportunity_id = $1 ORDER BY is_direct_evidence DESC, verified_at DESC NULLS LAST`, [id]),
    queryDb(`SELECT e.* FROM oi_equipment e JOIN oi_opportunity_properties op ON op.property_id = e.property_id WHERE op.opportunity_id = $1 ORDER BY e.equipment_type`, [id]),
    queryDb(`SELECT id, title, document_type, version_label, version_number, document_url, published_at, fetched_at, extraction_status, sha256, is_current FROM oi_source_documents WHERE opportunity_id = $1 ORDER BY published_at DESC NULLS LAST, title`, [id]),
    queryDb(`SELECT previous_status, new_status, change_reason, source_url, observed_at, metadata FROM oi_opportunity_status_history WHERE opportunity_id = $1 ORDER BY observed_at DESC`, [id]),
    queryDb(`SELECT solicitation_number, purchasing_organization, scope_of_work, publication_date,
                    submission_deadline, status, procurement_contact, required_licenses,
                    required_certifications, mandatory_site_visit, amendments, source_url,
                    last_status_checked_at
             FROM oi_procurement_records WHERE opportunity_id = $1
             ORDER BY updated_at DESC LIMIT 5`, [id]),
  ]);
  return { opportunity, properties, organizations, evidence, equipment, documents, statusHistory, procurement };
}

export async function getHubOverview(): Promise<HubOverview> {
  const rows = await queryDb(`
    WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}),
    stats AS (
      SELECT
        count(*)::int AS indexed_opportunities,
        count(*) FILTER (WHERE classification = 'confirmed' AND status = 'active')::int AS confirmed_active,
        count(*) FILTER (WHERE classification = 'timing_based')::int AS timing_based,
        count(*) FILTER (WHERE classification = 'asset_based')::int AS asset_based,
        count(*) FILTER (WHERE classification = 'relationship')::int AS relationship,
        count(*) FILTER (WHERE classification = 'inferred')::int AS inferred,
        COALESCE(sum(documented_value) FILTER (WHERE status = 'active'), 0)::numeric AS documented_active_value,
        count(*) FILTER (WHERE contract_expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days')::int AS upcoming_renewals,
        count(*) FILTER (WHERE classification = 'confirmed' AND discovered_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')::int AS recent_solicitations,
        count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS mapped_records
      FROM opportunity_feed
    ),
    supporting AS (
      SELECT
        (SELECT count(*) FROM fl_parcels) +
          (SELECT count(*) FROM oi_properties property
           WHERE NOT EXISTS (
             SELECT 1 FROM fl_parcels parcel
             WHERE property.source_id = 'fl-dor-cadastral'
               AND property.source_record_id = concat(parcel.county, ':', parcel.parcel_id)
           )) AS commercial_properties,
        (SELECT count(*) FROM oi_equipment) AS documented_equipment,
        (SELECT count(*) FROM oi_permit_records WHERE issue_date >= CURRENT_DATE - INTERVAL '30 days') +
          (SELECT count(*) FROM fl_permits WHERE issue_date >= CURRENT_DATE - INTERVAL '30 days') AS recent_permits
    )
    SELECT * FROM stats CROSS JOIN supporting
  `);
  const row = rows[0] || {};

  const [tradeRows, countyRows, classificationRows] = await Promise.all([
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT COALESCE(trade_slug, 'Unclassified') AS label, count(*)::int AS count FROM opportunity_feed GROUP BY 1 ORDER BY count DESC, label LIMIT 12`),
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT COALESCE(county, 'Regional / unknown') AS label, count(*)::int AS count FROM opportunity_feed GROUP BY 1 ORDER BY count DESC, label LIMIT 15`),
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT classification AS label, count(*)::int AS count FROM opportunity_feed GROUP BY 1 ORDER BY count DESC`),
  ]);

  const series = (items: DbRow[]) => items.map((item) => ({ label: String(item.label), count: Number(item.count || 0) }));
  return {
    indexedOpportunities: Number(row.indexed_opportunities || 0),
    confirmedActive: Number(row.confirmed_active || 0),
    timingBased: Number(row.timing_based || 0),
    assetBased: Number(row.asset_based || 0),
    relationship: Number(row.relationship || 0),
    inferred: Number(row.inferred || 0),
    documentedActiveValue: Number(row.documented_active_value || 0),
    upcomingRenewals: Number(row.upcoming_renewals || 0),
    recentSolicitations: Number(row.recent_solicitations || 0),
    commercialProperties: Number(row.commercial_properties || 0),
    documentedEquipment: Number(row.documented_equipment || 0),
    recentPermits: Number(row.recent_permits || 0),
    mappedRecords: Number(row.mapped_records || 0),
    byTrade: series(tradeRows),
    byCounty: series(countyRows),
    byClassification: series(classificationRows),
  };
}

export interface AtlasQuery extends OpportunityQuery {
  bbox?: [number, number, number, number];
  layers?: string[];
}

function bboxPredicate(params: unknown[], latColumn: string, lngColumn: string, bbox?: AtlasQuery["bbox"]) {
  if (!bbox) return "1=1";
  params.push(bbox[0], bbox[1], bbox[2], bbox[3]);
  const i = params.length;
  return `${lngColumn} BETWEEN $${i - 3} AND $${i - 1} AND ${latColumn} BETWEEN $${i - 2} AND $${i}`;
}

export async function getAtlasData(filters: AtlasQuery = {}) {
  const layers = new Set(filters.layers?.length ? filters.layers : ["opportunities", "solicitations", "renewals", "properties", "permits", "equipment", "relationships"]);
  const counties = filters.counties?.filter(Boolean) || [];
  const features: Array<Record<string, unknown>> = [];

  if (layers.has("opportunities") || layers.has("solicitations") || layers.has("renewals") || layers.has("relationships")) {
    const params: unknown[] = [];
    const bboxWhere = bboxPredicate(params, "latitude", "longitude", filters.bbox);
    if (counties.length) params.push(counties);
    const countyWhere = counties.length ? `AND county = ANY($${params.length}::text[])` : "";
    const opportunityFilters: string[] = [];
    if (filters.classifications?.length) { params.push(filters.classifications); opportunityFilters.push(`classification = ANY($${params.length}::text[])`); }
    if (filters.statuses?.length) { params.push(filters.statuses); opportunityFilters.push(`status = ANY($${params.length}::text[])`); }
    if (filters.trades?.length) { params.push(filters.trades); opportunityFilters.push(`trade_slug = ANY($${params.length}::text[])`); }
    if (filters.search?.trim()) { params.push(`%${filters.search.trim()}%`); opportunityFilters.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length})`); }
    const opportunityWhere = opportunityFilters.length ? `AND ${opportunityFilters.join(" AND ")}` : "";
    const rows = await queryDb(
      `WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL})
       SELECT * FROM opportunity_feed
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ${bboxWhere} ${countyWhere} ${opportunityWhere}
       ORDER BY discovered_at DESC`,
      params,
    );
    for (const row of rows) {
      const item = mapOpportunity(row);
      features.push({
        type: "Feature",
        id: `opportunity:${item.id}`,
        geometry: { type: "Point", coordinates: [item.longitude, item.latitude] },
        properties: { ...item, featureType: "opportunity", renderMode: "documented_location" },
      });
    }

    const regionalParams: unknown[] = [];
    if (counties.length) regionalParams.push(counties);
    const regionalCountyWhere = counties.length ? `AND county = ANY($1::text[])` : "";
    const regionalFilters: string[] = [];
    if (filters.classifications?.length) { regionalParams.push(filters.classifications); regionalFilters.push(`classification = ANY($${regionalParams.length}::text[])`); }
    if (filters.statuses?.length) { regionalParams.push(filters.statuses); regionalFilters.push(`status = ANY($${regionalParams.length}::text[])`); }
    if (filters.trades?.length) { regionalParams.push(filters.trades); regionalFilters.push(`trade_slug = ANY($${regionalParams.length}::text[])`); }
    if (filters.search?.trim()) { regionalParams.push(`%${filters.search.trim()}%`); regionalFilters.push(`(title ILIKE $${regionalParams.length} OR summary ILIKE $${regionalParams.length})`); }
    const regionalFilterWhere = regionalFilters.length ? `AND ${regionalFilters.join(" AND ")}` : "";
    const regionalRows = await queryDb(
      `WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL})
       SELECT CASE WHEN county IS NULL THEN 'Statewide' ELSE county END AS region,
              classification, status, trade_slug, service_category, count(*)::int AS opportunity_count,
              COALESCE(sum(documented_value), 0)::numeric AS documented_value
       FROM opportunity_feed
       WHERE (latitude IS NULL OR longitude IS NULL) ${regionalCountyWhere} ${regionalFilterWhere}
       GROUP BY region, classification, status, trade_slug, service_category`,
      regionalParams,
    );
    for (const row of regionalRows) {
      const statewide = String(row.region) === "Statewide";
      const county = statewide ? null : COUNTY_BY_NAME.get(String(row.region).toLowerCase());
      if (!statewide && !county) continue;
      features.push({
        type: "Feature",
        id: `regional:${statewide ? "fl" : county?.fips}:${row.classification}:${row.status}:${row.trade_slug || "none"}:${row.service_category || "none"}`,
        geometry: { type: "Point", coordinates: statewide ? [-82.3, 28.15] : [county!.lng, county!.lat] },
        properties: {
          featureType: "regional_aggregate",
          renderMode: statewide ? "statewide_aggregate" : "county_aggregate",
          county: county?.name || null,
          classification: String(row.classification),
          status: row.status ? String(row.status) : null,
          tradeSlug: row.trade_slug ? String(row.trade_slug) : null,
          serviceCategory: row.service_category ? String(row.service_category) : null,
          opportunityCount: Number(row.opportunity_count || 0),
          documentedValue: Number(row.documented_value || 0),
          title: statewide ? "Florida records without documented coordinates" : `${county!.name} County regional records`,
          geographicScopeType: statewide ? "regional" : "county",
        },
      });
    }
  }

  if (layers.has("properties")) {
    const params: unknown[] = [];
    const bboxWhere = bboxPredicate(params, "latitude", "longitude", filters.bbox);
    if (counties.length) params.push(counties);
    const countyWhere = counties.length ? `AND county = ANY($${params.length}::text[])` : "";
    const rows = await queryDb(`
      SELECT * FROM (
        SELECT id::text, name, situs_address, city, county, zip_code, latitude, longitude,
               property_use_description, building_sqft, year_built, owner_name_raw, source_url, updated_at
        FROM oi_properties
        UNION ALL
        SELECT concat(parcel.county, ':', parcel.parcel_id), NULL, parcel.situs_address,
               parcel.situs_city, parcel.county, parcel.situs_zip, parcel.latitude, parcel.longitude,
               parcel.use_description, parcel.building_sqft, parcel.year_built, parcel.owner_name_raw,
               parcel.location_source_url, parcel.updated_at
        FROM fl_parcels parcel
        WHERE NOT EXISTS (
          SELECT 1 FROM oi_properties property
          WHERE property.source_id = 'fl-dor-cadastral'
            AND property.source_record_id = concat(parcel.county, ':', parcel.parcel_id)
        )
      ) property_feed
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ${bboxWhere} ${countyWhere}
      ORDER BY updated_at DESC LIMIT 10000`, params);
    for (const row of rows) {
      features.push({ type: "Feature", id: `property:${row.id}`, geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] }, properties: { ...row, featureType: "property", renderMode: "documented_location" } });
    }
  }

  if (layers.has("permits")) {
    const params: unknown[] = [];
    const bboxWhere = bboxPredicate(params, "latitude", "longitude", filters.bbox);
    if (counties.length) params.push(counties);
    const countyWhere = counties.length ? `AND county = ANY($${params.length}::text[])` : "";
    const rows = await queryDb(`SELECT id, permit_number, permit_type, permit_status, description, issue_date, job_value, contractor_name, address, city, county, zip_code, latitude, longitude, source_url FROM oi_permit_records WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ${bboxWhere} ${countyWhere} ORDER BY issue_date DESC NULLS LAST LIMIT 5000`, params);
    for (const row of rows) {
      features.push({ type: "Feature", id: `permit:${row.id}`, geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] }, properties: { ...row, featureType: "permit", classification: "permit", renderMode: "documented_location" } });
    }
  }

  if (layers.has("equipment")) {
    const equipmentParams: unknown[] = [];
    const equipmentBboxWhere = bboxPredicate(equipmentParams, "p.latitude", "p.longitude", filters.bbox);
    if (counties.length) equipmentParams.push(counties);
    const equipmentCountyWhere = counties.length ? `AND p.county = ANY($${equipmentParams.length}::text[])` : "";
    const rows = await queryDb(`SELECT e.id, e.equipment_type, e.manufacturer, e.model, e.unit_count, e.individual_capacity_tons, e.aggregate_capacity_tons, e.capacity_is_estimated, e.installation_date, e.controls_platform, e.evidence_url, p.name, p.situs_address, p.city, p.county, p.zip_code, p.latitude, p.longitude FROM oi_equipment e JOIN oi_properties p ON p.id = e.property_id WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND ${equipmentBboxWhere} ${equipmentCountyWhere} ORDER BY e.updated_at DESC LIMIT 5000`, equipmentParams);
    for (const row of rows) {
      features.push({ type: "Feature", id: `equipment:${row.id}`, geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] }, properties: { ...row, featureType: "equipment", classification: "equipment", renderMode: "documented_location" } });
    }
  }

  if (layers.has("portfolios") || layers.has("relationships") || layers.has("properties")) {
    const mgmtParams: unknown[] = [];
    const mgmtBboxWhere = bboxPredicate(mgmtParams, "latitude", "longitude", filters.bbox);
    if (counties.length) mgmtParams.push(counties);
    const mgmtCountyWhere = counties.length ? `AND county = ANY($${mgmtParams.length}::text[])` : "";
    const mgmtRows = await queryDb(
      `SELECT id::text, name, dba, firm_type, license_number, license_type, status,
              address, city, county, zip_code, phone, email, website, qualifier_name,
              managed_properties_count, managed_portfolio_sqft, latitude, longitude, source, evidence_url,
              metadata
       FROM fl_management_firms
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ${mgmtBboxWhere} ${mgmtCountyWhere}
       ORDER BY managed_properties_count DESC, name ASC LIMIT 5000`,
      mgmtParams,
    );
    for (const row of mgmtRows) {
      const metadata = row.metadata && typeof row.metadata === "object"
        ? row.metadata as DbRow
        : {};
      features.push({
        type: "Feature",
        id: `portfolio:${row.id}`,
        geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] },
        properties: {
          id: row.id,
          title: String(row.name) + (row.dba ? ` (${row.dba})` : ""),
          name: row.name,
          dba: row.dba,
          summary: `${row.firm_type === "community_association_management" ? "Florida DBPR Community Association Management (CAB) firm" : "Commercial Property & Asset Management operator"} located at ${row.address}, ${row.city}, FL.${metadata.google_listing_status === "listing_found" ? " Google Maps listing found." : ""}`,
          classification: "relationship",
          serviceCategory: "Property Management Portfolios",
          tradeSlug: "property_management",
          trade_slug: "property_management",
          status: row.status || "current",
          address: row.address,
          city: row.city,
          county: row.county,
          zipCode: row.zip_code,
          phone: row.phone,
          email: row.email,
          website: row.website,
          qualifierName: row.qualifier_name,
          licenseNumber: row.license_number,
          licenseType: row.license_type,
          portfolioCount: Number(row.managed_properties_count || 0) || null,
          managedPropertiesCount: Number(row.managed_properties_count || 0) || null,
          portfolioSqft: row.managed_portfolio_sqft,
          googlePlaceId: metadata.google_place_id || null,
          googleListingStatus: metadata.google_listing_status || "not_checked",
          googleListingCheckedAt: metadata.google_listing_checked_at || null,
          coordinateSource: metadata.coordinate_source || null,
          sourceUrl: row.evidence_url || "https://www.myfloridalicense.com",
          featureType: "portfolio",
          renderMode: "documented_location",
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      returned: features.length,
      documentedLocations: features.filter((feature) => (feature.properties as DbRow).renderMode === "documented_location").length,
      regionalAggregates: features.filter((feature) => (feature.properties as DbRow).renderMode === "county_aggregate").length,
      generatedAt: new Date().toISOString(),
      notice: "County and statewide centroids are used only for clearly labeled aggregates when exact coordinates are unavailable, never as property coordinates.",
    },
  };
}

export async function getSourceCoverage() {
  const [sources, procurementSources, countyRegistry, syncHistory, syncState, alerts] = await Promise.all([
    queryDb(`SELECT * FROM oi_data_sources ORDER BY source_category, source_name`),
    queryDb(`SELECT id, agency_name AS source_name, portal_url AS source_url, 'procurement' AS source_category, collection_method AS access_method, supported_format AS data_format, collection_frequency AS update_frequency, status, (last_successful_at IS NOT NULL) AS is_operational, last_attempted_at, last_successful_at, indexed_bids_count AS records_ingested, error_status AS limitations FROM fl_procurement_sources ORDER BY agency_type, agency_name`),
    queryDb(`SELECT county, fips, official_portal_url, gis_download_url, file_format, status, commercial_parcels_count, last_parcels_pull_at, last_permits_pull_at, last_licenses_pull_at FROM fl_county_parcel_registry ORDER BY population_rank`),
    queryDb(`SELECT * FROM oi_source_sync_history ORDER BY started_at DESC LIMIT 100`),
    queryDb(`SELECT * FROM oi_source_sync_state ORDER BY next_run_at, source_id`),
    queryDb(`SELECT alert.*, source.source_name
             FROM oi_source_alerts alert JOIN oi_data_sources source ON source.id=alert.source_id
             ORDER BY (alert.resolved_at IS NULL) DESC, alert.last_seen_at DESC LIMIT 100`),
  ]);
  return { sources, procurementSources, countyRegistry, syncHistory, syncState, alerts };
}

export async function getTaxonomy() {
  return queryDb(`SELECT id, parent_id, slug, name, category_type, trade_slug, description, is_active, sort_order, metadata FROM oi_taxonomy_categories ORDER BY category_type, sort_order, name`);
}

export async function createTaxonomyCategory(input: { slug: string; name: string; categoryType: string; tradeSlug?: string; parentId?: string; description?: string }) {
  const rows = await queryDb(
    `INSERT INTO oi_taxonomy_categories (slug, name, category_type, trade_slug, parent_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.slug, input.name, input.categoryType, input.tradeSlug || null, input.parentId || null, input.description || null],
  );
  return rows[0];
}

export async function updateTaxonomyCategory(id: string, input: { name?: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  const rows = await queryDb(
    `UPDATE oi_taxonomy_categories SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       is_active = COALESCE($4, is_active),
       sort_order = COALESCE($5, sort_order),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, input.name ?? null, input.description ?? null, input.isActive ?? null, input.sortOrder ?? null],
  );
  return rows[0] || null;
}

export async function getSavedIntelligence() {
  const [items, searches] = await Promise.all([
    queryDb(`SELECT * FROM oi_saved_items ORDER BY created_at DESC`),
    queryDb(`SELECT * FROM oi_saved_searches ORDER BY updated_at DESC`),
  ]);
  return { items, searches };
}

export async function saveIntelligenceItem(input: { itemType: string; itemId?: string; title: string; notes?: string; collectionName?: string; regionGeojson?: unknown }) {
  const rows = await queryDb(
    `INSERT INTO oi_saved_items (item_type, item_id, title, notes, collection_name, region_geojson)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (item_type, item_id, saved_by) DO UPDATE SET notes = EXCLUDED.notes, collection_name = EXCLUDED.collection_name
     RETURNING *`,
    [input.itemType, input.itemId || null, input.title, input.notes || null, input.collectionName || null, input.regionGeojson ? JSON.stringify(input.regionGeojson) : null],
  );
  return rows[0];
}

export async function saveIntelligenceSearch(input: { name: string; filters: unknown; geographicScope?: unknown; notificationsEnabled?: boolean }) {
  const rows = await queryDb(
    `INSERT INTO oi_saved_searches (name, filters, geographic_scope, notifications_enabled)
     VALUES ($1, $2::jsonb, $3::jsonb, $4) RETURNING *`,
    [input.name, JSON.stringify(input.filters || {}), JSON.stringify(input.geographicScope || {}), Boolean(input.notificationsEnabled)],
  );
  return rows[0];
}

export async function deleteSavedIntelligence(id: string, kind: "item" | "search") {
  const table = kind === "search" ? "oi_saved_searches" : "oi_saved_items";
  await queryDb(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

export async function runDeterministicDiscovery(limit = 250) {
  const rules = await queryDb(`SELECT * FROM oi_discovery_rules WHERE is_enabled = TRUE ORDER BY slug`);
  const outcomes: Array<{ rule: string; created: number }> = [];

  for (const rule of rules) {
    const slug = String(rule.slug);
    let created = 0;
    if (["documented-niagara-controls", "documented-rooftop-units", "documented-walk-in-refrigeration"].includes(slug)) {
      const keywordMap: Record<string, string[]> = {
        "documented-niagara-controls": ["niagara", "tridium"],
        "documented-rooftop-units": ["rooftop unit", "rtu"],
        "documented-walk-in-refrigeration": ["walk-in cooler", "walk-in freezer"],
      };
      const categoryRows = await queryDb(`SELECT id FROM oi_taxonomy_categories WHERE slug = $1 LIMIT 1`, [rule.output_service_category_slug]);
      const categoryId = categoryRows[0]?.id || null;
      const equipmentRows = await queryDb(
        `SELECT e.*, p.situs_address, p.city, p.county, p.zip_code, p.latitude, p.longitude
         FROM oi_equipment e LEFT JOIN oi_properties p ON p.id = e.property_id
         WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) keyword WHERE lower(COALESCE(e.equipment_type, '') || ' ' || COALESCE(e.manufacturer, '') || ' ' || COALESCE(e.model, '') || ' ' || COALESCE(e.controls_platform, '') || ' ' || COALESCE(e.documented_description, '')) LIKE '%' || keyword || '%')
         ORDER BY e.updated_at DESC LIMIT $2`,
        [keywordMap[slug], limit],
      );
      for (const equipment of equipmentRows) {
        const dedupeHash = createHash("sha256").update(`${slug}:${equipment.id}`).digest("hex");
        const inserted = await queryDb(
          `INSERT INTO oi_opportunities (
             dedupe_hash, title, summary, trade_slug, service_category_id, classification, status,
             geographic_scope_type, address, city, county, counties, zip_code, latitude, longitude,
             evidence_confidence, classification_rationale, source_url, discovery_rule_id, last_verified_at
           ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11::text[], $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
           ON CONFLICT (dedupe_hash) DO NOTHING RETURNING id`,
          [
            dedupeHash,
            `${rule.name}: ${equipment.situs_address || equipment.equipment_type}`,
            equipment.documented_description || `Documented ${equipment.equipment_type}`,
            rule.output_trade_slug,
            categoryId,
            rule.output_classification,
            equipment.latitude && equipment.longitude ? "property" : "county",
            equipment.situs_address || null,
            equipment.city || null,
            equipment.county || null,
            equipment.county ? [equipment.county] : [],
            equipment.zip_code || null,
            equipment.latitude || null,
            equipment.longitude || null,
            rule.default_confidence,
            rule.rationale_template,
            equipment.evidence_url || null,
            rule.id,
          ],
        );
        if (inserted.length) {
          created++;
          await queryDb(`INSERT INTO oi_opportunity_evidence (opportunity_id, evidence_type, title, description, source_url, source_record_id, is_direct_evidence, confidence, verified_at) VALUES ($1, 'equipment', $2, $3, $4, $5, TRUE, $6, CURRENT_TIMESTAMP)`, [inserted[0].id, equipment.equipment_type, equipment.documented_description || null, equipment.evidence_url || null, equipment.id, equipment.confidence || rule.default_confidence]);
        }
      }
    }
    outcomes.push({ rule: slug, created });
  }
  return { rulesEvaluated: rules.length, opportunitiesCreated: outcomes.reduce((sum, item) => sum + item.created, 0), outcomes };
}

export async function getMarketAnalytics() {
  const overview = await getHubOverview();
  const [freshness, values, deadlines] = await Promise.all([
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT CASE WHEN COALESCE(last_verified_at, discovered_at) >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN '0-7 days' WHEN COALESCE(last_verified_at, discovered_at) >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN '8-30 days' WHEN COALESCE(last_verified_at, discovered_at) >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN '31-90 days' ELSE '90+ days' END AS label, count(*)::int AS count FROM opportunity_feed GROUP BY 1 ORDER BY 1`),
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT count(*) FILTER (WHERE documented_value IS NOT NULL)::int AS documented_count, count(*) FILTER (WHERE estimated_value IS NOT NULL)::int AS estimated_count, count(*) FILTER (WHERE documented_value IS NULL AND estimated_value IS NULL)::int AS unknown_count FROM opportunity_feed`),
    queryDb(`WITH opportunity_feed AS (${UNIVERSAL_FEED_SQL}) SELECT date_trunc('month', procurement_deadline)::date AS month, count(*)::int AS count FROM opportunity_feed WHERE procurement_deadline BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '12 months' GROUP BY 1 ORDER BY 1`),
  ]);
  return { overview, freshness, values: values[0] || {}, deadlines };
}

export const atlasCountyReference = FLORIDA_COUNTIES.map(({ fips, name, lat, lng, region }) => ({ fips, name, lat, lng, region }));
