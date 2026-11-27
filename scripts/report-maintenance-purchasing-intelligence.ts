import { sql } from "@/lib/db";

async function main() {
const [summary, types, intelligenceTypes, counties, sources, thresholds, enrichedFirms, websiteScans, countyCoverageSummary] = await Promise.all([
  sql`SELECT COUNT(*)::int firms,
      COUNT(*) FILTER (WHERE cardinality(portfolio_types)>0)::int typed_firms,
      COUNT(*) FILTER (WHERE cardinality(maintenance_trades)>0)::int maintenance_firms,
      COUNT(*) FILTER (WHERE vendor_onboarding_status<>'unknown')::int onboarding_firms,
      COUNT(*) FILTER (WHERE documented_purchasing_activities>0)::int purchasing_firms,
      COUNT(*) FILTER (WHERE documented_contractor_relationships>0)::int contractor_relationship_firms,
      COUNT(*) FILTER (WHERE documented_service_volume IS NOT NULL)::int service_volume_firms
    FROM fl_management_firms`,
  sql`SELECT portfolio_type, verification_class, COUNT(DISTINCT firm_id)::int firms, COUNT(*)::int records
    FROM fl_maintenance_purchasing_intelligence WHERE is_current=TRUE AND portfolio_type IS NOT NULL
    GROUP BY portfolio_type, verification_class ORDER BY portfolio_type, verification_class`,
  sql`SELECT intelligence_type, verification_class, fact_status, COUNT(DISTINCT firm_id)::int firms, COUNT(*)::int records
    FROM fl_maintenance_purchasing_intelligence WHERE is_current=TRUE
    GROUP BY intelligence_type, verification_class, fact_status ORDER BY intelligence_type, verification_class`,
  sql`SELECT county,
      COUNT(DISTINCT firm_id)::int firms,
      COUNT(*)::int records,
      COUNT(*) FILTER (WHERE intelligence_type='maintenance_responsibility')::int maintenance_records,
      COUNT(*) FILTER (WHERE intelligence_type='vendor_onboarding')::int onboarding_records
    FROM fl_maintenance_purchasing_intelligence WHERE is_current=TRUE AND county IS NOT NULL
    GROUP BY county ORDER BY county`,
  sql`SELECT source.source_key, source.source_name, source.last_success_at, source.last_record_count,
      source.consecutive_failures, source.last_error, COUNT(intelligence.id)::int evidence_records,
      COUNT(DISTINCT intelligence.firm_id)::int firms
    FROM fl_maintenance_intelligence_sources source
    LEFT JOIN fl_maintenance_purchasing_intelligence intelligence ON intelligence.source_key=source.source_key AND intelligence.is_current=TRUE
    GROUP BY source.source_key ORDER BY source.source_key`,
  sql`SELECT COUNT(*) FILTER (WHERE portfolio_floor>=100)::int firms_100_plus,
      COUNT(*) FILTER (WHERE portfolio_floor>=200)::int firms_200_plus,
      COUNT(*) FILTER (WHERE portfolio_floor>=100 AND cardinality(maintenance_trades)>0)::int maintenance_100_plus,
      COUNT(*) FILTER (WHERE portfolio_floor>=200 AND cardinality(maintenance_trades)>0)::int maintenance_200_plus
    FROM fl_management_firms`,
  sql`SELECT name, county, portfolio_floor, portfolio_tier, portfolio_types,
      maintenance_trades, maintenance_delivery_model, vendor_onboarding_status,
      documented_purchasing_activities, documented_contractor_relationships
    FROM fl_management_firms
    WHERE cardinality(maintenance_trades)>0 OR vendor_onboarding_status<>'unknown'
      OR documented_purchasing_activities>0 OR documented_contractor_relationships>0
    ORDER BY portfolio_floor DESC NULLS LAST, name LIMIT 50`,
  sql`SELECT status, COUNT(*)::int firms, SUM(pages_checked)::int pages_checked,
      SUM(facts_accepted)::int facts_accepted
    FROM fl_maintenance_website_scan_state GROUP BY status ORDER BY status`,
  sql`SELECT COUNT(DISTINCT county)::int counties_evaluated,
      COUNT(DISTINCT county) FILTER (WHERE accepted_records>0)::int counties_with_records,
      COUNT(*) FILTER (WHERE status='no_records')::int source_county_gaps
    FROM fl_maintenance_intelligence_county_coverage`,
]);

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary: summary[0], thresholds: thresholds[0], countyCoverage: countyCoverageSummary[0], websiteScans, enrichedFirms, types, intelligenceTypes, counties, sources }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
