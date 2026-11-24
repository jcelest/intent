import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { bridgeOperationalLegacyProcurement } from "@/lib/opportunity-ingestion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.adapter !== "operational_legacy_procurement") return NextResponse.json({ ok: false, error: "Unknown adapter. No external source will be called implicitly." }, { status: 400 });
    return NextResponse.json({ ok: true, result: await bridgeOperationalLegacyProcurement(Math.min(5000, Number(body.limit || 1000))) });
  } catch (error) {
    console.error("Opportunity ingestion failed:", error);
    return NextResponse.json({ ok: false, error: "Ingestion failed; see source synchronization history." }, { status: 500 });
  }
}
