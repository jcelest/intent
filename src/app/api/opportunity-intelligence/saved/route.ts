import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSavedOpportunities } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const saved = await getSavedOpportunities();
    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    console.error("API saved opportunities error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load saved opportunities" }, { status: 500 });
  }
}
