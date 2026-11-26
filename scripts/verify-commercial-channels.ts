import { sql } from "../src/lib/db";

async function run() {
  const [sources, entityTypes, queue, acceptance, platforms, counties, invalidEvidence] = await Promise.all([
    sql`SELECT source_key, status, source_reported_count, database_count, snapshot_date, last_successful_at FROM oi_channel_sources ORDER BY source_key`,
    sql`SELECT channel_key, entity_type, COUNT(*)::int count FROM oi_channel_entities WHERE is_source_active=TRUE GROUP BY channel_key, entity_type ORDER BY channel_key, entity_type`,
    sql`SELECT channel_key, status, COUNT(*)::int count FROM oi_channel_verification_queue GROUP BY channel_key, status ORDER BY channel_key, status`,
    sql`SELECT COUNT(*)::int count FROM oi_channel_verification_queue WHERE is_acceptance_test=TRUE`,
    sql`SELECT client_name, COUNT(*)::int total, COUNT(*) FILTER (WHERE status='REGISTERED')::int registered FROM oi_client_platform_coverage WHERE LOWER(client_name)='novation' GROUP BY client_name`,
    sql`SELECT county, source_status, parcels_count, business_matched_count, verified_active_count FROM oi_direct_account_county_coverage WHERE county IN ('Orange','Osceola') ORDER BY county`,
    sql`SELECT COUNT(*)::int count FROM oi_channel_entities WHERE evidence_url IS NULL OR evidence_url=''`,
  ]);
  const dbprSources = sources.filter((row) => ["dbpr-cam", "dbpr-mold"].includes(String(row.source_key)));
  if (dbprSources.some((row) => Number(row.source_reported_count) !== Number(row.database_count))) {
    throw new Error("DBPR source and database counts do not reconcile");
  }
  if (Number(acceptance[0]?.count || 0) !== 25) throw new Error("Acceptance queue must contain exactly 25 records");
  if (Number(platforms[0]?.total || 0) !== 10) throw new Error("Novation platform tracker must contain exactly 10 rows");
  if (Number(invalidEvidence[0]?.count || 0) !== 0) throw new Error("Every channel entity must carry a source evidence URL");
  console.log(JSON.stringify({ sources, entityTypes, queue, acceptance: acceptance[0], platforms: platforms[0], counties }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
