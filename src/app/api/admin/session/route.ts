import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";

const AUTH_COOKIE = "intent_auth";
const DEVICE_COOKIE = "intent_auth_device";

function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua || "").digest("hex").slice(0, 32);
}

export async function GET(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  const currentHash = hashUserAgent(ua);

  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE)?.value;
  const deviceHash = cookieStore.get(DEVICE_COOKIE)?.value;

  if (!auth || !deviceHash || deviceHash !== currentHash) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
