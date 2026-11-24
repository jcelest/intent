import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getHubOverview } from "@/lib/opportunity-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ ok: true, overview: await getHubOverview() });
  } catch (error) {
    console.error("Opportunity hub overview failed:", error);
    return NextResponse.json({ ok: false, error: "The universal opportunity schema is unavailable. Apply migration 009 and retry." }, { status: 503 });
  }
}
