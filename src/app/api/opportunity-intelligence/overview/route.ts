import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOpportunityOverviewStats } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const stats = await getOpportunityOverviewStats();
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("API overview stats error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load overview stats" }, { status: 500 });
  }
}
