import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { createTaxonomyCategory, getTaxonomy, updateTaxonomyCategory } from "@/lib/opportunity-hub";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true, categories: await getTaxonomy() });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    if (!body.slug || !body.name || !body.categoryType) return NextResponse.json({ ok: false, error: "slug, name, and categoryType are required" }, { status: 400 });
    return NextResponse.json({ ok: true, category: await createTaxonomyCategory(body) }, { status: 201 });
  } catch (error) {
    console.error("Taxonomy create failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to create taxonomy category" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  if (!body.id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  return NextResponse.json({ ok: true, category: await updateTaxonomyCategory(body.id, body) });
}
