import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { runDeterministicDiscovery } from "@/lib/opportunity-hub";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result: await runDeterministicDiscovery(Math.min(1000, Number(body.limit || 250))) });
  } catch (error) {
    console.error("Discovery rules failed:", error);
    return NextResponse.json({ ok: false, error: "Discovery rules failed" }, { status: 500 });
  }
}
