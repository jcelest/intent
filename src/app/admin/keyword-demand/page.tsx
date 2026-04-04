"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";

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

type GeoKey = "us" | "fl" | "metros";

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
  const [geo, setGeo] = useState<GeoKey>("us");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveResult | null>(null);

  useEffect(() => {
    fetch("/api/google-ads/keyword-research", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  const titleCase = useMemo(() => query.trim() || "your keyword", [query]);

  const runAnalysis = useCallback(async () => {
    setError(null);
    if (!configured) return;
    setLoading(true);
    try {
      const res = await fetch("/api/google-ads/keyword-research", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: query.trim(), geo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        setLive(null);
        return;
      }
      setLive(data as LiveResult);
    } catch {
      setError("Network error");
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, [configured, query, geo]);

  const primary = live?.primary;
  const chartHeights = primary?.monthlyVolumes?.length
    ? trendHeights(primary.monthlyVolumes)
    : MOCK_TREND;
  const relatedIdeas = live?.ideas?.slice(0, 12) ?? [];

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
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-display font-semibold text-[#00e5ff]">
            Keyword demand intelligence
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Search volume and keyword ideas from the Google Ads API — seed keywords, geo targeting,
            and historical monthly search volumes.
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
            <div className="w-full lg:w-56">
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
                Geo (target)
              </label>
              <select
                value={geo}
                onChange={(e) => setGeo(e.target.value as GeoKey)}
                className="w-full rounded-lg border-2 border-slate-600 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white focus:outline-none focus:border-[#00e5ff]/60"
              >
                <option value="us">United States</option>
                <option value="fl">Florida</option>
                <option value="metros">Florida metros (combined)</option>
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
          {error && (
            <p className="mt-4 text-sm text-red-400 font-mono" role="alert">
              {error}
            </p>
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
              Geo: {live?.geoLabel ?? (geo === "us" ? "United States" : geo === "fl" ? "Florida" : "Florida metros")}
              {" · "}
              English
            </p>
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
              {live?.geoBreakdown?.length
                ? "Relative share from separate geo-targeted requests for the same seed keyword."
                : "Sample data — set Google Ads env vars for live geo breakdown."}
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
                  : MOCK_GEO_ROWS.map((row) => (
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
                    ))}
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
              : MOCK_RELATED.map((r) => (
                  <div
                    key={r.keyword}
                    className="flex items-center justify-between rounded-lg border border-slate-700/80 px-4 py-3 bg-slate-950/50"
                  >
                    <span className="text-slate-200 font-mono text-sm">{r.keyword}</span>
                    <span className="text-xs text-slate-500">
                      {r.vol} · <span className="text-slate-400">{r.comp}</span>
                    </span>
                  </div>
                ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-slate-400 hover:text-[#00e5ff] transition-colors font-mono text-sm">
            ← Intent
          </Link>
          <p className="text-slate-500 text-sm font-mono">Keyword demand · Admin</p>
        </div>
      </footer>
    </div>
  );
}
