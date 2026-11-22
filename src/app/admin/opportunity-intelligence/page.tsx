"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OpportunityOverviewStats, CommercialBidRecord } from "@/lib/opportunity-intelligence";

export default function OpportunityIntelligenceOverviewPage() {
  const [stats, setStats] = useState<OpportunityOverviewStats | null>(null);
  const [recentBids, setRecentBids] = useState<CommercialBidRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, bidsRes] = await Promise.all([
        fetch("/api/opportunity-intelligence/overview"),
        fetch("/api/opportunity-intelligence/bids?limit=5"),
      ]);

      const statsData = await statsRes.json();
      const bidsData = await bidsRes.json();

      if (statsData.ok) {
        setStats(statsData.stats);
      } else {
        setError(statsData.error || "Failed to load overview statistics");
      }

      if (bidsData.ok) {
        setRecentBids(bidsData.bids || []);
      }
    } catch {
      setError("Network error while connecting to Opportunity Intelligence database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/opportunity-intelligence/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "all_sources" }),
      });
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-2xl border border-white/10 bg-[#0d1424] p-12 text-center">
        <div className="space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm font-mono text-slate-400">Querying Florida commercial opportunity database…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center text-red-300">
        <h3 className="text-lg font-semibold mb-2">Opportunity Intelligence Offline</h3>
        <p className="text-sm font-mono mb-4">{error}</p>
        <button
          onClick={loadData}
          className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/30 via-[#0d1424] to-blue-950/30 p-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Florida Statewide Command</span>
          <h1 className="text-2xl font-bold text-white mt-1">Commercial Procurement & Network Intelligence</h1>
          <p className="text-sm text-slate-300 mt-1">
            Tracking public bids, private networks, and trade opportunities across Florida&apos;s 67 counties.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerRefresh}
            disabled={refreshing}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "🔄 Trigger Refresh"}
          </button>
          <Link
            href="/admin/opportunity-intelligence/geographic-search"
            className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400 transition-colors"
          >
            Run Territory Search
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (11 Required Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Active FL Bids</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{stats?.totalActiveBids ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Open solicitations</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">New Today</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats?.newBidsToday ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Discovered today</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Closing ≤ 7 Days</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats?.bidsClosingWithin7Days ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Urgent response</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Commercial Orgs</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats?.totalCommercialNetworks ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">GCs & developers</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">New Orgs Month</div>
          <div className="text-2xl font-bold text-violet-400 mt-1">{stats?.newNetworksThisMonth ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Recently indexed</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Saved Opps</div>
          <div className="text-2xl font-bold text-pink-400 mt-1">{stats?.savedOpportunitiesCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Bookmarked</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Client Assigned</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{stats?.assignedToClientsCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">In client pipeline</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Outreach Active</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">{stats?.activeOutreachCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Conversations open</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Active Sources</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{stats?.activeSourcesCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Counties & agencies</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-xs font-mono uppercase text-slate-400">Failed Sources</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{stats?.failedSourcesCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Healthy: 0 issues</div>
        </div>

        <div className="col-span-2 rounded-xl border border-white/10 bg-[#0d1424] p-4 flex flex-col justify-between">
          <div className="text-xs font-mono uppercase text-slate-400">Last Data Refresh</div>
          <div className="text-sm font-semibold text-white mt-1">
            {stats?.lastSuccessfulRefresh
              ? new Date(stats.lastSuccessfulRefresh).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Synchronizing…"}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Neon Connection
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/opportunity-intelligence/geographic-search"
          className="group rounded-2xl border border-white/10 bg-[#0d1424] p-6 hover:border-cyan-500/50 hover:bg-[#111a30] transition-all"
        >
          <div className="text-2xl mb-2">🗺️</div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">Florida Geographic Search</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Search any combination of Florida ZIP codes, 67 counties, cities, or regions simultaneously with instant spatial resolution.
          </p>
        </Link>

        <Link
          href="/admin/opportunity-intelligence/bids"
          className="group rounded-2xl border border-white/10 bg-[#0d1424] p-6 hover:border-cyan-500/50 hover:bg-[#111a30] transition-all"
        >
          <div className="text-2xl mb-2">📋</div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">Commercial Bids Engine</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Search and filter active public bids across State procurement, School Districts, Airports, and all 67 Florida counties.
          </p>
        </Link>

        <Link
          href="/admin/opportunity-intelligence/pipeline"
          className="group rounded-2xl border border-white/10 bg-[#0d1424] p-6 hover:border-cyan-500/50 hover:bg-[#111a30] transition-all"
        >
          <div className="text-2xl mb-2">💼</div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">Outreach Pipeline</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Assign discovered opportunities to Intent Revenue clients and track stages from identification to awarded contracts.
          </p>
        </Link>
      </div>

      {/* Recent Discovered Bids Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-base font-semibold text-white">Recently Indexed Florida Opportunities</h3>
          <Link
            href="/admin/opportunity-intelligence/bids"
            className="text-xs font-mono text-cyan-400 hover:underline"
          >
            View all bids →
          </Link>
        </div>

        <div className="divide-y divide-white/5 overflow-x-auto">
          {recentBids.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No active bids recorded in database.</div>
          ) : (
            recentBids.map((bid) => (
              <div key={bid.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02]">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wide border border-cyan-500/20">
                      {bid.trade_slug || "Commercial"}
                    </span>
                    <span className="text-xs text-slate-400">{bid.agency_name}</span>
                    <span className="text-xs text-slate-500">• {bid.county} County</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white hover:text-cyan-300">{bid.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-1">{bid.description}</p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-200">{bid.estimated_value_display || "Unspecified"}</div>
                    <div className="text-[11px] text-amber-400 font-mono">
                      Closes: {bid.closing_date ? new Date(bid.closing_date).toLocaleDateString() : "Open"}
                    </div>
                  </div>
                  <a
                    href={bid.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                  >
                    Source ↗
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
