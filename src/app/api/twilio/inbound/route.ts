import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { absoluteCallbackUrl, twilio, validateTwilioWebhook } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
  if (!validateTwilioWebhook(request, params)) return new NextResponse("Invalid signature", { status: 403 });
  const from = params.From || "unknown";
  const to = params.To || "";
  const leadRows = await sql`SELECT id FROM dialer_leads WHERE phone_e164 = ${from} ORDER BY updated_at DESC LIMIT 1`;
  const calls = await sql`
    INSERT INTO dialer_calls (lead_id, direction, from_number, to_number, twilio_parent_call_sid, twilio_call_sid, status)
    VALUES (${leadRows[0]?.id || null}, 'inbound', ${from}, ${to}, ${params.CallSid || null}, ${params.CallSid || null}, 'ringing')
    RETURNING id
  `;
  const callId = calls[0].id as string;
  const users = await sql`SELECT id FROM dialer_users WHERE active = TRUE ORDER BY role DESC, display_name`;
  const response = new twilio.twiml.VoiceResponse();
  if (!users.length) {
    response.say("No one is available. Please leave a message after the tone.");
    response.record({ maxLength: 120, recordingStatusCallback: absoluteCallbackUrl(request, `/api/twilio/recording?callId=${callId}`) });
  } else {
    const dial = response.dial({ timeout: 25, answerOnBridge: true, action: absoluteCallbackUrl(request, `/api/twilio/status?callId=${callId}`) });
    for (const user of users) dial.client(String(user.id));
  }
  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

