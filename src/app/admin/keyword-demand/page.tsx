"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  GEO_PRESETS,
  GEO_PRESET_ORDER,
  type GeoPresetKey,
} from "@/lib/google-ads-geo-presets";

/** Fallback sample rows when Google Ads env is not configured */
const MOCK_GEO_ROWS = [
  { region: "Florida — Miami-Fort Lauderdale", share: 28, index: 100, vol: "12.4K–15.1K" },
  { region: "Florida — Orlando-Kissimmee-Sanford", share: 22, index: 92, vol: "9.8K–11.2K" },
  { region: "Florida — Tampa-St. Petersburg", share: 18, index: 88, vol: "8.1K–9.4K" },
  { region: "Georgia — Atlanta", share: 9, index: 71, vol: "4.0K–5.2K" },
  { region: "Texas — Dallas-Fort Worth", share: 7, index: 65, vol: "3.1K–4.0K" },
  { region: "Other U.S.", share: 16, index: 54, vol: "6.2K–8.0K" },
];

const MOCK_RELATED = [
  { keyword: "emergency ac repair", vol: "8.2K–10.0K", comp: "High" },
  { keyword: "ac repair near me", vol: "14.1K–17.3K", comp: "High" },
  { keyword: "hvac repair", vol: "33.1K–40.5K", comp: "High" },
  { keyword: "central ac not cooling", vol: "2.4K–3.0K", comp: "Medium" },
];

const MOCK_TREND = [42, 38, 45, 51, 48, 55, 52, 61, 58, 64, 59, 67];

async function readApiJson<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      text.trim().slice(0, 240) || `Unexpected response (HTTP ${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

type LiveIdea = {
  text: string;
  avgMonthlySearches: number | null;
  competition: string;
  competitionIndex: number | null;
  monthlyVolumes: { year: number; month: string; searches: number }[];
};

type LiveGeoRow = {
  region: string;
  avgMonthlySearches: number | null;
  share: number;
  index: number;
};

type LiveResult = {
  source: "google_ads";
  seedKeyword: string;
  geoLabel: string;
  ideas: LiveIdea[];
  primary: LiveIdea | null;
  geoBreakdown: LiveGeoRow[];
  yoyTrendPercent: string | null;
  meta?: { apiResultCount: number; totalSize: number | null };
  debugEvents?: KeywordResearchDebugEvent[];
};

type KeywordResearchDebugEvent = {
  at: string;
  step: string;
  message?: string;
  data?: Record<string, unknown>;
};

function formatVol(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function trendHeights(monthly: { searches: number }[]): number[] {
  if (!monthly.length) return MOCK_TREND;
  const max = Math.max(...monthly.map((m) => m.searches), 1);
  return monthly.map((m) => Math.round((m.searches / max) * 70));
}

export default function KeywordDemandPage() {
  const [query, setQuery] = useState("a/c repair");
  const [geo, setGeo] = useState<GeoPresetKey>("fl");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [debugTrace, setDebugTrace] = useState(false);
  const [debugEvents, setDebugEvents] = useState<KeywordResearchDebugEvent[] | null>(null);

  useEffect(() => {
    fetch("/api/google-ads/keyword-research", { credentials: "include" })
      .then((r) => readApiJson<{ configured?: boolean }>(r))
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const titleCase = useMemo(() => query.trim() || "your keyword", [query]);

  const runAnalysis = useCallback(async () => {
    setError(null);
    setDebugEvents(null);
    if (!configured) return;
    setLoading(true);
    try {
      const res = await fetch("/api/google-ads/keyword-research", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: query.trim(), geo, debug: debugTrace }),
      });
      const data = await readApiJson<{
        error?: string;
        debugEvents?: KeywordResearchDebugEvent[];
      } & Partial<LiveResult>>(res);
      if (Array.isArray(data.debugEvents) && data.debugEvents.length > 0) {
        setDebugEvents(data.debugEvents);
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        setLive(null);
        return;
      }
      setLive(data as LiveResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, [configured, query, geo, debugTrace]);

  const primary = live?.primary;
  const hasVolumeChart = Boolean(primary?.monthlyVolumes?.length);
  const showLiveEmptyMetrics = Boolean(live && !hasVolumeChart);
  const chartHeights = hasVolumeChart
    ? trendHeights(primary!.monthlyVolumes)
    : MOCK_TREND;
  const relatedIdeas = live?.ideas?.slice(0, 12) ?? [];
  const showRelatedDemo = !live && configured === false;
  const showGeoDemo = !live && configured === false;

  const geoLabelStatic = GEO_PRESETS[geo].label;

  const floridaCityKeys = GEO_PRESET_ORDER.filter((k) => k.startsWith("fl-"));

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-gradient-to-br from-[#00e5ff]/[0.03] via-transparent to-[#a78bfa]/[0.03] pointer-events-none z-0"
        aria-hidden
      />
      <AdminHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 overflow-x-hidden">
        {configured === false && (
          <div className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 font-mono">
            <span className="text-amber-400 font-semibold">NOT CONFIGURED</span>
            {" — "}
            Google Ads API environment variables are missing on this deployment. Use the same names as
            production in <code className="text-amber-200/90">.env.local</code> for local dev. Tables
            below show sample data until live credentials are present.
          </div>
        )}
        {configured === true && (
          <div className="mb-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90 font-mono">
            <span className="text-emerald-400 font-semibold">LIVE</span>
            {" — "}
            Connected to Google Ads API. Results use{" "}
            <code className="text-emerald-200/90">GenerateKeywordIdeas</code> (historical metrics).
            {live && live.ideas.length === 0 && (
              <span className="block mt-2 text-amber-200/90">
                Last run returned{" "}
                <strong className="text-amber-300">
                  {live.meta?.apiResultCount ?? 0} keyword idea rows
                </strong>{" "}
                from Google. If that stays at zero, try a broader seed (e.g. &quot;ac repair&quot;),
                another Florida geo, and confirm your Ads account can use Keyword Planner data (test
                tokens only work with test accounts; Basic access may be required for full data).
              </span>
            )}
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-display font-semibold text-[#00e5ff]">
            Intent Traffic
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Florida-focused search volume and keyword ideas from the Google Ads API — seed keywords,
            geo targeting, and historical monthly search volumes.
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="flex-1">
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
                Keyword or phrase
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "a/c repair", "emergency plumber"'
                className="w-full rounded-lg border-2 border-slate-600 bg-slate-950/80 px-4 py-3 font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00e5ff]/60 focus:ring-2 focus:ring-[#00e5ff]/20"
              />
            </div>
            <div className="w-full lg:min-w-[min(100%,22rem)] lg:max-w-md">
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
                Geo (target)
              </label>
              <select
                value={geo}
                onChange={(e) => setGeo(e.target.value as GeoPresetKey)}
                className="w-full rounded-lg border-2 border-slate-600 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white focus:outline-none focus:border-[#00e5ff]/60"
              >
                <optgroup label="Florida — broad">
                  <option value="fl">{GEO_PRESETS.fl.label}</option>
                  <option value="metros">{GEO_PRESETS.metros.label}</option>
                </optgroup>
                <optgroup label="Florida — cities & counties">
                  {floridaCityKeys.map((key) => (
                    <option key={key} value={key}>
                      {GEO_PRESETS[key].label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={loading || configured === null}
              className="rounded-lg bg-[#00e5ff] text-black font-semibold px-8 py-3 font-mono text-sm hover:bg-[#00e5ff]/90 transition-colors shadow-[0_0_20px_rgba(0,229,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Running…"
                : configured === null
                  ? "Loading…"
                  : configured === false
                    ? "Set env to run"
                    : "Run analysis"}
            </button>
          </div>
          {configured === true && (
            <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={debugTrace}
                onChange={(e) => setDebugTrace(e.target.checked)}
                className="mt-1 rounded border-slate-600 bg-slate-950 text-[#00e5ff] focus:ring-[#00e5ff]/40"
              />
              <span className="text-sm text-slate-400 font-mono leading-relaxed">
                <span className="text-slate-300">Debug trace</span> — log each step to{" "}
                <strong className="text-slate-300">Vercel runtime logs</strong> (search{" "}
                <code className="text-[#00e5ff]/90">[keyword-research]</code>) and show the same
                timeline below. No secrets are logged (tokens masked / omitted).
              </span>
            </label>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-400 font-mono" role="alert">
              {error}
            </p>
          )}
          {debugEvents && debugEvents.length > 0 && (
            <div className="mt-6 rounded-xl border border-violet-500/40 bg-violet-950/30 p-4">
              <h4 className="font-mono text-xs text-violet-300 uppercase tracking-wider mb-3">
                Debug trace (this run)
              </h4>
              <p className="text-xs text-slate-500 font-mono mb-3">
                Response path: API returns JSON with <code className="text-slate-400">ideas</code>,{" "}
                <code className="text-slate-400">primary</code>, <code className="text-slate-400">meta</code>
                , and optional <code className="text-slate-400">debugEvents</code> — the page stores that in
                React state and renders KPIs, chart, geo table, and related keywords.
              </p>
              <ol className="max-h-96 overflow-y-auto space-y-2 text-xs font-mono text-slate-300 list-decimal list-inside">
                {debugEvents.map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="break-words border-l-2 border-violet-500/30 pl-2">
                    <span className="text-slate-500">{ev.at}</span>{" "}
                    <span className="text-violet-300 font-semibold">{ev.step}</span>
                    {ev.message ? (
                      <span className="text-slate-400"> — {ev.message}</span>
                    ) : null}
                    {ev.data != null ? (
                      <pre className="mt-1 text-[10px] text-slate-500 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(ev.data, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            {
              label: "Avg. monthly searches",
              value: primary
                ? formatVol(primary.avgMonthlySearches)
                : configured
                  ? "—"
                  : "74K–90K",
              sub: primary ? live?.geoLabel ?? "Google Ads" : configured ? "Run analysis" : "Illustrative",
            },
            {
              label: "Competition",
              value: primary?.competition ?? (configured ? "—" : "High"),
              sub: primary
                ? primary.competitionIndex != null
                  ? `Index ${primary.competitionIndex}`
                  : "Paid search"
                : configured
                  ? "—"
                  : "Illustrative",
            },
            {
              label: "YoY trend",
              value: primary?.monthlyVolumes?.length
                ? live?.yoyTrendPercent ?? "—"
                : configured
                  ? "—"
                  : "+12%",
              sub: primary ? "Same geo & language" : configured ? "Run analysis" : "Sample",
            },
            {
              label: "Intent",
              value: primary ? "Transactional" : configured ? "—" : "Transactional",
              sub: primary ? "Heuristic" : configured ? "Run analysis" : "Preview",
            },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#00e5ff]/25 bg-slate-900/60 p-4">
              <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className="mt-2 text-xl font-display font-bold text-[#00e5ff]">{k.value}</p>
              <p className="mt-1 text-xs text-slate-500 font-mono">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          <div className="xl:col-span-2 rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-6">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-6">
              Search interest — monthly (last points from API)
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              Query: <span className="text-slate-300">&quot;{live?.seedKeyword ?? titleCase}&quot;</span>
              {" · "}
              Geo: {live?.geoLabel ?? geoLabelStatic}
              {" · "}
              English
            </p>
            {showLiveEmptyMetrics ? (
              <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-slate-600/80 bg-slate-950/40 px-4 text-center text-sm text-slate-400">
                Google did not return historical monthly search volumes for this run (no primary keyword
                metrics). Try another seed or geo, or check account / developer token access for
                Keyword Planner.
              </div>
            ) : configured && !live ? (
              <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-slate-600/80 bg-slate-950/40 px-4 text-center text-sm text-slate-400">
                Run analysis to load monthly search interest from the API.
              </div>
            ) : (
              <>
                <div className="h-48 flex items-end gap-1">
                  {chartHeights.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-[#00e5ff]/20 to-[#00e5ff]/60 min-w-[8px]"
                      style={{ height: `${(h / 70) * 100}%` }}
                      title={`Month ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-600">
                  <span>{primary?.monthlyVolumes?.[0]?.month ?? "Jan"}</span>
                  <span>…</span>
                  <span>
                    {primary?.monthlyVolumes?.[primary.monthlyVolumes.length - 1]?.month ?? "Dec"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border-2 border-slate-700 bg-slate-900/40 p-6">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-4">
              Plan settings (API)
            </h3>
            <ul className="space-y-3 text-sm text-slate-300 font-mono">
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Service</span>
                <span className="text-[#00e5ff]">KeywordPlanIdea</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Method</span>
                <span>GenerateKeywordIdeas</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Network</span>
                <span>Google Search</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Auth</span>
                <span>OAuth + dev token</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Geographic demand */}
        <div className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-700/80">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider">
              Demand by location
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {live
                ? "Volume for your selected geo (one Google Ads request — no extra regional fan-out)."
                : configured
                  ? "Run analysis to load metrics for the geo you selected."
                  : "Sample data — set Google Ads env vars for live results."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="px-6 py-3">Region</th>
                  <th className="px-6 py-3">Avg. monthly searches</th>
                  <th className="px-6 py-3">Demand index</th>
                  <th className="px-6 py-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {live?.geoBreakdown?.length
                  ? live.geoBreakdown.map((row) => (
                      <tr key={row.region} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                        <td className="px-6 py-3 text-slate-200">{row.region}</td>
                        <td className="px-6 py-3 text-[#00e5ff]">{formatVol(row.avgMonthlySearches)}</td>
                        <td className="px-6 py-3 text-slate-300">{row.index}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 max-w-[120px] rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#00e5ff]/70"
                                style={{ width: `${row.share}%` }}
                              />
                            </div>
                            <span className="text-slate-400">{row.share}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  : showGeoDemo
                    ? MOCK_GEO_ROWS.map((row) => (
                        <tr key={row.region} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                          <td className="px-6 py-3 text-slate-200">{row.region}</td>
                          <td className="px-6 py-3 text-[#00e5ff]">{row.vol}</td>
                          <td className="px-6 py-3 text-slate-300">{row.index}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 max-w-[120px] rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#00e5ff]/70"
                                  style={{ width: `${row.share}%` }}
                                />
                              </div>
                              <span className="text-slate-400">{row.share}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-8 text-center text-sm text-slate-500 font-mono"
                          >
                            {live
                              ? "No geo breakdown — Google returned no searchable volume for this seed (see LIVE note above)."
                              : "Run analysis to load demand for the selected Florida geo."}
                          </td>
                        </tr>
                      )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Related keywords */}
        <div className="rounded-xl border-2 border-slate-700 bg-slate-900/40 p-6">
          <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-4">
            Related keywords (ideas)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relatedIdeas.length > 0
              ? relatedIdeas.map((r) => (
                  <div
                    key={r.text}
                    className="flex items-center justify-between rounded-lg border border-slate-700/80 px-4 py-3 bg-slate-950/50 gap-2"
                  >
                    <span className="text-slate-200 font-mono text-sm truncate">{r.text}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatVol(r.avgMonthlySearches)} ·{" "}
                      <span className="text-slate-400">{r.competition}</span>
                    </span>
                  </div>
                ))
              : showRelatedDemo
                ? MOCK_RELATED.map((r) => (
                    <div
                      key={r.keyword}
                      className="flex items-center justify-between rounded-lg border border-slate-700/80 px-4 py-3 bg-slate-950/50"
                    >
                      <span className="text-slate-200 font-mono text-sm">{r.keyword}</span>
                      <span className="text-xs text-slate-500">
                        {r.vol} · <span className="text-slate-400">{r.comp}</span>
                      </span>
                    </div>
                  ))
                : (
                    <div className="md:col-span-2 rounded-lg border border-slate-700/60 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-500 font-mono">
                      {live
                        ? "No related keyword ideas in the API response for this run."
                        : "Run analysis to load related keyword ideas from Google Ads."}
                    </div>
                  )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-slate-400 hover:text-[#00e5ff] transition-colors font-mono text-sm">
            ← Intent
          </Link>
          <p className="text-slate-500 text-sm font-mono">Intent Traffic · Intent Admin Hub</p>
        </div>
      </footer>
    </div>
  );
}
