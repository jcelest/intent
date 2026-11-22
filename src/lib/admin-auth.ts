import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDialerSession } from "@/lib/dialer-auth";

/** Guard for admin APIs supporting both database-backed dialer sessions and fallback admin sessions. */
export async function requireAdminSession(request: Request): Promise<NextResponse | null> {
  try {
    const user = await getDialerSession(request);
    if (user) return null;
  } catch {
    // Database might be unavailable
  }

  const cookieStore = await cookies();
  const auth = cookieStore.get("intent_auth")?.value;
  if (auth) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
