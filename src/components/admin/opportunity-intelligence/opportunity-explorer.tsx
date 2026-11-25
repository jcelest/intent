"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import type { OpportunityClassification, OpportunityRecord } from "@/lib/opportunity-hub";
import { ClassificationBadge, EmptyState, ErrorState, LoadingState, SectionHeading, ValueDisplay } from "./hub-ui";

const TRADES = ["hvac", "automation_controls", "monitoring", "energy", "refrigeration", "roofing", "electrical", "plumbing", "fire_protection", "facility_management", "commercial_construction", "security", "property_maintenance", "relationships"];
const CLASSIFICATIONS: OpportunityClassification[] = ["confirmed", "timing_based", "asset_based", "relationship", "inferred"];

interface ExplorerPreset {
  title: string;
  eyebrow?: string;
  description: string;
  classifications?: OpportunityClassification[];
  statuses?: string[];
  sort?: string;
  renewalBefore?: string;
}

interface ExplorerResponse {
  ok: boolean;
  records: OpportunityRecord[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
}

export function OpportunityExplorer({ preset }: { preset: ExplorerPreset }) {
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("");
  const [county, setCounty] = useState("");
  const [classification, setClassification] = useState<OpportunityClassification | "">(preset.classifications?.length === 1 ? preset.classifications[0] : "");
  const [confidence, setConfidence] = useState("");
  const [minValue, setMinValue] = useState("");
  const [sort, setSort] = useState(preset.sort || "newest");
  const [records, setRecords] = useState<OpportunityRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OpportunityRecord | null>(null);
  const [filterOpen, setFilterOpen] = useState(true);

  useEffect(() => {
    const initialParams = new URLSearchParams(window.location.search);
    setSearch(initialParams.get("search") || "");
    setTrade(initialParams.get("trade") || "");
    setCounty(initialParams.get("county") || "");
    const initialSort = initialParams.get("sort");
    if (initialSort) setSort(initialSort);
  }, []);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: "75", sort });
    if (search.trim()) params.set("search", search.trim());
    if (trade) params.append("trade", trade);
    if (county) params.append("county", county);
    if (confidence) params.set("confidenceMin", confidence);
    if (minValue) params.set("minDocumentedValue", minValue);
    const classifications = classification ? [classification] : preset.classifications || [];
    classifications.forEach((value) => params.append("classification", value));
    preset.statuses?.forEach((value) => params.append("status", value));
    if (preset.renewalBefore) params.set("expirationBefore", preset.renewalBefore);
    return `/api/opportunity-intelligence/hub/opportunities?${params}`;
  }, [classification, confidence, county, minValue, preset.classifications, preset.renewalBefore, preset.statuses, search, sort, trade]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(requestUrl, { cache: "no-store" });
      const data = await response.json() as ExplorerResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Opportunity query failed");
      setRecords(data.records);
      setTotal(data.total);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opportunity query failed");
    } finally {
      setLoading(false);
    }
  }, [requestUrl]);

  useEffect(() => { const timeout = window.setTimeout(load, 180); return () => window.clearTimeout(timeout); }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`${requestUrl}&cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const data = await response.json() as ExplorerResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load more records");
      setRecords((current) => [...current, ...data.records]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more records");
    } finally {
      setLoadingMore(false);
    }
  };

  const save = async (record: OpportunityRecord) => {
    const response = await fetch("/api/opportunity-intelligence/hub/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "item", itemType: "opportunity", itemId: record.id, title: record.title }) });
    if (!response.ok) setError("Could not save this opportunity.");
  };

  const exportParams = requestUrl.split("?")[1] || "";

  return (
    <div>
      <SectionHeading eyebrow={preset.eyebrow} title={preset.title} description={preset.description} actions={<><a href={`/api/opportunity-intelligence/hub/export?format=csv&${exportParams}`} className="border border-white/10 px-3 py-2 text-xs text-[#aeb6bd] hover:border-amber-300/30 hover:text-white">Export CSV</a><a href={`/api/opportunity-intelligence/hub/export?format=geojson&${exportParams}`} className="border border-white/10 px-3 py-2 text-xs text-[#aeb6bd] hover:border-amber-300/30 hover:text-white">Export GeoJSON</a></>} />

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className={`${filterOpen ? "block" : "hidden xl:block"} h-fit border border-white/[0.08] bg-[#0d1014]`}>
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5"><span className="text-xs font-semibold text-white">Filters</span><button onClick={() => { setSearch(""); setTrade(""); setCounty(""); setConfidence(""); setMinValue(""); setClassification(preset.classifications?.length === 1 ? preset.classifications[0] : ""); }} className="text-[10px] text-[#78828b] hover:text-amber-200">Reset</button></div>
          <div className="space-y-4 p-3">
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, address, organization…" className="w-full border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none focus:border-amber-300/40" /></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Trade</span><select value={trade} onChange={(event) => setTrade(event.target.value)} className="w-full border border-white/10 bg-[#101419] px-2.5 py-2 text-xs text-white outline-none"><option value="">All trades</option>{TRADES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Classification</span><select value={classification} onChange={(event) => setClassification(event.target.value as OpportunityClassification | "")} className="w-full border border-white/10 bg-[#101419] px-2.5 py-2 text-xs text-white outline-none"><option value="">All evidence classes</option>{CLASSIFICATIONS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">County</span><select value={county} onChange={(event) => setCounty(event.target.value)} className="w-full border border-white/10 bg-[#101419] px-2.5 py-2 text-xs text-white outline-none"><option value="">All 67 counties</option>{FLORIDA_COUNTIES.map((item) => <option key={item.fips} value={item.name}>{item.name}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Minimum evidence</span><select value={confidence} onChange={(event) => setConfidence(event.target.value)} className="w-full border border-white/10 bg-[#101419] px-2.5 py-2 text-xs text-white outline-none"><option value="">Any confidence</option><option value="90">90%+</option><option value="75">75%+</option><option value="50">50%+</option></select></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Minimum documented value</span><input type="number" min="0" value={minValue} onChange={(event) => setMinValue(event.target.value)} placeholder="Unknowns excluded" className="w-full border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none focus:border-amber-300/40" /></label>
            <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wider text-[#68727c]">Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)} className="w-full border border-white/10 bg-[#101419] px-2.5 py-2 text-xs text-white outline-none"><option value="newest">Newest discovered</option><option value="evidence">Strongest evidence</option><option value="documented_value">Highest documented value</option><option value="estimated_value">Highest estimated value</option><option value="deadline">Closest deadline</option><option value="renewal">Upcoming renewal</option></select></label>
          </div>
          <div className="border-t border-white/[0.07] p-3 text-[10px] leading-4 text-[#5f6972]">Unknown values remain unknown and are excluded from numeric thresholds. Client capability never removes a record.</div>
        </aside>

        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between"><button onClick={() => setFilterOpen((value) => !value)} className="text-xs text-[#89939c] xl:hidden">{filterOpen ? "Hide" : "Show"} filters</button><div className="ml-auto font-mono text-[11px] text-[#69737c]">{loading ? "Querying…" : `${total.toLocaleString()} matching · ${records.length.toLocaleString()} loaded`}</div></div>
          {error && <ErrorState message={error} onRetry={load} />}
          {loading ? <LoadingState /> : records.length === 0 ? <EmptyState title="No source-backed records match these filters" detail="This is a truthful empty result—not an indication that no market opportunities exist. Check source coverage or broaden the filters." /> : (
            <div className="overflow-hidden border border-white/[0.08] bg-[#0b0e11]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead className="bg-[#11151a] text-[10px] uppercase tracking-[0.12em] text-[#69737d]"><tr><th className="px-3 py-2.5 font-medium">Opportunity</th><th className="px-3 py-2.5 font-medium">Evidence</th><th className="px-3 py-2.5 font-medium">Location</th><th className="px-3 py-2.5 font-medium">Value</th><th className="px-3 py-2.5 font-medium">Timing</th><th className="px-3 py-2.5 font-medium">Source</th><th className="px-3 py-2.5" /></tr></thead>
                  <tbody className="divide-y divide-white/[0.055]">
                    {records.map((record) => <tr key={`${record.sourceType}:${record.id}`} className="group hover:bg-white/[0.025]">
                      <td className="max-w-md px-3 py-3 align-top"><button onClick={() => setSelected(record)} className="text-left"><div className="text-sm font-medium leading-5 text-[#e4e8ec] group-hover:text-amber-100">{record.title}</div>{record.isStale && <div className="mt-1 text-[10px] font-medium text-red-300">Stale — verify before pursuit</div>}<div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#747e87]">{record.summary || record.classificationRationale}</div><div className="mt-1.5 font-mono text-[10px] text-[#56616b]">{record.tradeSlug?.replaceAll("_", " ") || "unclassified"}{record.serviceCategory ? ` · ${record.serviceCategory}` : ""}</div></button></td>
                      <td className="px-3 py-3 align-top"><ClassificationBadge classification={record.classification} /><div className="mt-1.5 text-[10px] text-[#68727b]">{record.evidenceConfidence === null ? "Confidence unknown" : `${record.evidenceConfidence}% confidence`}</div></td>
                      <td className="px-3 py-3 align-top text-xs text-[#a8b0b7]"><div>{record.city || "Regional"}{record.county ? `, ${record.county}` : ""}</div><div className="mt-1 text-[10px] text-[#606a73]">{record.zipCode || record.geographicScopeType.replaceAll("_", " ")}</div></td>
                      <td className="px-3 py-3 align-top text-xs"><ValueDisplay documented={record.documentedValue} estimated={record.estimatedValue} /></td>
                      <td className="px-3 py-3 align-top text-[11px] text-[#9ba4ac]"><div>{record.procurementDeadline ? `Due ${new Date(record.procurementDeadline).toLocaleDateString()}` : "No deadline recorded"}</div>{record.contractExpirationDate && <div className="mt-1 text-amber-200">{record.expirationIsEstimated ? "Est. " : ""}expires {new Date(record.contractExpirationDate).toLocaleDateString()}</div>}</td>
                      <td className="max-w-44 px-3 py-3 align-top text-[11px]"><div className="truncate text-[#919aa2]">{record.sourceName || "Source record"}</div>{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-amber-200/80 hover:text-amber-100">Open evidence</a> : <span className="mt-1 block text-[#59636c]">No public URL</span>}</td>
                      <td className="px-3 py-3 align-top"><button onClick={() => save(record)} className="border border-white/10 px-2 py-1 text-[10px] text-[#858f98] hover:border-amber-300/30 hover:text-amber-200">Save</button></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              {hasMore && <div className="border-t border-white/[0.07] p-3 text-center"><button disabled={loadingMore} onClick={loadMore} className="border border-white/10 px-5 py-2 text-xs text-[#aeb6bd] hover:border-amber-300/30 hover:text-white disabled:opacity-50">{loadingMore ? "Loading…" : "Load next 75 records"}</button></div>}
            </div>
          )}
        </section>
      </div>

      {selected && <OpportunityDrawer record={selected} onClose={() => setSelected(null)} onSave={() => save(selected)} />}
    </div>
  );
}

function OpportunityDrawer({ record, onClose, onSave }: { record: OpportunityRecord; onClose: () => void; onSave: () => void }) {
  const address = [record.address, record.city, record.county, record.zipCode].filter(Boolean).join(", ");
  return <div className="fixed inset-0 z-[80] flex justify-end bg-black/60" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0c1014] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0c1014]/95 px-5 py-4 backdrop-blur"><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Intelligence record</div><button onClick={onClose} className="text-xs text-[#89929b] hover:text-white">Close</button></div><div className="space-y-6 p-5"><div><ClassificationBadge classification={record.classification} /><h3 className="mt-3 text-xl font-semibold leading-7 text-white">{record.title}</h3><p className="mt-2 text-sm leading-6 text-[#929ca5]">{record.summary || "No source summary recorded."}</p></div><dl className="grid grid-cols-2 gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] text-xs">{[["Status", record.status], ["Trade", record.tradeSlug?.replaceAll("_", " ") || "Unknown"], ["Location", address || record.geographicScopeType], ["Confidence", record.evidenceConfidence === null ? "Unknown" : `${record.evidenceConfidence}%`], ["Deadline", record.procurementDeadline ? new Date(record.procurementDeadline).toLocaleString() : "Unknown"], ["Expiration", record.contractExpirationDate ? `${record.expirationIsEstimated ? "Estimated · " : ""}${new Date(record.contractExpirationDate).toLocaleDateString()}` : "Unknown"]].map(([label, value]) => <div key={label} className="bg-[#11151a] p-3"><dt className="text-[10px] uppercase tracking-wider text-[#626c75]">{label}</dt><dd className="mt-1 text-[#d2d7dc]">{value}</dd></div>)}</dl><div><h4 className="text-xs font-semibold uppercase tracking-wider text-[#7f8992]">Classification rationale</h4><p className="mt-2 border-l-2 border-amber-300/40 pl-3 text-sm leading-6 text-[#a3abb3]">{record.classificationRationale}</p></div>{record.valueEstimationMethodology && <div><h4 className="text-xs font-semibold uppercase tracking-wider text-[#7f8992]">Value methodology</h4><p className="mt-2 text-sm leading-6 text-[#929ca5]">{record.valueEstimationMethodology}</p></div>}<div className="flex flex-wrap gap-2"><button onClick={onSave} className="border border-amber-300/30 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">Save opportunity</button>{address && <button onClick={() => navigator.clipboard.writeText(address)} className="border border-white/10 px-3 py-2 text-xs text-[#adb5bd]">Copy address</button>}{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="border border-white/10 px-3 py-2 text-xs text-[#adb5bd]">Google Maps</a>}<a href={`https://www.google.com/search?q=${encodeURIComponent(record.title)}`} target="_blank" rel="noreferrer" className="border border-white/10 px-3 py-2 text-xs text-[#adb5bd]">Google Search</a>{record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="border border-white/10 px-3 py-2 text-xs text-[#adb5bd]">Original source</a>}<Link href={`/admin/opportunity-intelligence/all?id=${record.id}`} className="border border-white/10 px-3 py-2 text-xs text-[#adb5bd]">Full record</Link></div><div className="border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-[#59636c]">Discovered {new Date(record.discoveredAt).toLocaleString()} · {record.lastVerifiedAt ? `Last verified ${new Date(record.lastVerifiedAt).toLocaleString()}` : "Verification timestamp unknown"}</div></div></aside></div>;
}
