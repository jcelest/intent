import { sql } from "../src/lib/db";
import { buildOpportunityBrief } from "../src/lib/opportunity-documents";
import { getAtlasData, queryOpportunities } from "../src/lib/opportunity-hub";

type Row = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<Row[]> };
const queryDb = (query: string, params: unknown[] = []) =>
  (sql as unknown as Queryable).query(query, params);

async function main() {
  const [totals, sources, documents, documentFailures, categories, categoryRepresentatives, representatives, samples, explorer, atlas, samVerification, sourceCounts] = await Promise.all([
    queryDb(`SELECT count(*)::int AS total,
                    count(*) FILTER (WHERE classification='confirmed' AND status='active')::int AS confirmed_active,
                    count(*) FILTER (WHERE classification='timing_based' AND status='upcoming')::int AS timing_upcoming,
                    count(*) FILTER (WHERE classification='inferred')::int AS inferred,
                    count(*) FILTER (WHERE is_stale)::int AS stale
             FROM oi_opportunities`),
    queryDb(`SELECT source.id, source.source_name, source.status, source.is_operational,
                    source.last_successful_at, state.last_status, state.consecutive_failures,
                    state.next_run_at, state.last_metrics
             FROM oi_data_sources source LEFT JOIN oi_source_sync_state state ON state.source_id=source.id
             WHERE state.source_id IS NOT NULL ORDER BY source.id`),
    queryDb(`SELECT source_id, extraction_status, count(*)::int AS count,
                    min(extraction_error) FILTER (WHERE extraction_error IS NOT NULL) AS sample_error
             FROM oi_source_documents WHERE is_current=TRUE
             GROUP BY source_id, extraction_status ORDER BY source_id, extraction_status`),
    queryDb(`SELECT source_id, title, document_url, extraction_status, extraction_error
             FROM oi_source_documents
             WHERE is_current=TRUE AND extraction_status IN ('failed','unsupported')
             ORDER BY source_id, extraction_status, title LIMIT 12`),
    queryDb(`WITH category_names(name) AS (VALUES
      ('hvac_maintenance'), ('building_automation_controls'), ('remote_monitoring'),
      ('refrigeration'), ('energy_optimization'), ('recurring_maintenance'), ('upcoming_renewals')
    ), searchable AS (
      SELECT opportunity.id, opportunity.classification, opportunity.status,
             award.contract_expiration_date,
             lower(concat_ws(' ', opportunity.title, opportunity.summary, procurement.scope_of_work,
               document.document_text)) AS body
      FROM oi_opportunities opportunity
      LEFT JOIN oi_procurement_records procurement ON procurement.opportunity_id=opportunity.id
      LEFT JOIN LATERAL (
        SELECT string_agg(left(extracted_text, 100000), ' ') AS document_text
        FROM oi_source_documents WHERE opportunity_id=opportunity.id AND is_current=TRUE AND extraction_status='extracted'
      ) document ON TRUE
      LEFT JOIN oi_contract_awards award ON award.source_id=opportunity.source_id
        AND (award.source_record_id=opportunity.source_record_id OR award.source_record_id LIKE opportunity.source_record_id || ':%')
      WHERE opportunity.is_stale=FALSE AND (
        (opportunity.classification='confirmed' AND opportunity.status='active'
          AND (opportunity.procurement_deadline IS NULL OR opportunity.procurement_deadline >= CURRENT_TIMESTAMP))
        OR (opportunity.classification='timing_based' AND opportunity.status IN ('upcoming','active'))
      )
    ), tagged AS (
      SELECT DISTINCT searchable.id, searchable.classification, category.name
      FROM searchable CROSS JOIN LATERAL (VALUES
        ('hvac_maintenance', body ~ '(hvac|air condition|chiller|boiler|mechanical system)' AND body ~ '(maintenance|repair|service agreement|preventive)'),
        ('building_automation_controls', body ~ '(building automation|\\mbas\\M|\\mbms\\M|ddc|bacnet|control system|instrumentation)'),
        ('remote_monitoring', body ~ '(remote monitoring|telemetry|scada|fault detection|sensor monitoring)'),
        ('refrigeration', body ~ '(refrigeration|walk-in cooler|walk-in freezer|cold storage)'),
        ('energy_optimization', body ~ '(energy optimization|energy efficiency|energy audit|retro.?commission|energy management)'),
        ('recurring_maintenance', body ~ '(preventive maintenance|maintenance agreement|maintenance services|on-call maintenance|continuing services|service agreement)'),
        ('upcoming_renewals', classification='timing_based' AND contract_expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '18 months')
      ) category(name, matches) WHERE category.matches
    )
    SELECT category_names.name AS category,
           count(tagged.id) FILTER (WHERE tagged.classification='confirmed')::int AS confirmed_open,
           count(tagged.id) FILTER (WHERE tagged.classification='timing_based')::int AS timing_or_renewal,
           count(tagged.id)::int AS total
    FROM category_names LEFT JOIN tagged ON tagged.name=category_names.name
    GROUP BY category_names.name ORDER BY category_names.name`),
    queryDb(`WITH searchable AS (
      SELECT opportunity.id, opportunity.title, opportunity.source_id, opportunity.source_url,
             opportunity.procurement_deadline, opportunity.classification,
             award.contract_expiration_date,
             lower(concat_ws(' ', opportunity.title, opportunity.summary, procurement.scope_of_work,
               document.document_text)) AS body
      FROM oi_opportunities opportunity
      LEFT JOIN oi_procurement_records procurement ON procurement.opportunity_id=opportunity.id
      LEFT JOIN LATERAL (
        SELECT string_agg(left(extracted_text, 100000), ' ') AS document_text
        FROM oi_source_documents WHERE opportunity_id=opportunity.id AND is_current=TRUE AND extraction_status='extracted'
      ) document ON TRUE
      LEFT JOIN oi_contract_awards award ON award.source_id=opportunity.source_id
        AND (award.source_record_id=opportunity.source_record_id OR award.source_record_id LIKE opportunity.source_record_id || ':%')
      WHERE opportunity.is_stale=FALSE AND (
        (opportunity.classification='confirmed' AND opportunity.status='active'
          AND (opportunity.procurement_deadline IS NULL OR opportunity.procurement_deadline >= CURRENT_TIMESTAMP))
        OR (opportunity.classification='timing_based' AND opportunity.status='upcoming'))
    ), tagged AS (
      SELECT DISTINCT searchable.*, category.name
      FROM searchable CROSS JOIN LATERAL (VALUES
        ('hvac_maintenance', body ~ '(hvac|air condition|chiller|boiler|mechanical system)' AND body ~ '(maintenance|repair|service agreement|preventive)'),
        ('building_automation_controls', body ~ '(building automation|\\mbas\\M|\\mbms\\M|ddc|bacnet|control system|instrumentation)'),
        ('remote_monitoring', body ~ '(remote monitoring|telemetry|scada|fault detection|sensor monitoring)'),
        ('refrigeration', body ~ '(refrigeration|walk-in cooler|walk-in freezer|cold storage)'),
        ('energy_optimization', body ~ '(energy optimization|energy efficiency|energy audit|retro.?commission|energy management)'),
        ('recurring_maintenance', body ~ '(preventive maintenance|maintenance agreement|maintenance services|on-call maintenance|continuing services|service agreement)'),
        ('upcoming_renewals', classification='timing_based' AND contract_expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '18 months')
      ) category(name, matches) WHERE category.matches
    ), ranked AS (
      SELECT *, row_number() OVER (PARTITION BY name ORDER BY procurement_deadline NULLS LAST, title) AS rank
      FROM tagged
    ) SELECT name AS category, title, source_id, classification, procurement_deadline,
             contract_expiration_date, source_url
      FROM ranked WHERE rank <= 3 ORDER BY name, rank`),
    queryDb(`WITH ranked AS (
      SELECT opportunity.title, opportunity.source_id, opportunity.classification, opportunity.status,
             opportunity.procurement_deadline, opportunity.source_url,
             row_number() OVER (PARTITION BY opportunity.source_id ORDER BY opportunity.procurement_deadline NULLS LAST, opportunity.title) AS rank
      FROM oi_opportunities opportunity
      WHERE opportunity.is_stale=FALSE AND (
        (opportunity.classification='confirmed' AND opportunity.status='active'
          AND (opportunity.procurement_deadline IS NULL OR opportunity.procurement_deadline >= CURRENT_TIMESTAMP))
        OR (opportunity.classification='timing_based' AND opportunity.status='upcoming')
      ) AND opportunity.source_id IN ('sam-gov','fl-mfmp','fl-fdot-lettings','miamidade-current-solicitations','ucf-solicitations','broward-college-forecast','fl-administrative-register-bids')
    ) SELECT * FROM ranked WHERE rank <= 3 ORDER BY source_id, rank`),
    queryDb(`SELECT opportunity.id, opportunity.source_id, opportunity.title
             FROM oi_opportunities opportunity
             WHERE opportunity.classification='confirmed' AND opportunity.status='active'
               AND EXISTS (SELECT 1 FROM oi_source_documents document
                           WHERE document.opportunity_id=opportunity.id AND document.is_current=TRUE
                             AND document.extraction_status='extracted' AND length(document.extracted_text) > 500)
             ORDER BY CASE opportunity.source_id WHEN 'ucf-solicitations' THEN 0 WHEN 'miamidade-current-solicitations' THEN 1 ELSE 2 END,
                      opportunity.procurement_deadline NULLS LAST LIMIT 1`),
    queryOpportunities({ limit: 250 }),
    getAtlasData({ layers: ["opportunities"] }),
    queryDb(`SELECT count(*)::int AS florida_records,
                    count(*) FILTER (WHERE classification='confirmed')::int AS confirmed,
                    count(*) FILTER (WHERE status='active')::int AS active,
                    count(*) FILTER (WHERE procurement_deadline IS NOT NULL)::int AS with_deadline,
                    count(*) FILTER (WHERE procurement_deadline >= CURRENT_TIMESTAMP)::int AS future_deadline,
                    count(*) FILTER (WHERE source_document_url IS NOT NULL)::int AS with_source_document
             FROM oi_opportunities WHERE source_id='sam-gov'`),
    queryDb(`SELECT source_id, count(*)::int AS records,
                    count(*) FILTER (WHERE classification='confirmed' AND status='active')::int AS confirmed_active,
                    count(*) FILTER (WHERE classification='timing_based' AND status='upcoming')::int AS timing_upcoming,
                    count(*) FILTER (WHERE classification='inferred')::int AS inferred
             FROM oi_opportunities GROUP BY source_id ORDER BY source_id`),
  ]);

  const atlasOpportunityCount = atlas.features.reduce((total, feature) => {
    const properties = feature.properties as Row;
    if (properties.featureType === "opportunity") return total + 1;
    if (properties.featureType === "regional_aggregate") return total + Number(properties.opportunityCount || 0);
    return total;
  }, 0);
  if (atlasOpportunityCount !== explorer.total) {
    throw new Error(`Atlas represents ${atlasOpportunityCount} opportunities while Explorer reports ${explorer.total}.`);
  }
  const samResult = samVerification[0];
  if (Number(samResult?.florida_records || 0) > 0 && Number(samResult?.with_deadline || 0) === 0) {
    throw new Error("SAM.gov records are present, but no response deadlines were parsed.");
  }
  const sample = samples[0];
  const assistant = sample ? await buildOpportunityBrief(String(sample.id), "requirements deadline submission eligibility contact value") : null;
  if (!assistant || !assistant.citations.some((citation) => citation.excerpt)) {
    throw new Error("Assistant validation did not produce an extracted-document citation.");
  }
  console.log(JSON.stringify({
    verifiedAt: new Date().toISOString(), totals: totals[0], sources, sourceCounts, documents, documentFailures,
    samVerification: samVerification[0],
    categories, categoryRepresentatives, representatives,
    surfaces: { explorerTotal: explorer.total, atlasOpportunityCount, atlasFeatures: atlas.features.length },
    assistant: {
      opportunity: sample,
      deadline: assistant.deadline,
      sourceGrounding: assistant.sourceGrounding,
      solicitationNumber: assistant.pursuit.solicitationNumber,
      purchasingOrganization: assistant.pursuit.purchasingOrganization,
      requirements: assistant.pursuit.requirements,
      citationCount: assistant.citations.length,
      citedExcerptCount: assistant.citations.filter((citation) => citation.excerpt).length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
