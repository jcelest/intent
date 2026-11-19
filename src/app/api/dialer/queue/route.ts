import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { claimLead, refreshLeadReservation, releaseLeadReservation, reserveNextLead } from "@/lib/dialer-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "next" | "claim" | "heartbeat" | "release";
    leadId?: string;
    excludeLeadId?: string | null;
  };

  if (body.action === "next") {
    const lead = await reserveNextLead({
      userId: auth.user.id,
      role: auth.user.role,
      excludeLeadId: body.excludeLeadId,
    });
    return NextResponse.json({ lead });
  }

  if (!body.leadId) {
    return NextResponse.json({ error: "Lead id is required." }, { status: 400 });
  }

  if (body.action === "claim") {
    const lead = await claimLead({ userId: auth.user.id, role: auth.user.role, leadId: body.leadId });
    if (!lead) {
      return NextResponse.json(
        { error: "This lead is no longer available. Another rep may already be dialing it." },
        { status: 409 },
      );
    }
    return NextResponse.json({ lead });
  }

  if (body.action === "heartbeat") {
    const refreshed = await refreshLeadReservation({ userId: auth.user.id, leadId: body.leadId });
    return NextResponse.json({ refreshed });
  }

  if (body.action === "release") {
    await releaseLeadReservation({ userId: auth.user.id, leadId: body.leadId });
    return NextResponse.json({ released: true });
  }

  return NextResponse.json({ error: "A valid queue action is required." }, { status: 400 });
}
