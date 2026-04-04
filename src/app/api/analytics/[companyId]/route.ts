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

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Inclusive day count between two YYYY-MM-DD strings */
function inclusiveDayCount(startDate: string, endDate: string): number {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  if (!s || !e) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function pickDimension(startDate: string, endDate: string): "date" | "yearMonth" {
  return inclusiveDayCount(startDate, endDate) > 120 ? "yearMonth" : "date";
}

function parseDateRangePreset(rangeId: Ga4DateRangeId): {
  startDate: string;
  endDate: string;
  dimension: "date" | "yearMonth";
  label: string;
} {
  const now = new Date();
  const endDate = formatYmd(now);
  const start = new Date(now);

  if (rangeId === "12m") {
    start.setMonth(start.getMonth() - 12);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    return {
      startDate: startStr,
      endDate,
      dimension: "yearMonth",
      label: GA4_DATE_RANGES.find((r) => r.id === rangeId)?.label ?? "Last 12 months",
    };
  }

  const days = GA4_DATE_RANGES.find((r) => r.id === rangeId)?.days ?? 28;
  start.setDate(start.getDate() - days);
  const startStr = formatYmd(start);
  return {
    startDate: startStr,
    endDate,
    dimension: pickDimension(startStr, endDate),
    label: GA4_DATE_RANGES.find((r) => r.id === rangeId)?.label ?? rangeId,
  };
}

function validateCustomRange(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
  dimension: "date" | "yearMonth";
  label: string;
} {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  if (!s || !e) {
    throw new Error("Invalid startDate or endDate (use YYYY-MM-DD)");
  }
  if (e < s) {
    throw new Error("endDate must be on or after startDate");
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (e > today) {
    throw new Error("endDate cannot be in the future");
  }
  const dim = pickDimension(startDate, endDate);
  return {
    startDate,
    endDate,
    dimension: dim,
    label: `${startDate} → ${endDate}`,
  };
}

/** Same-length window immediately before `startDate` */
function previousPeriodRange(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
  dimension: "date" | "yearMonth";
} {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  if (!s || !e) throw new Error("Invalid dates");
  const msPerDay = 86400000;
  const days = inclusiveDayCount(startDate, endDate);
  const prevEnd = new Date(s.getTime() - msPerDay);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * msPerDay);
  const ps = formatYmd(prevStart);
  const pe = formatYmd(prevEnd);
  return {
    startDate: ps,
    endDate: pe,
    dimension: pickDimension(ps, pe),
  };
}

function formatDateLabel(dimValue: string, dimension: string): string {
  if (dimension === "yearMonth") {
    const y = dimValue.slice(0, 4);
    const m = parseInt(dimValue.slice(4, 6), 10) - 1;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
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
  range: { startDate: string; endDate: string; dimension: string },
  metricIds: Ga4MetricId[]
): Promise<Ga4LiveData> {
  const client = await getGa4Client();
  const { startDate, endDate, dimension } = range;

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
        return def?.format === "percent" || def?.format === "duration"
          ? parseFloat(v)
          : Math.round(parseFloat(v));
      }),
      format: (def?.format ?? "number") as "number" | "percent" | "duration",
    };
  });

  return {
    dateRange: `${startDate} – ${endDate}`,
    dateLabels,
    series,
    startDate,
    endDate,
  };
}

function mergeComparisonSeries(
  current: Ga4LiveData,
  previous: Ga4LiveData
): Ga4LiveData {
  const lengths = [
    ...current.series.map((s) => s.values.length),
    ...previous.series.map((s) => s.values.length),
    current.dateLabels.length,
    previous.dateLabels.length,
  ].filter((n) => n > 0);
  const safeLen = lengths.length ? Math.min(...lengths) : 0;

  const merged: Ga4Series[] = current.series.map((s) => {
    const prevS = previous.series.find((p) => p.id === s.id);
    const valuesPrevious = prevS
      ? prevS.values.slice(0, safeLen)
      : undefined;
    return {
      ...s,
      values: s.values.slice(0, safeLen),
      valuesPrevious,
    };
  });

  return {
    ...current,
    dateLabels: current.dateLabels.slice(0, safeLen),
    series: merged,
    comparison: {
      label: `${previous.startDate ?? ""} – ${previous.endDate ?? ""}`,
      startDate: previous.startDate ?? "",
      endDate: previous.endDate ?? "",
    },
  };
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
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  const compare =
    searchParams.get("compare") === "1" || searchParams.get("compare") === "true";

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
      let primary: {
        startDate: string;
        endDate: string;
        dimension: "date" | "yearMonth";
        label: string;
      };

      if (startParam && endParam) {
        primary = validateCustomRange(startParam, endParam);
      } else {
        primary = parseDateRangePreset(dateRange);
      }

      const range1 = {
        startDate: primary.startDate,
        endDate: primary.endDate,
        dimension: primary.dimension,
      };

      let ga4 = await fetchGa4Report(propertyId, range1, metricIds);
      ga4 = {
        ...ga4,
        dateRange: primary.label,
      };

      if (compare) {
        const prev = previousPeriodRange(primary.startDate, primary.endDate);
        const prevRange = { ...prev, dimension: primary.dimension };
        const ga4Prev = await fetchGa4Report(propertyId, prevRange, metricIds);
        ga4 = mergeComparisonSeries(ga4, ga4Prev);
        ga4.dateRange = primary.label + " (vs prior period)";
      }

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
