import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required.");
const sql = neon(databaseUrl);

const tables = [
  "oi_opportunities", "oi_taxonomy_categories", "oi_data_sources", "oi_properties",
  "oi_organizations", "oi_opportunity_evidence", "oi_equipment", "oi_permit_records",
  "oi_procurement_records", "oi_contract_awards", "oi_discovery_rules", "oi_saved_items",
  "oi_saved_searches", "oi_geographic_boundaries", "oi_source_sync_history",
];

const tableRows = await sql`SELECT unnest(${tables}::text[]) AS name`;
for (const row of tableRows) {
  const exists = await sql`SELECT to_regclass(${row.name}) IS NOT NULL AS exists`;
  if (!exists[0]?.exists) throw new Error(`Missing table: ${row.name}`);
}

const [reference] = await sql`
  SELECT
    (SELECT count(*)::int FROM oi_taxonomy_categories) AS taxonomy_count,
    (SELECT count(*)::int FROM oi_discovery_rules) AS rule_count,
    (SELECT count(*)::int FROM oi_data_sources) AS source_count,
    (SELECT count(*)::int FROM oi_opportunities) AS universal_opportunities,
    (SELECT count(*)::int FROM fl_commercial_bids) AS legacy_bids,
    (SELECT count(*)::int FROM fl_commercial_bids b JOIN fl_procurement_sources s ON s.id = b.source_id WHERE s.last_successful_at IS NOT NULL AND b.source_url IS NOT NULL AND b.source_url <> '') AS eligible_legacy_bids,
    (SELECT count(*)::int FROM fl_parcels) AS existing_parcels,
    (SELECT count(*)::int FROM fl_permits) AS existing_permits
`;

if (Number(reference.taxonomy_count) < 50) throw new Error("Taxonomy reference data is incomplete.");
if (Number(reference.rule_count) < 7) throw new Error("Discovery rule reference data is incomplete.");
if (Number(reference.source_count) < 10) throw new Error("Source catalog reference data is incomplete.");

console.log(JSON.stringify({ ok: true, tables: tables.length, ...reference }, null, 2));
