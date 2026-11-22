import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { matchClientsForOpportunity } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const trade = url.searchParams.get("trade") || undefined;
    const county = url.searchParams.get("county") || undefined;

    const matches = await matchClientsForOpportunity({ tradeSlug: trade, county });
    return NextResponse.json({ ok: true, matches });
  } catch (error) {
    console.error("API client matching error:", error);
    return NextResponse.json({ ok: false, error: "Client matching calculation failed" }, { status: 500 });
  }
}
