import { OAuth2Client } from "google-auth-library";
import {
  GEO_PRESETS,
  isBreakdownPreset,
  type GeoPresetKey,
} from "@/lib/google-ads-geo-presets";

export type { GeoPresetKey } from "@/lib/google-ads-geo-presets";

const LANGUAGE_EN = "languageConstants/1000";
const GOOGLE_ADS_API_VERSION = "v23";

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
  /**
   * Time span covered by the monthly search-volume series (from Keyword Planner historical metrics).
   * Avg. monthly searches is an average over these months, not a single month.
   */
  metricsTimeframe: {
    /** e.g. "Mar 2024 – Feb 2025" */
    label: string;
    startMonth: string;
    endMonth: string;
  } | null;
  /** Helps debug empty responses; always set from the raw API message */
  meta: {
    apiResultCount: number;
    totalSize: number | null;
    /** Extra per-city GenerateKeywordIdeas calls (e.g. Central Florida preset). */
    breakdownCalls?: number;
  };
};

/** One line in the debug trace (also emitted to runtime logs when debug is on). */
export type KeywordResearchDebugEvent = {
  at: string;
  step: string;
  message?: string;
  data?: Record<string, unknown>;
};

export class KeywordResearchDebugError extends Error {
  readonly debugEvents: KeywordResearchDebugEvent[];

  constructor(
    message: string,
    debugEvents: KeywordResearchDebugEvent[],
    options?: { cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "KeywordResearchDebugError";
    this.debugEvents = debugEvents;
  }
}

function maskCustomerId(id: string): string {
  if (id.length <= 6) return "****";
  return `${id.slice(0, 3)}…${id.slice(-4)}`;
}

function makeDebugLogger(enabled: boolean) {
  const events: KeywordResearchDebugEvent[] = [];
  const push = (step: string, message?: string, data?: Record<string, unknown>) => {
    if (!enabled) return;
    const ev: KeywordResearchDebugEvent = {
      at: new Date().toISOString(),
      step,
      ...(message !== undefined && message !== "" ? { message } : {}),
      ...(data !== undefined ? { data } : {}),
    };
    events.push(ev);
    console.info("[keyword-research]", JSON.stringify(ev));
  };
  return { events, push };
}

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

/** REST + proto JSON may use numeric enums or string names. */
function competitionLabel(
  level: string | number | null | undefined
): string {
  if (level === null || level === undefined) return "—";
  if (typeof level === "string") {
    const u = level.toUpperCase();
    if (u.includes("LOW")) return "Low";
    if (u.includes("MEDIUM")) return "Medium";
    if (u.includes("HIGH")) return "High";
  }
  const n = Number(level);
  switch (n) {
    case 1:
      return "Low";
    case 2:
      return "Medium";
    case 3:
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

const MONTH_NAME_ALIASES: Record<string, number> = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};

type RestMonthlySearchVolume = {
  month?: string | number | null;
  year?: number | string | null;
  monthlySearches?: number | string | null;
  monthly_searches?: number | string | null;
};

type RestKeywordIdeaMetrics = {
  avgMonthlySearches?: number | string | null;
  avg_monthly_searches?: number | string | null;
  competition?: string | number | null;
  competitionIndex?: number | string | null;
  competition_index?: number | string | null;
  monthlySearchVolumes?: RestMonthlySearchVolume[] | null;
  monthly_search_volumes?: RestMonthlySearchVolume[] | null;
};

type RestGenerateKeywordIdeaResult = {
  text?: string | null;
  keywordIdeaMetrics?: RestKeywordIdeaMetrics | null;
  keyword_idea_metrics?: RestKeywordIdeaMetrics | null;
};

type RestGenerateKeywordIdeaResponse = {
  results?: RestGenerateKeywordIdeaResult[] | null;
  totalSize?: number | string | null;
  total_size?: number | string | null;
};

function mapMonthlyVolumes(
  volumes: RestMonthlySearchVolume[] | null | undefined
): { year: number; month: string; searches: number }[] {
  if (!volumes?.length) return [];
  return volumes.map((v) => {
    let monthNum = 1;
    const rawMonth = v.month;
    if (typeof rawMonth === "number" && rawMonth >= 1 && rawMonth <= 12) {
      monthNum = rawMonth;
    } else if (typeof rawMonth === "string") {
      const key = rawMonth.trim().toUpperCase();
      if (MONTH_NAME_ALIASES[key] != null) {
        monthNum = MONTH_NAME_ALIASES[key];
      } else {
        const n = Number(rawMonth);
        if (n >= 1 && n <= 12) monthNum = n;
      }
    }
    const idx = Math.min(Math.max(monthNum - 1, 0), 11);
    const searches = Number(
      v.monthlySearches ?? v.monthly_searches ?? 0
    );
    return {
      year: Number(v.year ?? 0),
      month: MONTH_NAMES[idx] ?? String(rawMonth),
      searches,
    };
  });
}

function mapRestIdeaRow(r: RestGenerateKeywordIdeaResult): KeywordIdeaRow {
  const m = r.keywordIdeaMetrics ?? r.keyword_idea_metrics;
  const volumes = m?.monthlySearchVolumes ?? m?.monthly_search_volumes;
  return {
    text: r.text ?? "",
    avgMonthlySearches:
      m?.avgMonthlySearches != null
        ? Number(m.avgMonthlySearches)
        : m?.avg_monthly_searches != null
          ? Number(m.avg_monthly_searches)
          : null,
    competition: competitionLabel(m?.competition),
    competitionIndex:
      m?.competitionIndex != null
        ? Number(m.competitionIndex)
        : m?.competition_index != null
          ? Number(m.competition_index)
          : null,
    monthlyVolumes: mapMonthlyVolumes(volumes ?? undefined),
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

/** Normalize seed for the API (slashes in e.g. "a/c" can yield sparse results). */
function normalizeSeedKeyword(keyword: string): string {
  return keyword.trim().replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ");
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (typeof token !== "string") {
    throw new Error("Failed to retrieve Google OAuth access token");
  }
  return token;
}

function parseTotalSize(json: RestGenerateKeywordIdeaResponse): number | null {
  const v = json.totalSize ?? json.total_size;
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse `retryDelay` from Google Ads quota error JSON (e.g. `"4s"` → 4000). */
function parseQuotaRetryDelayMs(rawText: string): number | null {
  try {
    const parsed = JSON.parse(rawText) as {
      error?: {
        details?: Array<{
          errors?: Array<{
            details?: { quotaErrorDetails?: { retryDelay?: string } };
          }>;
        }>;
      };
    };
    const details = parsed.error?.details;
    if (!Array.isArray(details)) return null;
    for (const d of details) {
      const errs = (d as { errors?: unknown[] }).errors;
      if (!Array.isArray(errs)) continue;
      for (const e of errs) {
        const qed = (e as { details?: { quotaErrorDetails?: { retryDelay?: string } } })?.details
          ?.quotaErrorDetails;
        const rd = qed?.retryDelay;
        if (typeof rd === "string") {
          const m = /^(\d+(?:\.\d+)?)s$/i.exec(rd.trim());
          if (m) {
            const sec = Number(m[1]);
            if (Number.isFinite(sec) && sec >= 0) return Math.round(sec * 1000);
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Space between per-city GenerateKeywordIdeas calls to reduce burst 429s (Central Florida, etc.). */
const BREAKDOWN_REQUEST_GAP_MS = 750;

function monthRank(month: string): number {
  const i = MONTH_NAMES.indexOf(month);
  return i >= 0 ? i : 0;
}

/** Derive display range from Keyword Planner monthly rows (API returns recent months with search volume). */
export function computeMetricsTimeframe(
  monthly: { year: number; month: string }[]
): KeywordResearchResult["metricsTimeframe"] {
  if (!monthly.length) return null;
  const sorted = [...monthly].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return monthRank(a.month) - monthRank(b.month);
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startMonth = `${first.month} ${first.year}`;
  const endMonth = `${last.month} ${last.year}`;
  return {
    label: `${startMonth} – ${endMonth}`,
    startMonth,
    endMonth,
  };
}

function applyShareAndIndex(rows: GeoBreakdownRow[]): void {
  const vols = rows
    .map((r) => r.avgMonthlySearches)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const sum = vols.reduce((a, b) => a + b, 0);
  const max = Math.max(...vols, 1);
  for (const row of rows) {
    const v = row.avgMonthlySearches;
    if (v == null || Number.isNaN(v)) {
      row.share = 0;
      row.index = 0;
      continue;
    }
    row.share = sum > 0 ? Math.round((v / sum) * 100) : 0;
    row.index = Math.round((v / max) * 100);
  }
}

export type RunKeywordResearchOptions = {
  /** When true, collects `debugEvents` and logs each step to runtime logs (e.g. Vercel). */
  debug?: boolean;
};

export async function runKeywordResearch(
  keyword: string,
  geoKey: GeoPresetKey,
  options?: RunKeywordResearchOptions
): Promise<KeywordResearchResult & { debugEvents?: KeywordResearchDebugEvent[] }> {
  const dbg = Boolean(options?.debug);
  const { events, push } = makeDebugLogger(dbg);

  const fail = (message: string, cause?: unknown): never => {
    push("request.error", message, {
      cause: cause instanceof Error ? cause.message : undefined,
    });
    if (dbg) {
      throw new KeywordResearchDebugError(message, events, { cause });
    }
    if (cause instanceof Error) throw cause;
    throw new Error(message);
  };

  try {
    if (!isGoogleAdsConfigured()) {
      fail("Google Ads API is not configured");
    }

    const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
    const client_id = process.env.GOOGLE_ADS_CLIENT_ID!;
    const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
    const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN!;
    const customer_id = stripCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID)!;
    const login_customer_id = stripCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

    const preset = GEO_PRESETS[geoKey];
    const seed = normalizeSeedKeyword(keyword);

    push("request.start", undefined, {
      flow:
        "POST /api/google-ads/keyword-research → runKeywordResearch → OAuth access token → REST generateKeywordIdeas → JSON to frontend (ideas, primary, meta).",
      keywordIn: keyword,
      seedNormalized: seed,
      geoKey,
      geoLabel: preset.label,
      customerIdMasked: maskCustomerId(customer_id),
      hasLoginCustomerId: Boolean(login_customer_id),
      loginCustomerIdMasked: login_customer_id ? maskCustomerId(login_customer_id) : null,
      apiVersion: GOOGLE_ADS_API_VERSION,
    });

    push("oauth.start", "Requesting access token from google-auth-library (refresh token).");
    const accessToken = await getAccessToken(client_id, client_secret, refresh_token).catch(
      (e) =>
        fail(
          e instanceof Error ? e.message : "OAuth access token failed",
          e
        )
    );
    push("oauth.complete", undefined, {
      accessTokenChars: accessToken.length,
      note: "Bearer token is never logged in full.",
    });

    const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customer_id}:generateKeywordIdeas`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developer_token,
      "Content-Type": "application/json",
    };
    if (login_customer_id) {
      headers["login-customer-id"] = login_customer_id;
    }

    const headerNames = ["Authorization", "developer-token", "Content-Type"].concat(
      login_customer_id ? ["login-customer-id"] : []
    );

    const doOneCall = async (
      geoTargetConstants: string[],
      stepLabel: string
    ): Promise<RestGenerateKeywordIdeaResponse> => {
      const body = {
        language: LANGUAGE_EN,
        geoTargetConstants,
        keywordSeed: { keywords: [seed] },
        keywordPlanNetwork: "GOOGLE_SEARCH",
        includeAdultKeywords: false,
        pageSize: 100,
      };

      const max429Attempts = 6;
      let lastRaw = "";
      let lastStatus = 0;

      for (let attempt = 1; attempt <= max429Attempts; attempt++) {
        push("api.request", undefined, {
          step: stepLabel,
          method: "POST",
          url,
          headersSent: headerNames,
          body,
          ...(attempt > 1 ? { retryAttempt: attempt } : {}),
        });

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const rawText = await res.text();
        lastRaw = rawText;
        lastStatus = res.status;
        push("api.response", undefined, {
          step: stepLabel,
          httpStatus: res.status,
          ok: res.ok,
          responseBodyBytes: rawText.length,
          bodyPreview: rawText.slice(0, stepLabel.startsWith("breakdown:") ? 800 : 1200),
        });

        let json: RestGenerateKeywordIdeaResponse;
        try {
          json = JSON.parse(rawText) as RestGenerateKeywordIdeaResponse;
        } catch (parseErr) {
          return fail(
            rawText.trim().slice(0, 400) || `Google Ads API HTTP ${res.status}`,
            parseErr
          );
        }

        if (res.ok) {
          return json;
        }

        const errObj = json as unknown as {
          error?: { message?: string; status?: string; code?: number };
        };
        push("api.googleError", undefined, {
          step: stepLabel,
          httpStatus: res.status,
          googleError: errObj.error ?? null,
        });

        if (res.status === 429 && attempt < max429Attempts) {
          const fromApi = parseQuotaRetryDelayMs(rawText);
          const waitMs = fromApi ?? Math.min(4000 * attempt, 30_000);
          push("api.rateLimit.retry", undefined, {
            step: stepLabel,
            waitMs,
            attempt,
            nextAttempt: attempt + 1,
          });
          await sleep(waitMs);
          continue;
        }

        const msg =
          errObj.error?.message ||
          rawText.trim().slice(0, 500) ||
          `Google Ads API HTTP ${res.status}`;
        const e = new Error(msg);
        (e as { googleAdsHttpStatus?: number }).googleAdsHttpStatus = res.status;
        if (dbg) {
          throw new KeywordResearchDebugError(msg, events, { cause: e });
        }
        throw e;
      }

      const msg =
        lastRaw.trim().slice(0, 500) || `Google Ads API HTTP ${lastStatus} (retries exhausted)`;
      const e = new Error(msg);
      (e as { googleAdsHttpStatus?: number }).googleAdsHttpStatus = lastStatus;
      if (dbg) {
        throw new KeywordResearchDebugError(msg, events, { cause: e });
      }
      throw e;
    };

    let ideas: KeywordIdeaRow[];
    let primary: KeywordIdeaRow | null;
    let yoyTrendPercent: string | null;
    let geoBreakdown: GeoBreakdownRow[];
    let meta: KeywordResearchResult["meta"];

    if (isBreakdownPreset(preset)) {
      const jsonCombined = await doOneCall(
        [...preset.constants],
        "combined-ideas"
      );
      const raw = Array.isArray(jsonCombined.results) ? jsonCombined.results : [];
      ideas = raw.map(mapRestIdeaRow).filter((r) => r.text.length > 0);
      primary = pickPrimary(ideas, seed);
      yoyTrendPercent = primary ? computeYoy(primary.monthlyVolumes) : null;

      geoBreakdown = [];
      for (let i = 0; i < preset.breakdownCities.length; i++) {
        if (i > 0) {
          await sleep(BREAKDOWN_REQUEST_GAP_MS);
        }
        const city = preset.breakdownCities[i];
        const j = await doOneCall(
          [...city.constants],
          `breakdown:${city.label}`
        );
        const r = Array.isArray(j.results) ? j.results : [];
        const ideaRows = r.map(mapRestIdeaRow).filter((row) => row.text.length > 0);
        const pr = pickPrimary(ideaRows, seed);
        geoBreakdown.push({
          region: city.label,
          avgMonthlySearches: pr?.avgMonthlySearches ?? null,
          share: 0,
          index: 0,
        });
      }
      applyShareAndIndex(geoBreakdown);

      push("parse.complete", undefined, {
        rawResultsFromGoogle: raw.length,
        ideasAfterNonEmptyTextFilter: ideas.length,
        primaryKeywordText: primary?.text ?? null,
        totalSize: parseTotalSize(jsonCombined),
        breakdownCities: preset.breakdownCities.length,
      });

      meta = {
        apiResultCount: raw.length,
        totalSize: parseTotalSize(jsonCombined),
        breakdownCalls: preset.breakdownCities.length,
      };
    } else {
      const json = await doOneCall([...preset.constants], "single-geo");
      const raw = Array.isArray(json.results) ? json.results : [];
      ideas = raw.map(mapRestIdeaRow).filter((r) => r.text.length > 0);
      primary = pickPrimary(ideas, seed);
      yoyTrendPercent = primary ? computeYoy(primary.monthlyVolumes) : null;

      push("parse.complete", undefined, {
        rawResultsFromGoogle: raw.length,
        ideasAfterNonEmptyTextFilter: ideas.length,
        primaryKeywordText: primary?.text ?? null,
        totalSize: parseTotalSize(json),
      });

      geoBreakdown =
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

      meta = {
        apiResultCount: raw.length,
        totalSize: parseTotalSize(json),
      };
    }

    push("request.complete", undefined, {
      responseToFrontend: {
        ideasCount: ideas.length,
        hasPrimary: primary != null,
        hasGeoBreakdown: geoBreakdown.length > 0,
        meta,
      },
    });

    const result: KeywordResearchResult = {
      source: "google_ads",
      seedKeyword: seed,
      geoLabel: preset.label,
      ideas,
      primary,
      geoBreakdown,
      yoyTrendPercent,
      metricsTimeframe: computeMetricsTimeframe(primary?.monthlyVolumes ?? []),
      meta,
    };

    return dbg ? { ...result, debugEvents: events } : result;
  } catch (e) {
    if (e instanceof KeywordResearchDebugError) throw e;
    if (dbg) {
      const msg = e instanceof Error ? e.message : String(e);
      push("request.error", msg);
      throw new KeywordResearchDebugError(msg, events, {
        cause: e instanceof Error ? e : undefined,
      });
    }
    throw e;
  }
}
