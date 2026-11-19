import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";
import { addActivity, DISPOSITIONS, type Disposition } from "@/lib/dialer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const rows = await sql`
    SELECT c.*, u.display_name AS user_name, u.role AS user_role,
           l.first_name, l.last_name, l.company, l.city, l.state, l.metadata, l.notes AS lead_notes
    FROM dialer_calls c
    LEFT JOIN dialer_users u ON u.id = c.user_id
    LEFT JOIN dialer_leads l ON l.id = c.lead_id
    WHERE c.id = ${params.id}
      AND (c.user_id = ${auth.user.id} OR ${auth.user.role} = 'owner')
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  return NextResponse.json({ call: rows[0] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json().catch(() => ({}))) as {
    notes?: string;
    disposition?: string;
    syncLead?: boolean;
  };

  const hasNotes = body.notes !== undefined;
  const cleanNotes = hasNotes ? (body.notes?.trim() || null) : undefined;
  const hasDisposition = body.disposition !== undefined;
  const cleanDisposition = hasDisposition && body.disposition && DISPOSITIONS.includes(body.disposition as Disposition)
    ? (body.disposition as Disposition)
    : undefined;

  const rows = await sql`
    UPDATE dialer_calls SET
      notes = CASE WHEN ${hasNotes} THEN ${cleanNotes ?? null} ELSE notes END,
      disposition = CASE WHEN ${Boolean(cleanDisposition)} THEN ${cleanDisposition ?? null} ELSE disposition END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.id}
      AND (user_id = ${auth.user.id} OR ${auth.user.role} = 'owner')
    RETURNING *
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Call not found or unauthorized." }, { status: 404 });
  }

  const updatedCall = rows[0];

  // Optionally sync notes or disposition to the lead record so both match seamlessly
  if (updatedCall.lead_id && (hasNotes || cleanDisposition)) {
    await sql`
      UPDATE dialer_leads SET
        notes = CASE WHEN ${hasNotes && cleanNotes !== null} THEN ${cleanNotes ?? null} ELSE notes END,
        disposition = CASE WHEN ${Boolean(cleanDisposition)} THEN ${cleanDisposition ?? null} ELSE disposition END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${updatedCall.lead_id}
    `;

    await addActivity({
      leadId: String(updatedCall.lead_id),
      userId: auth.user.id,
      type: "disposition",
      summary: cleanNotes ? `Updated call log: "${cleanNotes.slice(0, 80)}"` : `Updated call outcome to ${cleanDisposition || "contacted"}`,
      metadata: { callId: params.id, notes: cleanNotes, disposition: cleanDisposition },
    });
  }

  return NextResponse.json({ success: true, call: updatedCall });
}
