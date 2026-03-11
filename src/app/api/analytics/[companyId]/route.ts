import { NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import type {
  AnalyticsResponse,
  Ga4LiveData,
  Ga4Series,
  Ga4MetricId,
  Ga4DateRangeId,
} from "@/lib/analytics-types";
import { GA4_METRICS, GA4_DATE_RANGES } from "@/lib/analytics-types";

async function getGa4Client() {
  const creds = process.env.GA4_CREDENTIALS_JSON;
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!creds && !credsPath) {
    throw new Error("GA4_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS not set");
  }
  const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
  return new BetaAnalyticsDataClient(
    creds ? { credentials: JSON.parse(creds) } : undefined
  );
}

function parseDateRange(rangeId: Ga4DateRangeId): { startDate: string; endDate: string; dimension: string } {
  const now = new Date();
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now);

  if (rangeId === "12m") {
    start.setMonth(start.getMonth() - 12);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    return { startDate: startStr, endDate, dimension: "yearMonth" };
  }

  const days = GA4_DATE_RANGES.find((r) => r.id === rangeId)?.days ?? 28;
  start.setDate(start.getDate() - days);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { startDate: startStr, endDate, dimension: "date" };
}

function formatDateLabel(dimValue: string, dimension: string): string {
  if (dimension === "yearMonth") {
    const y = dimValue.slice(0, 4);
    const m = parseInt(dimValue.slice(4, 6), 10) - 1;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[m]} '${y.slice(2)}`;
  }
  if (dimension === "date") {
    const m = dimValue.slice(4, 6);
    const d = dimValue.slice(6, 8);
    return `${m}/${d}`;
  }
  return dimValue;
}

async function fetchGa4Report(
  propertyId: string,
  dateRangeId: Ga4DateRangeId,
  metricIds: Ga4MetricId[]
): Promise<Ga4LiveData> {
  const client = await getGa4Client();
  const { startDate, endDate, dimension } = parseDateRange(dateRangeId);

  const metrics = metricIds.map((id) => ({ name: id }));
  const validMetrics = metrics.filter((m) =>
    GA4_METRICS.some((def) => def.id === m.name)
  );
  if (validMetrics.length === 0) {
    validMetrics.push({ name: "sessions" });
  }

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: dimension }],
    metrics: validMetrics,
    orderBys: [{ dimension: { dimensionName: dimension } }],
  });

  const rows = response.rows ?? [];
  const dateLabels = rows.map((r) =>
    formatDateLabel(r.dimensionValues?.[0]?.value ?? "", dimension)
  );
  const series: Ga4Series[] = validMetrics.map((m, idx) => {
    const def = GA4_METRICS.find((d) => d.id === m.name);
    return {
      id: m.name,
      label: def?.label ?? m.name,
      values: rows.map((r) => {
        const v = r.metricValues?.[idx]?.value ?? "0";
        return (def?.format === "percent" || def?.format === "duration") ? parseFloat(v) : Math.round(parseFloat(v));
      }),
      format: (def?.format ?? "number") as "number" | "percent" | "duration",
    };
  });

  const rangeLabel = GA4_DATE_RANGES.find((r) => r.id === dateRangeId)?.label ?? dateRangeId;
  return { dateRange: rangeLabel, dateLabels, series };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const { searchParams } = new URL(request.url);
  const dateRange = (searchParams.get("dateRange") ?? "12m") as Ga4DateRangeId;
  const metricsParam = searchParams.get("metrics") ?? GA4_METRICS.map((m) => m.id).join(",");
  const metricIds = metricsParam.split(",").filter(Boolean) as Ga4MetricId[];

  const company = getCompany(companyId);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (company.dataSource === "mock" && company.mockMetrics) {
    const res: AnalyticsResponse = {
      id: company.id,
      name: company.name,
      joinedDate: company.joinedDate,
      accentColor: company.accentColor,
      chartLayout: company.chartLayout,
      isLive: false,
      url: company.url,
      metrics: {
        revenue: company.mockMetrics.revenue,
        traffic: company.mockMetrics.traffic,
        leads: company.mockMetrics.leads,
        conversionRate: company.mockMetrics.conversionRate,
        aiCalls: company.mockMetrics.aiCalls,
      },
    };
    return NextResponse.json(res);
  }

  if (company.dataSource === "live") {
    const propertyId = process.env[`GA4_${company.id.toUpperCase().replace(/-/g, "_")}_PROPERTY_ID`];

    if (!propertyId) {
      return NextResponse.json(
        {
          ...company,
          isLive: true,
          url: company.url,
          metrics: { traffic: { current: [] } },
          error: `GA4 not configured. Set GA4_${company.id.toUpperCase().replace(/-/g, "_")}_PROPERTY_ID (and GA4_CREDENTIALS_JSON) in .env.local`,
        } as AnalyticsResponse,
        { status: 200 }
      );
    }

    try {
      const ga4 = await fetchGa4Report(propertyId, dateRange, metricIds);
      const trafficFromSessions = ga4.series.find((s) => s.id === "sessions");
      const trafficCurrent = trafficFromSessions?.values ?? [];

      const res: AnalyticsResponse = {
        id: company.id,
        name: company.name,
        joinedDate: company.joinedDate,
        accentColor: company.accentColor,
        chartLayout: company.chartLayout,
        isLive: true,
        url: company.url,
        metrics: {
          traffic: { current: trafficCurrent },
        },
        ga4,
      };

      return NextResponse.json(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "GA4 fetch failed";
      return NextResponse.json(
        {
          ...company,
          isLive: true,
          url: company.url,
          metrics: { traffic: { current: [] } },
          error: message,
        } as AnalyticsResponse,
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid company config" }, { status: 500 });
}
