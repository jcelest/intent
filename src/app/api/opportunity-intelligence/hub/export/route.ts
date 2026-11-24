import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { queryOpportunities } from "@/lib/opportunity-hub";

export const runtime = "nodejs";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "geojson" ? "geojson" : "csv";
  const result = await queryOpportunities({
    search: url.searchParams.get("search") || undefined,
    trades: url.searchParams.getAll("trade"),
    counties: url.searchParams.getAll("county"),
    classifications: url.searchParams.getAll("classification") as never[],
    limit: 250,
  });
  if (format === "geojson") {
    const body = {
      type: "FeatureCollection",
      features: result.records.filter((record) => record.latitude !== null && record.longitude !== null).map((record) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [record.longitude, record.latitude] },
        properties: { ...record, latitude: undefined, longitude: undefined },
      })),
    };
    return new NextResponse(JSON.stringify(body), { headers: { "Content-Type": "application/geo+json", "Content-Disposition": "attachment; filename=intent-opportunities.geojson" } });
  }
  const headers = ["id", "title", "classification", "status", "trade", "service", "county", "city", "zip", "documented_value", "estimated_value", "deadline", "expiration", "confidence", "source_url"];
  const lines = result.records.map((record) => [record.id, record.title, record.classification, record.status, record.tradeSlug, record.serviceCategory, record.county, record.city, record.zipCode, record.documentedValue, record.estimatedValue, record.procurementDeadline, record.contractExpirationDate, record.evidenceConfidence, record.sourceUrl].map(csvCell).join(","));
  return new NextResponse([headers.map(csvCell).join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=intent-opportunities.csv" } });
}
