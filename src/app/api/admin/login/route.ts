import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authenticateDialerUser,
  createDialerSession,
  DIALER_SESSION_COOKIE,
} from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

const VALID_MASTER_USER = (process.env.ADMIN_USERNAME || "Intent").toLowerCase();
const VALID_MASTER_PASS = process.env.ADMIN_PASSWORD || "Tealtent477";
const AUTH_COOKIE = "intent_auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() || "";
    const password = body.password || "";
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const cookieStore = await cookies();

    // 1. Try authenticating against dialer accounts in DB
    let user = null;
    try {
      user = await authenticateDialerUser(username, password);
    } catch (e) {
      console.warn("Dialer auth lookup failed, checking master admin credentials", e);
    }

    if (user) {
      try {
        const session = await createDialerSession(user.id, request.headers.get("user-agent") || "");
        cookieStore.set(DIALER_SESSION_COOKIE, session.token, {
          path: "/",
          maxAge: session.maxAge,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
        });
      } catch (sessionErr) {
        console.warn("Failed creating db session, setting cookie directly", sessionErr);
      }

      cookieStore.set(AUTH_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });

      return NextResponse.json({ success: true, user });
    }

    // 2. Fallback to master admin credentials (Intent / Tealtent477 or env)
    if (username.toLowerCase() === VALID_MASTER_USER && password === VALID_MASTER_PASS) {
      let dbOwner = null;
      try {
        const ownerRows = await sql`
          SELECT id, username, display_name, email, role, must_change_password
          FROM dialer_users
          WHERE role = 'owner' AND active = TRUE
          ORDER BY created_at ASC
          LIMIT 1
        `;
        if (ownerRows[0]) {
          dbOwner = {
            id: String(ownerRows[0].id),
            username: String(ownerRows[0].username),
            displayName: String(ownerRows[0].display_name),
            email: ownerRows[0].email ? String(ownerRows[0].email) : null,
            role: "owner" as const,
            mustChangePassword: Boolean(ownerRows[0].must_change_password),
          };
        }
      } catch {}

      const effectiveUser = dbOwner || {
        id: "admin-root",
        username: "Intent",
        displayName: "Intent Admin",
        email: null,
        role: "owner" as const,
        mustChangePassword: false,
      };

      if (dbOwner) {
        try {
          const session = await createDialerSession(dbOwner.id, request.headers.get("user-agent") || "");
          cookieStore.set(DIALER_SESSION_COOKIE, session.token, {
            path: "/",
            maxAge: session.maxAge,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
          });
        } catch (sessionErr) {
          console.warn("Failed creating db session for master admin", sessionErr);
        }
      }

      cookieStore.set(AUTH_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });

      return NextResponse.json({ success: true, user: effectiveUser });
    }

    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json(
      { error: "Authentication service error. Please try again." },
      { status: 500 },
    );
  }
}
