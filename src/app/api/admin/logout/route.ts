import { NextResponse } from "next/server";
import { destroyDialerSession } from "@/lib/dialer-auth";

export const runtime = "nodejs";

export async function POST() {
  await destroyDialerSession();
  return NextResponse.json({ success: true });
}
