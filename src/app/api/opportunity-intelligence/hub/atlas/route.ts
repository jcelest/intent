import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAtlasData } from "@/lib/opportunity-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const url = new URL(request.url);
    const bboxValues = (url.searchParams.get("bbox") || "").split(",").map(Number);
    const bbox = bboxValues.length === 4 && bboxValues.every(Number.isFinite)
      ? bboxValues as [number, number, number, number]
      : undefined;
    const result = await getAtlasData({
      bbox,
      counties: url.searchParams.getAll("county").flatMap((value) => value.split(",")).filter(Boolean),
      layers: (url.searchParams.get("layers") || "").split(",").filter(Boolean),
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("Atlas data query failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load Atlas data" }, { status: 500 });
  }
}
