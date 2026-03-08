import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_COOKIE = "intent_auth";
const DEVICE_COOKIE = "intent_auth_device";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  cookieStore.set(DEVICE_COOKIE, "", { path: "/", maxAge: 0 });

  return NextResponse.json({ success: true });
}
