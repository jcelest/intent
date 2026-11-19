import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateTwilioWebhook } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
  if (!validateTwilioWebhook(request, params)) return new NextResponse("Invalid signature", { status: 403 });
  const callId = new URL(request.url).searchParams.get("callId");
  const recordingSid = params.RecordingSid || null;
  const recordingUrl = params.RecordingUrl || null;
  const callSid = params.CallSid || null;

  if (callId) {
    await sql`
      UPDATE dialer_calls SET
        recording_sid = COALESCE(${recordingSid}, recording_sid),
        recording_url = COALESCE(${recordingUrl}, recording_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${callId}
    `;
  } else if (callSid) {
    await sql`
      UPDATE dialer_calls SET
        recording_sid = COALESCE(${recordingSid}, recording_sid),
        recording_url = COALESCE(${recordingUrl}, recording_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE twilio_call_sid = ${callSid} OR twilio_parent_call_sid = ${callSid}
    `;
  }
  return new NextResponse("OK");
}

