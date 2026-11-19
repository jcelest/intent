import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createDialerUser, requireDialerSession } from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request, "owner");
  if (auth.response) return auth.response;
  const users = await sql`
    SELECT id, username, display_name, email, role, active, must_change_password, last_login_at, created_at
    FROM dialer_users ORDER BY role DESC, display_name ASC
  `;
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request, "owner");
  if (auth.response) return auth.response;
  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
      role?: "owner" | "agent";
    };
    if (!body.username?.trim() || !body.displayName?.trim() || !body.password) {
      return NextResponse.json({ error: "Username, display name, and password are required." }, { status: 400 });
    }
    const user = await createDialerUser({
      username: body.username,
      displayName: body.displayName,
      email: body.email,
      password: body.password,
      role: body.role === "owner" ? "owner" : "agent",
      mustChangePassword: true,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json(
      { error: message.includes("unique") ? "That username or email is already in use." : message },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireDialerSession(request, "owner");
  if (auth.response) return auth.response;
  const body = (await request.json()) as { userId?: string; active?: boolean; displayName?: string; role?: string };
  if (!body.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
  await sql`
    UPDATE dialer_users SET
      active = COALESCE(${body.active ?? null}, active),
      display_name = COALESCE(${body.displayName?.trim() || null}, display_name),
      role = COALESCE(${body.role === "owner" || body.role === "agent" ? body.role : null}, role),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${body.userId}
  `;
  return NextResponse.json({ success: true });
}

