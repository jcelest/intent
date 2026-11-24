import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const DIALER_SESSION_COOKIE = "intent_dialer_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type DialerRole = "owner" | "agent";

export type DialerUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: DialerRole;
  mustChangePassword: boolean;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  password_hash: string;
  role: DialerRole;
  must_change_password: boolean;
};

function mapUser(row: UserRow): DialerUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function userAgentHash(userAgent: string): string {
  return createHash("sha256").update(userAgent || "").digest("hex");
}

export async function authenticateDialerUser(username: string, password: string): Promise<DialerUser | null> {
  const rows = await sql`
    SELECT id, username, display_name, email, password_hash, role, must_change_password
    FROM dialer_users
    WHERE LOWER(username) = LOWER(${username}) AND active = TRUE
    LIMIT 1
  `;
  const row = rows[0] as UserRow | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) return null;
  await sql`UPDATE dialer_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
  return mapUser(row);
}

export async function createDialerSession(userId: string, userAgent: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await sql`
    INSERT INTO dialer_sessions (user_id, token_hash, user_agent_hash, expires_at)
    VALUES (${userId}, ${tokenHash(token)}, ${userAgentHash(userAgent)}, ${expiresAt})
  `;
  return { token, expiresAt, maxAge: SESSION_MAX_AGE_SECONDS };
}

export async function getDialerSession(request?: Request): Promise<DialerUser | null> {
  void request;
  const cookieStore = await cookies();
  const token = cookieStore.get(DIALER_SESSION_COOKIE)?.value;
  if (token) {
    try {
      const rows = await sql`
        SELECT u.id, u.username, u.display_name, u.email, u.password_hash, u.role, u.must_change_password
        FROM dialer_sessions s
        JOIN dialer_users u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash(token)}
          AND s.expires_at > CURRENT_TIMESTAMP
          AND u.active = TRUE
        LIMIT 1
      `;
      const row = rows[0] as UserRow | undefined;
      if (row) return mapUser(row);
    } catch (e) {
      console.warn("Error looking up dialer session by token:", e);
    }
  }

  // Fallback: If master admin cookie is present, resolve to owner account
  const auth = cookieStore.get("intent_auth")?.value;
  if (auth) {
    try {
      const ownerRows = await sql`
        SELECT id, username, display_name, email, password_hash, role, must_change_password
        FROM dialer_users
        WHERE role = 'owner' AND active = TRUE
        ORDER BY created_at ASC
        LIMIT 1
      `;
      if (ownerRows[0]) {
        return mapUser(ownerRows[0] as UserRow);
      }
    } catch {}

    return {
      id: "admin-root",
      username: "Intent",
      displayName: "Intent Admin",
      email: null,
      role: "owner",
      mustChangePassword: false,
    };
  }

  return null;
}

export async function requireDialerSession(request: Request, role?: DialerRole) {
  const user = await getDialerSession(request);
  if (!user || (role && user.role !== role)) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function destroyDialerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DIALER_SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM dialer_sessions WHERE token_hash = ${tokenHash(token)}`;
  cookieStore.set(DIALER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function createDialerUser(input: {
  username: string;
  displayName: string;
  email?: string | null;
  password: string;
  role?: DialerRole;
  mustChangePassword?: boolean;
}) {
  const passwordHash = await hashPassword(input.password);
  const rows = await sql`
    INSERT INTO dialer_users (username, display_name, email, password_hash, role, must_change_password)
    VALUES (
      ${input.username.trim()}, ${input.displayName.trim()}, ${input.email?.trim() || null},
      ${passwordHash}, ${input.role || "agent"}, ${input.mustChangePassword ?? true}
    )
    RETURNING id, username, display_name, email, password_hash, role, must_change_password
  `;
  return mapUser(rows[0] as UserRow);
}

export async function changeDialerPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  await sql`
    UPDATE dialer_users
    SET password_hash = ${passwordHash}, must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

