import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOpportunity, updateOpportunity, TradeDemandValidationError } from "@/lib/trade-demand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const data = await getOpportunity(params.id);
    if (!data) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const opportunity = await updateOpportunity(params.id, await request.json());
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    return NextResponse.json({ opportunity });
  } catch (error) {
    if (error instanceof TradeDemandValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update opportunity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
