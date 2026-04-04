import { cookies } from "next/headers";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "intent_auth";
const DEVICE_COOKIE = "intent_auth_device";

function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua || "").digest("hex").slice(0, 32);
}

/** Returns null if authorized; otherwise a 401 NextResponse. */
export async function requireAdminSession(request: Request): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE)?.value;
  const deviceHash = cookieStore.get(DEVICE_COOKIE)?.value;
  const ua = request.headers.get("user-agent") || "";
  const currentHash = hashUserAgent(ua);

  if (!auth || !deviceHash || deviceHash !== currentHash) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
