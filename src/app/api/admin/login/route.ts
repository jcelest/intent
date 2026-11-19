import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authenticateDialerUser,
  createDialerSession,
  DIALER_SESSION_COOKIE,
} from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() || "";
    const password = body.password || "";
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await authenticateDialerUser(username, password);
    if (!user) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });

    const session = await createDialerSession(user.id, request.headers.get("user-agent") || "");
    const cookieStore = await cookies();
    cookieStore.set(DIALER_SESSION_COOKIE, session.token, {
      path: "/",
      maxAge: session.maxAge,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    cookieStore.set("intent_auth", "", { path: "/", maxAge: 0 });
    cookieStore.set("intent_auth_device", "", { path: "/", maxAge: 0 });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json(
      { error: "Account database is not ready. Run the dialer migration first." },
      { status: 503 },
    );
  }
}
