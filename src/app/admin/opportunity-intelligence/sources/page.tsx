"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProcurementSourceDef } from "@/lib/opportunity-sources";

export default function ProcurementSourcesPage() {
  const [sources, setSources] = useState<ProcurementSourceDef[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [agencyType, setAgencyType] = useState("all");
  const [status, setStatus] = useState("all");

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (agencyType !== "all") params.set("agencyType", agencyType);
      if (status !== "all") params.set("status", status);

      const res = await fetch(`/api/opportunity-intelligence/sources?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setSources(data.sources || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, agencyType, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSources();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadSources]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Florida Procurement Source Registry</h1>
          <p className="text-xs text-slate-400 mt-1">
            Registry of verified public purchasing portals covering all 67 Florida counties, state agencies, and authorities.
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400">{total} Procurement Portals Indexed</div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search Agency / County</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by agency name, county, platform..."
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Agency Classification</label>
          <select
            value={agencyType}
            onChange={(e) => setAgencyType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Classifications</option>
            <option value="state">Florida State Agencies</option>
            <option value="county">Florida Counties (All 67)</option>
            <option value="municipality">Municipalities & Cities</option>
            <option value="school_district">School Districts</option>
            <option value="higher_ed">Universities & Colleges</option>
            <option value="utility">Municipal Utilities</option>
            <option value="airport_transit">Aviation & Transit</option>
            <option value="federal">Federal in Florida</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Integration Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Integration States</option>
            <option value="active">Active Functioning</option>
            <option value="configured">Configured</option>
            <option value="tested">Tested</option>
            <option value="discovered">Discovered</option>
          </select>
        </div>
      </div>

      {/* Sources Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading procurement source registry…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-black/40 text-[10px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="p-4">Agency / Jurisdiction</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">County</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Portal Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="font-semibold text-white">{s.agencyName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{s.id}</div>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300">
                        {s.agencyType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{s.county || "Statewide"}</td>
                    <td className="p-4">
                      <span className="text-cyan-400 font-mono text-[11px]">{s.publishingPlatform}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-400 font-mono text-[10px] uppercase">{s.collectionMethod}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          s.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <a
                        href={s.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                      >
                        Portal ↗
                      </a>
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
