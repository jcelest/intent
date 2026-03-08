/**
 * Shared types for analytics API responses.
 * Supports both mock (before/after) and live (current-only) data.
 */

export type MetricsBeforeAfter = {
  before: number[];
  after: number[];
};

export type MetricsCurrent = {
  /** Last 12 months of values (oldest to newest) */
  current: number[];
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
  /** When GA4 is not configured for a live company */
  error?: string;
};
