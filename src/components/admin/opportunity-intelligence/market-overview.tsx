"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HubOverview, OpportunityRecord } from "@/lib/opportunity-hub";
import { ClassificationBadge, EmptyState, ErrorState, LoadingState, SectionHeading, ValueDisplay } from "./hub-ui";
import { AtlasPreview } from "./atlas-preview";

export function MarketOverview() {
  const [overview, setOverview] = useState<HubOverview | null>(null);
  const [recent, setRecent] = useState<OpportunityRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [overviewResponse, recentResponse] = await Promise.all([
        fetch("/api/opportunity-intelligence/hub/overview", { cache: "no-store" }),
        fetch("/api/opportunity-intelligence/hub/opportunities?limit=8&sort=newest", { cache: "no-store" }),
      ]);
      const overviewData = await overviewResponse.json();
      const recentData = await recentResponse.json();
      if (!overviewResponse.ok || !overviewData.ok) throw new Error(overviewData.error || "Could not load market overview");
      setOverview(overviewData.overview);
      setRecent(recentData.records || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load market overview");
    }
  };

  useEffect(() => { load(); }, []);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!overview) return <LoadingState label="Computing statewide market statistics…" />;

  const stats = [
    ["Indexed opportunities", overview.indexedOpportunities, "Total searchable source-backed records"],
    ["Confirmed active", overview.confirmedActive, "Documented purchasing opportunities"],
    ["Timing windows", overview.timingBased, "Expiration and planned-event signals"],
    ["Asset-based", overview.assetBased, "Documented equipment relevance"],
    ["Relationships", overview.relationship, "Documented commercial portfolios"],
    ["Inferred", overview.inferred, "Transparent service relevance only"],
    ["Upcoming renewals", overview.upcomingRenewals, "Within 180 days"],
    ["Recent solicitations", overview.recentSolicitations, "Discovered in 30 days"],
  ] as const;

  return <div>
    <SectionHeading eyebrow="Statewide market overview" title="Florida commercial opportunity intelligence" description="A source-traceable view of documented solicitations, contract timing, commercial assets, relationships, permits, and transparent inferences. Statistics reflect the indexed database—not demonstration data." actions={<Link href="/admin/opportunity-intelligence/all" className="border border-amber-300/30 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">Explore all records</Link>} />

    <div className="grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(([label, value, note]) => <div key={label} className="bg-[#0d1014] p-4"><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#67717a]">{label}</div><div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value.toLocaleString()}</div><div className="mt-1 text-[11px] text-[#68727b]">{note}</div></div>)}
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
      <section className="relative min-h-[430px] overflow-hidden border border-white/[0.08] bg-[#0d1014]">
        <div className="absolute left-4 top-4 z-10 pointer-events-none"><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">Intent Atlas preview</div><div className="mt-1 text-sm font-medium text-white">{overview.mappedRecords.toLocaleString()} individually mapped records</div></div>
        <AtlasPreview />
        <Link href="/admin/opportunity-intelligence/atlas" className="absolute bottom-4 right-4 z-10 border border-white/15 bg-[#0b0e12]/90 px-3 py-2 text-xs text-white backdrop-blur hover:border-amber-300/40">Open full-screen Atlas</Link>
      </section>
      <section className="border border-white/[0.08] bg-[#0d1014]">
        <div className="border-b border-white/[0.07] px-4 py-3"><div className="text-sm font-semibold text-white">Indexed market footprint</div><div className="mt-0.5 text-[11px] text-[#66717a]">Coverage and documented value</div></div>
        <dl className="divide-y divide-white/[0.06] px-4">
          {[['Commercial properties', overview.commercialProperties], ['Documented equipment', overview.documentedEquipment], ['New permits · 30 days', overview.recentPermits], ['Mapped opportunity records', overview.mappedRecords]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between py-3 text-xs"><dt className="text-[#89939c]">{label}</dt><dd className="font-mono text-white">{Number(value).toLocaleString()}</dd></div>)}
          <div className="py-3"><dt className="text-[10px] uppercase tracking-wider text-[#68727b]">Documented active contract value</dt><dd className="mt-1 text-xl font-semibold text-emerald-300">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(overview.documentedActiveValue)}</dd><p className="mt-1 text-[10px] leading-4 text-[#5e6871]">Estimates are excluded from this total.</p></div>
        </dl>
      </section>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Distribution title="Opportunities by trade" data={overview.byTrade} />
      <Distribution title="Leading counties" data={overview.byCounty} />
    </div>

    <section className="mt-4 border border-white/[0.08] bg-[#0d1014]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3"><div><h3 className="text-sm font-semibold text-white">Recently discovered</h3><p className="mt-0.5 text-[11px] text-[#66717a]">Newest verified or source-backed records</p></div><Link href="/admin/opportunity-intelligence/all?sort=newest" className="text-xs text-amber-200">View all</Link></div>
      {recent.length === 0 ? <EmptyState title="No source-backed opportunities indexed yet" detail="The interface will not substitute placeholder records. Review Sources & Coverage, connect an operational adapter, and run ingestion." /> : <div className="divide-y divide-white/[0.06]">{recent.map((record) => <div key={`${record.sourceType}:${record.id}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_140px_150px_120px] md:items-center"><div><div className="text-sm font-medium text-[#e0e4e8]">{record.title}</div><div className="mt-1 text-[11px] text-[#69737c]">{record.sourceName || "Source record"} · {record.county || "Regional geography"}</div></div><ClassificationBadge classification={record.classification} /><div className="text-xs"><ValueDisplay documented={record.documentedValue} estimated={record.estimatedValue} /></div>{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="text-right text-xs text-amber-200">Open source</a> : <span className="text-right text-xs text-[#59636c]">No public URL</span>}</div>)}</div>}
    </section>
  </div>;
}

function Distribution({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return <section className="border border-white/[0.08] bg-[#0d1014] p-4"><h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>{data.length === 0 ? <div className="text-xs text-[#68727b]">No indexed records.</div> : <div className="space-y-2.5">{data.slice(0, 10).map((item) => <div key={item.label} className="grid grid-cols-[130px_minmax(0,1fr)_48px] items-center gap-3 text-[11px]"><div className="truncate capitalize text-[#9099a2]">{item.label.replaceAll("_", " ")}</div><div className="h-1.5 bg-white/[0.05]"><div className="h-full bg-amber-300/70" style={{ width: `${Math.max(2, item.count / max * 100)}%` }} /></div><div className="text-right font-mono text-[#c6ccd1]">{item.count.toLocaleString()}</div></div>)}</div>}</section>;
}
