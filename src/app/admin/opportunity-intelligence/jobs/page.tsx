"use client";

import { useEffect, useState } from "react";
import type { CollectionJobRecord } from "@/lib/opportunity-intelligence";
import { CheckIcon } from "@/components/admin/opportunity-intelligence/icons";

export default function CollectionJobsPage() {
  const [jobs, setJobs] = useState<CollectionJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [jobNotice, setJobNotice] = useState<string | null>(null);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/jobs");
      const data = await res.json();
      if (data.ok) {
        setJobs(data.jobs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const triggerJob = async (jobType: string) => {
    try {
      setTriggering(true);
      const res = await fetch("/api/opportunity-intelligence/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType }),
      });
      const data = await res.json();
      if (data.ok) {
        setJobNotice(`Collection job [${jobType}] completed successfully.`);
        await loadJobs();
        setTimeout(() => setJobNotice(null), 4000);
      }
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Florida Data Collection Jobs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Execution history and incremental synchronization jobs across Florida procurement portals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerJob("state_procurement")}
            disabled={triggering}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            Run State MFMP/FDOT Sweep
          </button>
          <button
            onClick={() => triggerJob("county_procurement")}
            disabled={triggering}
            className="rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            {triggering ? "Running Sweep…" : "Run Full 67-County Sweep"}
          </button>
        </div>
      </div>

      {jobNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300 inline-flex items-center gap-1.5 w-full">
          <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0" /> {jobNotice}
        </div>
      )}

      {/* Jobs Log Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-mono text-slate-400">Loading collection job history…</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No collection runs logged yet. Click &quot;Run Full 67-County Sweep&quot; above to initiate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-black/40 text-[10px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="p-4">Job Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Records Seen</th>
                  <th className="p-4">Records Added</th>
                  <th className="p-4">Records Updated</th>
                  <th className="p-4">Triggered By</th>
                  <th className="p-4 text-right">Execution Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 text-white font-sans font-semibold">
                      {j.job_type.replace(/_/g, " ").toUpperCase()}
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
                        {j.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{j.records_seen}</td>
                    <td className="p-4 text-emerald-400">+{j.records_added}</td>
                    <td className="p-4 text-cyan-400">{j.records_updated}</td>
                    <td className="p-4 text-slate-400">{j.triggered_by}</td>
                    <td className="p-4 text-right text-slate-400 text-[11px]">
                      {new Date(j.started_at).toLocaleString()}
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
