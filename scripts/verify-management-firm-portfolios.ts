import assert from "node:assert/strict";
import { sql } from "@/lib/db";
import {
  calculatePortfolioSummary,
  mailingAddressMatchesFirm,
  normalizeStreetAddress,
  permitNamesMatchFirm,
  positiveInteger,
} from "@/lib/management-firm-portfolios";

async function main() {
  const [known, evidenced, parcels, permits, tierRows, totalRows, unknownRows] = await Promise.all([
    sql`
      SELECT * FROM fl_management_firms
      WHERE name IN ('CONDO METROPOLIS LLC', 'VERANDAH PROPERTIES, LLC')
      ORDER BY name
    `,
    sql`
      SELECT * FROM fl_management_firms
      WHERE portfolio_floor IS NOT NULL
        AND name NOT IN ('CONDO METROPOLIS LLC', 'VERANDAH PROPERTIES, LLC')
      ORDER BY portfolio_floor DESC, name
      LIMIT 3
    `,
    sql`SELECT county, parcel_id, owner_mailing_address FROM fl_parcels WHERE owner_mailing_address IS NOT NULL`,
    sql`
      SELECT id, address, raw_data
      FROM trade_demand_permits
      WHERE COALESCE(issued_at, processed_at, last_seen_at) >= CURRENT_TIMESTAMP - INTERVAL '12 months'
    `,
    sql`SELECT portfolio_tier, COUNT(*)::int AS count FROM fl_management_firms GROUP BY portfolio_tier`,
    sql`SELECT COUNT(*)::int AS count FROM fl_management_firms`,
    sql`
      SELECT id, name, portfolio_floor, portfolio_range_low, portfolio_range_high
      FROM fl_management_firms
      WHERE portfolio_tier = 'UNKNOWN'
      ORDER BY name
      LIMIT 1
    `,
  ]);

  assert.equal(known.length, 2, "Both required named firms must exist");
  assert.ok(evidenced.length >= 2, "At least two firms must have explicit, source-backed management relationships");
  const firms = [...known, ...evidenced];
  const spotChecks = [];

  for (const firm of firms) {
    const parcelKeys = new Set(
      parcels
        .filter((parcel) => mailingAddressMatchesFirm(parcel.owner_mailing_address, firm.address, firm.zip_code))
        .map((parcel) => `${parcel.county}:${parcel.parcel_id}`),
    );
    const permitAddresses = new Set(
      permits
        .filter((permit) => permitNamesMatchFirm(permit.raw_data, firm.name))
        .map((permit) => normalizeStreetAddress(permit.address || ""))
        .filter(Boolean),
    );
    assert.equal(firm.parcels_matched_by_mailing_address, parcelKeys.size || null, `${firm.name} parcel evidence must reproduce`);
    assert.equal(firm.permit_properties_trailing_12mo, permitAddresses.size || null, `${firm.name} permit evidence must reproduce`);

    const summary = calculatePortfolioSummary({
      parcelsMatchedByMailingAddress: parcelKeys.size || null,
      evictionFilingsTrailing12mo: positiveInteger(firm.eviction_filings_trailing_12mo),
      permitPropertiesTrailing12mo: permitAddresses.size || null,
      sunbizAssociationsManaged: positiveInteger(firm.sunbiz_associations_managed),
      associationUnitsTotal: positiveInteger(firm.association_units_total),
      claimedDoors: positiveInteger(firm.claimed_doors),
      verifiedManagedProperties: positiveInteger(firm.individually_verified_managed_properties),
      verifiedAssociationUnits: positiveInteger(firm.verified_association_units),
      verifiedRentalUnits: positiveInteger(firm.verified_rental_units),
      verifiedCondominiumUnits: positiveInteger(firm.verified_condominium_units),
      verifiedCommercialLocations: positiveInteger(firm.verified_commercial_locations),
    });
    assert.equal(firm.portfolio_floor, summary.portfolioFloor, `${firm.name} portfolio floor must reproduce`);
    assert.equal(firm.portfolio_tier, summary.portfolioTier, `${firm.name} tier must reproduce`);
    const maximumDocumented = Math.max(
      positiveInteger(firm.sunbiz_associations_managed) || 0,
      positiveInteger(firm.association_units_total) || 0,
      positiveInteger(firm.individually_verified_managed_properties) || 0,
      positiveInteger(firm.verified_association_units) || 0,
      positiveInteger(firm.verified_rental_units) || 0,
      positiveInteger(firm.verified_condominium_units) || 0,
      positiveInteger(firm.verified_commercial_locations) || 0,
    );
    assert.ok(firm.portfolio_floor === null || firm.portfolio_floor <= maximumDocumented, `${firm.name} floor cannot exceed documented evidence`);
    spotChecks.push({
      name: firm.name,
      tier: firm.portfolio_tier,
      floor: firm.portfolio_floor,
      parcels: firm.parcels_matched_by_mailing_address,
      permits: firm.permit_properties_trailing_12mo,
    });
  }

  assert.equal(Number(unknownRows[0]?.portfolio_floor ?? 0), 0, "UNKNOWN must not carry a floor");
  assert.equal(unknownRows[0]?.portfolio_range_low, null, "UNKNOWN must not carry a low range without a layer estimate");
  assert.equal(unknownRows[0]?.portfolio_range_high, null, "UNKNOWN must not carry a high range without a layer estimate");

  const tierCounts = Object.fromEntries(tierRows.map((row) => [row.portfolio_tier, Number(row.count)])) as Record<string, number>;
  const tierSum = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
  assert.equal(tierSum, Number(totalRows[0].count), "Tier counts must sum exactly to all displayed firms");

  console.log(JSON.stringify({
    ok: true,
    totalFirms: Number(totalRows[0].count),
    tierCounts,
    tierSum,
    unknownExample: unknownRows[0],
    spotChecks,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
