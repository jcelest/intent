import { NextRequest, NextResponse } from "next/server";
import {
  getClientOutreachTargets,
  getRegisteredClientsList,
  verifyOutreachTargetGoogle,
} from "@/lib/opportunity-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || undefined;
    const territoryOverride = searchParams.get("territory") || undefined;
    const tradeOverride = searchParams.get("trade") || undefined;
    const targetType = searchParams.get("targetType") || undefined;
    const verificationStatus = searchParams.get("verificationStatus") || undefined;
    const county = searchParams.get("county") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = Number(searchParams.get("limit")) || 100;
    const offset = Number(searchParams.get("offset")) || 0;

    const [outreachData, clients] = await Promise.all([
      getClientOutreachTargets({
        clientId,
        territoryOverride,
        tradeOverride,
        targetType,
        verificationStatus,
        county,
        search,
        limit,
        offset,
      }),
      getRegisteredClientsList(),
    ]);

    return NextResponse.json({
      ok: true,
      registeredClients: clients,
      ...outreachData,
    });
  } catch (error) {
    console.error("Unified Outreach Database API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed fetching client outreach targets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetId } = body;

    if (!targetId) {
      return NextResponse.json({ ok: false, error: "targetId is required" }, { status: 400 });
    }

    const updated = await verifyOutreachTargetGoogle(targetId);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Target not found or verification failed" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, target: updated });
  } catch (error) {
    console.error("Google verification API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed running Google search verification" },
      { status: 500 }
    );
  }
}
