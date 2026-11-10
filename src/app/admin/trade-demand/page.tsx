"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";

type Trade = { slug: string; name: string; active: boolean };
type Client = { id: string; name: string };
type SyncRun = {
  id: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  records_seen: number;
  records_added: number;
  records_updated: number;
  records_unchanged: number;
  error_message?: string | null;
};
type Shortcut = { label: string; url: string; kind: string };
type Opportunity = {
  id: string;
  buyer_name: string;
  project_name?: string | null;
  project_phase?: string | null;
  service_territory?: string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  trade_slug?: string | null;
  evidence_type: string;
  source_label: string;
  source_url: string;
  source_is_manual: boolean;
  rank_score: number;
  rank_reason: string;
  next_action?: string | null;
  next_action_at?: string | null;
  deadline?: string | null;
  deadline_needs_verification: boolean;
  stage: string;
  bid_open: boolean;
  active: boolean;
  permit_number?: string | null;
  assignments: Array<{ id: string; name: string; status: string }>;
};
type Meta = { trades: Trade[]; clients: Client[]; syncRuns: SyncRun[]; sourceShortcuts: Shortcut[] };

const evidenceLabels: Record<string, string> = {
  early_planning: "Early planning",
  permit_activity: "Permit activity",
  vendor_intake: "Vendor intake",
  published_bid: "Published bid",
  buyer_confirmed: "Buyer confirmed",
};

const initialManual = {
  buyerName: "",
  tradeSlug: "",
  projectName: "",
  projectPhase: "",
  serviceTerritory: "",
  address: "",
  city: "",
  county: "Orange",
  jobType: "",
  evidenceType: "published_bid",
  evidenceExcerpt: "",
  sourceUrl: "",
  sourceLabel: "",
  publishedAt: "",
  checkedAt: new Date().toISOString().slice(0, 10),
  deadline: "",
  deadlineTimezone: "America/New_York",
  submissionRoute: "",
  bidOpen: false,
  acceptingSubmissionsConfirmed: false,
  publicContactName: "",
  publicContactPhone: "",
  publicContactEmail: "",
  nextAction: "",
  nextActionAt: "",
  primeContractStatus: "unknown",
};

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function inputClass() {
  return "w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400";
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { data, status: response.status });
  return data;
}

export default function TradeDemandPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [manual, setManual] = useState(initialManual);
  const [savingManual, setSavingManual] = useState(false);
  const [newTrade, setNewTrade] = useState("");
  const [filters, setFilters] = useState({
    trade: "", location: "", buyer: "", evidenceType: "", deadline: "", clientId: "", nextAction: "", includeInactive: false,
  });

  const loadMeta = useCallback(async () => {
    const data = await readJson(await fetch("/api/admin/trade-demand/meta", { credentials: "include", cache: "no-store" }));
    setMeta(data);
  }, []);

  const loadQueue = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== false) params.set(key, String(value));
    });
    const data = await readJson(await fetch(`/api/admin/trade-demand?${params}`, { credentials: "include", cache: "no-store" }));
    setOpportunities(data.opportunities);
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMeta(), loadQueue()])
      .then(() => setError(null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Trade Demand."))
      .finally(() => setLoading(false));
  }, [loadMeta, loadQueue]);

  const activeTrades = useMemo(() => meta?.trades.filter((trade) => trade.active) ?? [], [meta]);
  const lastSync = meta?.syncRuns[0];
  const lastSuccessfulSync = meta?.syncRuns.find((run) => run.status === "succeeded");

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      await readJson(await fetch("/api/admin/trade-demand/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowDays: 45, maxRecords: 2500 }),
      }));
      await Promise.all([loadMeta(), loadQueue()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
      await loadMeta().catch(() => undefined);
    } finally {
      setSyncing(false);
    }
  }

  async function submitManual(event: FormEvent) {
    event.preventDefault();
    setSavingManual(true);
    setError(null);
    try {
      const payload = {
        ...manual,
        publishedAt: manual.publishedAt || null,
        checkedAt: manual.checkedAt || null,
        deadline: manual.deadline ? new Date(manual.deadline).toISOString() : null,
        nextActionAt: manual.nextActionAt ? new Date(manual.nextActionAt).toISOString() : null,
      };
      const data = await readJson(await fetch("/api/admin/trade-demand", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      setManual(initialManual);
      setShowManual(false);
      await loadQueue();
      window.location.href = `/admin/trade-demand/${data.opportunity.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual evidence.");
    } finally {
      setSavingManual(false);
    }
  }

  async function addTrade(event: FormEvent) {
    event.preventDefault();
    if (!newTrade.trim()) return;
    try {
      await readJson(await fetch("/api/admin/trade-demand/meta", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTrade }),
      }));
      setNewTrade("");
      await loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add trade.");
    }
  }

  function applyShortcut(shortcut: Shortcut) {
    setManual((value) => ({ ...value, sourceUrl: shortcut.url, sourceLabel: shortcut.label }));
    setShowManual(true);
  }

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-slate-800 pb-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-400">Central Florida buyer intelligence</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Trade Demand</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Call the right buyer with traceable evidence, match the work to a contractor client, and follow it through paid and repeat work.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowManual((value) => !value)} className="rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20">
              + Add evidence
            </button>
            <button onClick={syncNow} disabled={syncing} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
              {syncing ? "Syncing Orlando…" : "Sync Orlando now"}
            </button>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Orlando live connector</p>
                {lastSuccessfulSync ? (
                  <p className="mt-1 text-sm text-slate-300">
                    Last successful sync {formatDate(lastSuccessfulSync.finished_at || lastSuccessfulSync.started_at)} · {lastSuccessfulSync.records_added} added · {lastSuccessfulSync.records_updated} updated · {lastSuccessfulSync.records_unchanged} unchanged
                  </p>
                ) : <p className="mt-1 text-sm text-amber-300">No sync has completed yet.</p>}
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-mono text-emerald-300">LIVE · SOCRATA</span>
            </div>
            {lastSync?.status === "failed" && <p className="mt-3 text-sm text-red-300">Latest sync failed: {lastSync.error_message || "Unknown error"}</p>}
          </div>
          <button onClick={() => setShowSetup((value) => !value)} className="rounded-xl border border-slate-800 bg-slate-950/70 px-5 py-3 text-sm text-slate-300 hover:border-slate-600">Sources & trades</button>
        </section>

        {showSetup && (
          <section className="mt-4 grid gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-white">Verified source shortcuts</h3>
              <p className="mt-1 text-xs text-slate-500">These remain manual unless labeled live. Login-gated submissions are never automated.</p>
              <div className="mt-4 space-y-2">
                {meta?.sourceShortcuts.map((shortcut) => (
                  <div key={shortcut.url} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2">
                    <div className="min-w-0">
                      <a href={shortcut.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-cyan-300 hover:underline">{shortcut.label}</a>
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">{shortcut.kind}</p>
                    </div>
                    {shortcut.kind !== "Live Socrata connector" && <button onClick={() => applyShortcut(shortcut)} className="shrink-0 text-xs text-slate-300 hover:text-white">Use</button>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">Configurable trades</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {meta?.trades.map((trade) => <span key={trade.slug} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{trade.name}</span>)}
              </div>
              <form onSubmit={addTrade} className="mt-4 flex gap-2">
                <input value={newTrade} onChange={(event) => setNewTrade(event.target.value)} placeholder="Add trade" className={inputClass()} />
                <button className="rounded-lg border border-cyan-400/40 px-4 text-sm text-cyan-200">Add</button>
              </form>
              <h4 className="mt-6 text-sm font-semibold text-white">Recent sync runs</h4>
              <div className="mt-2 space-y-2">
                {meta?.syncRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400">
                    <p><span className={run.status === "succeeded" ? "text-emerald-300" : "text-red-300"}>{run.status.toUpperCase()}</span> · {formatDate(run.finished_at || run.started_at)} · {run.records_added} added · {run.records_updated} updated</p>
                    {run.error_message && <p className="mt-1 text-red-300">{run.error_message}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {showManual && (
          <form onSubmit={submitManual} className="mt-6 rounded-xl border border-cyan-400/30 bg-slate-950/90 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-lg font-semibold text-white">Manual evidence intake</h3><p className="mt-1 text-xs text-slate-500">GC bid packages, vendor applications, planning agendas, and property-manager requests.</p></div>
              <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300">MANUAL SOURCE</span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-400">Buyer<input required value={manual.buyerName} onChange={(e) => setManual({ ...manual, buyerName: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Trade<select required value={manual.tradeSlug} onChange={(e) => setManual({ ...manual, tradeSlug: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="">Select trade</option>{activeTrades.map((trade) => <option key={trade.slug} value={trade.slug}>{trade.name}</option>)}</select></label>
              <label className="text-xs text-slate-400">Evidence type<select value={manual.evidenceType} onChange={(e) => setManual({ ...manual, evidenceType: e.target.value, bidOpen: e.target.value === "published_bid" ? manual.bidOpen : false })} className={`mt-1 ${inputClass()}`}>{Object.entries(evidenceLabels).filter(([key]) => key !== "permit_activity").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="text-xs text-slate-400">Project / development<input value={manual.projectName} onChange={(e) => setManual({ ...manual, projectName: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Project phase<input value={manual.projectPhase} onChange={(e) => setManual({ ...manual, projectPhase: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Service territory (recurring work)<input value={manual.serviceTerritory} onChange={(e) => setManual({ ...manual, serviceTerritory: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Address<input value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">City<input value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">County<input value={manual.county} onChange={(e) => setManual({ ...manual, county: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Source URL<input required type="url" value={manual.sourceUrl} onChange={(e) => setManual({ ...manual, sourceUrl: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Source label<input value={manual.sourceLabel} onChange={(e) => setManual({ ...manual, sourceLabel: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Submission / contact route<input value={manual.submissionRoute} onChange={(e) => setManual({ ...manual, submissionRoute: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Publication date<input type="date" value={manual.publishedAt} onChange={(e) => setManual({ ...manual, publishedAt: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Checked date<input type="date" value={manual.checkedAt} onChange={(e) => setManual({ ...manual, checkedAt: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Deadline (leave blank if unknown)<input type="datetime-local" value={manual.deadline} onChange={(e) => setManual({ ...manual, deadline: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Deadline timezone<input value={manual.deadlineTimezone} onChange={(e) => setManual({ ...manual, deadlineTimezone: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              <label className="text-xs text-slate-400">Prime contract status<select value={manual.primeContractStatus} onChange={(e) => setManual({ ...manual, primeContractStatus: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="unknown">Unknown</option><option value="holds_prime">Holds prime contract</option><option value="still_bidding">Still bidding prime</option></select></label>
              <label className="text-xs text-slate-400">Next action<input value={manual.nextAction} onChange={(e) => setManual({ ...manual, nextAction: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
            </div>
            <label className="mt-4 block text-xs text-slate-400">Evidence excerpt<textarea required rows={3} value={manual.evidenceExcerpt} onChange={(e) => setManual({ ...manual, evidenceExcerpt: e.target.value })} className={`mt-1 ${inputClass()}`} placeholder="Paste the exact source language supporting the claim." /></label>
            {manual.evidenceType === "published_bid" && (
              <div className="mt-4 grid gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 md:grid-cols-2">
                <label className="flex items-center gap-3 text-sm text-amber-100"><input type="checkbox" checked={manual.bidOpen} onChange={(e) => setManual({ ...manual, bidOpen: e.target.checked })} /> Mark as open bid</label>
                <label className="flex items-center gap-3 text-sm text-amber-100"><input type="checkbox" checked={manual.acceptingSubmissionsConfirmed} onChange={(e) => setManual({ ...manual, acceptingSubmissionsConfirmed: e.target.checked })} /> Source names this trade scope and accepts submissions</label>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setShowManual(false)} className="px-4 py-2 text-sm text-slate-400">Cancel</button><button disabled={savingManual} className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{savingManual ? "Saving…" : "Save evidence"}</button></div>
          </form>
        )}

        <section className="mt-7">
          <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <select value={filters.trade} onChange={(e) => setFilters({ ...filters, trade: e.target.value })} className={inputClass()}><option value="">All trades</option>{activeTrades.map((trade) => <option key={trade.slug} value={trade.slug}>{trade.name}</option>)}</select>
            <input value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} placeholder="County or city" className={inputClass()} />
            <input value={filters.buyer} onChange={(e) => setFilters({ ...filters, buyer: e.target.value })} placeholder="Buyer" className={inputClass()} />
            <select value={filters.evidenceType} onChange={(e) => setFilters({ ...filters, evidenceType: e.target.value })} className={inputClass()}><option value="">All evidence</option>{Object.entries(evidenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <select value={filters.deadline} onChange={(e) => setFilters({ ...filters, deadline: e.target.value })} className={inputClass()}><option value="">Any deadline</option><option value="7_days">Next 7 days</option><option value="30_days">Next 30 days</option><option value="unknown">Unknown deadline</option><option value="overdue">Past deadline</option></select>
            <select value={filters.clientId} onChange={(e) => setFilters({ ...filters, clientId: e.target.value })} className={inputClass()}><option value="">All clients</option>{meta?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
            <select value={filters.nextAction} onChange={(e) => setFilters({ ...filters, nextAction: e.target.value })} className={inputClass()}><option value="">Any next action</option><option value="due">Due now</option><option value="scheduled">Scheduled</option><option value="missing">Missing</option></select>
            <label className="flex items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400"><input type="checkbox" checked={filters.includeInactive} onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })} /> Include expired / closed</label>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Prioritized work queue</h3><span className="font-mono text-xs text-slate-500">{opportunities.length} records</span></div>
          {loading && <div className="rounded-xl border border-slate-800 p-10 text-center text-slate-500">Loading queue…</div>}
          {!loading && opportunities.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">No opportunities match these filters. Sync Orlando or add manual evidence.</div>}
          {opportunities.map((opportunity) => (
            <Link key={opportunity.id} href={`/admin/trade-demand/${opportunity.id}`} className="group block rounded-xl border border-slate-800 bg-slate-950/75 p-5 transition hover:border-cyan-400/50 hover:bg-slate-900/80">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.7fr_1.5fr_1.2fr]">
                <div>
                  <div className="flex flex-wrap gap-2"><span className="rounded bg-cyan-400/10 px-2 py-1 text-[11px] font-bold uppercase text-cyan-300">{opportunity.trade_slug || "Classify trade"}</span><span className="rounded bg-slate-800 px-2 py-1 text-[11px] uppercase text-slate-400">{evidenceLabels[opportunity.evidence_type] || opportunity.evidence_type}</span>{opportunity.source_is_manual && <span className="rounded bg-amber-400/10 px-2 py-1 text-[11px] text-amber-300">MANUAL</span>}</div>
                  <h4 className="mt-3 font-semibold text-white group-hover:text-cyan-200">{opportunity.buyer_name}</h4>
                  <p className="mt-1 text-sm text-slate-400">{opportunity.project_name || opportunity.service_territory || opportunity.address || "Project needs verification"}</p>
                  <p className="mt-1 text-xs text-slate-600">{[opportunity.city, opportunity.county && `${opportunity.county} County`, opportunity.permit_number].filter(Boolean).join(" · ")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Priority</p>
                  <p className="mt-1 text-3xl font-bold text-cyan-300">{opportunity.rank_score}</p>
                  <p className="mt-2 text-xs text-slate-500">{opportunity.stage.replaceAll("_", " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Why today</p>
                  <p className="mt-2 text-sm leading-5 text-slate-300">{opportunity.rank_reason}</p>
                  {opportunity.deadline_needs_verification && <p className="mt-2 text-xs font-semibold text-amber-300">Deadline unknown — verify before treating as active.</p>}
                  {opportunity.deadline && <p className="mt-2 text-xs text-slate-500">Deadline: {formatDate(opportunity.deadline)}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Ask / do next</p>
                  <p className="mt-2 text-sm leading-5 text-white">{opportunity.next_action || "Set a next action."}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{opportunity.source_label}</span>{opportunity.assignments.map((assignment) => <span key={assignment.id} className="rounded-full border border-violet-400/30 px-2 py-0.5 text-violet-300">{assignment.name}</span>)}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
