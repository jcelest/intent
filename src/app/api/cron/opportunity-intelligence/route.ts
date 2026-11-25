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
  const sources = await syncDueOpportunitySources({ limitPerSource: 250 });
  const documents = await fetchPendingOpportunityDocuments(15);
  return NextResponse.json({ ok: true, sources, documents });
}
