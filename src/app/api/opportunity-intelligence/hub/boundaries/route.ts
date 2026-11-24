import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const stored = await sql`SELECT geometry_geojson, boundary_code, name, county FROM oi_geographic_boundaries WHERE boundary_type = 'county' ORDER BY name`;
    if (stored.length === 67) {
      return NextResponse.json({ type: "FeatureCollection", features: stored.map((row) => ({ type: "Feature", geometry: row.geometry_geojson, properties: { GEOID: row.boundary_code, NAME: row.name, county: row.county, source: "stored_authoritative_boundary" } })) });
    }
  } catch {
    // Migration may not yet be applied; fall through to the authoritative public endpoint.
  }

  const endpoint = new URL("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query");
  endpoint.searchParams.set("where", "STATE='12'");
  endpoint.searchParams.set("outFields", "GEOID,NAME,STATE");
  endpoint.searchParams.set("outSR", "4326");
  endpoint.searchParams.set("returnGeometry", "true");
  endpoint.searchParams.set("f", "geojson");
  const response = await fetch(endpoint, { headers: { "User-Agent": "Intent-Revenue-Opportunity-Intelligence/1.0" }, next: { revalidate: 86400 } });
  if (!response.ok) return NextResponse.json({ type: "FeatureCollection", features: [], error: "Authoritative county boundaries are temporarily unavailable." }, { status: 502 });
  const data = await response.json();
  return NextResponse.json(data, { headers: { "X-Data-Source": "U.S. Census Bureau TIGERweb" } });
}
