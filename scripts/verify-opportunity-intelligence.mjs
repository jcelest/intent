import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required");
const sql = neon(databaseUrl);

const [totals, bySource, byClassification, states, documents, documentStatuses, documentFailureSamples, geography, examples] = await Promise.all([
  sql`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE classification='confirmed' AND status='active')::int AS confirmed_active,
      count(*) FILTER (WHERE classification='timing_based')::int AS timing_signals,
      count(*) FILTER (WHERE classification IN ('asset_based','relationship','inferred'))::int AS inferred_relevance,
      count(*) FILTER (WHERE is_stale)::int AS stale,
      count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS point_mapped,
      count(*) FILTER (WHERE geographic_scope_type IN ('county','regional','statewide'))::int AS regional_mapped
    FROM oi_opportunities`,
  sql`SELECT source_id, count(*)::int AS records,
      count(*) FILTER (WHERE classification='confirmed' AND status='active')::int AS confirmed_active,
      max(last_verified_at) AS last_verified_at
    FROM oi_opportunities GROUP BY source_id ORDER BY records DESC`,
  sql`SELECT classification, status, count(*)::int AS records
    FROM oi_opportunities GROUP BY classification, status ORDER BY classification, status`,
  sql`SELECT s.source_id, s.adapter_key, s.last_status, s.last_successful_at,
      s.consecutive_failures, s.last_error, s.last_metrics, d.status AS registry_status,
      d.is_operational, d.last_successful_at AS registry_last_success
    FROM oi_source_sync_state s JOIN oi_data_sources d ON d.id=s.source_id
    ORDER BY s.source_id`,
  sql`SELECT count(*)::int AS registered,
      count(*) FILTER (WHERE fetched_at IS NOT NULL)::int AS fetched,
      count(*) FILTER (WHERE extraction_status='extracted')::int AS extracted,
      count(*) FILTER (WHERE extraction_status='failed')::int AS failed,
      count(*) FILTER (WHERE document_type='amendment')::int AS amendments,
      count(DISTINCT opportunity_id)::int AS opportunities_with_documents
    FROM oi_source_documents`,
  sql`SELECT source_id, extraction_status, content_type, count(*)::int AS records,
      min(extraction_error) AS sample_error
    FROM oi_source_documents GROUP BY source_id, extraction_status, content_type
    ORDER BY source_id, extraction_status, content_type`,
  sql`SELECT source_id, title, document_url, content_type, byte_size, extraction_error
    FROM oi_source_documents WHERE extraction_status='failed'
    ORDER BY updated_at DESC LIMIT 5`,
  sql`SELECT geographic_scope_type, county, count(*)::int AS records
    FROM oi_opportunities
    WHERE source_id IN ('fl-mfmp','fl-facts','fl-fdot-lettings','miamidade-current-solicitations','usaspending-fl','orlando-permits')
    GROUP BY geographic_scope_type, county ORDER BY records DESC LIMIT 20`,
  sql`SELECT o.title, o.classification, o.status, o.procurement_deadline,
      o.contract_expiration_date, o.documented_value, o.county, s.source_name,
      o.source_url, o.last_verified_at,
      (SELECT count(*)::int FROM oi_source_documents d WHERE d.opportunity_id=o.id) AS documents
    FROM oi_opportunities o JOIN oi_data_sources s ON s.id=o.source_id
    WHERE o.status IN ('active','upcoming')
      AND (o.procurement_deadline IS NULL OR o.procurement_deadline >= CURRENT_TIMESTAMP)
      AND o.source_id IN ('fl-mfmp','fl-facts','fl-fdot-lettings','miamidade-current-solicitations','usaspending-fl')
    ORDER BY CASE WHEN o.classification='confirmed' THEN 0 ELSE 1 END,
      o.procurement_deadline NULLS LAST, o.contract_expiration_date NULLS LAST
    LIMIT 20`,
]);

console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), totals: totals[0], bySource, byClassification, states, documents: documents[0], documentStatuses, documentFailureSamples, geography, examples }, null, 2));
