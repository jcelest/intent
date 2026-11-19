import { NextResponse } from "next/server";
import { changeDialerPassword, requireDialerSession, verifyPassword } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
  }
  const rows = await sql`SELECT password_hash FROM dialer_users WHERE id = ${auth.user.id} LIMIT 1`;
  if (!rows[0] || !(await verifyPassword(body.currentPassword, rows[0].password_hash as string))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  try {
    await changeDialerPassword(auth.user.id, body.newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to change password." },
      { status: 400 },
    );
  }
}

