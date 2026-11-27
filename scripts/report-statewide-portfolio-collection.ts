import { sql } from "@/lib/db";

async function main() {
  const [overall, relationshipKinds, sources, counties, thresholdFirms, sourceGaps, responsibilityCoverage] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS firms_total,
             COUNT(*) FILTER (WHERE portfolio_floor IS NOT NULL)::int AS verified_portfolio_firms,
             ROUND(100.0 * COUNT(*) FILTER (WHERE portfolio_floor IS NOT NULL) / NULLIF(COUNT(*), 0), 2) AS verified_percent,
             COUNT(*) FILTER (WHERE portfolio_floor >= 100)::int AS firms_100_plus,
             COUNT(*) FILTER (WHERE portfolio_floor >= 200)::int AS firms_200_plus,
             COUNT(*) FILTER (WHERE portfolio_floor > 300)::int AS firms_over_300,
             COALESCE(SUM(verified_properties_total), 0)::bigint AS verified_properties,
             COALESCE(SUM(verified_units_total), 0)::bigint AS verified_units,
             COALESCE(SUM(verified_buildings_total), 0)::bigint AS verified_buildings,
             COALESCE(SUM(verified_square_feet_total), 0)::bigint AS verified_square_feet,
             COALESCE(SUM(service_relevant_properties), 0)::bigint AS service_relevant_properties,
             COALESCE(SUM(service_relevant_units), 0)::bigint AS service_relevant_units,
             COALESCE(SUM(vendor_accessible_properties), 0)::bigint AS vendor_accessible_properties
      FROM fl_management_firms
    `,
    sql`
      SELECT relationship_kind, is_verified_management, is_verified_portfolio,
             COUNT(*)::int AS records, COUNT(DISTINCT firm_id)::int AS firms,
             COALESCE(SUM(location_count), 0)::bigint AS properties,
             COALESCE(SUM(unit_count), 0)::bigint AS units,
             COALESCE(SUM(building_count), 0)::bigint AS buildings,
             COALESCE(SUM(square_feet), 0)::bigint AS square_feet
      FROM fl_management_portfolio_relationships
      WHERE is_current = TRUE
      GROUP BY relationship_kind, is_verified_management, is_verified_portfolio
      ORDER BY is_verified_portfolio DESC, relationship_kind
    `,
    sql`
      SELECT source.source_key, source.source_name, source.source_type, source.jurisdiction,
             source.refresh_interval_hours, source.last_success_at, source.last_record_count,
             source.consecutive_failures, source.last_error,
             COUNT(relationship.id)::int AS current_relationships,
             COUNT(DISTINCT relationship.firm_id)::int AS current_firms,
             COUNT(relationship.id) FILTER (WHERE relationship.is_verified_portfolio)::int AS verified_records,
             COALESCE(SUM(relationship.unit_count) FILTER (WHERE relationship.is_verified_portfolio), 0)::bigint AS verified_units
      FROM fl_management_portfolio_sources source
      LEFT JOIN fl_management_portfolio_relationships relationship
        ON relationship.source_key = source.source_key AND relationship.is_current = TRUE
      GROUP BY source.source_key
      ORDER BY source.source_key
    `,
    sql`
      SELECT county,
             COUNT(DISTINCT firm_id)::int AS verified_firms,
             COUNT(*)::int AS verified_records,
             COALESCE(SUM(location_count), 0)::bigint AS verified_properties,
             COALESCE(SUM(unit_count), 0)::bigint AS verified_units,
             COUNT(DISTINCT source_key)::int AS contributing_sources
      FROM fl_management_portfolio_relationships
      WHERE is_current = TRUE AND is_verified_portfolio = TRUE AND county IS NOT NULL
      GROUP BY county
      ORDER BY county
    `,
    sql`
      SELECT firm.id, firm.name, firm.dba, firm.firm_type, firm.portfolio_floor, firm.portfolio_tier,
             firm.verified_properties_total, firm.verified_units_total,
             firm.service_relevant_properties, firm.service_relevant_units,
             firm.vendor_accessible_properties, firm.portfolio_by_county,
             ARRAY_AGG(DISTINCT relationship.relationship_kind ORDER BY relationship.relationship_kind) AS relationship_kinds,
             ARRAY_AGG(DISTINCT relationship.source_key ORDER BY relationship.source_key) AS sources
      FROM fl_management_firms firm
      JOIN fl_management_portfolio_relationships relationship
        ON relationship.firm_id = firm.id AND relationship.is_current = TRUE AND relationship.is_verified_portfolio = TRUE
      WHERE firm.portfolio_floor >= 100
      GROUP BY firm.id
      ORDER BY firm.portfolio_floor DESC, firm.name
      LIMIT 50
    `,
    sql`
      SELECT coverage.county,
             COUNT(DISTINCT coverage.source_key)::int AS registered_sources,
             COUNT(DISTINCT coverage.source_key) FILTER (WHERE coverage.status = 'covered')::int AS sources_with_records,
             COALESCE(SUM(coverage.source_records), 0)::bigint AS source_records,
             COALESCE(SUM(coverage.accepted_records), 0)::bigint AS accepted_records
      FROM fl_management_portfolio_county_coverage coverage
      GROUP BY coverage.county
      ORDER BY coverage.county
    `,
    sql`
      SELECT COUNT(*) FILTER (WHERE management_responsibility)::int AS records_with_management_responsibility,
             COUNT(*) FILTER (WHERE maintenance_responsibility)::int AS records_with_maintenance_responsibility,
             COUNT(*) FILTER (WHERE vendor_accessible)::int AS records_with_vendor_access,
             COUNT(*) FILTER (WHERE COALESCE((maintenance_scope->>'individual_unit_repairs')::boolean, FALSE))::int AS individual_unit_repairs,
             COUNT(*) FILTER (WHERE COALESCE((maintenance_scope->>'common_area_maintenance')::boolean, FALSE))::int AS common_area_maintenance,
             COUNT(*) FILTER (WHERE COALESCE((maintenance_scope->>'commercial_building_systems')::boolean, FALSE))::int AS commercial_building_systems
      FROM fl_management_portfolio_relationships
      WHERE is_current = TRUE
    `,
  ]);

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    collectionCostUsd: 0,
    overall: overall[0],
    relationshipKinds,
    sources,
    counties,
    thresholdFirms,
    sourceGaps,
    responsibilityCoverage: responsibilityCoverage[0],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
