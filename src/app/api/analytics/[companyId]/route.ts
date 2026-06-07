import { NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import type {
  AnalyticsResponse,
  Ga4LiveData,
  Ga4Series,
  Ga4MetricId,
  Ga4StandardMetricId,
  Ga4EventMetricId,
  Ga4DateRangeId,
} from "@/lib/analytics-types";
import { GA4_METRICS, GA4_EVENT_METRICS, GA4_DATE_RANGES, GA4_SELECTABLE_METRICS } from "@/lib/analytics-types";
import type { CompanyConfig } from "@/lib/companies";

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

/** Every calendar bucket in the requested range (GA4 omits zero-traffic days). */
function listDimensionKeysInRange(
  startDate: string,
  endDate: string,
  dimension: "date" | "yearMonth"
): string[] {
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);
  if (!s || !e) return [];

  if (dimension === "date") {
    const keys: string[] = [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      keys.push(
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
      );
    }
    return keys;
  }

  const keys: string[] = [];
  let y = s.getFullYear();
  let m = s.getMonth();
  const endY = e.getFullYear();
  const endM = e.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return keys;
}

function alignSeriesToLength(values: number[], targetLen: number): number[] {
  if (values.length === targetLen) return values;
  if (values.length > targetLen) return values.slice(-targetLen);
  return [...Array(targetLen - values.length).fill(0), ...values];
}

function splitMetricIds(metricIds: Ga4MetricId[]): {
  standard: Ga4StandardMetricId[];
  events: Ga4EventMetricId[];
} {
  return {
    standard: metricIds.filter((id) =>
      GA4_METRICS.some((m) => m.id === id)
    ) as Ga4StandardMetricId[],
    events: metricIds.filter((id) =>
      GA4_EVENT_METRICS.some((m) => m.id === id)
    ) as Ga4EventMetricId[],
  };
}

function phoneClickEventName(company: CompanyConfig): string {
  const envKey = `GA4_${company.id.toUpperCase().replace(/-/g, "_")}_PHONE_CLICK_EVENT`;
  return (
    process.env[envKey] ??
    company.ga4PhoneClickEvent ??
    GA4_EVENT_METRICS.find((m) => m.id === "phoneClicks")?.eventName ??
    "phone_click"
  );
}

async function fetchGa4StandardReport(
  propertyId: string,
  range: { startDate: string; endDate: string; dimension: string },
  metricIds: Ga4StandardMetricId[]
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
  const dim = dimension as "date" | "yearMonth";
  const expectedKeys = listDimensionKeysInRange(startDate, endDate, dim);
  const rowByKey = new Map(
    rows.map((r) => [r.dimensionValues?.[0]?.value ?? "", r])
  );

  const dimensionKeys =
    expectedKeys.length > 0
      ? expectedKeys
      : rows.map((r) => r.dimensionValues?.[0]?.value ?? "");
  const dateLabels = dimensionKeys.map((key) => formatDateLabel(key, dimension));
  const series: Ga4Series[] = validMetrics.map((m, idx) => {
    const def = GA4_METRICS.find((d) => d.id === m.name);
    return {
      id: m.name,
      label: def?.label ?? m.name,
      values: dimensionKeys.map((key) => {
        const row = rowByKey.get(key);
        const v = row?.metricValues?.[idx]?.value ?? "0";
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
    dimensionKeys,
    series,
    startDate,
    endDate,
  };
}

async function fetchGa4PhoneClickRealtimeCount(
  propertyId: string,
  eventName: string
): Promise<number | undefined> {
  try {
    const client = await getGa4Client();
    const [response] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: eventName },
        },
      },
    });
    const v = response.rows?.[0]?.metricValues?.[0]?.value;
    return v != null ? Math.round(parseFloat(v)) : 0;
  } catch {
    return undefined;
  }
}

async function fetchGa4EventSeries(
  propertyId: string,
  range: { startDate: string; endDate: string; dimension: string },
  eventMetricId: Ga4EventMetricId,
  eventName: string
): Promise<{ series: Ga4Series; countsByDimension: Map<string, number> }> {
  const client = await getGa4Client();
  const { startDate, endDate, dimension } = range;
  const def = GA4_EVENT_METRICS.find((m) => m.id === eventMetricId);

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: dimension }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: eventName },
      },
    },
    orderBys: [{ dimension: { dimensionName: dimension } }],
  });

  const rows = response.rows ?? [];
  const countsByDimension = new Map<string, number>();
  for (const r of rows) {
    const key = r.dimensionValues?.[0]?.value ?? "";
    countsByDimension.set(
      key,
      Math.round(parseFloat(r.metricValues?.[0]?.value ?? "0"))
    );
  }
  return {
    series: {
      id: eventMetricId,
      label: def?.label ?? eventMetricId,
      values: [],
      format: "number",
    },
    countsByDimension,
  };
}

async function fetchGa4Report(
  propertyId: string,
  range: { startDate: string; endDate: string; dimension: string },
  metricIds: Ga4MetricId[],
  company: CompanyConfig
): Promise<Ga4LiveData> {
  const { standard, events } = splitMetricIds(metricIds);
  const primary = await fetchGa4StandardReport(propertyId, range, standard);

  if (events.length === 0) {
    return primary;
  }

  const eventSeriesList: Ga4Series[] = [];
  let phoneClickMeta: Ga4LiveData["phoneClicks"];

  for (const eventMetricId of events) {
    const eventName =
      eventMetricId === "phoneClicks" ? phoneClickEventName(company) : "phone_click";
    const { series, countsByDimension } = await fetchGa4EventSeries(
      propertyId,
      range,
      eventMetricId,
      eventName
    );
    const keys = primary.dimensionKeys ?? [];
    eventSeriesList.push({
      ...series,
      values: keys.map((key) => countsByDimension.get(key) ?? 0),
    });

    if (eventMetricId === "phoneClicks") {
      const realtimeCount = await fetchGa4PhoneClickRealtimeCount(propertyId, eventName);
      phoneClickMeta = { eventName, realtimeCount };
    }
  }

  return {
    ...primary,
    series: [...primary.series, ...eventSeriesList],
    phoneClicks: phoneClickMeta,
  };
}

function mergeComparisonSeries(
  current: Ga4LiveData,
  previous: Ga4LiveData
): Ga4LiveData {
  const targetLen = current.dateLabels.length;

  const merged: Ga4Series[] = current.series.map((s) => {
    const prevS = previous.series.find((p) => p.id === s.id);
    const valuesPrevious = prevS
      ? alignSeriesToLength(prevS.values, targetLen)
      : undefined;
    return {
      ...s,
      values: alignSeriesToLength(s.values, targetLen),
      valuesPrevious,
    };
  });

  return {
    ...current,
    dateLabels: current.dateLabels.slice(-targetLen),
    dimensionKeys: current.dimensionKeys?.slice(-targetLen),
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
  const metricsParam =
    searchParams.get("metrics") ?? GA4_SELECTABLE_METRICS.map((m) => m.id).join(",");
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

      let ga4 = await fetchGa4Report(propertyId, range1, metricIds, company);
      ga4 = {
        ...ga4,
        dateRange: primary.label,
      };

      if (compare) {
        const prev = previousPeriodRange(primary.startDate, primary.endDate);
        const prevRange = { ...prev, dimension: primary.dimension };
        const ga4Prev = await fetchGa4Report(propertyId, prevRange, metricIds, company);
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
