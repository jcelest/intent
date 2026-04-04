import { GoogleAdsApi, enums, services, common } from "google-ads-api";
import { GEO_PRESETS, type GeoPresetKey } from "@/lib/google-ads-geo-presets";

export type { GeoPresetKey } from "@/lib/google-ads-geo-presets";

const LANGUAGE_EN = "languageConstants/1000";

export type KeywordIdeaRow = {
  text: string;
  avgMonthlySearches: number | null;
  competition: string;
  competitionIndex: number | null;
  monthlyVolumes: { year: number; month: string; searches: number }[];
};

export type GeoBreakdownRow = {
  region: string;
  avgMonthlySearches: number | null;
  share: number;
  index: number;
};

export type KeywordResearchResult = {
  source: "google_ads";
  seedKeyword: string;
  geoLabel: string;
  ideas: KeywordIdeaRow[];
  primary: KeywordIdeaRow | null;
  geoBreakdown: GeoBreakdownRow[];
  yoyTrendPercent: string | null;
};

function stripCustomerId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/-/g, "").trim();
}

function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      stripCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID)
  );
}

export function googleAdsKeywordResearchConfigured(): boolean {
  return isGoogleAdsConfigured();
}

function competitionLabel(
  level: enums.KeywordPlanCompetitionLevel | number | string | null | undefined
): string {
  if (level === null || level === undefined) return "—";
  const n = typeof level === "number" ? level : Number(level);
  switch (n) {
    case enums.KeywordPlanCompetitionLevel.LOW:
      return "Low";
    case enums.KeywordPlanCompetitionLevel.MEDIUM:
      return "Medium";
    case enums.KeywordPlanCompetitionLevel.HIGH:
      return "High";
    default:
      return "Unknown";
  }
}

const MONTH_NAMES = [
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

function mapMonthlyVolumes(
  volumes: common.IMonthlySearchVolume[] | null | undefined
): { year: number; month: string; searches: number }[] {
  if (!volumes?.length) return [];
  return volumes.map((v) => {
    const monthNum = Number(v.month ?? 1);
    const idx = Math.min(Math.max(monthNum - 1, 0), 11);
    return {
      year: Number(v.year ?? 0),
      month: MONTH_NAMES[idx] ?? String(v.month),
      searches: Number(v.monthly_searches ?? 0),
    };
  });
}

function mapIdeaRow(r: services.IGenerateKeywordIdeaResult): KeywordIdeaRow {
  const m = r.keyword_idea_metrics;
  return {
    text: r.text ?? "",
    avgMonthlySearches: m?.avg_monthly_searches ?? null,
    competition: competitionLabel(m?.competition),
    competitionIndex: m?.competition_index ?? null,
    monthlyVolumes: mapMonthlyVolumes(m?.monthly_search_volumes),
  };
}

function computeYoy(monthly: { year: number; month: string; searches: number }[]): string | null {
  if (monthly.length < 12) return null;
  const sorted = [...monthly].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month);
  });
  const last = sorted[sorted.length - 1];
  const priorYear = sorted.find(
    (x) => x.month === last.month && x.year === last.year - 1
  );
  if (!priorYear?.searches || !last.searches) return null;
  const pct = Math.round(((last.searches - priorYear.searches) / priorYear.searches) * 100);
  if (!Number.isFinite(pct)) return null;
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function pickPrimary(ideas: KeywordIdeaRow[], seed: string): KeywordIdeaRow | null {
  const s = seed.trim().toLowerCase();
  const exact = ideas.find((i) => i.text.toLowerCase() === s);
  if (exact) return exact;
  return ideas[0] ?? null;
}

export async function runKeywordResearch(
  keyword: string,
  geoKey: GeoPresetKey
): Promise<KeywordResearchResult> {
  if (!isGoogleAdsConfigured()) {
    throw new Error("Google Ads API is not configured");
  }

  const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID!;
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
  const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN!;
  const customer_id = stripCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID)!;
  const login_customer_id = stripCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  const client = new GoogleAdsApi({
    client_id,
    client_secret,
    developer_token,
  });

  const customer = client.Customer({
    customer_id,
    refresh_token,
    login_customer_id: login_customer_id || undefined,
  });

  const preset = GEO_PRESETS[geoKey];

  const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id,
    language: LANGUAGE_EN,
    geo_target_constants: [...preset.constants],
    keyword_seed: { keywords: [keyword.trim()] },
    keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
    include_adult_keywords: false,
    page_size: 100,
  } as never);

  const raw = response.results ?? [];
  const ideas = raw.map(mapIdeaRow).filter((r) => r.text.length > 0);
  const primary = pickPrimary(ideas, keyword);
  const yoyTrendPercent = primary ? computeYoy(primary.monthlyVolumes) : null;

  /** One row for the selected geo — avoids 4+ extra API calls (Vercel timeout / 502). */
  const geoBreakdown: GeoBreakdownRow[] =
    primary?.avgMonthlySearches != null
      ? [
          {
            region: preset.label,
            avgMonthlySearches: primary.avgMonthlySearches,
            share: 100,
            index: 100,
          },
        ]
      : [];

  return {
    source: "google_ads",
    seedKeyword: keyword.trim(),
    geoLabel: preset.label,
    ideas,
    primary,
    geoBreakdown,
    yoyTrendPercent,
  };
}
