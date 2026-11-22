"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommercialNetworkRecord } from "@/lib/opportunity-intelligence";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";

export default function CommercialNetworksPage() {
  const [networks, setNetworks] = useState<CommercialNetworkRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orgType, setOrgType] = useState("all");
  const [county, setCounty] = useState("all");
  const [trade, setTrade] = useState("all");
  const [pipelineSuccess, setPipelineSuccess] = useState<string | null>(null);

  const loadNetworks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (orgType !== "all") params.set("orgType", orgType);
      if (county !== "all") params.set("county", county);
      if (trade !== "all") params.set("trade", trade);

      const res = await fetch(`/api/opportunity-intelligence/networks?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setNetworks(data.networks || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, orgType, county, trade]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNetworks();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadNetworks]);

  const addToPipeline = async (network: CommercialNetworkRecord) => {
    try {
      const res = await fetch("/api/opportunity-intelligence/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityTitle: `Commercial Subcontracting / Vendor Intake: ${network.name}`,
          targetName: network.name,
          targetType: network.org_type,
          stage: "identified",
          contactPerson: network.primary_contact_name,
          contactEmail: network.primary_contact_email,
          contactPhone: network.primary_contact_phone,
          notes: `Vendor Portal: ${network.vendor_intake_url || network.website || "N/A"}. Volume: ${network.annual_commercial_volume || "N/A"}. Trades: ${network.trades_hired.join(", ")}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPipelineSuccess(`Added "${network.name}" to outreach pipeline`);
        setTimeout(() => setPipelineSuccess(null), 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Commercial Networks & General Contractors</h1>
          <p className="text-xs text-slate-400 mt-1">
            Top Florida general contractors, commercial developers, and property managers hiring trade subcontractors.
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400">{total} Commercial Networks</div>
      </div>

      {pipelineSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300">
          ✓ {pipelineSuccess}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search Company</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company name, notes..."
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Organization Type</label>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Organization Types</option>
            <option value="general_contractor">General Contractor</option>
            <option value="property_management">Property Management</option>
            <option value="developer">Developer</option>
            <option value="commercial_owner">Commercial Owner</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Florida County</label>
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Counties</option>
            {FLORIDA_COUNTIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} County
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Trades Hired</label>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Trades</option>
            <option value="hvac">HVAC</option>
            <option value="roofing">Roofing</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="painting">Painting</option>
            <option value="facilities_maintenance">Facilities</option>
          </select>
        </div>
      </div>

      {/* Network Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-12 text-center text-sm font-mono text-slate-400">Loading commercial networks…</div>
        ) : networks.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-sm text-slate-400">
            No commercial organizations matched your filter.
          </div>
        ) : (
          networks.map((net) => (
            <div
              key={net.id}
              className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-all space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-400 uppercase tracking-wide border border-blue-500/20">
                    {net.org_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-400">{net.county} County • {net.city}</span>
                </div>

                <h3 className="text-base font-bold text-white">{net.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{net.notes}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {net.trades_hired.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300 uppercase"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Volume:</span>
                    <span className="text-slate-200">{net.annual_commercial_volume || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Active Projects:</span>
                    <span className="text-emerald-400">{net.active_projects_count} Projects</span>
                  </div>
                </div>

                {net.primary_contact_name && (
                  <div className="rounded-xl border border-white/5 bg-black/30 p-2.5 text-xs space-y-0.5">
                    <div className="font-semibold text-slate-200">
                      {net.primary_contact_name} {net.primary_contact_title ? `— ${net.primary_contact_title}` : ""}
                    </div>
                    {net.primary_contact_email && (
                      <div className="text-cyan-400 font-mono text-[11px]">{net.primary_contact_email}</div>
                    )}
                    {net.primary_contact_phone && (
                      <div className="text-slate-400 text-[11px]">{net.primary_contact_phone}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  {net.website && (
                    <a
                      href={net.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Website ↗
                    </a>
                  )}
                  {net.vendor_intake_url && (
                    <a
                      href={net.vendor_intake_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Subcontractor Intake ↗
                    </a>
                  )}
                </div>

                <button
                  onClick={() => addToPipeline(net)}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:from-cyan-400 hover:to-blue-500 transition-all"
                >
                  + Add to Pipeline
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
