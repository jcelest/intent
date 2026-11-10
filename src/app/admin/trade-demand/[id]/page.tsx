"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";

type DbRow = Record<string, ReturnType<typeof JSON.parse>>;
type DetailData = {
  opportunity: DbRow;
  permit: DbRow | null;
  evidence: DbRow[];
  activities: DbRow[];
  assignments: DbRow[];
  related: DbRow[];
  clientMatches: Array<DbRow & { match: { score: number; missing: string[]; reasons: string[] } }>;
};
type Meta = { trades: Array<{ slug: string; name: string; active: boolean }> };

const stages = [
  ["identified", "Identified"],
  ["introduction", "Introduction"],
  ["bid_invited", "Bid invited"],
  ["bid_submitted", "Bid submitted"],
  ["awarded", "Awarded"],
  ["lost", "Lost"],
  ["first_paid_work_order", "First paid work order"],
  ["repeat_work", "Repeat work"],
] as const;

const evidenceLabels: Record<string, string> = {
  early_planning: "Early planning",
  permit_activity: "Permit activity",
  vendor_intake: "Vendor intake",
  published_bid: "Published bid",
  buyer_confirmed: "Buyer confirmed",
};

function inputClass() {
  return "w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400";
}

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { data, status: response.status });
  return data;
}

export default function TradeDemandDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<DetailData | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentWarning, setAssignmentWarning] = useState<{ clientId: string; competitors: DbRow[] } | null>(null);
  const [edit, setEdit] = useState<DbRow>({});
  const [activity, setActivity] = useState({
    activityType: "call_note", summary: "", contactName: "", confirmationDetails: "", stageTo: "", nextAction: "", nextActionAt: "",
  });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ trades: "", serviceAreas: "", jobTypes: "", capacityNotes: "", qualifications: "" });

  const load = useCallback(async () => {
    const [detail, metadata] = await Promise.all([
      readJson(await fetch(`/api/admin/trade-demand/${id}`, { credentials: "include", cache: "no-store" })),
      readJson(await fetch("/api/admin/trade-demand/meta", { credentials: "include", cache: "no-store" })),
    ]);
    setData(detail);
    setMeta(metadata);
    const opportunity = detail.opportunity;
    setEdit({
      buyerName: opportunity.buyer_name ?? "",
      projectName: opportunity.project_name ?? "",
      projectPhase: opportunity.project_phase ?? "",
      serviceTerritory: opportunity.service_territory ?? "",
      tradeSlug: opportunity.trade_slug ?? "",
      jobType: opportunity.job_type ?? "",
      city: opportunity.city ?? "",
      county: opportunity.county ?? "",
      evidenceType: opportunity.evidence_type,
      deadline: toLocalDateTime(opportunity.deadline),
      deadlineTimezone: opportunity.deadline_timezone ?? "America/New_York",
      primeContractStatus: opportunity.prime_contract_status ?? "unknown",
      stage: opportunity.stage,
      nextAction: opportunity.next_action ?? "",
      nextActionAt: toLocalDateTime(opportunity.next_action_at),
      staffNotes: opportunity.staff_notes ?? "",
      qualificationRequirements: (opportunity.qualification_requirements ?? []).join(", "),
    });
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load opportunity."))
      .finally(() => setLoading(false));
  }, [load]);

  const activeAssignmentClientIds = useMemo(
    () => new Set(data?.assignments.filter((item) => item.status === "active").map((item) => item.client_id) ?? []),
    [data]
  );

  async function saveOpportunity(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch(`/api/admin/trade-demand/${id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...edit,
          deadline: edit.deadline ? new Date(edit.deadline).toISOString() : null,
          nextActionAt: edit.nextActionAt ? new Date(edit.nextActionAt).toISOString() : null,
          qualificationRequirements: String(edit.qualificationRequirements || "").split(",").map((value) => value.trim()).filter(Boolean),
        }),
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save opportunity.");
    } finally {
      setSaving(false);
    }
  }

  async function logActivity(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch(`/api/admin/trade-demand/${id}/activities`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activity,
          nextActionAt: activity.nextActionAt ? new Date(activity.nextActionAt).toISOString() : null,
        }),
      }));
      setActivity({ activityType: "call_note", summary: "", contactName: "", confirmationDetails: "", stageTo: "", nextAction: "", nextActionAt: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log activity.");
    } finally {
      setSaving(false);
    }
  }

  async function assignClient(clientId: string, overrideWarning = false) {
    setError(null);
    try {
      await readJson(await fetch(`/api/admin/trade-demand/${id}/assignments`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, overrideWarning }),
      }));
      setAssignmentWarning(null);
      await load();
    } catch (err: unknown) {
      const requestError = err as Error & { status?: number; data?: { competitors?: DbRow[] } };
      if (requestError.status === 409) {
        setAssignmentWarning({ clientId, competitors: requestError.data?.competitors ?? [] });
      } else {
        setError(err instanceof Error ? err.message : "Failed to assign client.");
      }
    }
  }

  function openProfile(client: DbRow) {
    setProfileId(client.id);
    setProfile({
      trades: (client.trades ?? []).join(", "),
      serviceAreas: (client.service_areas ?? []).join(", "),
      jobTypes: (client.job_types ?? []).join(", "),
      capacityNotes: client.capacity_notes ?? "",
      qualifications: (client.qualifications ?? []).join(", "),
    });
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profileId) return;
    const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    try {
      await readJson(await fetch(`/api/admin/trade-demand/clients/${profileId}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: list(profile.trades), serviceAreas: list(profile.serviceAreas), jobTypes: list(profile.jobTypes), capacityNotes: profile.capacityNotes, qualifications: list(profile.qualifications) }),
      }));
      setProfileId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client profile.");
    }
  }

  if (loading) return <div className="min-h-screen"><AdminHeader /><main className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-500">Loading opportunity…</main></div>;
  if (!data) return <div className="min-h-screen"><AdminHeader /><main className="mx-auto max-w-7xl px-4 py-16"><p className="text-red-300">{error || "Opportunity not found."}</p></main></div>;
  const opportunity = data.opportunity;

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/trade-demand" className="font-mono text-sm text-slate-400 hover:text-cyan-300">← Work queue</Link>
        <div className="mt-5 flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-bold uppercase text-cyan-300">{opportunity.trade_slug || "Classify trade"}</span>
              <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase text-slate-400">{evidenceLabels[opportunity.evidence_type] || opportunity.evidence_type}</span>
              {opportunity.source_is_manual && <span className="rounded bg-amber-400/10 px-2 py-1 text-xs text-amber-300">MANUAL SOURCE</span>}
              {opportunity.bid_open && <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">OPEN BID</span>}
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-white">{opportunity.buyer_name}</h2>
            <p className="mt-2 text-slate-400">{opportunity.project_name || opportunity.service_territory || opportunity.address}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 lg:max-w-md">
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Why today · priority {opportunity.rank_score}</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{opportunity.rank_reason}</p>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        {assignmentWarning && (
          <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">Competing assignment warning</p>
            <p className="mt-1">Already assigned to {assignmentWarning.competitors.map((item) => item.client_name).join(", ")}. Assigning another client may create a conflict.</p>
            <div className="mt-3 flex gap-3"><button onClick={() => assignClient(assignmentWarning.clientId, true)} className="rounded bg-amber-300 px-3 py-2 font-semibold text-slate-950">Assign anyway</button><button onClick={() => setAssignmentWarning(null)} className="px-3 py-2 text-amber-100">Cancel</button></div>
          </div>
        )}

        <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Evidence and source</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="text-[10px] uppercase tracking-wider text-slate-600">Source</p><a href={opportunity.source_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-cyan-300 hover:underline">{opportunity.source_label} ↗</a></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-600">Deadline</p><p className={`mt-1 text-sm ${opportunity.deadline_needs_verification ? "text-amber-300" : "text-slate-300"}`}>{opportunity.deadline ? formatDate(opportunity.deadline) : "Unknown — verify"}</p></div>
                <div className="md:col-span-2"><p className="text-[10px] uppercase tracking-wider text-slate-600">Evidence excerpt</p><p className="mt-1 text-sm leading-6 text-slate-300">{opportunity.evidence_summary}</p></div>
              </div>
              {data.permit && (
                <div className="mt-5 rounded-lg border border-slate-800 bg-black/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-mono text-sm text-cyan-300">Permit {data.permit.permit_number}</h4><a href={data.permit.source_url} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white">Inspect source record ↗</a></div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[['Application', data.permit.application_type], ['Work type', data.permit.work_type], ['Status', data.permit.status], ['Processed', formatDate(data.permit.processed_at)], ['Issued', formatDate(data.permit.issued_at)], ['Address', data.permit.address], ['Parcel', data.permit.parcel_number], ['Contractor', data.permit.contractor_name], ['Business', data.permit.contractor_business_name], ['Public phone', data.permit.contractor_phone], ['Estimated cost', data.permit.estimated_cost ? `$${Number(data.permit.estimated_cost).toLocaleString()}` : 'Not provided'], ['Last checked', formatDate(data.permit.last_seen_at)]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 text-slate-300">{value || "Not provided"}</dd></div>)}
                  </dl>
                  <p className="mt-4 text-xs leading-5 text-amber-200/80">Permit activity is construction evidence only. It does not prove a trade scope is open for bids.</p>
                </div>
              )}
              <div className="mt-5 space-y-2">
                {data.evidence.map((item) => <div key={item.id} className="rounded-lg border border-slate-800 px-4 py-3"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold uppercase text-slate-400">{evidenceLabels[item.evidence_type] || item.evidence_type}{item.is_manual ? " · manual" : ""}</span><span className="text-xs text-slate-600">Checked {formatDate(item.checked_at)}</span></div><p className="mt-2 text-sm text-slate-300">{item.excerpt}</p></div>)}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Client matches</h3>
              <p className="mt-1 text-xs text-slate-500">Scored by trade, service area, job type, capacity, and known qualifications. Missing profile data stays visible.</p>
              <div className="mt-4 space-y-3">
                {data.clientMatches.length === 0 && <p className="text-sm text-slate-500">No paid or LeadNet client records are available.</p>}
                {data.clientMatches.map((client) => (
                  <div key={client.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><div className="flex items-center gap-3"><h4 className="font-semibold text-white">{client.name}</h4><span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-xs text-violet-300">Fit {client.match.score}</span></div><p className="mt-2 text-xs text-slate-500">{client.match.reasons.join(" · ") || "No confirmed fit fields yet"}</p>{client.match.missing.length > 0 && <p className="mt-1 text-xs text-amber-300">Missing: {client.match.missing.join(", ")}</p>}</div>
                      <div className="flex gap-2"><button onClick={() => openProfile(client)} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">Profile</button><button disabled={activeAssignmentClientIds.has(client.id)} onClick={() => assignClient(client.id)} className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">{activeAssignmentClientIds.has(client.id) ? "Assigned" : "Assign"}</button></div>
                    </div>
                    {profileId === client.id && <form onSubmit={saveProfile} className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2"><label className="text-xs text-slate-500">Trades (comma-separated)<input value={profile.trades} onChange={(e) => setProfile({ ...profile, trades: e.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-500">Service areas<input value={profile.serviceAreas} onChange={(e) => setProfile({ ...profile, serviceAreas: e.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-500">Job types<input value={profile.jobTypes} onChange={(e) => setProfile({ ...profile, jobTypes: e.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-500">Qualifications<input value={profile.qualifications} onChange={(e) => setProfile({ ...profile, qualifications: e.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-500 sm:col-span-2">Capacity notes<textarea value={profile.capacityNotes} onChange={(e) => setProfile({ ...profile, capacityNotes: e.target.value })} className={`mt-1 ${inputClass()}`} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setProfileId(null)} className="px-3 py-2 text-xs text-slate-400">Cancel</button><button className="rounded border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200">Save profile</button></div></form>}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Log buyer call or progress</h3>
              <form onSubmit={logActivity} className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-slate-400">Activity<select value={activity.activityType} onChange={(e) => setActivity({ ...activity, activityType: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="call_note">Call note</option><option value="buyer_confirmation">Buyer confirmation</option><option value="email_note">Email note</option><option value="meeting_note">Meeting note</option><option value="stage_change">Stage update</option></select></label>
                <label className="text-xs text-slate-400">Contact / confirmer<input value={activity.contactName} onChange={(e) => setActivity({ ...activity, contactName: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400 md:col-span-2">What happened<textarea required rows={3} value={activity.summary} onChange={(e) => setActivity({ ...activity, summary: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                {activity.activityType === "buyer_confirmation" && <label className="text-xs text-slate-400 md:col-span-2">Who confirmed what<textarea required value={activity.confirmationDetails} onChange={(e) => setActivity({ ...activity, confirmationDetails: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>}
                <label className="text-xs text-slate-400">Move stage<select value={activity.stageTo} onChange={(e) => setActivity({ ...activity, stageTo: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="">No stage change</option>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs text-slate-400">Next action<input value={activity.nextAction} onChange={(e) => setActivity({ ...activity, nextAction: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">Follow-up date<input type="datetime-local" value={activity.nextActionAt} onChange={(e) => setActivity({ ...activity, nextActionAt: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <div className="flex items-end justify-end"><button disabled={saving} className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Log activity</button></div>
              </form>
              <div className="mt-6 space-y-3 border-t border-slate-800 pt-5">
                {data.activities.map((item) => <article key={item.id} className="border-l-2 border-slate-700 pl-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold uppercase text-cyan-300">{item.activity_type.replaceAll("_", " ")}</p><time className="text-xs text-slate-600">{formatDate(item.occurred_at)}</time></div><p className="mt-1 text-sm text-slate-300">{item.summary}</p>{item.contact_name && <p className="mt-1 text-xs text-slate-500">Contact: {item.contact_name}</p>}{item.stage_to && <p className="mt-1 text-xs text-violet-300">{item.stage_from?.replaceAll("_", " ")} → {item.stage_to.replaceAll("_", " ")}</p>}</article>)}
                {data.activities.length === 0 && <p className="text-sm text-slate-500">No calls or progress logged yet.</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Public business contact</h3>
              <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-600">Name</dt><dd className="text-slate-300">{opportunity.public_contact_name || "Not provided"}</dd></div><div><dt className="text-xs text-slate-600">Phone</dt><dd>{opportunity.public_contact_phone ? <a href={`tel:${opportunity.public_contact_phone}`} className="text-cyan-300">{opportunity.public_contact_phone}</a> : <span className="text-slate-500">Not provided</span>}</dd></div><div><dt className="text-xs text-slate-600">Email</dt><dd>{opportunity.public_contact_email ? <a href={`mailto:${opportunity.public_contact_email}`} className="break-all text-cyan-300">{opportunity.public_contact_email}</a> : <span className="text-slate-500">Not provided</span>}</dd></div></dl>
            </section>

            <form onSubmit={saveOpportunity} className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Classification & workflow</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-slate-500">Buyer<input value={edit.buyerName || ""} onChange={(e) => setEdit({ ...edit, buyerName: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Project<input value={edit.projectName || ""} onChange={(e) => setEdit({ ...edit, projectName: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Phase<input value={edit.projectPhase || ""} onChange={(e) => setEdit({ ...edit, projectPhase: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Trade<select value={edit.tradeSlug || ""} onChange={(e) => setEdit({ ...edit, tradeSlug: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="">Needs classification</option>{meta?.trades.filter((trade) => trade.active).map((trade) => <option key={trade.slug} value={trade.slug}>{trade.name}</option>)}</select></label>
                <label className="block text-xs text-slate-500">Stage<select value={edit.stage || ""} onChange={(e) => setEdit({ ...edit, stage: e.target.value })} className={`mt-1 ${inputClass()}`}>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block text-xs text-slate-500">Prime status<select value={edit.primeContractStatus || "unknown"} onChange={(e) => setEdit({ ...edit, primeContractStatus: e.target.value })} className={`mt-1 ${inputClass()}`}><option value="unknown">Unknown</option><option value="holds_prime">Holds prime</option><option value="still_bidding">Still bidding</option></select></label>
                <label className="block text-xs text-slate-500">Deadline<input type="datetime-local" value={edit.deadline || ""} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Next action<textarea value={edit.nextAction || ""} onChange={(e) => setEdit({ ...edit, nextAction: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Follow-up<input type="datetime-local" value={edit.nextActionAt || ""} onChange={(e) => setEdit({ ...edit, nextActionAt: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                <label className="block text-xs text-slate-500">Qualification requirements<input value={edit.qualificationRequirements || ""} onChange={(e) => setEdit({ ...edit, qualificationRequirements: e.target.value })} className={`mt-1 ${inputClass()}`} placeholder="bonding, license, insurance" /></label>
                <label className="block text-xs text-slate-500">Staff notes<textarea rows={4} value={edit.staffNotes || ""} onChange={(e) => setEdit({ ...edit, staffNotes: e.target.value })} className={`mt-1 ${inputClass()}`} /></label>
              </div>
              <button disabled={saving} className="mt-4 w-full rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">Save changes</button>
            </form>

            <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
              <h3 className="font-semibold text-white">Buyer / project history</h3>
              <p className="mt-1 text-xs text-slate-500">Check existing relationships before another outreach.</p>
              <div className="mt-4 space-y-3">
                {data.related.map((item) => <Link key={item.id} href={`/admin/trade-demand/${item.id}`} className="block rounded-lg border border-slate-800 p-3 hover:border-slate-600"><div className="flex justify-between gap-2"><span className="text-sm text-slate-200">{item.project_name || item.buyer_name}</span><span className="text-xs uppercase text-cyan-300">{item.trade_slug || "unclassified"}</span></div><p className="mt-1 text-xs text-slate-500">{item.stage.replaceAll("_", " ")} · {evidenceLabels[item.evidence_type] || item.evidence_type}</p></Link>)}
                {data.related.length === 0 && <p className="text-sm text-slate-500">No other buyer or project records.</p>}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
