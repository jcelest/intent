import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIALER_SESSION_COOKIE = "intent_dialer_session";
const AUTH_COOKIE = "intent_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname).split(":")[0].toLowerCase();
  const isDialerHost = hostname === "call.intentrev.net" || hostname.startsWith("call.localhost");
  const hasSession = Boolean(
    request.cookies.get(DIALER_SESSION_COOKIE)?.value || request.cookies.get(AUTH_COOKIE)?.value
  );

  // If on dialer host (e.g. call.intentrev.net)
  if (isDialerHost) {
    if (pathname === "/login") {
      if (hasSession) return NextResponse.redirect(new URL("/", request.url));
      return NextResponse.rewrite(new URL("/admin/dialer/login", request.url));
    }

    if (pathname === "/") {
      if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
      const dialerUrl = new URL("/admin/dialer", request.url);
      dialerUrl.search = request.nextUrl.search;
      return NextResponse.rewrite(dialerUrl);
    }
  }

  // Root /admin or /admin/ redirects to Intent Admin Hub analytics & ads tracking
  if (pathname === "/admin" || pathname === "/admin/") {
    return NextResponse.redirect(new URL("/admin/analytics", request.url));
  }

  // Allow login pages
  if (pathname === "/admin/login" || pathname === "/admin/dialer/login") {
    return NextResponse.next();
  }

  // Protect /admin routes
  if (pathname.startsWith("/admin") && !hasSession) {
    const isDialerRoute = pathname.startsWith("/admin/dialer");
    const targetLogin = isDialerHost
      ? "/login"
      : isDialerRoute
        ? "/admin/dialer/login"
        : "/admin/login";
    const loginUrl = new URL(targetLogin, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/admin", "/admin/:path*"] };
