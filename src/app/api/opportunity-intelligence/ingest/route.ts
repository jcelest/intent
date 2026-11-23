import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  getContinuousIngestionStatus,
  runContinuousIngestionStep,
  ingestAll67Counties,
  fetchCadastralCommercialParcels,
  upsertCadastralParcels,
  COUNTY_NAME_TO_DOR,
} from "@/lib/statewide-cadastral-collector";

export const runtime = "nodejs";

/**
 * GET /api/opportunity-intelligence/ingest
 * Returns current continuous ingestion status, coverage per county, and total records.
 */
export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const status = await getContinuousIngestionStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("API error loading ingestion status:", error);
    return NextResponse.json({ ok: false, error: "Failed to load continuous ingestion status" }, { status: 500 });
  }
}

/**
 * POST /api/opportunity-intelligence/ingest
 * Triggers continuous ingestion step, full 67-county sweep, or single county run.
 * Body options:
 * - mode: "step" | "all_67" | "county"
 * - county: "Orange" (for mode === "county")
 * - limit: number of records per county (default 50-60)
 * - countiesPerStep: number of counties to process (default 5)
 */
export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || "step";

    if (mode === "all_67") {
      const recordsPerCounty = Math.min(100, Math.max(10, Number(body.limit) || 40));
      const res = await ingestAll67Counties(recordsPerCounty);
      return NextResponse.json({ ok: res.success, result: res });
    }

    if (mode === "county" && body.county) {
      const countyMeta = COUNTY_NAME_TO_DOR.get(String(body.county).toLowerCase());
      if (!countyMeta) {
        return NextResponse.json({ ok: false, error: `Invalid Florida county: ${body.county}` }, { status: 400 });
      }

      const limit = Math.min(200, Math.max(10, Number(body.limit) || 60));
      const records = await fetchCadastralCommercialParcels(
        countyMeta.dorCode,
        countyMeta.name,
        countyMeta.seat,
        limit,
        0
      );

      const { added, updated } = await upsertCadastralParcels(records);

      return NextResponse.json({
        ok: true,
        county: countyMeta.name,
        recordsSeen: records.length,
        recordsAdded: added,
        recordsUpdated: updated,
      });
    }

    // Default: continuous ingestion step (round-robin)
    const countiesPerStep = Math.min(20, Math.max(1, Number(body.countiesPerStep) || 5));
    const recordsPerCounty = Math.min(100, Math.max(10, Number(body.recordsPerCounty) || 50));

    const result = await runContinuousIngestionStep({
      countiesPerStep,
      recordsPerCounty,
      triggeredBy: "admin_manual",
    });

    return NextResponse.json({ ok: result.success, result });
  } catch (error) {
    console.error("API error triggering continuous ingestion:", error);
    return NextResponse.json({ ok: false, error: "Failed to run continuous ingestion" }, { status: 500 });
  }
}
