"use client";

import { useEffect, useState } from "react";
import type { OutreachPipelineRecord } from "@/lib/opportunity-intelligence";

const STAGES = [
  { id: "identified", label: "Identified", color: "text-slate-300 bg-slate-500/10 border-slate-500/20" },
  { id: "qualified", label: "Qualified", color: "text-blue-300 bg-blue-500/10 border-blue-500/20" },
  { id: "contacted", label: "Contacted", color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" },
  { id: "proposal_ready", label: "Proposal Ready", color: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  { id: "submitted", label: "Bid Submitted", color: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
  { id: "won", label: "Won / Awarded", color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  { id: "lost", label: "Closed / Lost", color: "text-rose-300 bg-rose-500/10 border-rose-500/20" },
];

export default function OutreachPipelinePage() {
  const [pipeline, setPipeline] = useState<OutreachPipelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<OutreachPipelineRecord | null>(null);

  const loadPipeline = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/pipeline");
      const data = await res.json();
      if (data.ok) {
        setPipeline(data.pipeline || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, []);

  const handleStageChange = async (id: string, newStage: string) => {
    try {
      const res = await fetch("/api/opportunity-intelligence/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: newStage }),
      });
      const data = await res.json();
      if (data.ok) {
        setPipeline((prev) => prev.map((p) => (p.id === id ? { ...p, stage: newStage } : p)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNotes = async () => {
    if (!editingItem) return;
    try {
      await fetch("/api/opportunity-intelligence/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          stage: editingItem.stage,
          notes: editingItem.notes,
          nextAction: editingItem.next_action,
          nextFollowupAt: editingItem.next_followup_at,
        }),
      });
      setPipeline((prev) => prev.map((p) => (p.id === editingItem.id ? editingItem : p)));
      setEditingItem(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Commercial Outreach Pipeline</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track business development stages, follow-up dates, and client assignments for Florida opportunities.
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400">{pipeline.length} Active Opportunities in Pipeline</div>
      </div>

      {/* Stage Flow Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAGES.map((s) => {
          const count = pipeline.filter((p) => p.stage === s.id).length;
          return (
            <div key={s.id} className={`rounded-xl border p-3 ${s.color}`}>
              <div className="text-[10px] font-mono uppercase font-semibold">{s.label}</div>
              <div className="text-xl font-bold mt-1">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading pipeline records…</div>
        ) : pipeline.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400 space-y-2">
            <div>No opportunities in pipeline yet.</div>
            <div className="text-xs text-slate-500">
              Go to Commercial Bids or Commercial Networks and click &quot;+ Add to Pipeline&quot;.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pipeline.map((item) => (
              <div key={item.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02]">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300">
                      {item.target_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-semibold text-cyan-400">{item.target_name}</span>
                    {item.client_name && (
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                        Assigned: {item.client_name}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white">{item.opportunity_title}</h3>
                  {item.notes && <p className="text-xs text-slate-400 line-clamp-1">{item.notes}</p>}

                  {item.contact_person && (
                    <div className="text-[11px] text-slate-400">
                      Contact: <strong className="text-slate-300">{item.contact_person}</strong>{" "}
                      {item.contact_email ? `(${item.contact_email})` : ""}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">Stage:</label>
                    <select
                      value={item.stage}
                      onChange={(e) => handleStageChange(item.id, e.target.value)}
                      className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    >
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setEditingItem(item)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                  >
                    Edit Notes & Follow-up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Notes Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#0d1424] p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Update Pipeline Record</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Name:</label>
                <div className="font-semibold text-slate-200">{editingItem.target_name}</div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Next Action Required:</label>
                <input
                  type="text"
                  value={editingItem.next_action || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, next_action: e.target.value })}
                  placeholder="e.g. Follow up on pre-bid clarifications"
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Internal Notes:</label>
                <textarea
                  rows={3}
                  value={editingItem.notes || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  placeholder="Enter details on client match, bonding, or outreach notes..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-cyan-400"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
