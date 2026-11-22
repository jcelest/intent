import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOutreachPipeline, createPipelineItem, updatePipelineStage } from "@/lib/opportunity-intelligence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const pipeline = await getOutreachPipeline();
    return NextResponse.json({ ok: true, pipeline });
  } catch (error) {
    console.error("API pipeline error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load outreach pipeline" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const item = await createPipelineItem(body);
    if (!item) return NextResponse.json({ ok: false, error: "Failed to create pipeline record" }, { status: 400 });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("API pipeline create error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create pipeline item" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const { id, stage, notes, nextAction, nextFollowupAt } = await request.json();
    if (!id || !stage) return NextResponse.json({ ok: false, error: "ID and stage are required" }, { status: 400 });

    const success = await updatePipelineStage(id, stage, notes, nextAction, nextFollowupAt);
    return NextResponse.json({ ok: success });
  } catch (error) {
    console.error("API pipeline update error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update pipeline stage" }, { status: 500 });
  }
}
