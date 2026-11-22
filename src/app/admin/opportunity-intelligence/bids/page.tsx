"use client";

import { useEffect, useState, useCallback } from "react";
import type { CommercialBidRecord } from "@/lib/opportunity-intelligence";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";

export default function CommercialBidsPage() {
  const [bids, setBids] = useState<CommercialBidRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<CommercialBidRecord | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState("all");
  const [county, setCounty] = useState("all");
  const [agencyType, setAgencyType] = useState("all");
  const [closingWithinDays, setClosingWithinDays] = useState(0);

  // Push to pipeline status
  const [pipelineSuccess, setPipelineSuccess] = useState<string | null>(null);

  const loadBids = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (trade !== "all") params.set("trade", trade);
      if (county !== "all") params.set("county", county);
      if (agencyType !== "all") params.set("agencyType", agencyType);
      if (closingWithinDays > 0) params.set("closingWithinDays", String(closingWithinDays));

      const res = await fetch(`/api/opportunity-intelligence/bids?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setBids(data.bids || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query, trade, county, agencyType, closingWithinDays]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBids();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadBids]);

  const toggleSave = async (bid: CommercialBidRecord) => {
    try {
      const res = await fetch("/api/opportunity-intelligence/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidId: bid.id,
          opportunityType: "bid",
          title: bid.title,
          agencyOrCompany: bid.agency_name,
          county: bid.county,
          tradeSlug: bid.trade_slug,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBids((prev) =>
          prev.map((b) => (b.id === bid.id ? { ...b, is_saved: data.saved } : b))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pushToPipeline = async (bid: CommercialBidRecord) => {
    try {
      const res = await fetch("/api/opportunity-intelligence/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: bid.id,
          opportunityTitle: bid.title,
          targetName: bid.agency_name,
          targetType: "public_agency",
          stage: "identified",
          estimatedValue: bid.estimated_value,
          contactPerson: bid.contact_name,
          contactEmail: bid.contact_email,
          contactPhone: bid.contact_phone,
          notes: `Solicitation: ${bid.solicitation_number}. Closes: ${bid.closing_date || "Open"}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPipelineSuccess(`Added "${bid.title.slice(0, 30)}…" to outreach pipeline`);
        setTimeout(() => setPipelineSuccess(null), 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const exportCSV = () => {
    if (bids.length === 0) return;
    const headers = [
      "Solicitation Number",
      "Title",
      "Agency",
      "Agency Type",
      "County",
      "Trade",
      "Value",
      "Posted Date",
      "Closing Date",
      "Source URL",
    ];
    const rows = bids.map((b) => [
      `"${b.solicitation_number}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.agency_name.replace(/"/g, '""')}"`,
      `"${b.agency_type}"`,
      `"${b.county || ""}"`,
      `"${b.trade_slug || ""}"`,
      `"${b.estimated_value_display || ""}"`,
      `"${b.posted_date}"`,
      `"${b.closing_date || ""}"`,
      `"${b.source_url}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `florida-commercial-bids-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Florida Commercial Bids</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time public procurement solicitations across state agencies, 67 counties, and municipal buyers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            📥 Export CSV ({total})
          </button>
        </div>
      </div>

      {pipelineSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300">
          ✓ {pipelineSuccess}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search Keyword / Solicitation</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Chiller, Roof, Switchgear..."
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
            <option value="county">County Procurement</option>
            <option value="municipality">Municipalities</option>
            <option value="school_district">School Districts</option>
            <option value="higher_ed">Universities / Colleges</option>
            <option value="airport_transit">Aviation / Transit</option>
            <option value="federal">Federal in Florida</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Trade Discipline</label>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Florida Trades</option>
            <option value="hvac">HVAC / Mechanical</option>
            <option value="roofing">Roofing & Waterproofing</option>
            <option value="electrical">Electrical & Generator</option>
            <option value="plumbing">Plumbing & Utility</option>
            <option value="general_contracting">General Contracting</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Florida County (67)</label>
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All 67 FL Counties</option>
            {FLORIDA_COUNTIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} County
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Closing Window</label>
          <select
            value={closingWithinDays}
            onChange={(e) => setClosingWithinDays(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value={0}>Any Closing Date</option>
            <option value={7}>Closing in ≤ 7 Days</option>
            <option value={14}>Closing in ≤ 14 Days</option>
            <option value={30}>Closing in ≤ 30 Days</option>
          </select>
        </div>
      </div>

      {/* Bids List */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading bids matching criteria…</div>
        ) : bids.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No procurement opportunities matched your criteria. Try widening your geographic or trade filter.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {bids.map((bid) => (
              <div
                key={bid.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wide border border-cyan-500/20">
                      {bid.trade_slug || "Commercial"}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{bid.solicitation_number}</span>
                    <span className="text-xs text-slate-400">• {bid.agency_name}</span>
                    <span className="text-xs text-slate-500">• {bid.county} County</span>
                  </div>

                  <h3
                    onClick={() => setSelectedBid(bid)}
                    className="text-base font-semibold text-white hover:text-cyan-300 cursor-pointer transition-colors"
                  >
                    {bid.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{bid.description}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
                    <span>Est: <strong className="text-slate-200">{bid.estimated_value_display || "TBD"}</strong></span>
                    <span>•</span>
                    <span>Posted: {new Date(bid.posted_date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-amber-400">
                      Closes: {bid.closing_date ? new Date(bid.closing_date).toLocaleDateString() : "Open"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                  <button
                    onClick={() => toggleSave(bid)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      bid.is_saved
                        ? "bg-pink-500/20 text-pink-300 border-pink-500/30"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {bid.is_saved ? "★ Saved" : "☆ Save"}
                  </button>

                  <button
                    onClick={() => pushToPipeline(bid)}
                    className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                  >
                    + Add to Pipeline
                  </button>

                  <button
                    onClick={() => setSelectedBid(bid)}
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    View Details
                  </button>

                  <a
                    href={bid.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-400 transition-colors"
                  >
                    Source ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-[#0d1424] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-cyan-400">
                  {selectedBid.agency_name} • {selectedBid.county} County
                </span>
                <h2 className="text-lg font-bold text-white mt-1">{selectedBid.title}</h2>
                <div className="text-xs font-mono text-slate-400 mt-0.5">Sol #: {selectedBid.solicitation_number}</div>
              </div>
              <button
                onClick={() => setSelectedBid(null)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-black/40 p-3 text-xs">
              <div>
                <span className="text-slate-500 block">Trade:</span>
                <span className="font-semibold text-slate-200 uppercase">{selectedBid.trade_slug}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Estimated Value:</span>
                <span className="font-semibold text-cyan-300">{selectedBid.estimated_value_display || "TBD"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Closing Date:</span>
                <span className="font-semibold text-amber-400">
                  {selectedBid.closing_date ? new Date(selectedBid.closing_date).toLocaleDateString() : "Open"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-slate-400">Scope of Work</h4>
              <p className="text-xs text-slate-200 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5">
                {selectedBid.description}
              </p>
            </div>

            {selectedBid.qualification_requirements && selectedBid.qualification_requirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-slate-400">Qualification Requirements</h4>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                  {selectedBid.qualification_requirements.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedBid.pre_bid_conference && (
              <div className="space-y-1">
                <h4 className="text-xs font-mono uppercase text-slate-400">Pre-Bid Conference</h4>
                <p className="text-xs text-slate-300">{selectedBid.pre_bid_conference}</p>
              </div>
            )}

            {selectedBid.contact_name && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1 text-xs">
                <div className="font-semibold text-slate-200">Agency Contact</div>
                <div className="text-slate-300">{selectedBid.contact_name}</div>
                {selectedBid.contact_email && <div className="text-cyan-400">{selectedBid.contact_email}</div>}
                {selectedBid.contact_phone && <div className="text-slate-400">{selectedBid.contact_phone}</div>}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => pushToPipeline(selectedBid)}
                className="rounded-lg bg-cyan-500/20 text-cyan-300 px-4 py-2 text-xs font-semibold hover:bg-cyan-500/30"
              >
                + Add to Pipeline
              </button>
              <a
                href={selectedBid.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-cyan-500 text-black px-4 py-2 text-xs font-bold hover:bg-cyan-400"
              >
                Open Official Procurement Portal ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
