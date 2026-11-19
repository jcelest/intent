import { NextResponse } from "next/server";
import { getDialerSession } from "@/lib/dialer-auth";

/** Compatibility guard for existing admin APIs while admin authentication uses dialer sessions. */
export async function requireAdminSession(request: Request): Promise<NextResponse | null> {
  const user = await getDialerSession(request);
  return user ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
