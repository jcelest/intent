import { NextResponse } from "next/server";
import { getDialerSession } from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getDialerSession(request);
    return NextResponse.json({ ok: Boolean(user), user });
  } catch {
    return NextResponse.json({ ok: false, user: null });
  }
}
