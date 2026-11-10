import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { syncOrlandoPermits, TradeDemandConflictError } from "@/lib/trade-demand";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const run = await syncOrlandoPermits({
      windowDays: body.windowDays,
      maxRecords: body.maxRecords,
      pageSize: body.pageSize,
    });
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof TradeDemandConflictError) {
      return NextResponse.json({ error: error.message, ...error.details }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Orlando sync failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
