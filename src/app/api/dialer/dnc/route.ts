import { NextResponse } from "next/server";
import { addActivity, normalizePhone } from "@/lib/dialer";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response) return auth.response;
  const entries = await sql`
    SELECT d.*, u.display_name AS requested_by_name FROM dialer_dnc d
    LEFT JOIN dialer_users u ON u.id = d.requested_by ORDER BY d.created_at DESC LIMIT 2000
  `;
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { phone?: string; reason?: string };
  const phone = normalizePhone(body.phone || "");
  if (!phone) return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  const rows = await sql`
    INSERT INTO dialer_dnc (phone_e164, reason, source, requested_by)
    VALUES (${phone}, ${body.reason?.trim() || "Manual suppression"}, 'manual', ${auth.user.id})
    ON CONFLICT (phone_e164) DO UPDATE SET reason = EXCLUDED.reason
    RETURNING *
  `;
  await sql`UPDATE dialer_leads SET do_not_call = TRUE, status = 'closed', disposition = 'dnc' WHERE phone_e164 = ${phone}`;
  await addActivity({ userId: auth.user.id, type: "dnc_added", summary: `Suppressed ${phone}` });
  return NextResponse.json({ entry: rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireDialerSession(request, "owner");
  if (auth.response) return auth.response;
  const body = (await request.json()) as { phone?: string };
  const phone = normalizePhone(body.phone || "");
  if (!phone) return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  await sql`DELETE FROM dialer_dnc WHERE phone_e164 = ${phone}`;
  await sql`UPDATE dialer_leads SET do_not_call = FALSE, status = 'to_call', disposition = NULL WHERE phone_e164 = ${phone}`;
  return NextResponse.json({ success: true });
}

