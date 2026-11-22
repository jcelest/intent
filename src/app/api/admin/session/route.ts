import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDialerSession } from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getDialerSession(request);
    if (user) {
      return NextResponse.json({ ok: true, user });
    }

    const cookieStore = await cookies();
    const auth = cookieStore.get("intent_auth")?.value;
    if (auth) {
      return NextResponse.json({
        ok: true,
        user: {
          id: "admin-root",
          username: "Intent",
          displayName: "Intent Admin",
          email: null,
          role: "owner",
          mustChangePassword: false,
        },
      });
    }

    return NextResponse.json({ ok: false, user: null });
  } catch {
    return NextResponse.json({ ok: false, user: null });
  }
}
