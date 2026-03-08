import { NextResponse } from "next/server";
import { getCompany } from "@/lib/companies";
import type { AnalyticsResponse } from "@/lib/analytics-types";

async function fetchGa4Traffic(propertyId: string): Promise<number[]> {
  const creds = process.env.GA4_CREDENTIALS_JSON;
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!creds && !credsPath) {
    throw new Error("GA4_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS not set");
  }

  const { BetaAnalyticsDataClient } = await import("@google-analytics/data");

  const client = new BetaAnalyticsDataClient(
    creds ? { credentials: JSON.parse(creds) } : undefined
  );

  const now = new Date();
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 12);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: startStr, endDate }],
    dimensions: [{ name: "yearMonth" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "yearMonth" } }],
  });

  const rows = response.rows ?? [];
  const last12 = rows.slice(-12);
  const monthlySessions = last12.map((row) =>
    Number(row.metricValues?.[0]?.value ?? 0)
  );
  while (monthlySessions.length < 12) {
    monthlySessions.unshift(0);
  }
  return monthlySessions;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
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
          metrics: {
            traffic: { current: [] },
          },
          error: `GA4 not configured. Set GA4_NOVATION_HVAC_PROPERTY_ID (and GA4_CREDENTIALS_JSON) in .env.local`,
        } as AnalyticsResponse,
        { status: 200 }
      );
    }

    try {
      const trafficCurrent = await fetchGa4Traffic(propertyId);

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
          conversionRate: undefined,
          aiCalls: undefined,
        },
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
