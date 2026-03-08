/**
 * Shared types for analytics API responses.
 * Supports both mock (before/after) and live (current-only) data.
 */

export type MetricsBeforeAfter = {
  before: number[];
  after: number[];
};

export type MetricsCurrent = {
  /** Values over time (oldest to newest) */
  current: number[];
};

/** GA4 metric config — id = API name, label = display name, format = how to render */
export const GA4_METRICS = [
  { id: "sessions", label: "Sessions", format: "number" as const },
  { id: "activeUsers", label: "Users", format: "number" as const },
  { id: "screenPageViews", label: "Page views", format: "number" as const },
  { id: "bounceRate", label: "Bounce rate", format: "percent" as const },
  { id: "engagementRate", label: "Engagement rate", format: "percent" as const },
  { id: "conversions", label: "Conversions", format: "number" as const },
] as const;

export type Ga4MetricId = (typeof GA4_METRICS)[number]["id"];

/** Date range options aligned with GA4 */
export const GA4_DATE_RANGES = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "28d", label: "Last 28 days", days: 28 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "12m", label: "Last 12 months", days: 365 },
] as const;

export type Ga4DateRangeId = (typeof GA4_DATE_RANGES)[number]["id"];

export type Ga4Series = {
  id: string;
  label: string;
  values: number[];
  format: "number" | "percent";
};

export type Ga4LiveData = {
  dateRange: string;
  dateLabels: string[];
  series: Ga4Series[];
};

export type AnalyticsResponse = {
  id: string;
  name: string;
  joinedDate: string;
  accentColor: string;
  chartLayout: "area-dominant" | "bar-dominant" | "mixed" | "compact";
  isLive: boolean;
  url?: string;
  metrics: {
    revenue?: MetricsBeforeAfter;
    traffic: MetricsBeforeAfter | MetricsCurrent;
    leads?: MetricsBeforeAfter;
    conversionRate?: { before: number; after: number };
    aiCalls?: { before: number; after: number };
  };
  /** Live GA4 data when dateRange/metrics params used */
  ga4?: Ga4LiveData;
  /** When GA4 is not configured for a live company */
  error?: string;
};
