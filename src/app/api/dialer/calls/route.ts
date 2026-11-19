import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 250), 1), 1000);
  const calls = auth.user.role === "owner"
    ? await sql`
        SELECT c.*, u.display_name AS user_name, l.first_name, l.last_name, l.company
        FROM dialer_calls c LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        ORDER BY c.started_at DESC LIMIT ${limit}
      `
    : await sql`
        SELECT c.*, u.display_name AS user_name, l.first_name, l.last_name, l.company
        FROM dialer_calls c LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        WHERE c.user_id = ${auth.user.id}
        ORDER BY c.started_at DESC LIMIT ${limit}
      `;
  return NextResponse.json({ calls });
}

