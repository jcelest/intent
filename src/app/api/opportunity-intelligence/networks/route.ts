import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCommercialNetworks } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const orgType = url.searchParams.get("orgType") || "all";
    const county = url.searchParams.get("county") || "all";
    const trade = url.searchParams.get("trade") || "all";
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const { networks, total } = await getCommercialNetworks({
      query,
      orgType,
      county,
      trade,
      limit,
      offset,
    });

    return NextResponse.json({ ok: true, networks, total });
  } catch (error) {
    console.error("API networks error:", error);
    return NextResponse.json({ ok: false, error: "Failed to query commercial networks" }, { status: 500 });
  }
}
