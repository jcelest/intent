import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { addActivity, TradeDemandValidationError } from "@/lib/trade-demand";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ activity: await addActivity(params.id, await request.json()) }, { status: 201 });
  } catch (error) {
    if (error instanceof TradeDemandValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to log activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
