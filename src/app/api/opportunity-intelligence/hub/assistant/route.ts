import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { buildOpportunityBrief } from "@/lib/opportunity-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const opportunityId = url.searchParams.get("opportunityId");
  if (!opportunityId) {
    return NextResponse.json({ ok: false, error: "opportunityId is required" }, { status: 400 });
  }
  const brief = await buildOpportunityBrief(opportunityId, url.searchParams.get("question") || undefined);
  if (!brief) return NextResponse.json({ ok: false, error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: brief });
}
