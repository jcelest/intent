import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { deleteSavedIntelligence, getSavedIntelligence, saveIntelligenceItem, saveIntelligenceSearch } from "@/lib/opportunity-hub";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true, ...(await getSavedIntelligence()) });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  const result = body.kind === "search" ? await saveIntelligenceSearch(body) : await saveIntelligenceItem(body);
  return NextResponse.json({ ok: true, result }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const kind = url.searchParams.get("kind") === "search" ? "search" : "item";
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  await deleteSavedIntelligence(id, kind);
  return NextResponse.json({ ok: true });
}
