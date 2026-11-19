import { NextResponse } from "next/server";
import { addActivity, DISPOSITIONS, nextAttemptForDisposition, statusForDisposition, type Disposition } from "@/lib/dialer";
import { requireDialerSession } from "@/lib/dialer-auth";
import { releaseLeadReservation, reserveNextLead } from "@/lib/dialer-queue";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as {
    leadId?: string;
    callId?: string;
    disposition?: string;
    notes?: string;
    callbackAt?: string | null;
    reserveNext?: boolean;
  };
  if (!body.leadId || !body.disposition || !DISPOSITIONS.includes(body.disposition as Disposition)) {
    return NextResponse.json({ error: "Lead and valid disposition are required." }, { status: 400 });
  }
  const disposition = body.disposition as Disposition;
  const status = statusForDisposition(disposition);
  const nextCallAt = nextAttemptForDisposition(disposition, body.callbackAt);
  const isDnc = disposition === "dnc";

  await sql`
    UPDATE dialer_leads SET
      status = ${status}, disposition = ${disposition},
      notes = CASE WHEN ${body.notes?.trim() || null}::text IS NULL THEN notes ELSE ${body.notes?.trim() || null} END,
      next_call_at = ${nextCallAt},
      last_contacted_at = CASE WHEN ${["contacted", "interested", "callback", "appointment", "converted"].includes(disposition)} THEN CURRENT_TIMESTAMP ELSE last_contacted_at END,
      do_not_call = ${isDnc}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${body.leadId}
  `;
  if (body.callId) {
    await sql`
      UPDATE dialer_calls SET disposition = ${disposition}, notes = ${body.notes?.trim() || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${body.callId} AND (user_id = ${auth.user.id} OR ${auth.user.role} = 'owner')
    `;
  }
  if (isDnc) {
    await sql`
      INSERT INTO dialer_dnc (phone_e164, reason, source, requested_by)
      SELECT phone_e164, ${body.notes?.trim() || "Lead requested no further calls"}, 'disposition', ${auth.user.id}
      FROM dialer_leads WHERE id = ${body.leadId}
      ON CONFLICT (phone_e164) DO UPDATE SET reason = EXCLUDED.reason
    `;
  }
  if (body.callbackAt || disposition === "callback" || disposition === "appointment") {
    const dueAt = body.callbackAt ? new Date(body.callbackAt) : nextCallAt;
    await sql`
      INSERT INTO dialer_tasks (lead_id, assigned_user_id, created_by, task_type, title, description, due_at)
      SELECT id, COALESCE(assigned_user_id, ${auth.user.id}), ${auth.user.id},
        ${disposition === "appointment" ? "follow_up" : "callback"},
        ${disposition === "appointment" ? "Appointment follow-up" : "Call back lead"},
        ${body.notes?.trim() || null}, ${dueAt}
      FROM dialer_leads WHERE id = ${body.leadId}
    `;
  }
  await addActivity({
    leadId: body.leadId,
    userId: auth.user.id,
    type: "disposition",
    summary: `Marked ${disposition.replaceAll("_", " ")}`,
    metadata: { callId: body.callId || null, callbackAt: body.callbackAt || null },
  });
  await releaseLeadReservation({ userId: auth.user.id, leadId: body.leadId });
  const nextLead = body.reserveNext
    ? await reserveNextLead({ userId: auth.user.id, role: auth.user.role, excludeLeadId: body.leadId })
    : null;
  return NextResponse.json({ success: true, status, nextLead });
}
