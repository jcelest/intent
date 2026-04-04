"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";

/** Static mock data for Google Ads API application mockup — not live data */
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

export default function KeywordDemandMockupPage() {
  const [query, setQuery] = useState("a/c repair");

  const titleCase = useMemo(() => {
    return query.trim() || "your keyword";
  }, [query]);

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-gradient-to-br from-[#00e5ff]/[0.03] via-transparent to-[#a78bfa]/[0.03] pointer-events-none z-0"
        aria-hidden
      />
      <AdminHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16 overflow-x-hidden">
        {/* Application mockup banner */}
        <div className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 font-mono">
          <span className="text-amber-400 font-semibold">MOCKUP / PREVIEW</span>
          {" — "}
          Interface preview for Google Ads API (Keyword Planner) integration. Data shown is illustrative only until API credentials are connected.
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-display font-semibold text-[#00e5ff]">
            Keyword demand intelligence
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Search volume estimates, competition, and geographic demand breakdown powered by the Google Ads API — Keyword Plan Idea & Historical Metrics services.
          </p>
        </div>

        {/* Search bar */}
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
            <div className="w-full lg:w-48">
              <label className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
                Geo (target)
              </label>
              <select className="w-full rounded-lg border-2 border-slate-600 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white focus:outline-none focus:border-[#00e5ff]/60">
                <option>United States</option>
                <option>Florida (state)</option>
                <option>Custom metros (API)</option>
              </select>
            </div>
            <button
              type="button"
              className="rounded-lg bg-[#00e5ff] text-black font-semibold px-8 py-3 font-mono text-sm hover:bg-[#00e5ff]/90 transition-colors shadow-[0_0_20px_rgba(0,229,255,0.25)]"
            >
              Run analysis
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Avg. monthly searches", value: "74K–90K", sub: "Range (illustrative)" },
            { label: "Competition", value: "High", sub: "Paid search" },
            { label: "YoY trend (mock)", value: "+12%", sub: "Same geo & language" },
            { label: "Top intent cluster", value: "Transactional", sub: "Classifier preview" },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-[#00e5ff]/25 bg-slate-900/60 p-4"
            >
              <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className="mt-2 text-xl font-display font-bold text-[#00e5ff]">{k.value}</p>
              <p className="mt-1 text-xs text-slate-500 font-mono">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          {/* Chart mock */}
          <div className="xl:col-span-2 rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-6">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-6">
              Search interest — last 12 months (illustrative)
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              Query: <span className="text-slate-300">&quot;{titleCase}&quot;</span> · Geo: United States · Language: English
            </p>
            <div className="h-48 flex items-end gap-1">
              {MOCK_TREND.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#00e5ff]/20 to-[#00e5ff]/60 min-w-[8px]"
                  style={{ height: `${(h / 70) * 100}%` }}
                  title={`Month ${i + 1}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-600">
              <span>Jan</span>
              <span>Jun</span>
              <span>Dec</span>
            </div>
          </div>

          {/* Quick stats */}
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
                <span className="text-slate-500">Metrics</span>
                <span>Historical volume</span>
              </li>
              <li className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Geo breakdown</span>
                <span>Metro / region</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Auth</span>
                <span>OAuth + dev token</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Geographic demand table */}
        <div className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-700/80">
            <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider">
              Demand by location (illustrative breakdown)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Share of observed interest by region — production data via{" "}
              <code className="text-slate-400">GenerateKeywordIdeas</code> / geo constants.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="px-6 py-3">Region</th>
                  <th className="px-6 py-3">Est. volume (range)</th>
                  <th className="px-6 py-3">Demand index</th>
                  <th className="px-6 py-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_GEO_ROWS.map((row) => (
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
            {MOCK_RELATED.map((r) => (
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
          <p className="text-slate-500 text-sm font-mono">Keyword demand mockup · Internal</p>
        </div>
      </footer>
    </div>
  );
}
