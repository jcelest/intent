import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { getManagementFirmPortfolioEvidence } from "@/lib/management-firm-portfolios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const county = url.searchParams.get("county")?.trim() || "";
    const id = url.searchParams.get("id")?.trim() || "";
    const firmType = url.searchParams.get("type")?.trim() || "";
    const portfolioTier = url.searchParams.get("portfolioTier")?.trim() || "";
    const sort = url.searchParams.get("sort") === "name" ? "name" : "portfolio";
    const search = url.searchParams.get("search")?.trim() || "";
    const googleListedOnly = url.searchParams.get("googleListed") === "true";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 5000);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const searchTerm = `%${search}%`;

    if (id) {
      const rows = await sql`SELECT * FROM fl_management_firms WHERE id = ${id}::uuid LIMIT 1`;
      if (!rows.length) return NextResponse.json({ ok: false, error: "Firm not found" }, { status: 404 });
      const evidence = await getManagementFirmPortfolioEvidence(id);
      return NextResponse.json({ ok: true, firm: rows[0], evidence });
    }

    const [firms, countRow, countiesRow, tierRows] = await Promise.all([
      sql`
        SELECT id, name, dba, firm_type, license_number, license_type, status,
               address, city, state, zip_code, county, phone, email, website,
               qualifier_name, latitude, longitude, source, evidence_url, metadata,
               portfolio_floor, portfolio_range_low, portfolio_range_high, portfolio_tier,
               parcels_matched_by_mailing_address, eviction_filings_trailing_12mo,
               permit_properties_trailing_12mo, sunbiz_associations_managed,
               association_units_total, portfolio_calculated_at
        FROM fl_management_firms
        WHERE (${county} = '' OR LOWER(county) = LOWER(${county}))
          AND (${firmType} = '' OR firm_type = ${firmType})
          AND (${portfolioTier} = '' OR portfolio_tier = ${portfolioTier})
          AND (${googleListedOnly} = FALSE OR metadata->>'google_listing_status' = 'listing_found')
          AND (${search} = '' OR (name ILIKE ${searchTerm} OR address ILIKE ${searchTerm} OR city ILIKE ${searchTerm} OR COALESCE(license_number, '') ILIKE ${searchTerm}))
        ORDER BY
          CASE WHEN ${sort} = 'portfolio' THEN portfolio_floor END DESC NULLS LAST,
          name ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM fl_management_firms
        WHERE (${county} = '' OR LOWER(county) = LOWER(${county}))
          AND (${firmType} = '' OR firm_type = ${firmType})
          AND (${portfolioTier} = '' OR portfolio_tier = ${portfolioTier})
          AND (${googleListedOnly} = FALSE OR metadata->>'google_listing_status' = 'listing_found')
          AND (${search} = '' OR (name ILIKE ${searchTerm} OR address ILIKE ${searchTerm} OR city ILIKE ${searchTerm} OR COALESCE(license_number, '') ILIKE ${searchTerm}))
      `,
      sql`
        SELECT county, COUNT(*)::int AS count
        FROM fl_management_firms
        GROUP BY county
        ORDER BY count DESC
      `,
      sql`
        SELECT portfolio_tier, COUNT(*)::int AS count
        FROM fl_management_firms
        WHERE (${county} = '' OR LOWER(county) = LOWER(${county}))
          AND (${firmType} = '' OR firm_type = ${firmType})
          AND (${googleListedOnly} = FALSE OR metadata->>'google_listing_status' = 'listing_found')
          AND (${search} = '' OR (name ILIKE ${searchTerm} OR address ILIKE ${searchTerm} OR city ILIKE ${searchTerm} OR COALESCE(license_number, '') ILIKE ${searchTerm}))
        GROUP BY portfolio_tier
      `,
    ]);

    return NextResponse.json({
      ok: true,
      total: countRow[0]?.total || 0,
      googleListedOnly,
      counties: countiesRow,
      tierCounts: Object.fromEntries(tierRows.map((row) => [row.portfolio_tier, row.count])),
      firms,
    });
  } catch (error) {
    console.error("Management firms GET failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch management firms" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json(
    {
      ok: false,
      error: "Statewide synchronization runs through the audited DBPR/Census ingestion job.",
    },
    { status: 405, headers: { Allow: "GET" } },
  );
}
