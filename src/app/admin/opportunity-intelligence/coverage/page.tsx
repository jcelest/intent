"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { FloridaCountyCoverage } from "@/lib/opportunity-intelligence";
import { FLORIDA_REGIONS } from "@/lib/florida-geo";
import { RefreshIcon, ArrowRightIcon } from "@/components/admin/opportunity-intelligence/icons";

export default function FloridaCoveragePage() {
  const [counties, setCounties] = useState<FloridaCountyCoverage[]>([]);
  const [summary, setSummary] = useState({
    totalCounties: 67,
    recentlyRefreshed: 0,
    partiallyIndexed: 0,
    collectionPending: 0,
    totalBids: 0,
    totalNetworks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/coverage");
      const data = await res.json();
      if (data.ok) {
        setCounties(data.counties || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const filteredCounties = counties.filter((c) => {
    if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.countyName.toLowerCase().includes(q) ||
        c.seat.toLowerCase().includes(q) ||
        c.fips.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Florida Coverage & County Intelligence</h1>
          <p className="text-xs text-slate-400 mt-1">
            Status of commercial bidding sources, general contractors, and active opportunities across all 67 Florida counties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCoverage}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 inline-flex items-center gap-1.5"
          >
            <RefreshIcon className="h-3.5 w-3.5" /> Refresh Coverage
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-slate-400">Total FL Counties</div>
          <div className="text-2xl font-bold text-white mt-1">67</div>
          <div className="text-[11px] text-cyan-400 mt-0.5 font-mono">100% Territorial Scope</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-emerald-400">Recently Refreshed</div>
          <div className="text-2xl font-bold text-white mt-1">{summary.recentlyRefreshed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active bids + networks</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-amber-400">Partially Indexed</div>
          <div className="text-2xl font-bold text-white mt-1">{summary.partiallyIndexed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Sources or bids mapped</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-slate-400">Collection Pending</div>
          <div className="text-2xl font-bold text-slate-400 mt-1">{summary.collectionPending}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting collector cycle</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search County / Seat</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search e.g. Orange, Orlando, Miami, 095..."
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Filter Region</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Florida Regions (Statewide)</option>
            {Object.values(FLORIDA_REGIONS).map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Filter Coverage State</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Coverage States</option>
            <option value="recently_refreshed">Recently Refreshed</option>
            <option value="partially_indexed">Partially Indexed</option>
            <option value="collection_pending">Collection Pending</option>
          </select>
        </div>
      </div>

      {/* Counties Grid / Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Florida County Territory Registry</h3>
          <span className="text-xs font-mono text-cyan-400">
            Showing {filteredCounties.length} of 67 Counties
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading Florida coverage data…</div>
        ) : filteredCounties.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No Florida counties matched this filter criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3">County & Seat</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3 text-center">Active Bids</th>
                  <th className="px-4 py-3 text-center">Commercial Networks</th>
                  <th className="px-4 py-3 text-center">Procurement Portals</th>
                  <th className="px-4 py-3 text-center">Coverage State</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCounties.map((c) => (
                  <tr key={c.fips} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-white">{c.countyName} County</div>
                      <div className="text-[11px] text-slate-400">Seat: {c.seat} • FIPS 12{c.fips}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {c.region.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      {c.activeBidsCount > 0 ? (
                        <span className="font-semibold text-cyan-400">{c.activeBidsCount}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      {c.networksCount > 0 ? (
                        <span className="font-semibold text-blue-400">{c.networksCount}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      {c.sourcesCount > 0 ? (
                        <span className="font-semibold text-emerald-400">{c.sourcesCount}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {c.status === "recently_refreshed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Recently Refreshed
                        </span>
                      ) : c.status === "partially_indexed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Partially Indexed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-500/20">
                          Collection Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <Link
                        href={`/admin/opportunity-intelligence/bids?county=${encodeURIComponent(c.countyName)}`}
                        className="inline-block text-[11px] font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                      >
                        Bids
                      </Link>
                      <span className="text-slate-700">|</span>
                      <Link
                        href={`/admin/opportunity-intelligence/networks?county=${encodeURIComponent(c.countyName)}`}
                        className="inline-block text-[11px] font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        Networks
                      </Link>
                      <span className="text-slate-700">|</span>
                      <Link
                        href={`/admin/opportunity-intelligence/geographic-search`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white"
                      >
                        Geo Search <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
