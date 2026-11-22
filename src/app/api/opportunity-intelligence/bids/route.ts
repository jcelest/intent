import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCommercialBids, toggleSaveOpportunity } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const trade = url.searchParams.get("trade") || "all";
    const county = url.searchParams.get("county") || "all";
    const agencyType = url.searchParams.get("agencyType") || "all";
    const status = url.searchParams.get("status") || "all";
    const closingWithinDays = Number(url.searchParams.get("closingWithinDays") || 0);
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const { bids, total } = await getCommercialBids({
      query,
      trade,
      county,
      agencyType,
      status,
      closingWithinDays,
      limit,
      offset,
    });

    return NextResponse.json({ ok: true, bids, total });
  } catch (error) {
    console.error("API bids error:", error);
    return NextResponse.json({ ok: false, error: "Failed to query commercial bids" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const result = await toggleSaveOpportunity(body);
    return NextResponse.json({ ok: true, saved: result.saved });
  } catch (error) {
    console.error("API toggle save error:", error);
    return NextResponse.json({ ok: false, error: "Failed to toggle saved state" }, { status: 500 });
  }
}
