import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSourceCoverage } from "@/lib/opportunity-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ ok: true, ...(await getSourceCoverage()) });
  } catch (error) {
    console.error("Source coverage query failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load source coverage" }, { status: 500 });
  }
}
