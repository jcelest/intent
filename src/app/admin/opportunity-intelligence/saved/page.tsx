"use client";

import { useEffect, useState } from "react";
import type { SavedOpportunityRecord } from "@/lib/opportunity-intelligence";

export default function SavedOpportunitiesPage() {
  const [saved, setSaved] = useState<SavedOpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/saved");
      const data = await res.json();
      if (data.ok) {
        setSaved(data.saved || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const removeSaved = async (item: SavedOpportunityRecord) => {
    try {
      await fetch("/api/opportunity-intelligence/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidId: item.bid_id,
          networkId: item.network_id,
          opportunityType: item.opportunity_type,
          title: item.title,
          agencyOrCompany: item.agency_or_company,
        }),
      });
      setSaved((prev) => prev.filter((s) => s.id !== item.id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Saved Opportunities & Bookmarks</h1>
          <p className="text-xs text-slate-400 mt-1">
            Bookmarked Florida commercial solicitations and network partners pinned for review.
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400">{saved.length} Bookmarks Saved</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading saved opportunities…</div>
        ) : saved.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400 space-y-2">
            <div>No saved opportunities yet.</div>
            <div className="text-xs text-slate-500">
              Click the Save button on any Commercial Bid or Network to bookmark it here.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {saved.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-pink-500/10 px-2 py-0.5 text-[10px] font-bold text-pink-400 uppercase tracking-wide border border-pink-500/20">
                      {item.opportunity_type}
                    </span>
                    <span className="text-xs text-slate-400">{item.agency_or_company}</span>
                    {item.county && <span className="text-xs text-slate-500">• {item.county} County</span>}
                    {item.trade_slug && (
                      <span className="text-xs font-mono text-cyan-400 uppercase">• {item.trade_slug}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <div className="text-[11px] font-mono text-slate-500">
                    Saved on {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => removeSaved(item)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
