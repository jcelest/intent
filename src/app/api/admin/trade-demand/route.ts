import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  createManualOpportunity,
  listOpportunities,
  TradeDemandValidationError,
  type QueueFilters,
} from "@/lib/trade-demand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const filters: QueueFilters = {
    trade: searchParams.get("trade"),
    location: searchParams.get("location"),
    buyer: searchParams.get("buyer"),
    evidenceType: searchParams.get("evidenceType"),
    deadline: searchParams.get("deadline") as QueueFilters["deadline"],
    clientId: searchParams.get("clientId"),
    nextAction: searchParams.get("nextAction") as QueueFilters["nextAction"],
    includeInactive: searchParams.get("includeInactive") === "true",
  };

  try {
    return NextResponse.json({ opportunities: await listOpportunities(filters) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Trade Demand queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const input = await request.json();
    const opportunity = await createManualOpportunity(input);
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof TradeDemandValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
