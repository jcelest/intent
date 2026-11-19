import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateTwilioWebhook } from "@/lib/twilio-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
  if (!validateTwilioWebhook(request, params)) return new NextResponse("Invalid signature", { status: 403 });
  const callId = new URL(request.url).searchParams.get("callId");
  if (callId) {
    await sql`
      UPDATE dialer_calls SET recording_sid = ${params.RecordingSid || null}, recording_url = ${params.RecordingUrl || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${callId}
    `;
  }
  return new NextResponse("OK");
}

