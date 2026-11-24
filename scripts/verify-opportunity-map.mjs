import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required");
const sql = neon(databaseUrl);

const [map] = await sql.query(`
  SELECT count(*)::int AS mapped_parcels,
         count(DISTINCT county)::int AS mapped_counties
  FROM fl_parcels
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL
`);
const [properties] = await sql.query(`
  SELECT count(*)::int AS properties,
         count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS mapped_properties
  FROM oi_properties
`);
const opportunities = await sql.query(`
  SELECT classification, status, count(*)::int AS count
  FROM oi_opportunities
  GROUP BY classification, status
  ORDER BY classification, status
`);
const [evidence] = await sql.query(`
  SELECT count(*)::int AS evidence_count
  FROM oi_opportunity_evidence
  WHERE source_id = 'fl-dor-cadastral'
`);
const [legacyOverlap] = await sql.query(`
  SELECT count(*)::int AS unmatched_mapped_legacy
  FROM fl_parcels parcel
  WHERE parcel.latitude IS NOT NULL AND parcel.longitude IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM oi_properties property
      WHERE property.source_id = 'fl-dor-cadastral'
        AND property.source_record_id = concat(parcel.county, ':', parcel.parcel_id)
    )
`);
const sample = await sql.query(`
  SELECT opportunity.title, opportunity.county,
         opportunity.source_payload->>'buildingSqft' AS building_sqft,
         opportunity.latitude, opportunity.longitude, opportunity.source_url
  FROM oi_opportunities opportunity
  WHERE opportunity.source_id = 'fl-dor-cadastral'
  ORDER BY (opportunity.source_payload->>'buildingSqft')::int DESC
  LIMIT 5
`);

const failures = [];
if (!Number(map.mapped_parcels)) failures.push("No mapped parcel centroids");
if (Number(properties.mapped_properties) !== Number(map.mapped_parcels)) failures.push("Canonical property count does not match mapped parcel count");
const inferred = opportunities.find((row) => row.classification === "inferred");
if (!inferred || Number(inferred.count) < 1) failures.push("No inferred property opportunities");
if (Number(evidence.evidence_count) < Number(inferred?.count || 0)) failures.push("Some inferred opportunities are missing direct evidence");
if (sample.some((row) => !row.source_url || row.latitude == null || row.longitude == null)) failures.push("Sample contains an untraceable or unmapped record");

console.log(JSON.stringify({ map, properties, opportunities, evidence, legacyOverlap, sample, failures }, null, 2));
if (failures.length) process.exit(1);
