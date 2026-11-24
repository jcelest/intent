import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const county = url.searchParams.get("county")?.trim() || "";
    const firmType = url.searchParams.get("type")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const googleListedOnly = url.searchParams.get("googleListed") === "true";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 1000);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    const searchTerm = `%${search}%`;

    const [firms, countRow, countiesRow] = await Promise.all([
      sql`
        SELECT *
        FROM fl_management_firms
        WHERE (${county} = '' OR LOWER(county) = LOWER(${county}))
          AND (${firmType} = '' OR firm_type = ${firmType})
          AND (${googleListedOnly} = FALSE OR metadata->>'google_listing_status' = 'listing_found')
          AND (${search} = '' OR (name ILIKE ${searchTerm} OR address ILIKE ${searchTerm} OR city ILIKE ${searchTerm} OR COALESCE(license_number, '') ILIKE ${searchTerm}))
        ORDER BY managed_properties_count DESC, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS total
        FROM fl_management_firms
        WHERE (${county} = '' OR LOWER(county) = LOWER(${county}))
          AND (${firmType} = '' OR firm_type = ${firmType})
          AND (${googleListedOnly} = FALSE OR metadata->>'google_listing_status' = 'listing_found')
          AND (${search} = '' OR (name ILIKE ${searchTerm} OR address ILIKE ${searchTerm} OR city ILIKE ${searchTerm} OR COALESCE(license_number, '') ILIKE ${searchTerm}))
      `,
      sql`
        SELECT county, COUNT(*)::int AS count
        FROM fl_management_firms
        GROUP BY county
        ORDER BY count DESC
      `,
    ]);

    return NextResponse.json({
      ok: true,
      total: countRow[0]?.total || 0,
      googleListedOnly,
      counties: countiesRow,
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
