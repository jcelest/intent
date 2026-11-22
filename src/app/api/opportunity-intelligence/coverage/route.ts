import { NextResponse } from "next/server";
import { getFloridaCoverageSummary } from "@/lib/opportunity-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getFloridaCoverageSummary();
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    console.error("Coverage summary API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed fetching Florida coverage summary" },
      { status: 500 }
    );
  }
}
