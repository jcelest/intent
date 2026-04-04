import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  googleAdsKeywordResearchConfigured,
  KeywordResearchDebugError,
  runKeywordResearch,
} from "@/lib/google-ads-keyword-research";
import { GEO_PRESETS, type GeoPresetKey } from "@/lib/google-ads-geo-presets";
import { toGoogleAdsHttpError } from "@/lib/google-ads-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Central Florida preset runs 1 + N city calls; allow headroom on serverless */
export const maxDuration = 120;

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

  let body: { keyword?: string; geo?: string; debug?: boolean };
  try {
    body = (await request.json()) as { keyword?: string; geo?: string; debug?: boolean };
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
  const debugRequested = body.debug === true;

  try {
    const result = await runKeywordResearch(keyword, geo, { debug: debugRequested });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[google-ads/keyword-research]", err);
    if (err instanceof KeywordResearchDebugError) {
      const { message, status, code } = toGoogleAdsHttpError(err.cause ?? err);
      return NextResponse.json(
        {
          error: err.message || message,
          ...(code ? { code } : {}),
          debugEvents: err.debugEvents,
        },
        { status }
      );
    }
    const { message, status, code } = toGoogleAdsHttpError(err);
    return NextResponse.json(
      code ? { error: message, code } : { error: message },
      { status }
    );
  }
}
