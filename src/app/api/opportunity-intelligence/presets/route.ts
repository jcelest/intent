import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { FLORIDA_REGIONS, FLORIDA_COUNTIES } from "@/lib/florida-geo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const rows = await sql`SELECT id, name, description, territory_scope FROM fl_geo_presets ORDER BY name ASC`;
    return NextResponse.json({
      ok: true,
      presets: rows,
      regions: Object.values(FLORIDA_REGIONS),
      counties: FLORIDA_COUNTIES.map((c) => ({ name: c.name, fips: c.fips, region: c.region, seat: c.seat })),
    });
  } catch (error) {
    console.error("API presets error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load presets" }, { status: 500 });
  }
}
