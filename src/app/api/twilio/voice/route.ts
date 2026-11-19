import { NextResponse } from "next/server";
import { leadIsCallable } from "@/lib/dialer";
import { sql } from "@/lib/db";
import { absoluteCallbackUrl, assertTwilioConfigured, twilio, validateTwilioWebhook } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
  if (!validateTwilioWebhook(request, params)) return new NextResponse("Invalid signature", { status: 403 });

  const response = new twilio.twiml.VoiceResponse();
  try {
    const config = assertTwilioConfigured();
    const leadId = params.leadId || params.LeadId;
    const requestedCallId = params.dialerCallId || params.DialerCallId;
    const userId = (params.From || "").replace(/^client:/, "");
    if (!leadId || !userId) {
      response.say("The dial request is missing required information.");
      return xml(response);
    }
    const allowed = await leadIsCallable(leadId);
    if (!allowed.ok) {
      response.say(allowed.error);
      return xml(response);
    }
    const userRows = await sql`SELECT id FROM dialer_users WHERE id = ${userId} AND active = TRUE LIMIT 1`;
    if (!userRows[0]) {
      response.say("Your dialer account is not active.");
      return xml(response);
    }
    const validCallId = /^[0-9a-f-]{36}$/i.test(requestedCallId || "") ? requestedCallId : null;
    const callRows = validCallId
      ? await sql`
          INSERT INTO dialer_calls (id, lead_id, user_id, direction, from_number, to_number, twilio_parent_call_sid, status)
          VALUES (${validCallId}, ${leadId}, ${userId}, 'outbound', ${config.phoneNumber}, ${allowed.lead.phone_e164}, ${params.CallSid || null}, 'initiated')
          ON CONFLICT (id) DO UPDATE SET twilio_parent_call_sid = EXCLUDED.twilio_parent_call_sid, status = 'initiated', updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `
      : await sql`
          INSERT INTO dialer_calls (lead_id, user_id, direction, from_number, to_number, twilio_parent_call_sid, status)
          VALUES (${leadId}, ${userId}, 'outbound', ${config.phoneNumber}, ${allowed.lead.phone_e164}, ${params.CallSid || null}, 'initiated')
          RETURNING id
        `;
    const callId = callRows[0].id as string;
    await sql`
      UPDATE dialer_leads SET call_attempts = call_attempts + 1, last_call_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leadId}
    `;
    const settingRows = await sql`SELECT value FROM dialer_settings WHERE key = 'twilio' LIMIT 1`;
    const setting = (settingRows[0]?.value || {}) as { recordingEnabled?: boolean };
    const callback = absoluteCallbackUrl(request, `/api/twilio/status?callId=${encodeURIComponent(callId)}`);
    const dial = response.dial({
      callerId: config.phoneNumber,
      answerOnBridge: true,
      timeout: 30,
      record: setting.recordingEnabled ? "record-from-answer-dual" : undefined,
      recordingStatusCallback: setting.recordingEnabled
        ? absoluteCallbackUrl(request, `/api/twilio/recording?callId=${encodeURIComponent(callId)}`)
        : undefined,
    });
    dial.number({
      statusCallback: callback,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    }, allowed.lead.phone_e164 as string);
    return xml(response);
  } catch (error) {
    console.error("Twilio voice route failed", error);
    response.say("The call could not be started. Please check the dialer settings.");
    return xml(response);
  }
}

function xml(response: InstanceType<typeof twilio.twiml.VoiceResponse>) {
  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

