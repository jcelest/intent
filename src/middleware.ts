import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIALER_SESSION_COOKIE = "intent_dialer_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname).split(":")[0].toLowerCase();
  const isDialerHost = hostname === "call.intentrev.net" || hostname.startsWith("call.localhost");
  const hasSession = Boolean(request.cookies.get(DIALER_SESSION_COOKIE)?.value);

  if (isDialerHost && pathname === "/login") {
    if (hasSession) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.rewrite(new URL("/admin/login", request.url));
  }

  if (isDialerHost && pathname === "/") {
    if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
    const dialerUrl = new URL("/admin/dialer", request.url);
    dialerUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(dialerUrl);
  }

  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/admin") && !hasSession) {
    const loginUrl = new URL(isDialerHost ? "/login" : "/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/admin/:path*"] };
