import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  googleAdsKeywordResearchConfigured,
  runKeywordResearch,
} from "@/lib/google-ads-keyword-research";
import { GEO_PRESETS, type GeoPresetKey } from "@/lib/google-ads-geo-presets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel Pro: allow time for Google Ads + geo breakdown calls */
export const maxDuration = 60;

function isGeoKey(v: unknown): v is GeoPresetKey {
  return typeof v === "string" && v in GEO_PRESETS;
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({
    configured: googleAdsKeywordResearchConfigured(),
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  if (!googleAdsKeywordResearchConfigured()) {
    return NextResponse.json(
      {
        error: "Google Ads API is not configured",
        hint: "Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, and GOOGLE_ADS_CUSTOMER_ID",
      },
      { status: 503 }
    );
  }

  let body: { keyword?: string; geo?: string };
  try {
    body = (await request.json()) as { keyword?: string; geo?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword || keyword.length > 200) {
    return NextResponse.json(
      { error: "Provide keyword (1–200 characters)" },
      { status: 400 }
    );
  }

  const geo = isGeoKey(body.geo) ? body.geo : "fl";

  try {
    const result = await runKeywordResearch(keyword, geo);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Google Ads API error";
    console.error("[google-ads/keyword-research]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
