import { NextResponse } from "next/server";
import { syncDueOpportunitySources } from "@/lib/opportunity-live-sources";
import { fetchPendingOpportunityDocuments } from "@/lib/opportunity-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const lane = searchParams.get("lane") || "scheduled";
  const force = searchParams.get("force") === "1";
  const lanes: Record<string, string[]> = {
    hourly: ["mfmp"],
    periodic: ["sam-gov", "fdot-lettings", "miamidade", "ucf-solicitations"],
    daily: ["facts", "usaspending", "orlando-permits", "broward-college-forecast", "fl-administrative-register-bids"],
    scheduled: [],
  };
  if (lane === "documents") {
    const documents = await fetchPendingOpportunityDocuments({ limit: 60, maxPerSource: 10 });
    return NextResponse.json({ ok: true, lane, sources: null, documents });
  }
  if (!(lane in lanes)) return NextResponse.json({ ok: false, error: "Unknown scheduler lane" }, { status: 400 });
  const adapters = lanes[lane];
  const sources = await syncDueOpportunitySources({ force, limitPerSource: lane === "daily" ? 500 : 1000, adapters: adapters.length ? adapters : undefined });
  const documents = await fetchPendingOpportunityDocuments({ limit: 20, maxPerSource: 4 });
  return NextResponse.json({ ok: true, lane, force, sources, documents });
}
