import { NextResponse } from "next/server";
import { getSavedViews, createSavedView, deleteSavedView } from "@/lib/saved-views";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const views = await getSavedViews();
    return NextResponse.json({ ok: true, views });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed getting saved views";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.name) {
      return NextResponse.json({ ok: false, error: "View name is required" }, { status: 400 });
    }

    const view = await createSavedView({
      name: String(body.name).trim(),
      overlayClientId: body.overlayClientId || null,
      filters: body.filters || {},
    });

    return NextResponse.json({ ok: true, view });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed creating saved view";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing view ID" }, { status: 400 });
    }
    await deleteSavedView(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed deleting saved view";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
