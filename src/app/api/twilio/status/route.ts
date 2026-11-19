import { NextResponse } from "next/server";
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
  await sql`
    UPDATE dialer_calls SET
      twilio_call_sid = COALESCE(twilio_call_sid, ${params.CallSid || params.DialCallSid || null}),
      status = ${status}, callback_sequence = GREATEST(callback_sequence, ${sequence}),
      answered_at = CASE WHEN ${status} IN ('in-progress', 'answered', 'completed') AND answered_at IS NULL THEN CURRENT_TIMESTAMP ELSE answered_at END,
      ended_at = CASE WHEN ${status} IN ('completed', 'busy', 'failed', 'no-answer', 'canceled') THEN CURRENT_TIMESTAMP ELSE ended_at END,
      duration_seconds = COALESCE(${duration}, duration_seconds), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${callId} AND ${sequence} >= callback_sequence
  `;
  return new NextResponse("OK");
}

