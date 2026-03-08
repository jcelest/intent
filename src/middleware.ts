import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "intent_auth";
const DEVICE_COOKIE = "intent_auth_device";

async function hashUserAgent(ua: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ua || "");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const auth = request.cookies.get(AUTH_COOKIE)?.value;
    const deviceHash = request.cookies.get(DEVICE_COOKIE)?.value;

    if (!auth || !deviceHash) {
      const res = NextResponse.redirect(new URL("/admin/login", request.url));
      res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(DEVICE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    const ua = request.headers.get("user-agent") || "";
    const currentHash = await hashUserAgent(ua);

    if (deviceHash !== currentHash) {
      const res = NextResponse.redirect(new URL("/admin/login", request.url));
      res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(DEVICE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
