"use client";

import { useState } from "react";
import type { ParsedGeoScope } from "@/lib/florida-geo";
import type { CommercialBidRecord, CommercialNetworkRecord } from "@/lib/opportunity-intelligence";
import {
  SearchIcon,
  MapPinIcon,
  RadarIcon,
  DownloadIcon,
  ExternalLinkIcon,
} from "@/components/admin/opportunity-intelligence/icons";

export default function FloridaGeographicSearchPage() {
  const [geoInput, setGeoInput] = useState("Orange County, Seminole, 32801, 33602, Tampa, Orlando");
  const [selectedTrade, setSelectedTrade] = useState("all");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    geoScope: ParsedGeoScope;
    bids: CommercialBidRecord[];
    networks: CommercialNetworkRecord[];
    stats: {
      totalBidsFound: number;
      totalNetworksFound: number;
      countiesResolved: number;
      zipsResolved: number;
    };
  } | null>(null);

  const executeSearch = async (overrideInput?: string) => {
    const inputToUse = overrideInput !== undefined ? overrideInput : geoInput;
    if (!inputToUse.trim()) return;

    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/geo-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputToUse, trade: selectedTrade }),
      });
      const data = await res.json();
      if (data.ok) {
        setSearchResult(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetText: string) => {
    setGeoInput(presetText);
    executeSearch(presetText);
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        // Extract 5-digit zip codes or words
        const matches = text.match(/\b\d{5}\b|[a-zA-Z\s]+(?=,|$|\r|\n)/g) || [];
        const combined = Array.from(new Set(matches.map((m) => m.trim()).filter(Boolean))).join(", ");
        setGeoInput(combined);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase text-cyan-400">Spatial Intelligence Engine</span>
          <span className="text-xs text-slate-500">• All 67 Florida Counties</span>
        </div>
        <h1 className="text-xl font-bold text-white mt-1">Florida Multi-Territory Geographic Search</h1>
        <p className="text-xs text-slate-400 mt-1">
          Search any combination of Florida ZIP codes, counties, cities, or regional presets simultaneously.
        </p>
      </div>

      {/* Reusable Florida Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 mr-1">Quick Presets:</span>
        <button
          onClick={() => applyPreset("Orange, Seminole, Osceola, Lake, Volusia, Brevard")}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-3 w-3 text-cyan-400" /> Greater Orlando / Central FL
        </button>
        <button
          onClick={() => applyPreset("Hillsborough, Pinellas, Pasco, Manatee, Sarasota")}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-3 w-3 text-cyan-400" /> Tampa Bay & Suncoast
        </button>
        <button
          onClick={() => applyPreset("Miami-Dade, Broward, Palm Beach")}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-3 w-3 text-cyan-400" /> South Florida Tri-County
        </button>
        <button
          onClick={() => applyPreset("Duval, St. Johns, Clay, Nassau, Baker")}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-3 w-3 text-cyan-400" /> First Coast (Jacksonville)
        </button>
        <button
          onClick={() => applyPreset("Hillsborough, Polk, Osceola, Orange, Seminole, Volusia")}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-3 w-3 text-cyan-400" /> I-4 High Demand Corridor
        </button>
        <button
          onClick={() => applyPreset("All 67 Florida Counties, Statewide")}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all inline-flex items-center gap-1"
        >
          <RadarIcon className="h-3 w-3 text-cyan-400" /> All 67 Counties (Statewide)
        </button>
      </div>

      {/* Main Geographic Input Console */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono uppercase text-slate-300 font-semibold">
              Mixed Geographic Territory Input (ZIPs, Counties, Cities, Ranges)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-xs font-mono text-cyan-400 hover:underline inline-flex items-center gap-1.5">
                <DownloadIcon className="h-3.5 w-3.5" /> Import CSV of ZIPs / Locations
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setGeoInput("")}
                className="text-xs font-mono text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            rows={3}
            value={geoInput}
            onChange={(e) => setGeoInput(e.target.value)}
            placeholder="Type or paste any Florida ZIP codes (32801, 33602, 32801-32810), counties (Orange, Hillsborough, Miami-Dade), or cities (Orlando, Tampa, Jacksonville)..."
            className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <label className="text-xs font-mono text-slate-400">Trade Filter:</label>
            <select
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Florida Trades</option>
              <option value="hvac">HVAC / Mechanical</option>
              <option value="roofing">Roofing & Waterproofing</option>
              <option value="electrical">Electrical & Generator</option>
              <option value="plumbing">Plumbing & Utility</option>
              <option value="general_contracting">General Contracting</option>
            </select>
          </div>

          <button
            onClick={() => executeSearch()}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20 inline-flex items-center gap-1.5"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            {loading ? "Resolving Florida Geography…" : "Execute Florida Search"}
          </button>
        </div>
      </div>

      {/* Search Scope Summary */}
      {searchResult && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Territory Resolution Scope
              </h3>
              <span className="text-xs font-mono text-cyan-300">
                {searchResult.stats.countiesResolved} Counties Resolved • {searchResult.stats.zipsResolved} ZIPs
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-black/40 p-2.5 border border-white/5">
                <div className="text-slate-400 font-mono text-[10px]">Commercial Bids Found:</div>
                <div className="text-lg font-bold text-cyan-400">{searchResult.stats.totalBidsFound}</div>
              </div>
              <div className="rounded-lg bg-black/40 p-2.5 border border-white/5">
                <div className="text-slate-400 font-mono text-[10px]">Commercial Networks:</div>
                <div className="text-lg font-bold text-blue-400">{searchResult.stats.totalNetworksFound}</div>
              </div>
              <div className="rounded-lg bg-black/40 p-2.5 border border-white/5">
                <div className="text-slate-400 font-mono text-[10px]">Statewide Scope:</div>
                <div className="text-lg font-bold text-emerald-400">
                  {searchResult.geoScope.isStatewide ? "Yes (All 67)" : "Targeted Florida"}
                </div>
              </div>
              <div className="rounded-lg bg-black/40 p-2.5 border border-white/5">
                <div className="text-slate-400 font-mono text-[10px]">Warnings / Unmatched:</div>
                <div className="text-lg font-bold text-amber-400">{searchResult.geoScope.warnings.length}</div>
              </div>
            </div>

            {searchResult.geoScope.resolvedCounties.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-mono text-slate-400 block mb-1.5">Resolved Florida Counties:</span>
                <div className="flex flex-wrap gap-1.5">
                  {searchResult.geoScope.resolvedCounties.map((c) => (
                    <span
                      key={c}
                      className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-200"
                    >
                      {c} County
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results: Bids & Networks Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bids in Territory */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">Active Bids in Territory ({searchResult.bids.length})</h3>
                <span className="text-xs text-slate-400 font-mono">Public procurement</span>
              </div>

              {searchResult.bids.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active solicitations found in selected territory.</div>
              ) : (
                <div className="space-y-3">
                  {searchResult.bids.map((b) => (
                    <div key={b.id} className="rounded-xl border border-white/5 bg-black/20 p-3.5 space-y-1.5 hover:border-cyan-500/30 transition-all">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-cyan-400 font-mono text-[10px] font-bold uppercase">{b.trade_slug}</span>
                        <span className="text-slate-400">{b.county} County</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white">{b.title}</h4>
                      <div className="text-[11px] text-slate-400">{b.agency_name}</div>
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                        <span className="text-slate-300">{b.estimated_value_display || "TBD"}</span>
                        <a
                          href={b.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                        >
                          View Source <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Networks in Territory */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">Commercial Networks in Territory ({searchResult.networks.length})</h3>
                <span className="text-xs text-slate-400 font-mono">GCs & developers</span>
              </div>

              {searchResult.networks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No commercial networks found in selected territory.</div>
              ) : (
                <div className="space-y-3">
                  {searchResult.networks.map((n) => (
                    <div key={n.id} className="rounded-xl border border-white/5 bg-black/20 p-3.5 space-y-1.5 hover:border-blue-500/30 transition-all">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-blue-400 font-mono text-[10px] font-bold uppercase">
                          {n.org_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-400">{n.county} County • {n.city}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white">{n.name}</h4>
                      {n.primary_contact_name && (
                        <div className="text-[11px] text-slate-300">
                          Contact: {n.primary_contact_name} {n.primary_contact_phone ? `(${n.primary_contact_phone})` : ""}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                        <span className="text-slate-400">Hires: {n.trades_hired?.join(", ")}</span>
                        {n.website && (
                          <a
                            href={n.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            Website <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
