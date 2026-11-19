import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const rows = await sql`
    SELECT c.*, l.first_name, l.last_name, l.company
    FROM dialer_calls c
    LEFT JOIN dialer_leads l ON l.id = c.lead_id
    WHERE c.id = ${params.id}
      AND (c.user_id = ${auth.user.id} OR ${auth.user.role} = 'owner')
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  return NextResponse.json({ call: rows[0] });
}
