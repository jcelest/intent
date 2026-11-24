"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import { EmptyState, ErrorState, LoadingState, SectionHeading } from "./hub-ui";

interface Column { key: string; label: string; format?: "currency" | "date" | "boolean" | "number" | "source"; }
interface Props { type: string; eyebrow: string; title: string; description: string; columns: Column[]; }

function valueFor(row: Record<string, unknown>, column: Column) {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return <span className="text-[#58626b]">Unknown</span>;
  if (column.format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
  if (column.format === "date") return new Date(String(value)).toLocaleDateString();
  if (column.format === "boolean") return value ? "Yes" : "No";
  if (column.format === "number") return Number(value).toLocaleString();
  if (column.format === "source") return <a href={String(value)} target="_blank" rel="noreferrer" className="text-amber-200 hover:text-amber-100">Open source</a>;
  return String(value);
}

export function ResourceExplorer({ type, eyebrow, title, description, columns }: Props) {
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 75;
  const requestUrl = useMemo(() => { const params = new URLSearchParams({ type, limit: String(limit), offset: String(offset) }); if (search.trim()) params.set("search", search.trim()); if (county) params.append("county", county); return `/api/opportunity-intelligence/hub/resources?${params}`; }, [county, offset, search, type]);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch(requestUrl, { cache: "no-store" }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || `Could not load ${type}`); setRecords(data.records); setTotal(data.total); } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not load ${type}`); } finally { setLoading(false); } }, [requestUrl, type]);
  useEffect(() => { const timer = window.setTimeout(load, 150); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { setOffset(0); }, [search, county]);

  const download = () => {
    const lines = [columns.map((column) => `"${column.label}"`).join(","), ...records.map((row) => columns.map((column) => `"${String(row[column.key] ?? "").replaceAll('"', '""')}"`).join(","))];
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); link.download = `intent-${type}-page-${offset / limit + 1}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  return <div><SectionHeading eyebrow={eyebrow} title={title} description={description} actions={<button onClick={download} disabled={!records.length} className="border border-white/10 px-3 py-2 text-xs text-[#aab2b9] disabled:opacity-40">Export visible page</button>} /><div className="mb-3 flex flex-col gap-2 border border-white/[0.08] bg-[#0d1014] p-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${type}…`} className="min-w-0 flex-1 border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/40" /><select value={county} onChange={(event) => setCounty(event.target.value)} className="border border-white/10 bg-[#101419] px-3 py-2 text-xs text-white"><option value="">All Florida counties</option>{FLORIDA_COUNTIES.map((item) => <option key={item.fips} value={item.name}>{item.name}</option>)}</select><div className="self-center font-mono text-[10px] text-[#66717a]">{total.toLocaleString()} indexed</div></div>{error && <ErrorState message={error} onRetry={load} />}{loading ? <LoadingState /> : !records.length ? <EmptyState title={`No indexed ${type}`} detail="No placeholder rows are shown. Check Sources & Coverage to determine whether this dataset is connected for the selected jurisdiction." /> : <div className="overflow-hidden border border-white/[0.08] bg-[#0b0e11]"><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead className="bg-[#11151a] text-[10px] uppercase tracking-wider text-[#69737c]"><tr>{columns.map((column) => <th key={column.key} className="px-3 py-2.5 font-medium">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.055]">{records.map((row, index) => <tr key={String(row.id || index)} className="hover:bg-white/[0.025]">{columns.map((column) => <td key={column.key} className="max-w-xs truncate px-3 py-3 text-xs text-[#aeb6bd]">{valueFor(row, column)}</td>)}</tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="border border-white/10 px-3 py-1.5 text-[10px] text-[#aab2b9] disabled:opacity-30">Previous</button><span className="font-mono text-[10px] text-[#66717a]">{offset + 1}–{Math.min(total, offset + records.length)} of {total}</span><button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="border border-white/10 px-3 py-1.5 text-[10px] text-[#aab2b9] disabled:opacity-30">Next</button></div></div>}</div>;
}
