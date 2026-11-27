import { sql } from "@/lib/db";

async function main() {
const countyRows = await sql`
  SELECT COALESCE(county, '(unknown)') AS county,
         COUNT(*)::int AS firms,
         COUNT(*) FILTER (WHERE portfolio_floor IS NOT NULL)::int AS verified_firms,
         COUNT(*) FILTER (WHERE portfolio_floor >= 100)::int AS firms_100_plus,
         COUNT(*) FILTER (WHERE portfolio_floor >= 200)::int AS firms_200_plus
  FROM fl_management_firms
  WHERE LOWER(COALESCE(county, '')) IN ('escambia', 'santa rosa')
  GROUP BY county
  ORDER BY county
`;

const firmRows = await sql`
  SELECT id, name, dba, license_number, address, city, county, zip_code,
         website, source, evidence_url, portfolio_floor, portfolio_tier,
         parcels_matched_by_mailing_address, permit_properties_trailing_12mo,
         sunbiz_associations_managed, association_units_total
  FROM fl_management_firms
  WHERE LOWER(COALESCE(county, '')) IN ('escambia', 'santa rosa')
  ORDER BY county, name
`;

const parcelRows = await sql`
  SELECT COALESCE(county, '(unknown)') AS county, COUNT(*)::int AS parcels
  FROM fl_parcels
  WHERE LOWER(COALESCE(county, '')) IN ('escambia', 'santa rosa')
  GROUP BY county
  ORDER BY county
`;

const verifiedFirms = await sql`
  SELECT id, name, dba, license_number, county, portfolio_floor, portfolio_tier,
         individually_verified_managed_properties, verified_association_units,
         verified_communities, verified_commercial_properties,
         verified_residential_properties, portfolio_by_county, portfolio_by_zip
  FROM fl_management_firms
  WHERE individually_verified_managed_properties IS NOT NULL
     OR verified_association_units IS NOT NULL
  ORDER BY portfolio_floor DESC NULLS LAST, name
`;

const verifiedRelationships = await sql`
  SELECT firm.name AS firm_name, relationship.source_key, relationship.property_name,
         relationship.county, relationship.zip_code, relationship.unit_count,
         relationship.canonical_property_key, relationship.verification_level,
         relationship.source_url, relationship.corroborating_source_url,
         relationship.metadata->>'match_score' AS match_score,
         relationship.metadata->'dbpr_row'->>'Managing Entity Name' AS dbpr_managing_entity,
         relationship.metadata->'dbpr_row'->>'Managing Entity Route' AS dbpr_route
  FROM fl_management_portfolio_relationships relationship
  JOIN fl_management_firms firm ON firm.id = relationship.firm_id
  WHERE relationship.is_current = TRUE
    AND relationship.is_verified_management = TRUE
    AND relationship.unit_count IS NOT NULL
  ORDER BY firm.name, relationship.canonical_property_key, relationship.source_key
`;

const supplementaryCounts = await sql`
  SELECT relationship_kind, COUNT(*)::int AS records,
         COUNT(DISTINCT firm_id)::int AS firms
  FROM fl_management_portfolio_relationships
  WHERE is_current = TRUE AND is_verified_management = FALSE
  GROUP BY relationship_kind
  ORDER BY relationship_kind
`;

const sources = await sql`
  SELECT source_key, source_name, last_success_at, next_refresh_at,
         last_record_count, consecutive_failures, last_error
  FROM fl_management_portfolio_sources
  ORDER BY source_key
`;

const relationshipCounts = await sql`
  SELECT source_key, relationship_kind, is_verified_management,
         COUNT(*)::int AS records, COUNT(DISTINCT firm_id)::int AS firms
  FROM fl_management_portfolio_relationships
  WHERE is_current = TRUE
  GROUP BY source_key, relationship_kind, is_verified_management
  ORDER BY source_key, relationship_kind
`;

console.log(JSON.stringify({ countyRows, parcelRows, verifiedFirms, verifiedRelationships, relationshipCounts, supplementaryCounts, sources }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
