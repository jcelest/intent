import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response) return auth.response;
  const sequences = await sql`SELECT * FROM dialer_sequences ORDER BY active DESC, created_at DESC`;
  return NextResponse.json({ sequences });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { name?: string; description?: string; steps?: unknown[] };
  if (!body.name?.trim()) return NextResponse.json({ error: "Sequence name is required." }, { status: 400 });
  const rows = await sql`
    INSERT INTO dialer_sequences (name, description, steps, created_by)
    VALUES (${body.name.trim()}, ${body.description?.trim() || null}, ${JSON.stringify(body.steps || [])}, ${auth.user.id})
    RETURNING *
  `;
  return NextResponse.json({ sequence: rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { id?: string; name?: string; description?: string; steps?: unknown[]; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "Sequence id is required." }, { status: 400 });
  const rows = await sql`
    UPDATE dialer_sequences SET
      name = COALESCE(${body.name?.trim() || null}, name),
      description = CASE WHEN ${body.description === undefined} THEN description ELSE ${body.description?.trim() || null} END,
      steps = CASE WHEN ${body.steps === undefined} THEN steps ELSE ${body.steps ? JSON.stringify(body.steps) : "[]"}::jsonb END,
      active = COALESCE(${body.active ?? null}, active), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${body.id} RETURNING *
  `;
  return NextResponse.json({ sequence: rows[0] || null });
}

