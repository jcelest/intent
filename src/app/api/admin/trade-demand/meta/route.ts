import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getTradeDemandMeta, upsertTrade, TradeDemandValidationError } from "@/lib/trade-demand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await getTradeDemandMeta());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Trade Demand settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ trade: await upsertTrade(await request.json()) }, { status: 201 });
  } catch (error) {
    if (error instanceof TradeDemandValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to save trade.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
