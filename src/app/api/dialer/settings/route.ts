import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const [settings, users] = await Promise.all([
    sql`SELECT key, value, updated_at FROM dialer_settings ORDER BY key`,
    sql`SELECT id, username, display_name, email, role, active, must_change_password, last_login_at, created_at FROM dialer_users ORDER BY role DESC, display_name`,
  ]);
  const values = Object.fromEntries(settings.map((row) => [row.key, row.value]));
  const dialerOrigin = (process.env.DIALER_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  return NextResponse.json({
    settings: values,
    users,
    twilio: {
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_TWIML_APP_SID && process.env.TWILIO_PHONE_NUMBER),
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
      voiceUrl: `${dialerOrigin}/api/twilio/voice`,
      inboundUrl: `${dialerOrigin}/api/twilio/inbound`,
    },
    currentUser: auth.user,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { key?: string; value?: Record<string, unknown> };
  if (!body.key || !body.value || !["workspace", "twilio"].includes(body.key)) {
    return NextResponse.json({ error: "Valid setting key and value are required." }, { status: 400 });
  }
  if (body.key === "twilio" && auth.user.role !== "owner") {
    return NextResponse.json({ error: "Only owners can modify Twilio settings." }, { status: 403 });
  }
  await sql`
    INSERT INTO dialer_settings (key, value, updated_by, updated_at)
    VALUES (${body.key}, ${JSON.stringify(body.value)}, ${auth.user.id}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = dialer_settings.value || EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
  `;
  return NextResponse.json({ success: true, value: body.value });
}
