import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getMarketAnalytics } from "@/lib/opportunity-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true, analytics: await getMarketAnalytics() });
}
