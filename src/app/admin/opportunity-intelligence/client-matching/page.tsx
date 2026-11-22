"use client";

import { useCallback, useEffect, useState } from "react";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import { CheckIcon } from "@/components/admin/opportunity-intelligence/icons";

interface ClientMatchResult {
  clientId: string;
  clientName: string;
  matchScore: number;
  matchReasons: string[];
}

export default function ClientMatchingPage() {
  const [selectedTrade, setSelectedTrade] = useState("hvac");
  const [selectedCounty, setSelectedCounty] = useState("Orange");
  const [matches, setMatches] = useState<ClientMatchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const calculateMatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/opportunity-intelligence/client-matching?trade=${selectedTrade}&county=${selectedCounty}`
      );
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTrade, selectedCounty]);

  useEffect(() => {
    calculateMatches();
  }, [calculateMatches]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Client Opportunity Matching Engine</h1>
        <p className="text-xs text-slate-400 mt-1">
          Automated scoring algorithm matching Florida bids and commercial networks against registered Intent Revenue client profiles.
        </p>
      </div>

      {/* Simulator / Query Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#0d1424] p-5">
        <div>
          <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Trade Required:</label>
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="hvac">HVAC / Mechanical</option>
            <option value="roofing">Roofing & Waterproofing</option>
            <option value="electrical">Electrical & Generator</option>
            <option value="plumbing">Plumbing & Underground Utility</option>
            <option value="general_contracting">General Contracting</option>
            <option value="painting">Commercial Painting</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Florida County:</label>
          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            {FLORIDA_COUNTIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} County ({c.region.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matching Results */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Matching Client Profiles for {selectedTrade.toUpperCase()} in {selectedCounty} County
          </h3>
          <span className="text-xs font-mono text-cyan-400">{matches.length} Eligible Clients</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Scoring client capability profiles…</div>
        ) : matches.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400 space-y-2">
            <div>No existing active client profiles match this trade and territory.</div>
            <div className="text-xs text-slate-500">
              Clients registered in Intent Revenue (Commercial Partnerships / Trade Demand) with matching service territories will appear automatically.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {matches.map((m) => (
              <div key={m.clientId} className="p-5 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{m.clientName}</h4>
                    <span className="rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                      Score: {m.matchScore}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    {m.matchReasons.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckIcon className="h-3 w-3" /> {r}
                      </span>
                    ))}
                  </div>
                </div>

                <button className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20">
                  Assign Lead
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
