import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response) return auth.response;
  const lists = await sql`
    SELECT l.*, COUNT(m.lead_id)::int AS lead_count
    FROM dialer_lists l LEFT JOIN dialer_list_members m ON m.list_id = l.id
    WHERE l.active = TRUE GROUP BY l.id ORDER BY l.created_at DESC
  `;
  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { name?: string; description?: string; color?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "List name is required." }, { status: 400 });
  const rows = await sql`
    INSERT INTO dialer_lists (name, description, color, created_by)
    VALUES (${body.name.trim()}, ${body.description?.trim() || null}, ${body.color || "#14b8a6"}, ${auth.user.id})
    RETURNING *
  `;
  return NextResponse.json({ list: rows[0] }, { status: 201 });
}

