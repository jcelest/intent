/**
 * Central company config for the admin analytics hub.
 * Add new companies here — use dataSource: "mock" for demo data,
 * or dataSource: "live" with ga4PropertyId for real GA4 metrics.
 */

export const ACCENT_COLORS = {
  cyan: "#00e5ff",
  emerald: "#34d399",
  amber: "#fbbf24",
  violet: "#a78bfa",
} as const;

export type ChartLayout = "area-dominant" | "bar-dominant" | "mixed" | "compact";

export type CompanyConfig = {
  id: string;
  name: string;
  url?: string;
  joinedDate: string;
  accentColor: string;
  chartLayout: ChartLayout;
  dataSource: "mock" | "live";
  /** Mock metrics — only used when dataSource: "mock" */
  mockMetrics?: {
    revenue: { before: number[]; after: number[] };
    traffic: { before: number[]; after: number[] };
    leads: { before: number[]; after: number[] };
    conversionRate: { before: number; after: number };
    aiCalls: { before: number; after: number };
  };
};

export const COMPANIES: CompanyConfig[] = [
  // —— LIVE: Real analytics from GA4 ——
  {
    id: "novation-hvac",
    name: "Novation Heating and Air Conditioning",
    url: "https://novationhvac.com",
    joinedDate: "2024-10",
    accentColor: ACCENT_COLORS.cyan,
    chartLayout: "area-dominant",
    dataSource: "live",
  },
  // —— MOCK: Demo data ——
  {
    id: "acme-plumbing",
    name: "Acme Plumbing Co.",
    joinedDate: "2024-01",
    accentColor: ACCENT_COLORS.cyan,
    chartLayout: "area-dominant",
    dataSource: "mock",
    mockMetrics: {
      revenue: {
        before: [38, 42, 48, 52, 45, 58, 62, 68, 72, 78, 82, 88],
        after: [88, 95, 108, 115, 102, 128, 135, 148, 158, 168, 175, 192],
      },
      traffic: {
        before: [980, 1120, 1250, 1380, 1180, 1520, 1650, 1780, 1920, 2050, 2180, 2350],
        after: [2350, 2520, 2850, 3020, 2680, 3320, 3480, 3720, 3980, 4220, 4450, 4780],
      },
      leads: {
        before: [6, 9, 11, 14, 10, 16, 18, 22, 24, 26, 28, 32],
        after: [32, 38, 45, 52, 42, 62, 68, 78, 85, 92, 98, 108],
      },
      conversionRate: { before: 18, after: 42 },
      aiCalls: { before: 0, after: 1247 },
    },
  },
  {
    id: "summit-dental",
    name: "Summit Dental Group",
    joinedDate: "2024-03",
    accentColor: ACCENT_COLORS.emerald,
    chartLayout: "bar-dominant",
    dataSource: "mock",
    mockMetrics: {
      revenue: {
        before: [32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 55],
        after: [55, 58, 62, 68, 72, 78, 85, 92, 98, 105, 112, 118],
      },
      traffic: {
        before: [720, 780, 820, 880, 920, 950, 980, 1020, 1050, 1080, 1120, 1180],
        after: [1180, 1250, 1320, 1420, 1520, 1620, 1720, 1820, 1920, 2020, 2120, 2250],
      },
      leads: {
        before: [4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 12, 14],
        after: [14, 16, 18, 22, 25, 28, 32, 36, 40, 44, 48, 55],
      },
      conversionRate: { before: 22, after: 38 },
      aiCalls: { before: 0, after: 892 },
    },
  },
  {
    id: "metro-auto",
    name: "Metro Auto Services",
    joinedDate: "2024-06",
    accentColor: ACCENT_COLORS.amber,
    chartLayout: "mixed",
    dataSource: "mock",
    mockMetrics: {
      revenue: {
        before: [72, 68, 78, 85, 92, 88, 95, 102, 108, 115, 112, 118],
        after: [118, 128, 142, 155, 168, 162, 178, 192, 205, 218, 225, 242],
      },
      traffic: {
        before: [1850, 1920, 2050, 2180, 2320, 2250, 2420, 2580, 2720, 2850, 2780, 2950],
        after: [2950, 3180, 3420, 3680, 3920, 3820, 4080, 4320, 4580, 4820, 4950, 5220],
      },
      leads: {
        before: [22, 24, 28, 32, 35, 30, 38, 42, 45, 48, 44, 52],
        after: [52, 58, 65, 72, 78, 72, 85, 92, 98, 105, 102, 115],
      },
      conversionRate: { before: 14, after: 28 },
      aiCalls: { before: 0, after: 2156 },
    },
  },
  {
    id: "green-valley-law",
    name: "Green Valley Law Firm",
    joinedDate: "2024-09",
    accentColor: ACCENT_COLORS.violet,
    chartLayout: "compact",
    dataSource: "mock",
    mockMetrics: {
      revenue: {
        before: [22, 24, 26, 28, 30, 28, 32, 34, 36, 38, 35, 42],
        after: [42, 52, 62, 72, 82, 78, 92, 105, 118, 128, 135, 148],
      },
      traffic: {
        before: [380, 420, 450, 480, 520, 490, 550, 580, 620, 650, 620, 720],
        after: [720, 850, 980, 1120, 1250, 1180, 1350, 1520, 1680, 1820, 1920, 2080],
      },
      leads: {
        before: [6, 8, 9, 11, 12, 10, 14, 15, 17, 18, 16, 22],
        after: [22, 32, 42, 52, 58, 55, 68, 78, 88, 95, 102, 112],
      },
      conversionRate: { before: 8, after: 38 },
      aiCalls: { before: 0, after: 534 },
    },
  },
];

export function getCompany(id: string): CompanyConfig | undefined {
  return COMPANIES.find((c) => c.id === id);
}
