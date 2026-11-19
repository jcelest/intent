import { NextResponse } from "next/server";
import { automaticDispositionForTwilioStatus } from "@/lib/dialer-outcomes";
import { sql } from "@/lib/db";
import { validateTwilioWebhook } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
  if (!validateTwilioWebhook(request, params)) return new NextResponse("Invalid signature", { status: 403 });
  const callId = new URL(request.url).searchParams.get("callId");
  if (!callId) return new NextResponse("Missing callId", { status: 400 });
  const status = params.CallStatus || params.DialCallStatus || "unknown";
  const sequence = Number(params.SequenceNumber || -1);
  const duration = Number(params.CallDuration || params.DialCallDuration || 0) || null;
  const updated = await sql`
    UPDATE dialer_calls SET
      twilio_call_sid = COALESCE(twilio_call_sid, ${params.CallSid || params.DialCallSid || null}),
      status = ${status}, callback_sequence = GREATEST(callback_sequence, ${sequence}),
      answered_at = CASE WHEN ${status} IN ('in-progress', 'answered', 'completed') AND answered_at IS NULL THEN CURRENT_TIMESTAMP ELSE answered_at END,
      ended_at = CASE WHEN ${status} IN ('completed', 'busy', 'failed', 'no-answer', 'canceled') THEN CURRENT_TIMESTAMP ELSE ended_at END,
      duration_seconds = COALESCE(${duration}, duration_seconds), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${callId} AND ${sequence} >= callback_sequence
    RETURNING id, lead_id, user_id, direction, disposition
  `;
  const call = updated[0];
  const automaticDisposition = automaticDispositionForTwilioStatus(status);

  if (call?.direction === "outbound" && call.lead_id && automaticDisposition) {
    const dispositionRows = await sql`
      UPDATE dialer_calls SET disposition = ${automaticDisposition}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${callId} AND disposition IS NULL
      RETURNING id
    `;
    if (dispositionRows[0]) {
      await sql`
        UPDATE dialer_leads SET
          status = 'try_again', disposition = ${automaticDisposition},
          next_call_at = CURRENT_TIMESTAMP + INTERVAL '4 hours',
          reserved_by = CASE WHEN reserved_by = ${call.user_id || null}::uuid THEN NULL ELSE reserved_by END,
          reserved_at = CASE WHEN reserved_by = ${call.user_id || null}::uuid THEN NULL ELSE reserved_at END,
          reservation_expires_at = CASE WHEN reserved_by = ${call.user_id || null}::uuid THEN NULL ELSE reservation_expires_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${call.lead_id}
      `;
      await sql`
        INSERT INTO dialer_activities (lead_id, user_id, activity_type, summary, metadata)
        VALUES (${call.lead_id}, ${call.user_id || null}, 'automatic_disposition',
          ${`Automatically marked ${automaticDisposition.replaceAll("_", " ")}`},
          ${JSON.stringify({ callId, twilioStatus: status })})
      `;
    }
  }
  return new NextResponse("OK");
}
