import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destroyDialerSession, DIALER_SESSION_COOKIE } from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroyDialerSession();
  } catch {
    // Ignore error if db is unreachable
  }

  const cookieStore = await cookies();
  cookieStore.set(DIALER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  cookieStore.set("intent_auth", "", { path: "/", maxAge: 0 });
  cookieStore.set("intent_auth_device", "", { path: "/", maxAge: 0 });

  return NextResponse.json({ success: true });
}
