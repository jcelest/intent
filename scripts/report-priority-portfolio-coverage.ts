import { sql } from "@/lib/db";

async function main() {
  const [thresholdKinds, priority, priorityTop, countyCompleteness, unknownReasons, parcelEnrichment] = await Promise.all([
    sql`
      SELECT relationship_kind,
             COUNT(DISTINCT firm.id)::int AS verified_firms,
             COUNT(DISTINCT firm.id) FILTER (WHERE firm.portfolio_floor >= 100)::int AS firms_100_plus,
             COUNT(DISTINCT firm.id) FILTER (WHERE firm.portfolio_floor >= 200)::int AS firms_200_plus
      FROM fl_management_firms firm
      JOIN fl_management_portfolio_relationships relationship
        ON relationship.firm_id = firm.id AND relationship.is_current = TRUE AND relationship.is_verified_portfolio = TRUE
      GROUP BY relationship_kind
      ORDER BY relationship_kind
    `,
    sql`
      SELECT relationship.county,
             COUNT(DISTINCT relationship.firm_id)::int AS verified_firms,
             COUNT(DISTINCT relationship.firm_id) FILTER (WHERE firm.portfolio_floor >= 100)::int AS total_portfolio_100_plus,
             COUNT(DISTINCT relationship.firm_id) FILTER (WHERE firm.portfolio_floor >= 200)::int AS total_portfolio_200_plus,
             COALESCE(SUM(relationship.location_count), 0)::bigint AS verified_properties,
             COALESCE(SUM(relationship.unit_count), 0)::bigint AS verified_units,
             COUNT(DISTINCT relationship.firm_id) FILTER (WHERE relationship.is_verified_management)::int AS verified_management_firms,
             COUNT(DISTINCT relationship.firm_id) FILTER (WHERE relationship.relationship_kind = 'licensed_operator')::int AS licensed_operator_firms
      FROM fl_management_portfolio_relationships relationship
      JOIN fl_management_firms firm ON firm.id = relationship.firm_id
      WHERE relationship.is_current = TRUE AND relationship.is_verified_portfolio = TRUE
        AND relationship.county IN ('Escambia', 'Santa Rosa')
      GROUP BY relationship.county
      ORDER BY relationship.county
    `,
    sql`
      SELECT firm.name, firm.dba, firm.portfolio_floor, firm.verified_properties_total,
             firm.verified_units_total, relationship.relationship_kind,
             relationship.county,
             SUM(relationship.location_count)::bigint AS county_properties,
             SUM(COALESCE(relationship.unit_count, 0))::bigint AS county_units,
             ARRAY_AGG(DISTINCT relationship.source_key ORDER BY relationship.source_key) AS sources
      FROM fl_management_firms firm
      JOIN fl_management_portfolio_relationships relationship
        ON relationship.firm_id = firm.id AND relationship.is_current = TRUE AND relationship.is_verified_portfolio = TRUE
      WHERE relationship.county IN ('Escambia', 'Santa Rosa')
      GROUP BY firm.id, relationship.relationship_kind, relationship.county
      HAVING SUM(COALESCE(relationship.unit_count, 0)) >= 100 OR SUM(relationship.location_count) >= 100
      ORDER BY county_units DESC, county_properties DESC, firm.name
      LIMIT 30
    `,
    sql`
      SELECT COUNT(*) FILTER (WHERE accepted_records > 0)::int AS counties_with_verified_portfolios,
             COUNT(*)::int AS counties_audited,
             ARRAY_AGG(county ORDER BY county) FILTER (WHERE accepted_records = 0) AS counties_without_accepted_records
      FROM (
        SELECT county, SUM(accepted_records)::bigint AS accepted_records
        FROM fl_management_portfolio_county_coverage
        GROUP BY county
      ) coverage
    `,
    sql`
      SELECT source, firm_type, COUNT(*)::int AS firms
      FROM fl_management_firms
      WHERE portfolio_floor IS NULL
      GROUP BY source, firm_type
      ORDER BY firms DESC
      LIMIT 20
    `,
    sql`
      SELECT COUNT(*) FILTER (WHERE parcel_id IS NOT NULL)::int AS parcel_matched_records,
             COUNT(*) FILTER (WHERE building_count IS NOT NULL)::int AS records_with_building_count,
             COUNT(*) FILTER (WHERE square_feet IS NOT NULL)::int AS records_with_square_feet,
             COALESCE(SUM(square_feet), 0)::bigint AS documented_square_feet
      FROM fl_management_portfolio_relationships
      WHERE is_current = TRUE AND is_verified_portfolio = TRUE
    `,
  ]);
  console.log(JSON.stringify({ thresholdKinds, priority, priorityTop, countyCompleteness: countyCompleteness[0], unknownReasons, parcelEnrichment: parcelEnrichment[0] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
