import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOpportunityDetail, queryOpportunities, type OpportunityClassification } from "@/lib/opportunity-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const list = (params: URLSearchParams, key: string) => params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
const finite = (value: string | null) => value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const detail = await getOpportunityDetail(id);
      return detail ? NextResponse.json({ ok: true, detail }) : NextResponse.json({ ok: false, error: "Opportunity not found" }, { status: 404 });
    }
    const result = await queryOpportunities({
      search: url.searchParams.get("search") || undefined,
      trades: list(url.searchParams, "trade"),
      services: list(url.searchParams, "service"),
      classifications: list(url.searchParams, "classification") as OpportunityClassification[],
      statuses: list(url.searchParams, "status"),
      counties: list(url.searchParams, "county"),
      cities: list(url.searchParams, "city"),
      zips: list(url.searchParams, "zip"),
      sources: list(url.searchParams, "source"),
      minDocumentedValue: finite(url.searchParams.get("minDocumentedValue")),
      maxDocumentedValue: finite(url.searchParams.get("maxDocumentedValue")),
      minEstimatedValue: finite(url.searchParams.get("minEstimatedValue")),
      confidenceMin: finite(url.searchParams.get("confidenceMin")),
      freshnessDays: finite(url.searchParams.get("freshnessDays")),
      deadlineBefore: url.searchParams.get("deadlineBefore") || undefined,
      expirationBefore: url.searchParams.get("expirationBefore") || undefined,
      sort: url.searchParams.get("sort") || undefined,
      cursor: url.searchParams.get("cursor") || undefined,
      limit: finite(url.searchParams.get("limit")),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Opportunity query failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to query opportunities" }, { status: 500 });
  }
}
