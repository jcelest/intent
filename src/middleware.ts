import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "intent_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Protect analytics and other admin routes
  if (pathname.startsWith("/admin")) {
    const auth = request.cookies.get(AUTH_COOKIE)?.value;
    if (!auth) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
