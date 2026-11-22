import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { ensureOpportunitySeedData } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  await ensureOpportunitySeedData();

  try {
    const url = new URL(request.url);
    const agencyType = url.searchParams.get("agencyType") || "all";
    const status = url.searchParams.get("status") || "all";
    const query = url.searchParams.get("query") || "";

    const rows = await sql`
      SELECT 
        id, agency_name, agency_type, county, city, state, portal_url,
        publishing_platform, collection_method, supported_format,
        access_requirements, status, collection_frequency,
        last_attempted_at, last_successful_at, error_status, indexed_bids_count
      FROM fl_procurement_sources
      WHERE 
        (${agencyType} = 'all' OR agency_type = ${agencyType})
        AND (${status} = 'all' OR status = ${status})
        AND (${query} = '' OR (
          agency_name ILIKE '%' || ${query} || '%'
          OR county ILIKE '%' || ${query} || '%'
          OR city ILIKE '%' || ${query} || '%'
          OR publishing_platform ILIKE '%' || ${query} || '%'
        ))
      ORDER BY agency_type ASC, county ASC, agency_name ASC
    `;

    return NextResponse.json({ ok: true, sources: rows, total: rows.length });
  } catch (error) {
    console.error("API sources error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load procurement sources" }, { status: 500 });
  }
}
