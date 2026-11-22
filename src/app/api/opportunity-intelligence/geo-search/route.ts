import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { parseFloridaGeoSearch } from "@/lib/florida-geo";
import { sql } from "@/lib/db";
import type { CommercialBidRecord, CommercialNetworkRecord } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const { input, trade } = await request.json();
    const geoScope = parseFloridaGeoSearch(input || "");

    const counties = geoScope.resolvedCounties;
    const zips = geoScope.resolvedZips;

    let bids: CommercialBidRecord[] = [];
    let networks: CommercialNetworkRecord[] = [];

    if (geoScope.isStatewide || counties.length === 0) {
      const bidRows = await sql`
        SELECT id, solicitation_number, title, agency_name, agency_type, county, city, zip_code, trade_slug, estimated_value_display, closing_date, status, source_url, posted_date, qualification_requirements
        FROM fl_commercial_bids
        WHERE (${trade || "all"} = 'all' OR trade_slug = ${trade || ""})
        ORDER BY closing_date ASC NULLS LAST
        LIMIT 50
      `;
      bids = (bidRows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        solicitation_number: String(r.solicitation_number),
        title: String(r.title),
        agency_name: String(r.agency_name),
        agency_type: String(r.agency_type),
        county: r.county ? String(r.county) : null,
        city: r.city ? String(r.city) : null,
        zip_code: r.zip_code ? String(r.zip_code) : null,
        trade_slug: r.trade_slug ? String(r.trade_slug) : null,
        estimated_value_display: r.estimated_value_display ? String(r.estimated_value_display) : null,
        posted_date: r.posted_date ? new Date(String(r.posted_date)).toISOString() : new Date().toISOString(),
        closing_date: r.closing_date ? new Date(String(r.closing_date)).toISOString() : null,
        status: String(r.status),
        source_url: String(r.source_url),
        qualification_requirements: Array.isArray(r.qualification_requirements) ? (r.qualification_requirements as string[]) : [],
      }));

      const netRows = await sql`
        SELECT id, name, org_type, county, city, zip_code, trades_hired, primary_contact_name, primary_contact_phone, website, active_projects_count
        FROM fl_commercial_networks
        WHERE (${trade || "all"} = 'all' OR ${trade || ""} = ANY(trades_hired))
        ORDER BY active_projects_count DESC
        LIMIT 50
      `;
      networks = (netRows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        org_type: String(r.org_type),
        county: r.county ? String(r.county) : null,
        city: r.city ? String(r.city) : null,
        zip_code: r.zip_code ? String(r.zip_code) : null,
        trades_hired: Array.isArray(r.trades_hired) ? (r.trades_hired as string[]) : [],
        primary_contact_name: r.primary_contact_name ? String(r.primary_contact_name) : null,
        primary_contact_phone: r.primary_contact_phone ? String(r.primary_contact_phone) : null,
        website: r.website ? String(r.website) : null,
        active_projects_count: Number(r.active_projects_count || 0),
      }));
    } else {
      const bidRows = await sql`
        SELECT id, solicitation_number, title, agency_name, agency_type, county, city, zip_code, trade_slug, estimated_value_display, closing_date, status, source_url, posted_date, qualification_requirements
        FROM fl_commercial_bids
        WHERE 
          (county = ANY(${counties}) OR zip_code = ANY(${zips}))
          AND (${trade || "all"} = 'all' OR trade_slug = ${trade || ""})
        ORDER BY closing_date ASC NULLS LAST
        LIMIT 50
      `;
      bids = (bidRows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        solicitation_number: String(r.solicitation_number),
        title: String(r.title),
        agency_name: String(r.agency_name),
        agency_type: String(r.agency_type),
        county: r.county ? String(r.county) : null,
        city: r.city ? String(r.city) : null,
        zip_code: r.zip_code ? String(r.zip_code) : null,
        trade_slug: r.trade_slug ? String(r.trade_slug) : null,
        estimated_value_display: r.estimated_value_display ? String(r.estimated_value_display) : null,
        posted_date: r.posted_date ? new Date(String(r.posted_date)).toISOString() : new Date().toISOString(),
        closing_date: r.closing_date ? new Date(String(r.closing_date)).toISOString() : null,
        status: String(r.status),
        source_url: String(r.source_url),
        qualification_requirements: Array.isArray(r.qualification_requirements) ? (r.qualification_requirements as string[]) : [],
      }));

      const netRows = await sql`
        SELECT id, name, org_type, county, city, zip_code, trades_hired, primary_contact_name, primary_contact_phone, website, active_projects_count
        FROM fl_commercial_networks
        WHERE 
          (county = ANY(${counties}) OR zip_code = ANY(${zips}))
          AND (${trade || "all"} = 'all' OR ${trade || ""} = ANY(trades_hired))
        ORDER BY active_projects_count DESC
        LIMIT 50
      `;
      networks = (netRows as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        name: String(r.name),
        org_type: String(r.org_type),
        county: r.county ? String(r.county) : null,
        city: r.city ? String(r.city) : null,
        zip_code: r.zip_code ? String(r.zip_code) : null,
        trades_hired: Array.isArray(r.trades_hired) ? (r.trades_hired as string[]) : [],
        primary_contact_name: r.primary_contact_name ? String(r.primary_contact_name) : null,
        primary_contact_phone: r.primary_contact_phone ? String(r.primary_contact_phone) : null,
        website: r.website ? String(r.website) : null,
        active_projects_count: Number(r.active_projects_count || 0),
      }));
    }

    return NextResponse.json({
      ok: true,
      geoScope,
      bids,
      networks,
      stats: {
        totalBidsFound: bids.length,
        totalNetworksFound: networks.length,
        countiesResolved: counties.length,
        zipsResolved: zips.length,
      },
    });
  } catch (error) {
    console.error("API geo-search error:", error);
    return NextResponse.json({ ok: false, error: "Geographic search failed" }, { status: 500 });
  }
}
