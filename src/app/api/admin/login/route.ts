import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";

const VALID_USER = "Intent";
const VALID_PASS = "Tealtent477";
const AUTH_COOKIE = "intent_auth";
const DEVICE_COOKIE = "intent_auth_device";
const MAX_AGE = 86400; // 24 hours

function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua || "").digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  const deviceHash = hashUserAgent(ua);

  try {
    const body = await request.json();
    const { username, password } = body;

    if (username !== VALID_USER || password !== VALID_PASS) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, "1", {
      path: "/",
      maxAge: MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    cookieStore.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      maxAge: MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
