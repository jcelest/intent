import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  getChannelCoverageReport,
  getPlatformCoverage,
  updatePlatformCoverage,
} from "@/lib/commercial-channel-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const clientName = new URL(request.url).searchParams.get("client");
    const [coverage, platformCoverage] = await Promise.all([
      getChannelCoverageReport(),
      getPlatformCoverage(clientName),
    ]);
    return NextResponse.json({ ok: true, ...coverage, platformCoverage });
  } catch (error) {
    console.error("Channel coverage query failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load channel coverage" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    if (!body.clientName || !body.platformKey || !["NOT_REGISTERED", "IN_PROGRESS", "REGISTERED"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "clientName, platformKey, and a valid status are required" }, { status: 400 });
    }
    const row = await updatePlatformCoverage({
      clientName: String(body.clientName),
      platformKey: String(body.platformKey),
      status: body.status,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    console.error("Platform coverage update failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to update platform coverage" }, { status: 500 });
  }
}
