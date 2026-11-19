"use client";

import type { Call as VoiceCall, Device as VoiceDevice } from "@twilio/voice-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/logo";

type Row = Record<string, unknown>;
type View = "dashboard" | "leads" | "calls" | "tasks" | "sequences" | "pipeline" | "dnc" | "settings";
type CallPhase = "idle" | "connecting" | "ringing" | "open" | "completed" | "error";

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "leads", label: "Leads", icon: "users" },
  { id: "calls", label: "Calls", icon: "phone" },
  { id: "tasks", label: "Tasks", icon: "check" },
  { id: "sequences", label: "Sequences", icon: "sequence" },
  { id: "pipeline", label: "Pipeline", icon: "pipeline" },
];

const DISPOSITIONS = [
  ["no_answer", "No answer"], ["voicemail", "Voicemail"], ["busy", "Busy"], ["failed", "Failed"],
  ["contacted", "Contacted"], ["interested", "Interested"], ["callback", "Callback"],
  ["appointment", "Appointment"], ["not_interested", "Not interested"], ["wrong_number", "Wrong number"],
  ["dnc", "Do not call"], ["converted", "Converted"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  to_call: "To call", try_again: "Try again", follow_up: "Follow up", closed: "Closed",
  no_answer: "No answer", voicemail: "Voicemail", busy: "Busy", failed: "Failed", contacted: "Contacted",
  interested: "Interested", callback: "Callback", appointment: "Appointment", not_interested: "Not interested",
  wrong_number: "Wrong number", dnc: "DNC", converted: "Converted", queued: "Queued", initiated: "Initiated",
  ringing: "Ringing", "in-progress": "Connected", completed: "Completed", canceled: "Canceled",
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Request failed.");
  return data as T;
}

function text(row: Row | null | undefined, key: string) {
  return row?.[key] == null ? "" : String(row[key]);
}

function number(row: Row | null | undefined, key: string) {
  return Number(row?.[key] || 0);
}

function leadName(lead: Row | null | undefined) {
  const name = `${text(lead, "first_name")} ${text(lead, "last_name")}`.trim();
  return name || text(lead, "company") || "Unnamed lead";
}

function formatPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : String(value || "—");
}

function formatDate(value: unknown, withTime = true) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", withTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function localTime(lead: Row) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: text(lead, "timezone") || "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date());
  } catch { return "Local time unavailable"; }
}

function csvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

type ParsedLead = Record<string, string | boolean | undefined>;

function csvCategory(value: string) {
  const category = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!category) return {};
  if (["new", "ready", "to call", "not called", "uncontacted", "pending"].includes(category)) return { status: "to_call" };
  if (category.includes("voicemail")) return { status: "try_again", disposition: "voicemail" };
  if (category === "busy") return { status: "try_again", disposition: "busy" };
  if (["failed", "unreachable", "disconnected"].some((term) => category.includes(term))) return { status: "try_again", disposition: "failed" };
  if (["no answer", "no response", "not reached", "retry", "try again"].some((term) => category.includes(term))) return { status: "try_again", disposition: "no_answer" };
  if (["do not call", "dnc"].some((term) => category === term || category.includes(term))) return { status: "closed", disposition: "dnc", doNotCall: true };
  if (["wrong number", "bad number"].some((term) => category.includes(term))) return { status: "closed", disposition: "wrong_number" };
  if (["not interested", "no interest"].some((term) => category.includes(term))) return { status: "closed", disposition: "not_interested" };
  if (["converted", "won", "sale", "customer"].some((term) => category === term || category.includes(term))) return { status: "closed", disposition: "converted" };
  if (["appointment", "meeting booked", "booked", "demo scheduled"].some((term) => category.includes(term))) return { status: "follow_up", disposition: "appointment" };
  if (["callback", "call back", "maybe later"].some((term) => category.includes(term))) return { status: "follow_up", disposition: "callback" };
  if (["interested", "qualified"].some((term) => category.includes(term))) return { status: "follow_up", disposition: "interested" };
  if (["contacted", "conversation", "spoke", "talked"].some((term) => category.includes(term))) return { status: "follow_up", disposition: "contacted" };
  if (["follow up", "followup"].includes(category)) return { status: "follow_up" };
  if (["closed", "lost"].includes(category)) return { status: "closed" };
  return {};
}

function parseLeadCsv(input: string): ParsedLead[] {
  const rows = csvRows(input);
  if (rows.length < 2) return [];
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rows[0].map(normalize);
  const get = (row: string[], ...names: string[]) => {
    const index = headers.findIndex((header) => names.map(normalize).includes(header));
    return index >= 0 ? row[index] || "" : "";
  };
  return rows.slice(1).map((row) => {
    const outcome = get(row, "disposition", "outcome", "result", "call result", "call status", "lead status", "status", "stage", "category");
    const note = get(row, "notes", "note", "your note", "call notes", "comments", "comment");
    const reviews = get(row, "google reviews", "review count", "reviews");
    const licenseAge = get(row, "license age", "license age days", "license days", "days licensed");
    const context = [note, reviews ? `${reviews} Google reviews` : "", licenseAge ? `license ${licenseAge} days old` : ""].filter(Boolean).join(" · ");
    return {
      firstName: get(row, "first name", "firstname", "contact first name"),
      lastName: get(row, "last name", "lastname", "contact last name"),
      company: get(row, "company", "business", "business name", "company name"),
      title: get(row, "title", "job title"),
      phone: get(row, "phone", "phone number", "mobile", "telephone"),
      email: get(row, "email", "email address"),
      city: get(row, "city"),
      state: get(row, "state"),
      postalCode: get(row, "zip", "zipcode", "postal code"),
      source: get(row, "source", "list", "campaign") || "CSV import",
      notes: context,
      nextCallAt: get(row, "callback at", "callback date", "follow up date", "next call", "next call at", "due date"),
      ...csvCategory(outcome),
    };
  }).filter((lead) => lead.phone);
}

export function DialerWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view") as View | null;
  const view: View = requestedView && [...VIEWS.map((item) => item.id), "dnc", "settings"].includes(requestedView) ? requestedView : "leads";
  const [overview, setOverview] = useState<Row>({});
  const [leads, setLeads] = useState<Row[]>([]);
  const [calls, setCalls] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [sequences, setSequences] = useState<Row[]>([]);
  const [dnc, setDnc] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row>({});
  const [lists, setLists] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "single"; id: string; name: string } | { type: "bulk"; count: number } | null>(null);
  const [deletingLead, setDeletingLead] = useState(false);
  const [modal, setModal] = useState<"lead" | "import" | "task" | "user" | "password" | "dialpad" | "guardrails" | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [activeLead, setActiveLead] = useState<Row | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callError, setCallError] = useState("");
  const [incomingCall, setIncomingCall] = useState<VoiceCall | null>(null);
  const [disposition, setDisposition] = useState("contacted");
  const [callNotes, setCallNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [autoDial, setAutoDial] = useState(true);
  const deviceRef = useRef<VoiceDevice | null>(null);
  const callRef = useRef<VoiceCall | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [overviewData, leadsData, settingsData, listsData] = await Promise.all([
        api<Row>("/api/dialer/overview"),
        api<{ leads: Row[] }>("/api/dialer/leads?limit=1000"),
        api<Row>("/api/dialer/settings"),
        api<{ lists: Row[] }>("/api/dialer/lists"),
      ]);
      setOverview(overviewData);
      setLeads(leadsData.leads);
      setSettings(settingsData);
      setLists(listsData.lists);
      const extras = await Promise.all([
        api<{ calls: Row[] }>("/api/dialer/calls?limit=500"),
        api<{ tasks: Row[] }>("/api/dialer/tasks?status=all"),
        api<{ sequences: Row[] }>("/api/dialer/sequences"),
        api<{ entries: Row[] }>("/api/dialer/dnc"),
      ]);
      setCalls(extras[0].calls); setTasks(extras[1].tasks); setSequences(extras[2].sequences); setDnc(extras[3].entries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the dialer.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const matchesStatus = statusFilter === "all" || text(lead, "status") === statusFilter;
    const haystack = `${leadName(lead)} ${text(lead, "company")} ${text(lead, "phone_e164")} ${text(lead, "email")}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase());
  }), [leads, search, statusFilter]);

  const currentUser = (overview.user || settings.currentUser || {}) as Row;
  const users = (settings.users || []) as Row[];
  const counts = (overview.counts || {}) as Row;
  const metrics = (overview.metrics || {}) as Row;
  const twilio = (settings.twilio || {}) as Row;
  const workspace = ((settings.settings as Row | undefined)?.workspace as Row | undefined) || {};
  const guardrailsActive = workspace.guardrailsEnabled !== false && workspace.enforceCallingWindow !== false;

  useEffect(() => {
    if (Boolean(currentUser.mustChangePassword) && !passwordChanged && modal === null) setModal("password");
  }, [currentUser.mustChangePassword, modal, passwordChanged]);

  const navigate = (next: View) => {
    const isDialerHost = window.location.hostname === "call.intentrev.net" || window.location.hostname.startsWith("call.localhost");
    router.push(`${isDialerHost ? "/" : "/admin/dialer"}?view=${next}`);
  };

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current;
    const tokenData = await api<{ token: string }>("/api/twilio/token");
    const { Device } = await import("@twilio/voice-sdk");
    const device = new Device(tokenData.token, { closeProtection: true });
    device.on("incoming", (call) => setIncomingCall(call));
    device.on("tokenWillExpire", async () => {
      try { device.updateToken((await api<{ token: string }>("/api/twilio/token")).token); } catch { /* next call will surface it */ }
    });
    device.on("error", (event) => setCallError(event.message || "Twilio device error."));
    await device.register();
    deviceRef.current = device;
    return device;
  }, []);

  useEffect(() => {
    if (!Boolean(twilio.configured)) return;
    void ensureDevice().catch((cause) => {
      setCallError(cause instanceof Error ? cause.message : "Unable to register for inbound calls.");
    });
  }, [ensureDevice, twilio.configured]);

  useEffect(() => () => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
  }, []);

  const placeCall = useCallback(async (lead: Row) => {
    if (callRef.current) return;
    setActiveLead(lead); setCallError(""); setCallNotes(""); setCallbackAt(""); setDisposition("contacted");
    setCallPhase("connecting");
    const localCallId = crypto.randomUUID();
    setActiveCallId(localCallId);
    try {
      const device = await ensureDevice();
      const call = await device.connect({ params: { leadId: text(lead, "id"), dialerCallId: localCallId } });
      callRef.current = call;
      call.on("ringing", () => setCallPhase("ringing"));
      call.on("accept", () => setCallPhase("open"));
      const finish = () => { callRef.current = null; setCallPhase("completed"); };
      call.on("disconnect", finish); call.on("cancel", finish); call.on("reject", finish);
      call.on("error", (event) => { callRef.current = null; setCallError(event.message || "Call failed."); setCallPhase("error"); });
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : "Unable to start call.");
      setCallPhase("error");
    }
  }, [ensureDevice]);

  const endCall = () => callRef.current?.disconnect();

  const sendDigit = (digit: string) => {
    if (!callRef.current || callPhase !== "open") return;
    callRef.current.sendDigits(digit);
  };

  const saveDisposition = async () => {
    if (!activeLead) return;
    try {
      const result = await api<{ nextLead: Row | null }>("/api/dialer/disposition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: text(activeLead, "id"), callId: activeCallId, disposition, notes: callNotes, callbackAt: callbackAt || null }),
      });
      setToast("Outcome saved");
      setActiveLead(null); setActiveCallId(null); setCallPhase("idle");
      await refresh();
      if (autoDial && result.nextLead) setTimeout(() => void placeCall(result.nextLead as Row), 450);
    } catch (cause) { setCallError(cause instanceof Error ? cause.message : "Unable to save outcome."); }
  };

  const handleDeleteLeads = async () => {
    if (!confirmDelete) return;
    setDeletingLead(true);
    try {
      if (confirmDelete.type === "bulk") {
        await api("/api/dialer/leads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
        setToast(`${confirmDelete.count} lead${confirmDelete.count === 1 ? "" : "s"} deleted`);
      } else {
        await api(`/api/dialer/leads/${confirmDelete.id}`, { method: "DELETE" });
        setSelectedIds((prev) => prev.filter((id) => id !== confirmDelete.id));
        setToast("Lead deleted");
      }
      setConfirmDelete(null);
      await refresh();
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Failed to delete lead(s)");
    } finally {
      setDeletingLead(false);
    }
  };

  const logout = async () => {
    deviceRef.current?.destroy();
    await fetch("/api/admin/logout", { method: "POST" });
    const isDialerHost = window.location.hostname === "call.intentrev.net" || window.location.hostname.startsWith("call.localhost");
    window.location.href = isDialerHost ? "/login" : "/admin/login";
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#f8fafc] text-[#0f172a]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#e2e8f0] bg-[#f1f5f9] lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[#e2e8f0] px-5">
          <DialerBrandMark />
          <div><div className="font-semibold tracking-tight text-[#0f172a]">Intent Dialer</div><div className="text-[10px] uppercase tracking-[.2em] text-[#64748b]">Private workspace</div></div>
        </div>
        <div className="px-4 pt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-[#64748b]">Dialing tools</div>
        <div className="space-y-1.5 px-3 pt-2">
          <button
            type="button"
            onClick={() => setModal("dialpad")}
            className="flex w-full items-center justify-between rounded-xl border border-[#b8d0e6] bg-[#edf5fc] px-3.5 py-2.5 text-sm font-semibold text-[#1266c4] shadow-xs transition hover:border-[#1266c4] hover:bg-[#e1effb] active:scale-[.99]"
          >
            <span className="flex items-center gap-2.5">
              <Icon name="dialpad" className="h-4 w-4" />
              <span>Keypad</span>
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1266c4] shadow-xs">
              Dial
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModal("guardrails")}
            className="flex w-full items-center justify-between rounded-xl border border-[#dce6f1] bg-white px-3.5 py-2 text-xs font-semibold text-[#1e293b] shadow-2xs transition hover:border-[#b8d0e6] hover:bg-[#f8fafc] active:scale-[.99]"
          >
            <span className="flex items-center gap-2.5">
              <Icon name="sliders" className="h-4 w-4 text-[#1266c4]" />
              <span>Guardrails</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                guardrailsActive ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${guardrailsActive ? "bg-emerald-500" : "bg-amber-500"}`} />
              {guardrailsActive ? "Active" : "Flexible"}
            </span>
          </button>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {VIEWS.map((item) => <NavButton key={item.id} {...item} active={view === item.id} onClick={() => navigate(item.id)} />)}
        </nav>
        <div className="mt-auto space-y-1 border-t border-[#e2e8f0] p-3">
          <NavButton id="dnc" label="Do not call" icon="shield" active={view === "dnc"} onClick={() => navigate("dnc")} />
          <NavButton id="settings" label="Settings & team" icon="settings" active={view === "settings"} onClick={() => navigate("settings")} />
          <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-xs">
            <div className="flex items-center gap-3">
              <Avatar name={text(currentUser, "displayName") || text(currentUser, "display_name")} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0f172a]">{text(currentUser, "displayName") || text(currentUser, "display_name")}</div><div className="text-xs capitalize text-[#64748b]">{text(currentUser, "role")}</div></div>
              <button onClick={logout} title="Log out" className="rounded-md p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-red-600 transition"><Icon name="logout" /></button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <MobileHeader view={view} navigate={navigate} logout={logout} onOpenDialpad={() => setModal("dialpad")} onOpenGuardrails={() => setModal("guardrails")} guardrailsActive={guardrailsActive} />
        {error && <div className="mx-auto mt-5 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!Boolean(twilio.configured) && view !== "settings" && (
          <button onClick={() => navigate("settings")} className="mx-4 mt-4 flex max-w-7xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-5 text-amber-800 sm:mx-6 lg:mx-auto lg:mt-5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> <span className="min-w-0">Add the Twilio environment variables before placing calls. Open settings for the exact webhook URLs.</span>
          </button>
        )}
        <main className="mx-auto min-w-0 max-w-[1500px] overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10">
          {view === "dashboard" && <Dashboard counts={counts} metrics={metrics} recentCalls={(overview.recentCalls || []) as Row[]} conversations={(overview.conversations || []) as Row[]} outcomeBreakdown={(overview.outcomeBreakdown || []) as Row[]} tasks={(overview.tasks || []) as Row[]} repStats={(overview.repStats || []) as Row[]} onNavigate={navigate} onOpenDialpad={() => setModal("dialpad")} />}
          {view === "leads" && <ResponsiveLeadsView leads={visibleLeads} allLeads={leads} counts={counts} users={users} lists={lists} statusFilter={statusFilter} setStatusFilter={setStatusFilter} search={search} setSearch={setSearch} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onDial={placeCall} onOpenDialpad={() => setModal("dialpad")} onOpenGuardrails={() => setModal("guardrails")} onAdd={() => setModal("lead")} onImport={() => setModal("import")} onRefresh={refresh} onRequestDeleteLead={(id, name) => setConfirmDelete({ type: "single", id, name })} onRequestDeleteBulk={() => setConfirmDelete({ type: "bulk", count: selectedIds.length })} onNotify={(msg) => setToast(msg)} />}
          {view === "calls" && <ResponsiveCallsView calls={calls} users={users} onRefresh={refresh} onOpenDialpad={() => setModal("dialpad")} onNotify={(msg) => setToast(msg)} />}
          {view === "tasks" && <TasksView tasks={tasks} onCreate={() => setModal("task")} onRefresh={refresh} />}
          {view === "sequences" && <SequencesView sequences={sequences} onRefresh={refresh} />}
          {view === "pipeline" && <PipelineView leads={leads} onDial={placeCall} onOpenDialpad={() => setModal("dialpad")} onDeleteLead={(id, name) => setConfirmDelete({ type: "single", id, name })} />}
          {view === "dnc" && <DncView entries={dnc} onRefresh={refresh} />}
          {view === "settings" && <SettingsView settings={settings} currentUser={currentUser} onCreateUser={() => setModal("user")} onChangePassword={() => setModal("password")} onRefresh={refresh} onNotify={(msg) => setToast(msg)} />}
        </main>
      </div>

      <MobileBottomNav view={view} navigate={navigate} />
      {toast && <div className="fixed bottom-20 left-1/2 z-[80] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl bg-[#123b70] px-5 py-2.5 text-center text-sm font-medium text-white shadow-xl lg:bottom-5">{toast}</div>}
      {confirmDelete && (
        <Modal
          title={confirmDelete.type === "bulk" ? `Delete ${confirmDelete.count} leads?` : `Delete ${confirmDelete.name || "lead"}?`}
          description="This permanently removes the lead and any scheduled tasks. Associated call history is preserved."
          onClose={() => setConfirmDelete(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 leading-relaxed">
              <strong>Warning:</strong> This action cannot be undone. Are you sure you want to delete {confirmDelete.type === "bulk" ? `these ${confirmDelete.count} leads` : `"${confirmDelete.name}"`}?
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setConfirmDelete(null)}>Cancel</SecondaryButton>
              <button
                disabled={deletingLead}
                onClick={() => void handleDeleteLeads()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingLead ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="trash" className="h-4 w-4" />
                )}
                <span>Delete permanently</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "lead" && <AddLeadModal users={users} lists={lists} onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Lead added"); void refresh(); }} />}
      {modal === "import" && <ImportModal users={users} onClose={() => setModal(null)} onDone={(message) => { setModal(null); setToast(message); void refresh(); }} />}
      {modal === "task" && <TaskModal leads={leads} users={users} onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Task created"); void refresh(); }} />}
      {modal === "user" && <UserModal onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Setter account created"); void refresh(); }} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} onDone={() => { setPasswordChanged(true); setModal(null); setToast("Password updated"); void refresh(); }} />}
      {modal === "dialpad" && <ManualDialModal onClose={() => setModal(null)} onDial={(lead) => { setModal(null); void refresh(); void placeCall(lead); }} />}
      {modal === "guardrails" && <GuardrailsModal workspace={workspace} onClose={() => setModal(null)} onRefresh={refresh} onNotify={(msg) => setToast(msg)} />}
      {activeLead && <CallDock lead={activeLead} phase={callPhase} error={callError} disposition={disposition} setDisposition={setDisposition} notes={callNotes} setNotes={setCallNotes} callbackAt={callbackAt} setCallbackAt={setCallbackAt} autoDial={autoDial} setAutoDial={setAutoDial} onEnd={endCall} onSendDigit={sendDigit} onSave={saveDisposition} onClose={() => { if (callRef.current) endCall(); setActiveLead(null); setCallPhase("idle"); }} />}
      {incomingCall && <IncomingCall call={incomingCall} onClose={() => setIncomingCall(null)} />}
    </div>
  );
}

function NavButton({ label, icon, active, onClick }: { id: string; label: string; icon: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-white font-semibold text-[#1266c4] shadow-sm ring-1 ring-[#e2e8f0]" : "text-[#64748b] hover:bg-white/70 hover:text-[#0f172a]"}`}><Icon name={icon} /><span>{label}</span></button>;
}

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z"/>,
    check: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    sequence: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></>,
    pipeline: <><path d="M4 4v16M10 4v10M16 10v10M22 4v16"/><path d="M2 8h4M8 16h4M14 6h4M20 13h4"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.8 7l-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>,
    alert: <><path d="M10.3 2.9L1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, search: <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></>,
    dialpad: <><circle cx="6" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="18" cy="5" r="1"/><circle cx="6" cy="11" r="1"/><circle cx="12" cy="11" r="1"/><circle cx="18" cy="11" r="1"/><circle cx="6" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="18" cy="17" r="1"/><circle cx="12" cy="22" r="1"/></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    close: <path d="M18 6L6 18M6 6l12 12"/>, menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    play: <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>,
    pause: <><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] || paths.grid}</svg>;
}

function Avatar({ name }: { name: string }) {
  return <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e1effb] text-xs font-bold text-[#1266c4]">{name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "I"}</div>;
}

function DialerBrandMark({ large = false }: { large?: boolean }) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-[#159ed8] to-[#1266c4] shadow-[0_6px_18px_rgba(18,102,196,.24)] ${large ? "h-16 w-16 rounded-2xl" : "h-9 w-9 rounded-xl"}`}><Logo className={`${large ? "!h-14 sm:!h-14" : "!h-8 sm:!h-8"} [&>img]:brightness-0 [&>img]:invert [&>img]:drop-shadow-none`}/></span>;
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#f8fafc]"><div className="text-center"><div className="flex justify-center"><DialerBrandMark large/></div><div className="mx-auto mt-5 h-8 w-8 animate-spin rounded-full border-4 border-[#d8e8f8] border-t-[#1266c4]"/><p className="mt-4 text-sm text-[#64748b]">Opening Intent Dialer…</p></div></div>;
}

function MobileHeader({ view, navigate, logout, onOpenDialpad, onOpenGuardrails, guardrailsActive }: { view: View; navigate: (view: View) => void; logout: () => void; onOpenDialpad: () => void; onOpenGuardrails: () => void; guardrailsActive: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#e2e8f0]/80 bg-white/90 px-4 shadow-sm backdrop-blur-xl lg:hidden">
      <button aria-label="Open navigation" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl text-[#1e293b] transition hover:bg-[#f1f5f9]"><Icon name="menu" className="h-5 w-5"/></button>
      <div className="flex items-center gap-2.5"><DialerBrandMark/><div><div className="text-sm font-bold leading-none text-[#0f172a]">Intent Dialer</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.18em] text-[#64748b]">Private workspace</div></div></div>
      <button onClick={() => navigate("leads")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1266c4] text-white shadow-sm shadow-blue-700/15 transition hover:bg-[#0f57aa]" aria-label="Open calling queue"><Icon name="phone" className="h-5 w-5"/></button>
    </header>
    {open && <div className="fixed inset-0 z-[85] bg-[#0f172a]/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}><div className="h-full w-[min(86vw,340px)] overflow-y-auto bg-[#f8fafc] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#123b70] via-[#14579a] to-[#1266c4] p-4 text-white"><div className="flex items-center gap-3"><DialerBrandMark/><div><div className="font-bold">Intent Dialer</div><div className="mt-1 text-[10px] uppercase tracking-[.16em] text-white/70">Workspace menu</div></div></div><button aria-label="Close navigation" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Icon name="close"/></button></div><div className="space-y-2 mb-3"><button onClick={() => { onOpenDialpad(); setOpen(false); }} className="flex w-full items-center justify-between rounded-xl border border-[#b8d0e6] bg-[#edf5fc] px-4 py-3 text-sm font-bold text-[#1266c4] shadow-sm"><span className="flex items-center gap-2.5"><Icon name="dialpad" className="h-5 w-5"/><span>Keypad</span></span><span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1266c4]">Dial</span></button><button onClick={() => { onOpenGuardrails(); setOpen(false); }} className="flex w-full items-center justify-between rounded-xl border border-[#dce6f1] bg-white px-4 py-3 text-sm font-semibold text-[#1e293b] shadow-2xs"><span className="flex items-center gap-2.5"><Icon name="sliders" className="h-5 w-5 text-[#1266c4]"/><span>Calling guardrails</span></span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${guardrailsActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{guardrailsActive ? "Active" : "Flexible"}</span></button></div><div className="space-y-1">{[...VIEWS, { id: "dnc" as View, label: "Do not call", icon: "shield" }, { id: "settings" as View, label: "Settings & team", icon: "settings" }].map((item) => <NavButton key={item.id} {...item} active={view === item.id} onClick={() => { navigate(item.id); setOpen(false); }}/>)}</div><button onClick={logout} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700"><Icon name="logout"/>Log out</button></div></div>}
  </>;
}

function MobileBottomNav({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  const items: { id: View; label: string; icon: string }[] = [
    { id: "dashboard", label: "Home", icon: "grid" },
    { id: "leads", label: "Leads", icon: "users" },
    { id: "calls", label: "Calls", icon: "phone" },
    { id: "tasks", label: "Tasks", icon: "check" },
    { id: "settings", label: "More", icon: "settings" },
  ];
  return <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dce6f1] bg-white/95 px-2 pt-1 shadow-[0_-8px_24px_rgba(18,59,112,.07)] backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+.25rem)] lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-5 gap-1">{items.map((item) => { const active = view === item.id || (item.id === "settings" && ["settings", "dnc", "sequences", "pipeline"].includes(view)); return <button key={item.id} onClick={() => navigate(item.id)} className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[9px] font-bold transition ${active ? "bg-[#edf5fc] text-[#1266c4]" : "text-[#64748b] hover:bg-[#f8fafc]"}`}>{active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[#1266c4]"/>}<Icon name={item.icon} className="h-5 w-5 shrink-0"/><span className="truncate">{item.label}</span></button>; })}</div></nav>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex min-w-0 flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end"><div className="min-w-0"><div className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#1266c4]">{eyebrow}</div><h1 className="break-words text-[1.85rem] font-bold tracking-[-.04em] text-[#0f172a] sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748b]">{description}</p></div>{action && <div className="flex min-w-0 flex-wrap gap-2">{action}</div>}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "interested" || status === "contacted" || status === "completed" || status === "converted"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "no_answer" || status === "voicemail" || status === "try_again" || status === "busy"
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : status === "callback" || status === "follow_up" || status === "appointment"
    ? "bg-violet-50 text-violet-700 ring-violet-200"
    : status === "dnc" || status === "failed" || status === "wrong_number" || status === "not_interested"
    ? "bg-red-50 text-red-700 ring-red-200"
    : "bg-[#edf5fc] text-[#1266c4] ring-[#d5e3f1]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>{STATUS_LABELS[status] || status || "New"}</span>;
}

function PrimaryButton({ children, onClick, type = "button", disabled = false }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1266c4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-700/15 transition hover:bg-[#0f57aa] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function SecondaryButton({ children, onClick, type = "button", disabled = false }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d0dbe7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e293b] shadow-sm transition hover:border-[#1266c4] hover:bg-[#f8fbfe] hover:text-[#1266c4] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function Dashboard({ counts, metrics, recentCalls, conversations, outcomeBreakdown, tasks, repStats, onNavigate, onOpenDialpad }: { counts: Row; metrics: Row; recentCalls: Row[]; conversations: Row[]; outcomeBreakdown: Row[]; tasks: Row[]; repStats: Row[]; onNavigate: (view: View) => void; onOpenDialpad: () => void }) {
  const connected = number(metrics, "conversations_today");
  const total = number(metrics, "calls_today");
  return <>
    <PageHeader eyebrow="Your workspace" title="Good calls start here" description="A live view of your team, queue, and follow-ups." action={<><SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton><PrimaryButton onClick={() => onNavigate("leads")}><Icon name="phone"/>Start dialing</PrimaryButton></>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Calls today", total, `${number(metrics, "calls_week")} this week`],
        ["Conversations", connected, `${total ? Math.round(connected / total * 100) : 0}% conversation rate`],
        ["Talk time", `${Math.floor(number(metrics, "talk_seconds_today") / 60)}m`, "Today across the team"],
        ["Ready to call", number(counts, "to_call"), `${number(counts, "try_again")} to retry`],
      ].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_20px_rgba(18,59,112,.04)]"><div className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748b]">{label}</div><div className="mt-3 text-3xl font-bold tracking-tight text-[#0f172a]">{value}</div><div className="mt-2 text-xs text-[#94a3b8]">{sub}</div></div>)}
    </div>
    <DailyRecap metrics={metrics} conversations={conversations} outcomeBreakdown={outcomeBreakdown}/>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs"><div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4"><h2 className="font-semibold text-[#0f172a]">Recent calls</h2><button onClick={() => onNavigate("calls")} className="text-xs font-semibold text-[#1266c4] hover:underline">View all</button></div><div className="divide-y divide-[#e2e8f0]">{recentCalls.length ? recentCalls.map((call) => <div key={text(call, "id")} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#f8fafc]"><Avatar name={leadName(call)}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0f172a]">{leadName(call)}</div><div className="truncate text-xs text-[#64748b]">{text(call, "company")} · {text(call, "user_name") || "Unassigned"}</div></div><StatusBadge status={text(call, "disposition") || text(call, "status")}/><div className="hidden w-28 text-right text-xs text-[#94a3b8] sm:block">{formatDate(call.started_at)}</div></div>) : <Empty message="No calls yet. Start with your ready queue."/>}</div></section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs"><div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4"><h2 className="font-semibold text-[#0f172a]">Upcoming tasks</h2><button onClick={() => onNavigate("tasks")} className="text-xs font-semibold text-[#1266c4] hover:underline">Open tasks</button></div><div className="divide-y divide-[#e2e8f0]">{tasks.slice(0, 5).map((task) => <div key={text(task, "id")} className="px-5 py-3.5 hover:bg-[#f8fafc]"><div className="text-sm font-semibold text-[#0f172a]">{text(task, "title")}</div><div className="mt-1 text-xs text-[#64748b]">{leadName(task)} · {formatDate(task.due_at)}</div></div>)}{!tasks.length && <Empty message="Nothing due right now."/>}</div></section>
        <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs"><div className="border-b border-[#e2e8f0] px-5 py-4"><h2 className="font-semibold text-[#0f172a]">Team today</h2></div><div className="divide-y divide-[#e2e8f0]">{repStats.map((rep) => <div key={text(rep, "id")} className="flex items-center gap-3 px-5 py-3.5"><Avatar name={text(rep, "display_name")}/><div className="flex-1"><div className="text-sm font-semibold text-[#0f172a]">{text(rep, "display_name")}</div><div className="text-xs capitalize text-[#64748b]">{text(rep, "role")}</div></div><div className="text-right"><div className="text-sm font-bold text-[#0f172a]">{number(rep, "calls_today")}</div><div className="text-[10px] uppercase text-[#94a3b8]">calls</div></div></div>)}</div></section>
      </div>
    </div>
  </>;
}

function DailyRecap({ metrics, conversations, outcomeBreakdown }: { metrics: Row; conversations: Row[]; outcomeBreakdown: Row[] }) {
  const talkMinutes = Math.round(number(metrics, "talk_seconds_today") / 60);
  const summary = [
    ["Dials", number(metrics, "calls_today")],
    ["Conversations", number(metrics, "conversations_today")],
    ["Meetings", number(metrics, "meetings_today")],
    ["Callbacks", number(metrics, "callbacks_today")],
    ["Talk time", `${talkMinutes}m`],
  ];
  return <section className="mt-6 overflow-hidden rounded-3xl border border-[#d4e2ef] bg-white shadow-[0_12px_40px_rgba(18,102,196,.06)]">
    <div className="bg-gradient-to-br from-[#123b70] via-[#14579a] to-[#1266c4] px-5 py-6 text-white sm:px-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="text-[10px] font-bold uppercase tracking-[.22em] text-[#c6e2fa]">Today&apos;s recap</div><h2 className="mt-2 text-2xl font-bold tracking-[-.035em]">Your day at a glance</h2><p className="mt-1 text-sm text-white/70">Live totals update as calls and outcomes are saved.</p></div><div className="text-xs font-semibold text-white/60">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</div></div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">{summary.map(([label, value], index) => <div key={String(label)} className={`rounded-2xl border border-white/10 bg-white/[.07] p-4 ${index === 4 ? "col-span-2 sm:col-span-1" : ""}`}><div className="text-2xl font-bold tracking-tight">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/60">{label}</div></div>)}</div>
    </div>
    <div className="grid lg:grid-cols-[1fr_280px]">
      <div className="border-b border-[#e2e8f0] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 sm:px-7"><div><h3 className="font-bold text-[#0f172a]">Who you talked to</h3><p className="mt-0.5 text-xs text-[#64748b]">Notes and open follow-ups from today</p></div><span className="rounded-full bg-[#e7f1fb] px-3 py-1 text-xs font-bold text-[#1266c4]">{conversations.length}</span></div>
        <div className="divide-y divide-[#e2e8f0]">{conversations.map((call) => <article key={text(call, "id")} className="px-5 py-4 sm:px-7 hover:bg-[#f8fafc]"><div className="flex items-start gap-3"><Avatar name={leadName(call)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-bold text-[#0f172a]">{leadName(call)}</div><div className="mt-0.5 text-xs text-[#64748b]">{text(call, "company") || formatPhone(call.phone_e164)} · {text(call, "user_name") || "Unassigned"}</div></div><StatusBadge status={text(call, "disposition")}/></div>{(text(call, "notes") || text(call, "lead_notes")) && <div className="mt-3 rounded-xl bg-[#f1f5f9] px-3 py-2.5 text-xs leading-5 text-[#334155]"><span className="font-bold text-[#0f172a]">Note: </span>{text(call, "notes") || text(call, "lead_notes")}</div>}{text(call, "open_task_title") && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-violet-700"><Icon name="check" className="h-3.5 w-3.5"/><span>{text(call, "open_task_title")}{call.open_task_due_at ? ` · ${formatDate(call.open_task_due_at)}` : ""}</span></div>}</div></div></article>)}{!conversations.length && <Empty message="Conversations will appear here after you save contacted, interested, callback, appointment, or converted outcomes."/>}</div>
      </div>
      <aside className="bg-[#f8fafc] px-5 py-5 sm:px-7 lg:px-5"><h3 className="text-xs font-bold uppercase tracking-[.14em] text-[#64748b]">Outcome mix</h3><div className="mt-4 space-y-3">{outcomeBreakdown.map((item) => { const count = number(item, "count"); const total = Math.max(number(metrics, "calls_today"), 1); return <div key={text(item, "outcome")}><div className="mb-1.5 flex items-center justify-between gap-2"><StatusBadge status={text(item, "outcome")}/><span className="text-xs font-bold text-[#0f172a]">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]"><div className="h-full rounded-full bg-[#1266c4]" style={{ width: `${Math.max(4, Math.round(count / total * 100))}%` }}/></div></div>; })}{!outcomeBreakdown.length && <p className="text-xs leading-5 text-[#94a3b8]">Outcome categories will fill in as calls are completed.</p>}</div></aside>
    </div>
  </section>;
}

type LeadsViewProps = {
  leads: Row[];
  allLeads: Row[];
  counts: Row;
  users: Row[];
  lists: Row[];
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  selectedIds: string[];
  setSelectedIds: (value: string[]) => void;
  onDial: (lead: Row) => void;
  onOpenDialpad: () => void;
  onOpenGuardrails?: () => void;
  onAdd: () => void;
  onImport: () => void;
  onRefresh: () => Promise<void>;
  onRequestDeleteLead?: (id: string, name: string) => void;
  onRequestDeleteBulk?: () => void;
  onNotify?: (msg: string) => void;
};

function ResponsiveLeadsView(props: LeadsViewProps) {
  const { leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, search, setSearch, selectedIds, setSelectedIds, onDial, onOpenDialpad, onAdd, onImport, onRefresh, onRequestDeleteLead, onRequestDeleteBulk } = props;
  const [assigning, setAssigning] = useState(false);
  const filters = [["all", "All", number(counts, "all_leads")], ["to_call", "Ready", number(counts, "to_call")], ["try_again", "Retry", number(counts, "try_again")], ["follow_up", "Follow up", number(counts, "follow_up")], ["closed", "Closed", number(counts, "closed")]];
  const nextEligibleLead = allLeads.find((lead) => !Boolean(lead.do_not_call) && text(lead, "status") !== "closed");
  const changeAssignment = async (userId: string) => {
    if (!selectedIds.length) return;
    setAssigning(true);
    await api("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, assignedUserId: userId || null }) });
    setSelectedIds([]);
    setAssigning(false);
    await onRefresh();
  };
  return <>
    <div className="lg:hidden">
      <PageHeader eyebrow="Your sheet" title="Leads" description="Your calling queue, optimized for one-handed dialing." action={<><SecondaryButton onClick={onImport}><Icon name="upload" className="h-4 w-4"/>Import</SecondaryButton><PrimaryButton onClick={onAdd}><Icon name="plus" className="h-4 w-4"/>Add lead</PrimaryButton></>}/>
      <section className="mb-4 min-w-0 rounded-2xl border border-[#b8d0e6] bg-gradient-to-br from-[#edf5fc] to-white p-3 shadow-[0_8px_24px_rgba(18,102,196,.08)]">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#1266c4]">Outbound dialing</div><p className="mt-0.5 truncate text-xs text-[#64748b]">Key in a number or call the next eligible lead.</p></div>
          <span className="shrink-0 rounded-full border border-[#c9def1] bg-white px-2 py-1 text-[10px] font-bold text-[#1266c4]">1 at a time</span>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <button type="button" onClick={onOpenDialpad} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-[#b8d0e6] bg-white px-2 text-sm font-bold text-[#1266c4] shadow-xs transition hover:bg-[#f8fbfe]"><Icon name="dialpad" className="h-4 w-4 shrink-0"/><span className="truncate">Keypad</span></button>
          <button type="button" disabled={!nextEligibleLead} onClick={() => nextEligibleLead && onDial(nextEligibleLead)} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#1266c4] px-2 text-sm font-bold text-white shadow-sm shadow-blue-700/15 transition hover:bg-[#0f57aa] disabled:cursor-not-allowed disabled:opacity-45"><Icon name="phone" className="h-4 w-4 shrink-0"/><span className="truncate">Start outbound</span></button>
        </div>
      </section>
      <div className="mb-4 grid min-w-0 grid-cols-6 gap-2">{filters.map(([id, label, count], index) => <button key={String(id)} onClick={() => setStatusFilter(String(id))} className={`min-w-0 rounded-xl border p-2.5 text-left transition ${index < 3 ? "col-span-2" : "col-span-3"} ${statusFilter === id ? "border-[#1266c4] bg-[#1266c4] text-white shadow-md shadow-blue-900/10" : "border-[#e2e8f0] bg-white text-[#334155]"}`}><div className="truncate text-lg font-bold">{count}</div><div className={`mt-0.5 truncate text-[11px] font-semibold ${statusFilter === id ? "text-white/80" : "text-[#64748b]"}`}>{label}</div></button>)}</div>
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_8px_30px_rgba(18,59,112,.05)]">
        <div className="space-y-3 border-b border-[#e2e8f0] p-3">
          <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..." className="min-h-11 w-full rounded-xl border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/></div>
          {selectedIds.length > 0 ? (
            <div className="grid min-w-0 gap-2 sm:flex">
              <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value)} defaultValue="" className="min-h-11 flex-1 rounded-xl border border-[#d0dbe7] bg-white px-3 text-sm text-[#0f172a]"><option value="" disabled>Assign {selectedIds.length} selected...</option><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select>
              <button
                type="button"
                onClick={() => onRequestDeleteBulk && onRequestDeleteBulk()}
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 transition hover:bg-red-100 sm:shrink-0"
              >
                <Icon name="trash" className="h-4 w-4" />
                <span>Delete ({selectedIds.length})</span>
              </button>
            </div>
          ) : <div className="px-1 text-xs text-[#64748b]">{leads.length} shown · {lists.length} lists</div>}
        </div>
        <div className="divide-y divide-[#e2e8f0]">{leads.map((lead) => { const leadId = text(lead, "id"); const disabled = Boolean(lead.do_not_call) || text(lead, "status") === "closed"; return <article key={leadId} className="p-4"><div className="flex items-start gap-3"><label className="flex min-h-11 items-center"><input aria-label={`Select ${leadName(lead)}`} type="checkbox" checked={selectedIds.includes(leadId)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, leadId] : selectedIds.filter((id) => id !== leadId))}/></label><Avatar name={leadName(lead)}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#0f172a]">{leadName(lead)}</h2><p className="truncate text-xs text-[#64748b]">{text(lead, "company") || text(lead, "title") || "No company"}</p></div><StatusBadge status={text(lead, "disposition") || text(lead, "status")}/></div><a href={`tel:${text(lead, "phone_e164")}`} className="mt-3 block text-base font-bold tracking-tight text-[#1266c4]">{formatPhone(lead.phone_e164)}</a><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#64748b]"><span>{localTime(lead)} local</span><span>{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</span><span>{text(lead, "assigned_name") || "Unassigned"}</span></div></div></div><div className="mt-4 flex items-center gap-2"><button disabled={disabled} onClick={() => onDial(lead)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#edf5fc] text-sm font-bold text-[#1266c4] transition hover:bg-[#e1effb] active:scale-[.99] disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"><Icon name="phone"/>Dial {leadName(lead).split(" ")[0]}</button><button title="Delete lead" onClick={() => onRequestDeleteLead && onRequestDeleteLead(leadId, leadName(lead))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition"><Icon name="trash" className="h-5 w-5" /></button></div></article>; })}{!leads.length && <Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/>}</div>
      </section>
    </div>
    <div className="hidden lg:block"><LeadsView {...props}/></div>
  </>;
}

function LeadsView({ leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, search, setSearch, selectedIds, setSelectedIds, onDial, onOpenDialpad, onOpenGuardrails, onAdd, onImport, onRefresh, onRequestDeleteLead, onRequestDeleteBulk }: LeadsViewProps) {
  const [assigning, setAssigning] = useState(false);
  const changeAssignment = async (userId: string) => {
    if (!selectedIds.length) return;
    setAssigning(true);
    await api("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, assignedUserId: userId || null }) });
    setSelectedIds([]); setAssigning(false); await onRefresh();
  };
  const filters = [
    ["all", "All leads", number(counts, "all_leads")], ["to_call", "To call", number(counts, "to_call")],
    ["try_again", "Try again", number(counts, "try_again")], ["follow_up", "Follow up", number(counts, "follow_up")], ["closed", "Closed", number(counts, "closed")],
  ];
  return <>
    <PageHeader eyebrow="Your sheet" title="Leads" description="Everyone you're calling, where each contact stands, and what needs attention next." action={<div className="flex gap-2">{onOpenGuardrails && <SecondaryButton onClick={onOpenGuardrails}><Icon name="sliders"/>Guardrails</SecondaryButton>}<SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton><SecondaryButton onClick={onImport}><Icon name="upload"/>Import CSV</SecondaryButton><PrimaryButton onClick={onAdd}><Icon name="plus"/>Add lead</PrimaryButton></div>}/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{filters.map(([id, label, count]) => <button key={String(id)} onClick={() => setStatusFilter(String(id))} className={`rounded-xl border p-4 text-left transition ${statusFilter === id ? "border-[#1266c4] bg-white shadow-sm ring-2 ring-[#1266c4]" : "border-[#e2e8f0] bg-white/75 hover:bg-white hover:border-[#b8d0e6]"}`}><div className="text-2xl font-bold text-[#0f172a]">{count}</div><div className="mt-1 text-sm font-semibold text-[#0f172a]">{label}</div><div className="mt-1 text-[11px] text-[#64748b]">{id === "all" ? "Everything except deleted" : id === "to_call" ? "Never dialed and ready" : id === "try_again" ? "No answer, busy, failed" : id === "follow_up" ? "Callbacks and interest" : "Completed or suppressed"}</div></button>)}</div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_20px_rgba(18,59,112,.035)]">
      <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, companies, phones…" className="w-full rounded-lg border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/></div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value)} defaultValue="" className="rounded-lg border border-[#d0dbe7] bg-white px-3 py-2 text-sm text-[#0f172a]">
              <option value="" disabled>Assign {selectedIds.length} leads…</option>
              <option value="">Unassigned</option>
              {users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}
            </select>
            <button
              type="button"
              onClick={() => onRequestDeleteBulk && onRequestDeleteBulk()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-xs"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>
        )}
        <div className="text-xs text-[#64748b]">{leads.length} shown · {lists.length} lists</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[.12em] text-[#64748b]"><th className="w-12 px-4 py-3"><input type="checkbox" checked={leads.length > 0 && leads.every((lead) => selectedIds.includes(text(lead, "id")))} onChange={(event) => setSelectedIds(event.target.checked ? leads.map((lead) => text(lead, "id")) : [])}/></th><th className="px-3 py-3">Prospect</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last call</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{leads.map((lead) => <tr key={text(lead, "id")} className="group hover:bg-[#f8fafc]"><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(text(lead, "id"))} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, text(lead, "id")] : selectedIds.filter((id) => id !== text(lead, "id")))}/></td><td className="px-3 py-3"><div className="flex items-center gap-3"><Avatar name={leadName(lead)}/><div><div className="text-sm font-semibold text-[#0f172a]">{leadName(lead)}</div><div className="max-w-[240px] truncate text-xs text-[#64748b]">{text(lead, "company") || text(lead, "title") || "—"}</div></div></div></td><td className="px-3 py-3"><div className="text-sm font-semibold text-[#0f172a]">{formatPhone(lead.phone_e164)}</div><div className="mt-0.5 text-[11px] text-[#64748b]">{localTime(lead)} local</div></td><td className="px-3 py-3"><StatusBadge status={text(lead, "disposition") || text(lead, "status")}/></td><td className="px-3 py-3"><div className="text-xs font-medium text-[#0f172a]">{formatDate(lead.last_call_at)}</div><div className="text-[11px] text-[#64748b]">{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</div></td><td className="px-3 py-3 text-xs text-[#475569]">{text(lead, "assigned_name") || "Unassigned"}</td><td className="px-3 py-3 text-right"><div className="flex items-center justify-end gap-1.5"><button disabled={Boolean(lead.do_not_call) || text(lead, "status") === "closed"} onClick={() => onDial(lead)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5fc] px-3 py-2 text-xs font-bold text-[#1266c4] hover:bg-[#e1effb] transition disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"><Icon name="phone" className="h-3.5 w-3.5"/>Dial</button><button title="Delete lead" onClick={(e) => { e.stopPropagation(); if (onRequestDeleteLead) onRequestDeleteLead(text(lead, "id"), leadName(lead)); }} className="grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition"><Icon name="trash" className="h-4 w-4" /></button></div></td></tr>)}{!leads.length && <tr><td colSpan={7}><Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/></td></tr>}</tbody></table></div>
    </section>
  </>;
}

function Empty({ message }: { message: string }) { return <div className="px-5 py-10 text-center text-sm text-[#89928e]">{message}</div>; }

function CallAudioPlayer({
  callId,
  durationSeconds,
  hasRecording = false,
  compact = false,
  onAttachClick,
}: {
  callId: string;
  durationSeconds?: number | null;
  hasRecording?: boolean;
  compact?: boolean;
  onAttachClick?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setError(null);
      setIsLoading(true);
      try {
        await audioRef.current.play();
      } catch {
        setIsLoading(false);
        setError("Playback failed");
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatSec = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!hasRecording) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-[#94a3b8] italic">No recording</span>
        {onAttachClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAttachClick(); }}
            className="inline-flex items-center gap-1 rounded bg-[#edf5fc] px-2 py-1 text-[11px] font-semibold text-[#1266c4] hover:bg-[#e1effb] transition"
            title="Attach or sync recording"
          >
            <Icon name="link" className="h-3 w-3" />
            <span>Attach</span>
          </button>
        )}
      </div>
    );
  }

  const mp3Url = `/api/dialer/calls/${callId}/recording?format=mp3&download=1`;
  const wavUrl = `/api/dialer/calls/${callId}/recording?format=wav&download=1`;
  const streamUrl = `/api/dialer/calls/${callId}/recording?format=mp3`;

  return (
    <div className={`min-w-0 max-w-full flex-col gap-1.5 ${compact ? "flex w-full" : "flex w-full sm:max-w-[340px]"}`} onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="none"
        onPlay={() => { setIsPlaying(true); setIsLoading(false); }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) setDuration(audioRef.current.duration);
          setIsLoading(false);
        }}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
          setError("Audio unavailable");
        }}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause recording" : "Play recording"}
          disabled={isLoading}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-xs transition ${
            isPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-[#1266c4] hover:bg-[#0e529e]"
          }`}
        >
          {isLoading ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : isPlaying ? (
            <Icon name="pause" className="h-3 w-3" />
          ) : (
            <Icon name="play" className="h-3 w-3 ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#e2e8f0] accent-[#1266c4]"
          />
          <div className="flex justify-between text-[10px] text-[#64748b] font-medium leading-none mt-1">
            <span>{formatSec(currentTime)}</span>
            <span>{formatSec(duration)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={cycleSpeed}
          title="Playback speed"
          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition shrink-0"
        >
          {playbackRate}x
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href={mp3Url}
            download
            title="Download MP3"
            className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-bold text-[#1266c4] bg-[#edf5fc] hover:bg-[#e1effb] transition"
          >
            <Icon name="download" className="h-3 w-3" />
            <span>MP3</span>
          </a>
          <a
            href={wavUrl}
            download
            title="Download WAV"
            className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-bold text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition"
          >
            <Icon name="download" className="h-3 w-3" />
            <span>WAV</span>
          </a>
        </div>
      </div>
      {error && <span className="text-[10px] text-red-600 font-medium">{error}</span>}
    </div>
  );
}

function AttachRecordingModal({
  call,
  onClose,
  onDone,
}: {
  call: Row;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [sid, setSid] = useState("");
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const callId = text(call, "id");
  const callSid = text(call, "twilio_call_sid") || text(call, "twilio_parent_call_sid");

  const syncFromTwilio = async () => {
    setError("");
    setSyncing(true);
    try {
      const res = await api<{ success: boolean; call: Row }>(`/api/dialer/calls/${callId}/recording`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncFromTwilio: true }),
      });
      if (res.success) onDone("Recording synced from Twilio!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync recording from Twilio.");
    } finally {
      setSyncing(false);
    }
  };

  const saveManual = async () => {
    if (!sid.trim() && !url.trim()) return;
    setError("");
    setSaving(true);
    try {
      const res = await api<{ success: boolean }>(`/api/dialer/calls/${callId}/recording`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingSid: sid.trim() || undefined, recordingUrl: url.trim() || undefined }),
      });
      if (res.success) onDone("Recording attached!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach recording.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Attach recording: ${leadName(call)}`} description="Attach or sync a call recording for this conversation." onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Rep:</span>
            <span className="font-semibold text-[#0f172a]">{text(call, "user_name") || "Unclaimed"} ({text(call, "user_role") === "owner" ? "Owner" : "Setter"})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Started:</span>
            <span className="font-semibold text-[#0f172a]">{formatDate(call.started_at)}</span>
          </div>
          {callSid && (
            <div className="flex justify-between">
              <span className="text-[#64748b]">Twilio Call SID:</span>
              <code className="text-[#1266c4] text-[11px] font-mono">{callSid}</code>
            </div>
          )}
        </div>

        {callSid && (
          <div className="rounded-xl border border-[#d0dbe7] bg-white p-4">
            <div className="font-semibold text-sm text-[#0f172a]">Option 1: Auto-sync from Twilio</div>
            <p className="mt-1 text-xs text-[#64748b]">
              Twilio logged this call with SID {callSid}. Check Twilio to automatically locate and link the recording.
            </p>
            <div className="mt-3">
              <PrimaryButton onClick={() => void syncFromTwilio()} disabled={syncing}>
                {syncing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="check" />}
                <span>{syncing ? "Checking Twilio…" : "Sync from Twilio"}</span>
              </PrimaryButton>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#d0dbe7] bg-white p-4 space-y-3">
          <div className="font-semibold text-sm text-[#0f172a]">Option 2: Enter Recording SID or Direct URL</div>
          <Field label="Twilio Recording SID (e.g. RE...)">
            <input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="RE1234567890abcdef..." className={inputClass} />
          </Field>
          <Field label="Or direct audio URL (MP3/WAV)">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </Field>
          <div className="pt-2">
            <SecondaryButton onClick={() => void saveManual()} disabled={saving || (!sid.trim() && !url.trim())}>
              {saving ? "Saving…" : "Attach recording"}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ResponsiveCallsView({
  calls,
  users = [],
  onRefresh,
  onOpenDialpad,
  onNotify,
}: {
  calls: Row[];
  users?: Row[];
  onRefresh?: () => Promise<void>;
  onOpenDialpad?: () => void;
  onNotify?: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [recordingOnly, setRecordingOnly] = useState(false);
  const [attachCall, setAttachCall] = useState<Row | null>(null);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      const q = query.toLowerCase();
      const matchesSearch = !query || `${leadName(call)} ${text(call, "company")} ${text(call, "to_number")} ${text(call, "from_number")} ${text(call, "user_name")}`.toLowerCase().includes(q);
      const matchesRep = repFilter === "all" || (repFilter === "owner" ? text(call, "user_role") === "owner" : repFilter === "agent" ? text(call, "user_role") === "agent" : text(call, "user_id") === repFilter);
      const matchesRecording = !recordingOnly || Boolean(call.recording_sid || call.recording_url);
      return matchesSearch && matchesRep && matchesRecording;
    });
  }, [calls, query, repFilter, recordingOnly]);

  const ownerCount = calls.filter((c) => text(c, "user_role") === "owner").length;
  const setterCount = calls.filter((c) => text(c, "user_role") === "agent").length;
  const recordedCount = calls.filter((c) => Boolean(c.recording_sid || c.recording_url)).length;

  return <>
    <div className="lg:hidden">
      <PageHeader eyebrow="Activity" title="Calls" description="Every attempt, outcome, and rep with attached recordings." action={onOpenDialpad ? <SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton> : undefined}/>
      <div className="mb-4 grid min-w-0 grid-cols-2 gap-2">
        <button onClick={() => { setRepFilter("all"); setRecordingOnly(false); }} className={`min-w-0 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${repFilter === "all" && !recordingOnly ? "border-[#1266c4] bg-[#1266c4] text-white shadow-sm" : "border-[#e2e8f0] bg-white text-[#334155]"}`}>
          <div className="text-lg font-bold">{calls.length}</div>All
        </button>
        <button onClick={() => { setRepFilter("owner"); setRecordingOnly(false); }} className={`min-w-0 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${repFilter === "owner" ? "border-[#1266c4] bg-[#1266c4] text-white shadow-sm" : "border-[#e2e8f0] bg-white text-[#334155]"}`}>
          <div className="text-lg font-bold">{ownerCount}</div>Owner
        </button>
        <button onClick={() => { setRepFilter("agent"); setRecordingOnly(false); }} className={`min-w-0 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${repFilter === "agent" ? "border-[#1266c4] bg-[#1266c4] text-white shadow-sm" : "border-[#e2e8f0] bg-white text-[#334155]"}`}>
          <div className="text-lg font-bold">{setterCount}</div>Setter
        </button>
        <button onClick={() => setRecordingOnly(!recordingOnly)} className={`min-w-0 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${recordingOnly ? "border-[#1266c4] bg-[#1266c4] text-white shadow-sm" : "border-[#e2e8f0] bg-white text-[#334155]"}`}>
          <div className="text-lg font-bold">{recordedCount}</div>Recordings
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_8px_30px_rgba(18,59,112,.05)]">
        <div className="border-b border-[#e2e8f0] p-3">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search call history..." className="min-h-11 w-full rounded-xl border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/>
          </div>
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {visible.map((call) => (
            <article key={text(call, "id")} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar name={leadName(call)}/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[#0f172a]">{leadName(call)}</h2>
                      <p className="truncate text-xs text-[#64748b]">{text(call, "company") || formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}</p>
                    </div>
                    <StatusBadge status={text(call, "disposition") || text(call, "status")}/>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0f172a]">{text(call, "user_name") || "Unclaimed"}</span>
                    {text(call, "user_role") === "owner" ? (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">Owner</span>
                    ) : text(call, "user_role") === "agent" ? (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-700 border border-teal-200">Setter</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#f8fafc] p-3 text-xs">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Direction</div>
                  <div className="mt-1 font-semibold capitalize text-[#0f172a]">{text(call, "direction")}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Duration</div>
                  <div className="mt-1 font-semibold text-[#0f172a]">{number(call, "duration_seconds") ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}` : "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Started</div>
                  <div className="mt-1 font-semibold text-[#0f172a]">{formatDate(call.started_at)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e8f0] bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-2 flex items-center gap-1.5">
                  <Icon name="mic" className="h-3 w-3 text-[#1266c4]" />
                  <span>Call recording</span>
                </div>
                <CallAudioPlayer
                  compact
                  callId={text(call, "id")}
                  durationSeconds={number(call, "duration_seconds")}
                  hasRecording={Boolean(call.recording_sid || call.recording_url)}
                  onAttachClick={() => setAttachCall(call)}
                />
              </div>
            </article>
          ))}
          {!visible.length && <Empty message="No call records found."/>}
        </div>
      </section>
    </div>

    <div className="hidden lg:block">
      <CallsView calls={calls} users={users} onRefresh={onRefresh} onOpenDialpad={onOpenDialpad} onNotify={onNotify} />
    </div>

    {attachCall && (
      <AttachRecordingModal
        call={attachCall}
        onClose={() => setAttachCall(null)}
        onDone={(msg) => {
          setAttachCall(null);
          if (onNotify) onNotify(msg);
          if (onRefresh) void onRefresh();
        }}
      />
    )}
  </>;
}

function CallsView({
  calls,
  users = [],
  onRefresh,
  onOpenDialpad,
  onNotify,
}: {
  calls: Row[];
  users?: Row[];
  onRefresh?: () => Promise<void>;
  onOpenDialpad?: () => void;
  onNotify?: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [recordingOnly, setRecordingOnly] = useState(false);
  const [attachCall, setAttachCall] = useState<Row | null>(null);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      const q = query.toLowerCase();
      const matchesSearch = !query || `${leadName(call)} ${text(call, "company")} ${text(call, "to_number")} ${text(call, "from_number")} ${text(call, "user_name")}`.toLowerCase().includes(q);
      const matchesRep = repFilter === "all" || (repFilter === "owner" ? text(call, "user_role") === "owner" : repFilter === "agent" ? text(call, "user_role") === "agent" : text(call, "user_id") === repFilter);
      const matchesRecording = !recordingOnly || Boolean(call.recording_sid || call.recording_url);
      return matchesSearch && matchesRep && matchesRecording;
    });
  }, [calls, query, repFilter, recordingOnly]);

  const ownerCount = calls.filter((c) => text(c, "user_role") === "owner").length;
  const setterCount = calls.filter((c) => text(c, "user_role") === "agent").length;
  const recordedCount = calls.filter((c) => Boolean(c.recording_sid || c.recording_url)).length;

  return <>
    <PageHeader
      eyebrow="Activity"
      title="Calls"
      description="Every outbound attempt and inbound callback for owner and setter, with attached audio recordings."
      action={onOpenDialpad ? <SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton> : undefined}
    />

    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setRepFilter("all"); setRecordingOnly(false); }}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            repFilter === "all" && !recordingOnly
              ? "bg-[#1266c4] text-white shadow-xs"
              : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#b8d0e6]"
          }`}
        >
          All calls ({calls.length})
        </button>
        <button
          onClick={() => { setRepFilter("owner"); setRecordingOnly(false); }}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            repFilter === "owner"
              ? "bg-indigo-600 text-white shadow-xs"
              : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#b8d0e6]"
          }`}
        >
          Owner calls ({ownerCount})
        </button>
        <button
          onClick={() => { setRepFilter("agent"); setRecordingOnly(false); }}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            repFilter === "agent"
              ? "bg-teal-600 text-white shadow-xs"
              : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#b8d0e6]"
          }`}
        >
          Setter calls ({setterCount})
        </button>
        <button
          onClick={() => setRecordingOnly(!recordingOnly)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            recordingOnly
              ? "bg-emerald-600 text-white shadow-xs"
              : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#b8d0e6]"
          }`}
        >
          With recording ({recordedCount})
        </button>
      </div>

      <div className="text-xs text-[#64748b]">
        Showing {visible.length} of {calls.length} calls
      </div>
    </div>

    <section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
      <div className="border-b border-[#e2e8f0] p-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xl">
          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contact, company, phone, rep…"
            className="w-full rounded-lg border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"
          />
        </div>
        {users.length > 0 && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-lg border border-[#d0dbe7] bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="all">All reps</option>
            <option value="owner">Owner only</option>
            <option value="agent">Setter only</option>
            {users.map((u) => (
              <option key={text(u, "id")} value={text(u, "id")}>
                {text(u, "display_name")} ({text(u, "role") === "owner" ? "Owner" : "Setter"})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left">
          <thead>
            <tr className="bg-[#f8fafc] text-[10px] uppercase tracking-[.12em] text-[#64748b] border-b border-[#e2e8f0]">
              <th className="px-5 py-3">Contact</th>
              <th className="px-4 py-3">Rep (Caller)</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3 min-w-[300px]">Recording</th>
              <th className="px-5 py-3 text-right">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {visible.map((call) => (
              <tr key={text(call, "id")} className="hover:bg-[#f8fafc]">
                <td className="px-5 py-3.5">
                  <div className="text-sm font-semibold text-[#0f172a]">{leadName(call)}</div>
                  <div className="text-xs text-[#64748b]">
                    {text(call, "company") || formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#0f172a]">{text(call, "user_name") || "Unclaimed"}</span>
                    {text(call, "user_role") === "owner" ? (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                        Owner
                      </span>
                    ) : text(call, "user_role") === "agent" ? (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-700 border border-teal-200">
                        Setter
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs capitalize text-[#334155]">{text(call, "direction")}</td>
                <td className="px-4 py-3.5"><StatusBadge status={text(call, "disposition") || text(call, "status")}/></td>
                <td className="px-4 py-3.5 text-xs text-[#334155]">
                  {number(call, "duration_seconds")
                    ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}`
                    : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <CallAudioPlayer
                    callId={text(call, "id")}
                    durationSeconds={number(call, "duration_seconds")}
                    hasRecording={Boolean(call.recording_sid || call.recording_url)}
                    onAttachClick={() => setAttachCall(call)}
                  />
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-[#64748b]">{formatDate(call.started_at)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7}><Empty message="No call records found."/></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>

    {attachCall && (
      <AttachRecordingModal
        call={attachCall}
        onClose={() => setAttachCall(null)}
        onDone={(msg) => {
          setAttachCall(null);
          if (onNotify) onNotify(msg);
          if (onRefresh) void onRefresh();
        }}
      />
    )}
  </>;
}

function TasksView({ tasks, onCreate, onRefresh }: { tasks: Row[]; onCreate: () => void; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState("open");
  const visible = tasks.filter((task) => tab === "all" || text(task, "status") === tab);
  const complete = async (id: string) => { await api("/api/dialer/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed" }) }); await onRefresh(); };
  return <><PageHeader eyebrow="Follow-through" title="Tasks" description="Callbacks, follow-ups, and reminders that keep interested leads from slipping away." action={<PrimaryButton onClick={onCreate}><Icon name="plus"/>New task</PrimaryButton>}/><div className="mb-4 flex gap-2">{["open", "completed", "all"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition ${tab === item ? "bg-[#1266c4] text-white shadow-xs" : "border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#b8d0e6]"}`}>{item}</button>)}</div><section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs"><div className="divide-y divide-[#e2e8f0]">{visible.map((task) => <div key={text(task, "id")} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center hover:bg-[#f8fafc]"><button disabled={text(task, "status") !== "open"} onClick={() => void complete(text(task, "id"))} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${text(task, "status") === "completed" ? "border-[#1266c4] bg-[#1266c4] text-white" : "border-[#cbd5e1] hover:border-[#1266c4]"}`}>{text(task, "status") === "completed" && <Icon name="check" className="h-3.5 w-3.5"/>}</button><div className="min-w-0 flex-1"><div className={`font-semibold ${text(task, "status") === "completed" ? "text-[#94a3b8] line-through" : "text-[#0f172a]"}`}>{text(task, "title")}</div><div className="mt-1 text-xs text-[#64748b]">{leadName(task)}{text(task, "company") ? ` · ${text(task, "company")}` : ""}</div></div><StatusBadge status={text(task, "task_type")}/><div className={`text-xs font-medium ${task.due_at && new Date(String(task.due_at)) < new Date() && text(task, "status") === "open" ? "text-red-600 font-bold" : "text-[#64748b]"}`}>{formatDate(task.due_at)}</div><div className="text-xs text-[#64748b]">{text(task, "assigned_name") || "Unassigned"}</div></div>)}{!visible.length && <Empty message="No tasks in this view."/>}</div></section></>;
}

function SequencesView({ sequences, onRefresh }: { sequences: Row[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const create = async () => { if (!name.trim()) return; await api("/api/dialer/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: "Three-touch call cadence", steps: [{ day: 0, type: "call" }, { day: 2, type: "call" }, { day: 5, type: "call" }] }) }); setName(""); await onRefresh(); };
  return <><PageHeader eyebrow="Cadences" title="Sequences" description="Reusable call schedules for consistent follow-up without parallel or predictive dialing."/><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><section className="grid content-start gap-4 sm:grid-cols-2">{sequences.map((sequence) => { const steps = Array.isArray(sequence.steps) ? sequence.steps as Row[] : []; return <div key={text(sequence, "id")} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs"><div className="flex items-start justify-between"><div><h3 className="font-semibold text-[#0f172a]">{text(sequence, "name")}</h3><p className="mt-1 text-xs text-[#64748b]">{text(sequence, "description") || "Call sequence"}</p></div><StatusBadge status={Boolean(sequence.active) ? "contacted" : "closed"}/></div><div className="mt-5 flex items-center gap-2">{steps.map((step, index) => <div key={index} className="contents"><div className="grid h-10 min-w-10 place-items-center rounded-full bg-[#edf5fc] text-xs font-bold text-[#1266c4]">D{number(step, "day")}</div>{index < steps.length - 1 && <div className="h-px flex-1 bg-[#d0dbe7]"/>}</div>)}</div></div>; })}{!sequences.length && <div className="sm:col-span-2 rounded-2xl border border-dashed border-[#d0dbe7] bg-white"><Empty message="Create your first call sequence."/></div>}</section><aside className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs"><h2 className="font-semibold text-[#0f172a]">New sequence</h2><p className="mt-1 text-xs leading-relaxed text-[#64748b]">Creates a simple three-call cadence on days 0, 2, and 5. Calls are always placed one at a time by a rep.</p><label className="mt-5 block text-xs font-semibold text-[#475569]">Sequence name</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Florida HVAC follow-up" className="mt-2 w-full rounded-lg border border-[#d0dbe7] px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/><div className="mt-4"><PrimaryButton onClick={() => void create()} disabled={!name.trim()}><Icon name="plus"/>Create sequence</PrimaryButton></div></aside></div></>;
}

function PipelineView({ leads, onDial, onOpenDialpad, onDeleteLead }: { leads: Row[]; onDial: (lead: Row) => void; onOpenDialpad?: () => void; onDeleteLead?: (id: string, name: string) => void }) {
  const columns = [["to_call", "To call"], ["try_again", "Try again"], ["follow_up", "Follow up"], ["closed", "Closed"]] as const;
  return <><PageHeader eyebrow="Pipeline" title="Lead pipeline" description="A compact board organized by the next action your team needs to take." action={onOpenDialpad ? <SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton> : undefined}/><div className="grid gap-4 lg:grid-cols-4">{columns.map(([status, label]) => { const items = leads.filter((lead) => text(lead, "status") === status); return <section key={status} className="rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9]/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-bold text-[#0f172a]">{label}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#64748b] border border-[#e2e8f0]">{items.length}</span></div><div className="space-y-3">{items.slice(0, 100).map((lead) => <div key={text(lead, "id")} className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-xs"><div className="flex items-start gap-2"><Avatar name={leadName(lead)}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0f172a]">{leadName(lead)}</div><div className="truncate text-xs text-[#64748b]">{text(lead, "company") || formatPhone(lead.phone_e164)}</div></div></div><div className="mt-3 flex items-center justify-between"><StatusBadge status={text(lead, "disposition") || status}/><div className="flex items-center gap-1">{status !== "closed" && <button onClick={() => onDial(lead)} className="rounded-full bg-[#edf5fc] p-2 text-[#1266c4] hover:bg-[#e1effb] transition"><Icon name="phone" className="h-3.5 w-3.5"/></button>}<button title="Delete lead" onClick={() => onDeleteLead && onDeleteLead(text(lead, "id"), leadName(lead))} className="rounded-full p-2 text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition"><Icon name="trash" className="h-3.5 w-3.5"/></button></div></div></div>)}</div></section>; })}</div></>;
}

function DncView({ entries, onRefresh }: { entries: Row[]; onRefresh: () => Promise<void> }) {
  const [phone, setPhone] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const add = async () => { try { await api("/api/dialer/dnc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, reason }) }); setPhone(""); setReason(""); await onRefresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to suppress number."); } };
  const remove = async (value: string) => { await api("/api/dialer/dnc", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: value }) }); await onRefresh(); };
  return <><PageHeader eyebrow="Compliance" title="Do not call" description="A workspace-wide suppression list. Numbers here are blocked before Twilio receives a dial request."/><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><aside className="h-fit rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs"><h2 className="font-semibold text-[#0f172a]">Suppress a number</h2><p className="mt-1 text-xs leading-relaxed text-[#64748b]">This closes every matching lead and prevents future calls.</p>{error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}<label className="mt-5 block text-xs font-semibold text-[#475569]">Phone number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(407) 555-0123" className="mt-2 w-full rounded-lg border border-[#d0dbe7] px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/><label className="mt-4 block text-xs font-semibold text-[#475569]">Reason</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Requested no further calls" className="mt-2 min-h-24 w-full rounded-lg border border-[#d0dbe7] px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/><div className="mt-4"><PrimaryButton onClick={() => void add()} disabled={!phone.trim()}><Icon name="shield"/>Add to DNC</PrimaryButton></div></aside><section className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs"><div className="border-b border-[#e2e8f0] px-5 py-4 text-sm font-semibold text-[#0f172a]">{entries.length} suppressed numbers</div><div className="divide-y divide-[#e2e8f0]">{entries.map((entry) => <div key={text(entry, "id")} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center hover:bg-[#f8fafc]"><div className="flex-1"><div className="font-semibold text-[#0f172a]">{formatPhone(entry.phone_e164)}</div><div className="mt-1 text-xs text-[#64748b]">{text(entry, "reason") || "No reason provided"} · {formatDate(entry.created_at)}</div></div><div className="text-xs text-[#64748b]">{text(entry, "requested_by_name") || text(entry, "source")}</div><button onClick={() => void remove(text(entry, "phone_e164"))} className="text-xs font-semibold text-red-600 hover:underline">Remove</button></div>)}{!entries.length && <Empty message="No suppressed numbers."/>}</div></section></div></>;
}

function SettingsView({ settings, currentUser, onCreateUser, onChangePassword, onRefresh, onNotify }: { settings: Row; currentUser: Row; onCreateUser: () => void; onChangePassword: () => void; onRefresh: () => Promise<void>; onNotify?: (msg: string) => void }) {
  const workspace = (settings.settings as Row | undefined)?.workspace as Row | undefined || {};
  const twilio = settings.twilio as Row | undefined || {};
  const users = settings.users as Row[] | undefined || [];
  const [settingsSection, setSettingsSection] = useState<"team" | "guardrails">("team");

  const toggleRecording = async () => {
    const next = !Boolean(twilio.recordingEnabled !== false);
    try {
      await api("/api/dialer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "twilio", value: { recordingEnabled: next } }),
      });
      await onRefresh();
      if (onNotify) onNotify(next ? "Call recording enabled" : "Call recording disabled");
    } catch (err) {
      if (onNotify) onNotify(err instanceof Error ? err.message : "Failed to update recording settings");
    }
  };

  return <>
    <PageHeader eyebrow="Workspace" title="Settings" description="Manage your team, calling connection, recordings, and workspace guardrails." action={<SecondaryButton onClick={onChangePassword}>Change password</SecondaryButton>}/>
    <div className="mb-5 grid min-w-0 grid-cols-2 gap-1 rounded-xl border border-[#dce6f1] bg-[#edf3f8] p-1">
      <button type="button" onClick={() => setSettingsSection("team")} className={`min-h-11 min-w-0 rounded-lg px-2 text-xs font-bold transition sm:text-sm ${settingsSection === "team" ? "bg-white text-[#1266c4] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>Settings &amp; team</button>
      <button type="button" onClick={() => setSettingsSection("guardrails")} className={`min-h-11 min-w-0 rounded-lg px-2 text-xs font-bold transition sm:text-sm ${settingsSection === "guardrails" ? "bg-white text-[#1266c4] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"}`}>Calling guardrails</button>
    </div>
    {settingsSection === "guardrails" ? (
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs sm:p-6">
        <CallingGuardrailsEditor workspace={workspace} onRefresh={onRefresh} onNotify={onNotify} />
      </section>
    ) : (
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
            <div className="min-w-0"><h2 className="font-semibold text-[#0f172a]">Team accounts</h2><p className="mt-1 text-xs leading-5 text-[#64748b]">Separate logins keep assignments, calls, and tasks attributable.</p></div>
            {text(currentUser, "role") === "owner" && <PrimaryButton onClick={onCreateUser}><Icon name="plus" className="h-4 w-4"/>Add setter</PrimaryButton>}
          </div>
          <div className="mt-5 divide-y divide-[#e2e8f0]">{users.map((user) => <div key={text(user, "id")} className="flex min-w-0 items-center gap-3 py-3"><Avatar name={text(user, "display_name")}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0f172a]">{text(user, "display_name")}</div><div className="break-words text-xs leading-4 text-[#64748b]">@{text(user, "username")} · {text(user, "last_login_at") ? `last active ${formatDate(user.last_login_at)}` : "never signed in"}</div></div><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-bold uppercase text-[#475569] min-[350px]:inline-flex">{text(user, "role")}</span><span className={`h-2.5 w-2.5 rounded-full ${Boolean(user.active) ? "bg-emerald-500" : "bg-slate-300"}`}/></div></div>)}</div>
        </section>
        <section className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs sm:p-6">
          <div className="flex min-w-0 items-center gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${Boolean(twilio.configured) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><Icon name={Boolean(twilio.configured) ? "check" : "alert"} className="h-4 w-4"/></div><div className="min-w-0"><h2 className="font-semibold text-[#0f172a]">Twilio connection</h2><p className="truncate text-xs text-[#64748b]">{Boolean(twilio.configured) ? `Ready on ${formatPhone(twilio.phoneNumber)}` : "Environment variables still required"}</p></div></div>
          <div className="mt-5 min-w-0 space-y-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs sm:p-4"><div className="min-w-0"><div className="font-semibold text-[#475569]">TwiML App voice URL</div><code className="mt-1 block max-w-full break-all rounded border border-[#e2e8f0] bg-white p-2 leading-5 text-[#1266c4]">{text(twilio, "voiceUrl")}</code></div><div className="min-w-0"><div className="font-semibold text-[#475569]">Phone number inbound webhook</div><code className="mt-1 block max-w-full break-all rounded border border-[#e2e8f0] bg-white p-2 leading-5 text-[#1266c4]">{text(twilio, "inboundUrl")}</code></div></div>
          <p className="mt-4 text-xs leading-relaxed text-[#64748b]">Use HTTP POST for both URLs. Outbound calls use your Twilio number and inbound callbacks ring every active dialer account.</p>
        </section>
        <section className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs sm:p-6">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-[#1266c4]"><Icon name="mic" className="h-4 w-4"/></div><div className="min-w-0"><h2 className="font-semibold text-[#0f172a]">Call recording</h2><p className="text-xs leading-4 text-[#64748b]">{Boolean(twilio.recordingEnabled !== false) ? "Dual-channel recording active" : "Recording disabled"}</p></div></div>
            {text(currentUser, "role") === "owner" && <button type="button" onClick={toggleRecording} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${Boolean(twilio.recordingEnabled !== false) ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{Boolean(twilio.recordingEnabled !== false) ? "Enabled" : "Disabled"}</button>}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[#64748b]">Dual-channel recording captures both sides of each call. Owner and setter can play, pause, and download recordings from Calls.</p>
          {text(twilio, "recordingUrl") && <div className="mt-4 min-w-0 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs sm:p-4"><div className="font-semibold text-[#475569]">Recording status webhook URL</div><code className="mt-1 block max-w-full break-all rounded border border-[#e2e8f0] bg-white p-2 leading-5 text-[#1266c4]">{text(twilio, "recordingUrl")}</code></div>}
        </section>
      </div>
    )}
  </>;
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[70] flex max-w-full items-end overflow-x-hidden overflow-y-auto bg-[#0f172a]/50 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" onMouseDown={onClose}><div className="max-h-[92dvh] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded-t-3xl border border-white/60 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:my-8 sm:max-w-xl sm:rounded-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#cbd5e1] sm:hidden"/><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-bold tracking-tight text-[#0f172a]">{title}</h2>{description && <p className="mt-1 break-words text-sm leading-5 text-[#64748b]">{description}</p>}</div><button aria-label="Close" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"><Icon name="close" className="h-5 w-5"/></button></div><div className="mt-5 min-w-0 sm:mt-6">{children}</div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#475569]">{label}</span>{children}</label>; }
const inputClass = "min-w-0 max-w-full w-full rounded-lg border border-[#d0dbe7] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]";

function formatClockTime(clock?: string) {
  if (!clock) return "";
  const [hStr, mStr] = clock.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return clock;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
}

type GuardrailValues = {
  name: string;
  guardrailsEnabled: boolean;
  enforceCallingWindow: boolean;
  callWindowStart: string;
  callWindowEnd: string;
  allowWeekendCalling: boolean;
  enforceDailyLimit: boolean;
  maxDailyAttempts: number;
};

const GUARDRAIL_PRESETS: {
  id: string;
  name: string;
  badge: string;
  desc: string;
  values: Partial<GuardrailValues>;
}[] = [
  {
    id: "tcpa",
    name: "TCPA Standard",
    badge: "8am – 8pm",
    desc: "Compliant 8am–8pm local window, max 3 dials/24h, weekdays only",
    values: {
      guardrailsEnabled: true,
      enforceCallingWindow: true,
      callWindowStart: "08:00",
      callWindowEnd: "20:00",
      enforceDailyLimit: true,
      maxDailyAttempts: 3,
      allowWeekendCalling: false,
    },
  },
  {
    id: "extended",
    name: "Extended Hours",
    badge: "7am – 9pm",
    desc: "Early 7am start + late 9pm evening window, max 4 dials/24h, weekends enabled",
    values: {
      guardrailsEnabled: true,
      enforceCallingWindow: true,
      callWindowStart: "07:00",
      callWindowEnd: "21:00",
      enforceDailyLimit: true,
      maxDailyAttempts: 4,
      allowWeekendCalling: true,
    },
  },
  {
    id: "business",
    name: "B2B Daylight",
    badge: "9am – 5pm",
    desc: "Office hours only, max 3 dials/24h, strictly weekdays",
    values: {
      guardrailsEnabled: true,
      enforceCallingWindow: true,
      callWindowStart: "09:00",
      callWindowEnd: "17:00",
      enforceDailyLimit: true,
      maxDailyAttempts: 3,
      allowWeekendCalling: false,
    },
  },
  {
    id: "flexible",
    name: "24/7 Sandbox",
    badge: "Testing Mode",
    desc: "Calling window bypassed, weekends allowed, max 10 dials/24h",
    values: {
      guardrailsEnabled: true,
      enforceCallingWindow: false,
      callWindowStart: "00:00",
      callWindowEnd: "23:59",
      enforceDailyLimit: false,
      maxDailyAttempts: 10,
      allowWeekendCalling: true,
    },
  },
];

function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  badge,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="break-words text-sm font-semibold text-[#0f172a]">{label}</span>
          {badge}
        </div>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1266c4] focus:ring-offset-2 ${
          checked ? "bg-[#1266c4]" : "bg-[#cbd5e1]"
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function CallingGuardrailsEditor({
  workspace,
  onRefresh,
  onNotify,
}: {
  workspace: Row;
  onRefresh: () => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const [name, setName] = useState(text(workspace, "name") || "Intent Dialer");
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(workspace.guardrailsEnabled !== false);
  const [enforceCallingWindow, setEnforceCallingWindow] = useState(workspace.enforceCallingWindow !== false);
  const [callWindowStart, setCallWindowStart] = useState(text(workspace, "callWindowStart") || "08:00");
  const [callWindowEnd, setCallWindowEnd] = useState(text(workspace, "callWindowEnd") || "20:00");
  const [allowWeekendCalling, setAllowWeekendCalling] = useState(workspace.allowWeekendCalling !== false);
  const [enforceDailyLimit, setEnforceDailyLimit] = useState(workspace.enforceDailyLimit !== false);
  const [maxDailyAttempts, setMaxDailyAttempts] = useState(number(workspace, "maxDailyAttempts") || 3);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (workspace.name !== undefined) setName(text(workspace, "name") || "Intent Dialer");
    if (workspace.guardrailsEnabled !== undefined) setGuardrailsEnabled(workspace.guardrailsEnabled !== false);
    if (workspace.enforceCallingWindow !== undefined) setEnforceCallingWindow(workspace.enforceCallingWindow !== false);
    if (workspace.callWindowStart !== undefined) setCallWindowStart(text(workspace, "callWindowStart") || "08:00");
    if (workspace.callWindowEnd !== undefined) setCallWindowEnd(text(workspace, "callWindowEnd") || "20:00");
    if (workspace.allowWeekendCalling !== undefined) setAllowWeekendCalling(workspace.allowWeekendCalling !== false);
    if (workspace.enforceDailyLimit !== undefined) setEnforceDailyLimit(workspace.enforceDailyLimit !== false);
    if (workspace.maxDailyAttempts !== undefined) setMaxDailyAttempts(number(workspace, "maxDailyAttempts") || 3);
  }, [workspace]);

  const saveImmediate = useCallback(
    async (overrides?: Partial<GuardrailValues>) => {
      setSaveStatus("saving");
      setErrorMessage("");
      const payload: GuardrailValues = {
        name,
        guardrailsEnabled,
        enforceCallingWindow,
        callWindowStart,
        callWindowEnd,
        allowWeekendCalling,
        enforceDailyLimit,
        maxDailyAttempts,
        ...overrides,
      };

      try {
        await api("/api/dialer/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "workspace", value: { ...workspace, ...payload } }),
        });
        setSaveStatus("saved");
        const timeStr = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date());
        setLastSavedAt(timeStr);
        onNotify?.("Guardrails saved immediately");
        void onRefresh();
      } catch (cause) {
        setSaveStatus("error");
        setErrorMessage(cause instanceof Error ? cause.message : "Failed to save guardrails.");
      }
    },
    [workspace, name, guardrailsEnabled, enforceCallingWindow, callWindowStart, callWindowEnd, allowWeekendCalling, enforceDailyLimit, maxDailyAttempts, onRefresh, onNotify]
  );

  const applyPreset = (preset: typeof GUARDRAIL_PRESETS[number]) => {
    if (preset.values.guardrailsEnabled !== undefined) setGuardrailsEnabled(preset.values.guardrailsEnabled);
    if (preset.values.enforceCallingWindow !== undefined) setEnforceCallingWindow(preset.values.enforceCallingWindow);
    if (preset.values.callWindowStart !== undefined) setCallWindowStart(preset.values.callWindowStart);
    if (preset.values.callWindowEnd !== undefined) setCallWindowEnd(preset.values.callWindowEnd);
    if (preset.values.allowWeekendCalling !== undefined) setAllowWeekendCalling(preset.values.allowWeekendCalling);
    if (preset.values.enforceDailyLimit !== undefined) setEnforceDailyLimit(preset.values.enforceDailyLimit);
    if (preset.values.maxDailyAttempts !== undefined) setMaxDailyAttempts(preset.values.maxDailyAttempts);

    void saveImmediate(preset.values);
  };

  const handleToggle = (key: keyof GuardrailValues, value: boolean) => {
    if (key === "guardrailsEnabled") setGuardrailsEnabled(value);
    if (key === "enforceCallingWindow") setEnforceCallingWindow(value);
    if (key === "allowWeekendCalling") setAllowWeekendCalling(value);
    if (key === "enforceDailyLimit") setEnforceDailyLimit(value);
    void saveImmediate({ [key]: value });
  };

  const handleAttemptsChange = (nextAttempts: number) => {
    const clamped = Math.max(1, Math.min(20, nextAttempts));
    setMaxDailyAttempts(clamped);
    void saveImmediate({ maxDailyAttempts: clamped });
  };

  const triggerDebouncedSave = (updates: Partial<GuardrailValues>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveImmediate(updates);
    }, 450);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e2e8f0] pb-4">
        <div>
          <h2 className="text-base font-bold text-[#0f172a] sm:text-lg">Calling guardrails</h2>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Enforced server-side before outbound calls bridge. Changes save immediately.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {saveStatus === "saving" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
              Saving immediately…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition">
              <Icon name="check" className="h-3 w-3" />
              Saved immediately{lastSavedAt ? ` (${lastSavedAt})` : ""}
            </span>
          )}
          {saveStatus === "error" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              <Icon name="alert" className="h-3 w-3" />
              {errorMessage || "Save failed"}
            </span>
          )}
          {saveStatus === "idle" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce6f1] bg-[#edf5fc] px-2.5 py-1 text-xs font-semibold text-[#1266c4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1266c4]" />
              Auto-save active
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#64748b]">Quick presets</span>
          <span className="text-[11px] text-[#94a3b8]">Clicking a preset applies &amp; saves instantly</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {GUARDRAIL_PRESETS.map((preset) => {
            const isMatch =
              guardrailsEnabled === preset.values.guardrailsEnabled &&
              enforceCallingWindow === preset.values.enforceCallingWindow &&
              callWindowStart === preset.values.callWindowStart &&
              callWindowEnd === preset.values.callWindowEnd &&
              maxDailyAttempts === preset.values.maxDailyAttempts &&
              allowWeekendCalling === preset.values.allowWeekendCalling;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`group relative flex min-w-0 flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                  isMatch
                    ? "border-[#1266c4] bg-[#edf5fc] shadow-xs ring-2 ring-[#1266c4]"
                    : "border-[#e2e8f0] bg-white hover:border-[#b8d0e6] hover:bg-[#f8fafc]"
                }`}
              >
                <div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-bold text-[#0f172a]">{preset.name}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        isMatch ? "bg-[#1266c4] text-white" : "bg-[#f1f5f9] text-[#475569]"
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{preset.desc}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-[#e2e8f0]/60 pt-2 text-[11px]">
                  <span className={`font-semibold ${isMatch ? "text-[#1266c4]" : "text-[#64748b]"}`}>
                    {isMatch ? "✓ Current preset" : "Apply preset"}
                  </span>
                  <span className="text-[10px] text-[#94a3b8]">Saves instantly</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 sm:p-5">
        <Switch
          label="Master guardrail enforcement"
          description="When active, dialing windows and attempt limits are strictly enforced. When disabled (Flexible Sandbox), all hours and attempts are unlocked for testing or sprint calling."
          checked={guardrailsEnabled}
          onChange={(checked) => handleToggle("guardrailsEnabled", checked)}
          badge={
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                guardrailsEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {guardrailsEnabled ? "Strict mode" : "Flexible mode"}
            </span>
          }
        />
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <Switch
          label="Enforce local prospect time window"
          description="Checks the prospect's local timezone before dialing to ensure you only call during permissible hours."
          checked={enforceCallingWindow}
          onChange={(checked) => handleToggle("enforceCallingWindow", checked)}
        />

        <div className={`grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#f1f5f9] transition ${!enforceCallingWindow ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Local start time
            </label>
            <div className="relative">
              <input
                type="time"
                value={callWindowStart}
                onChange={(event) => {
                  setCallWindowStart(event.target.value);
                  triggerDebouncedSave({ callWindowStart: event.target.value });
                }}
                onBlur={() => void saveImmediate({ callWindowStart })}
                className={inputClass}
              />
              <span className="mt-1 block text-[11px] text-[#64748b]">
                Starts at {formatClockTime(callWindowStart)} local
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Local end time
            </label>
            <div className="relative">
              <input
                type="time"
                value={callWindowEnd}
                onChange={(event) => {
                  setCallWindowEnd(event.target.value);
                  triggerDebouncedSave({ callWindowEnd: event.target.value });
                }}
                onBlur={() => void saveImmediate({ callWindowEnd })}
                className={inputClass}
              />
              <span className="mt-1 block text-[11px] text-[#64748b]">
                Ends at {formatClockTime(callWindowEnd)} local
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <Switch
            label="Allow weekend dialing"
            description="Permit outbound dials on Saturday and Sunday within the configured time window."
            checked={allowWeekendCalling}
            onChange={(checked) => handleToggle("allowWeekendCalling", checked)}
            badge={
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  allowWeekendCalling ? "bg-blue-50 text-[#1266c4] border border-blue-200" : "bg-slate-100 text-slate-600"
                }`}
              >
                {allowWeekendCalling ? "Weekends allowed" : "Weekdays only"}
              </span>
            }
          />
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
          <Switch
            label="Enforce daily attempt limit"
            description="Caps the number of outbound dials to any single lead in a rolling 24-hour window."
            checked={enforceDailyLimit}
            onChange={(checked) => handleToggle("enforceDailyLimit", checked)}
          />

          <div className={`mt-3 pt-3 border-t border-[#f1f5f9] transition ${!enforceDailyLimit ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#475569]">Max dials / 24 hours:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAttemptsChange(maxDailyAttempts - 1)}
                  disabled={maxDailyAttempts <= 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[#d0dbe7] bg-white text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc] disabled:opacity-40"
                >
                  -
                </button>
                <span className="min-w-6 text-center text-sm font-bold text-[#0f172a]">{maxDailyAttempts}</span>
                <button
                  type="button"
                  onClick={() => handleAttemptsChange(maxDailyAttempts + 1)}
                  disabled={maxDailyAttempts >= 20}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[#d0dbe7] bg-white text-sm font-bold text-[#0f172a] hover:bg-[#f8fafc] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 8, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleAttemptsChange(num)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    maxDailyAttempts === num
                      ? "bg-[#1266c4] text-white"
                      : "bg-[#edf5fc] text-[#1266c4] hover:bg-[#e1effb]"
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-1.5">
            Workspace name
          </label>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              triggerDebouncedSave({ name: event.target.value });
            }}
            onBlur={() => void saveImmediate({ name })}
            placeholder="e.g. Intent Dialer"
            className={inputClass}
          />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-[#edf5fc]/60 p-3 text-xs leading-relaxed text-[#1e3a62]">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-[#1266c4]" />
          <div>
            <span className="font-bold">Permanent DNC suppression:</span> Numbers on your Do-Not-Call suppression list are strictly blocked server-side before Twilio receives a call request, regardless of guardrail overrides or time presets.
          </div>
        </div>
      </div>
    </div>
  );
}

function GuardrailsModal({
  workspace,
  onClose,
  onRefresh,
  onNotify,
}: {
  workspace: Row;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  return (
    <Modal
      title="Calling guardrails"
      description="Configure compliance boundaries and dialing rules. Changes save immediately to the server."
      onClose={onClose}
    >
      <CallingGuardrailsEditor
        workspace={workspace}
        onRefresh={onRefresh}
        onNotify={onNotify}
      />
    </Modal>
  );
}

const DIALPAD_KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
] as const;

function PhoneKeypad({ onPress, disabled = false }: { onPress: (digit: string) => void; disabled?: boolean }) {
  return <div className="mx-auto grid w-full min-w-0 max-w-[280px] grid-cols-3 gap-2">{DIALPAD_KEYS.map(([digit, letters]) => <button key={digit} type="button" disabled={disabled} onClick={() => onPress(digit)} aria-label={`Press ${digit}`} className="flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl border border-[#d5e3f1] bg-white py-2 text-xl font-bold text-[#173d6b] shadow-xs transition hover:border-[#76a9d8] hover:bg-[#edf5fc] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:rounded-2xl"><span>{digit}</span>{letters && <span className="mt-0.5 text-[8px] font-bold tracking-[.12em] text-[#7f9bb7]">{letters}</span>}</button>)}</div>;
}

function ManualDialModal({ onClose, onDial }: { onClose: () => void; onDial: (lead: Row) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const press = (digit: string) => setPhone((current) => current.length < 16 ? `${current}${digit}` : current);
  const submit = async () => {
    if (!phone.trim()) return;
    setSaving(true); setError("");
    const parts = name.trim().split(/\s+/).filter(Boolean);
    try {
      const result = await api<{ leads: Row[]; errors: { error: string }[] }>("/api/dialer/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: { firstName: parts[0] || "Manual", lastName: parts.slice(1).join(" ") || "call", company: "Manual dial", phone, source: "dialpad" } }),
      });
      if (!result.leads[0]) throw new Error(result.errors[0]?.error || "Enter a valid phone number.");
      onDial(result.leads[0]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start this call."); setSaving(false);
    }
  };
  return <Modal title="Dial a number" description="Use the keypad, paste, or type directly. It will be saved as a manual lead so the call remains in your history." onClose={onClose}>
    <div className="mx-auto w-full min-w-0 max-w-sm">
      <div className="mb-4 min-w-0 rounded-2xl border border-[#d5e3f1] bg-[#f8fbfe] p-3 text-center sm:p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[#7a95b3]">Phone number</div>
        <input inputMode="tel" autoFocus value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^\d+*#() -]/g, ""))} placeholder="Enter number…" className="mt-2 w-full min-w-0 border-0 bg-transparent text-center text-2xl font-bold tracking-wide text-[#173d6b] outline-none placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-[#a5b9cb] sm:text-3xl sm:placeholder:text-lg"/>
        <div className="mt-3 flex justify-center gap-2"><button type="button" onClick={() => setPhone((current) => current.slice(0, -1))} className="rounded-full bg-[#edf5fc] px-4 py-1.5 text-xs font-bold text-[#1266c4] hover:bg-[#e1effb] transition">Delete</button><button type="button" onClick={() => setPhone("")} className="rounded-full bg-[#edf5fc] px-4 py-1.5 text-xs font-bold text-[#1266c4] hover:bg-[#e1effb] transition">Clear</button></div>
      </div>
      <PhoneKeypad onPress={press}/>
      <div className="mt-5"><Field label="Prospect or business name (optional)"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Acme Air Conditioning" className={inputClass}/></Field></div>
      {error && <p className="mt-3 text-center text-sm font-semibold text-red-600">{error}</p>}
      <button type="button" disabled={!phone.trim() || saving} onClick={() => void submit()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1266c4] px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0f57aa] disabled:cursor-not-allowed disabled:opacity-45"><Icon name="phone"/>{saving ? "Starting call…" : "Call number"}</button>
    </div>
  </Modal>;
}

function AddLeadModal({ users, lists, onClose, onDone }: { users: Row[]; lists: Row[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", company: "", phone: "", email: "", city: "", state: "FL", assignedUserId: "", listId: "" }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await api("/api/dialer/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead: form, listId: form.listId || null }) }); onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add lead."); setSaving(false); } };
  return <Modal title="Add lead" description="Add one prospect directly to your calling queue." onClose={onClose}><form onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><input className={inputClass} value={form.firstName} onChange={(event) => set("firstName", event.target.value)}/></Field><Field label="Last name"><input className={inputClass} value={form.lastName} onChange={(event) => set("lastName", event.target.value)}/></Field><Field label="Company"><input className={inputClass} value={form.company} onChange={(event) => set("company", event.target.value)}/></Field><Field label="Phone *"><input required className={inputClass} value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="(407) 555-0123"/></Field><Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => set("email", event.target.value)}/></Field><Field label="City"><input className={inputClass} value={form.city} onChange={(event) => set("city", event.target.value)}/></Field><Field label="State"><input maxLength={2} className={inputClass} value={form.state} onChange={(event) => set("state", event.target.value.toUpperCase())}/></Field><Field label="Assign to"><select className={inputClass} value={form.assignedUserId} onChange={(event) => set("assignedUserId", event.target.value)}><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select></Field><Field label="List"><select className={inputClass} value={form.listId} onChange={(event) => set("listId", event.target.value)}><option value="">No list</option>{lists.map((list) => <option key={text(list, "id")} value={text(list, "id")}>{text(list, "name")}</option>)}</select></Field></div>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit" disabled={saving}>{saving ? "Adding…" : "Add lead"}</PrimaryButton></div></form></Modal>;
}

function ImportModal({ users, onClose, onDone }: { users: Row[]; onClose: () => void; onDone: (message: string) => void }) {
  const [fileName, setFileName] = useState(""); const [parsed, setParsed] = useState<ParsedLead[]>([]); const [assignee, setAssignee] = useState(""); const [listName, setListName] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const choose = async (file?: File) => { if (!file) return; setListName(file.name.replace(/\.csv$/i, "")); const leads = parseLeadCsv(await file.text()); const categories = leads.reduce<Record<string, number>>((totals, lead) => { const status = String(lead.status || "to_call"); totals[status] = (totals[status] || 0) + 1; return totals; }, {}); setFileName(`${file.name} · ${categories.to_call || 0} ready · ${categories.try_again || 0} retry · ${categories.follow_up || 0} follow-up · ${categories.closed || 0} closed`); setParsed(leads); if (!leads.length) setError("No rows with a phone column were found."); else setError(""); };
  const submit = async () => { setSaving(true); try { const result = await api<{ leads: Row[]; errors: Row[] }>("/api/dialer/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: parsed.map((lead) => ({ ...lead, assignedUserId: assignee || null })), listName: listName || "Imported leads" }) }); onDone(`Imported ${result.leads.length} leads${result.errors.length ? ` · ${result.errors.length} skipped` : ""}`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); setSaving(false); } };
  return <Modal title="Import CSV" description="Headers are detected automatically. A phone column is the only requirement." onClose={onClose}><label className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#d0dbe7] bg-[#f8fbfe] px-5 py-9 text-center hover:border-[#1266c4] transition"><Icon name="upload" className="h-7 w-7 text-[#1266c4]"/><span className="mt-3 text-sm font-semibold text-[#0f172a]">{fileName || "Choose a CSV file"}</span><span className="mt-1 text-xs text-[#64748b]">Up to 5,000 leads per import</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void choose(event.target.files?.[0])}/></label>{parsed.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="New list name"><input className={inputClass} value={listName} onChange={(event) => setListName(event.target.value)}/></Field><Field label="Assign imported leads"><select className={inputClass} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select></Field><div className="sm:col-span-2 rounded-lg bg-[#edf5fc] border border-[#b8d0e6] px-4 py-3 text-sm text-[#1266c4]">Ready to import {parsed.length} leads. Duplicate phone/company pairs will be updated instead of duplicated.</div></div>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton onClick={() => void submit()} disabled={!parsed.length || saving}>{saving ? "Importing…" : `Import ${parsed.length || ""} leads`}</PrimaryButton></div></Modal>;
}

function TaskModal({ leads, users, onClose, onDone }: { leads: Row[]; users: Row[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(""); const [leadId, setLeadId] = useState(""); const [assignedUserId, setAssignedUserId] = useState(""); const [dueAt, setDueAt] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); await api("/api/dialer/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, leadId: leadId || null, assignedUserId: assignedUserId || null, dueAt: dueAt || null, taskType: "follow_up" }) }); onDone(); };
  return <Modal title="New task" onClose={onClose}><form onSubmit={submit} className="space-y-4"><Field label="Task"><input required className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Follow up on estimate"/></Field><Field label="Lead"><select className={inputClass} value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">No lead</option>{leads.map((lead) => <option key={text(lead, "id")} value={text(lead, "id")}>{leadName(lead)} — {text(lead, "company")}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Assign to"><select className={inputClass} value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}><option value="">Me</option>{users.map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select></Field><Field label="Due"><input type="datetime-local" className={inputClass} value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></Field></div><div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit">Create task</PrimaryButton></div></form></Modal>;
}

function UserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" }); const [error, setError] = useState(""); const [show, setShow] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, role: "agent" }) }); onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create account."); } };
  return <Modal title="Create setter account" description="The setter will be asked to change this temporary password after signing in." onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name"><input required className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/></Field><Field label="Username"><input required className={inputClass} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}/></Field></div><Field label="Email (optional)"><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></Field><Field label="Temporary password"><div className="flex gap-2"><input required minLength={10} type={show ? "text" : "password"} className={inputClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/><SecondaryButton onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</SecondaryButton></div></Field>{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit">Create account</PrimaryButton></div></form></Modal>;
}

function PasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }); onDone(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to change password."); } };
  return <Modal title="Change password" description="Use at least 10 characters." onClose={onClose}><form onSubmit={submit} className="space-y-4"><Field label="Current password"><input required type="password" className={inputClass} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></Field><Field label="New password"><input required minLength={10} type="password" className={inputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/></Field>{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit">Update password</PrimaryButton></div></form></Modal>;
}

function CallDock({ lead, phase, error, disposition, setDisposition, notes, setNotes, callbackAt, setCallbackAt, autoDial, setAutoDial, onEnd, onSendDigit, onSave, onClose }: { lead: Row; phase: CallPhase; error: string; disposition: string; setDisposition: (value: string) => void; notes: string; setNotes: (value: string) => void; callbackAt: string; setCallbackAt: (value: string) => void; autoDial: boolean; setAutoDial: (value: boolean) => void; onEnd: () => void; onSendDigit: (digit: string) => void; onSave: () => void; onClose: () => void }) {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState("");
  const active = ["connecting", "ringing", "open"].includes(phase);

  const handleDigit = useCallback((digit: string) => {
    onSendDigit(digit);
    setSentDigits((prev) => prev + digit);
  }, [onSendDigit]);

  useEffect(() => {
    if (phase !== "open") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const valid = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"];
      if (valid.includes(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleDigit]);

  return <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[95dvh] max-w-full overflow-x-hidden overflow-y-auto rounded-t-3xl border border-[#9ebbd6] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_25px_80px_rgba(18,59,112,.28)] sm:inset-x-3 sm:bottom-3 sm:max-w-5xl sm:rounded-2xl lg:left-[252px]">
    <div className="min-w-0 bg-gradient-to-r from-[#123b70] via-[#14579a] to-[#1266c4] px-4 py-4 text-white sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-12 sm:w-12 ${phase === "open" ? "animate-pulse bg-white/25 text-white" : "bg-white/10"}`}><Icon name="phone" className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2"><div className="truncate font-semibold">{leadName(lead)}</div><span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">{phase === "open" ? "Connected" : phase}</span></div>
          <div className="mt-1 truncate text-xs text-white/75 sm:text-sm">{text(lead, "company")} · {formatPhone(lead.phone_e164)} · {localTime(lead)} local</div>
        </div>
        <button onClick={onClose} aria-label="Close call dock" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"><Icon name="close" className="h-5 w-5"/></button>
      </div>
      {active && <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <button type="button" onClick={() => setKeypadOpen((current) => !current)} className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold shadow-sm transition ${keypadOpen ? "bg-white text-[#1266c4]" : "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"}`} aria-label="Toggle in-call keypad"><Icon name="dialpad" className="h-4 w-4 shrink-0"/><span>Keypad</span>{sentDigits.length > 0 && <span className="max-w-12 truncate rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-[#1266c4]">{sentDigits.slice(-4)}</span>}</button>
        <button onClick={onEnd} className="min-h-10 min-w-0 rounded-xl bg-red-500 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-600">End call</button>
      </div>}
    </div>
    {keypadOpen && active && (
      <div className="min-w-0 border-b border-[#dce8f3] bg-[#f5f9fd] px-3 py-4 sm:px-4 sm:py-5">
        <div className="mb-3 text-center">
          <div className="text-sm font-bold text-[#173d6b]">In-call keypad (DTMF)</div>
          <div className="mt-1 text-xs text-[#64748b]">
            {phase === "open"
              ? "Press on-screen keys or type numbers to navigate automated phone trees (e.g. press 1 to continue)."
              : "Keypad activates as soon as the call connects."}
          </div>
          {sentDigits.length > 0 && (
            <div className="mt-2.5 inline-flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-lg border border-[#d5e3f1] bg-white px-3 py-1 text-xs shadow-xs">
              <span className="text-[#64748b]">Sent:</span>
              <span className="max-w-40 truncate font-mono text-sm font-bold tracking-wider text-[#1266c4]">{sentDigits}</span>
              <button
                type="button"
                onClick={() => setSentDigits("")}
                className="text-[11px] font-medium text-[#94a3b8] hover:text-[#1266c4]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <PhoneKeypad onPress={handleDigit} disabled={phase !== "open"}/>
      </div>
    )}
    <div className="grid min-w-0 gap-4 p-3 sm:p-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
      <Field label="Outcome">
        <select value={disposition} onChange={(event) => setDisposition(event.target.value)} className={inputClass}>
          {DISPOSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Call notes">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="What happened on the call?"/>
      </Field>
      <PrimaryButton onClick={onSave} disabled={active}>Save & {autoDial ? "dial next" : "close"}</PrimaryButton>
    </div>
    {(disposition === "callback" || disposition === "appointment") && (
      <div className="border-t border-[#e2e8f0] px-4 py-3">
        <Field label="Callback / appointment time">
          <input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} className={`${inputClass} max-w-sm`}/>
        </Field>
      </div>
    )}
    <div className="flex flex-col gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-start gap-2 text-xs leading-5 text-[#475569]">
        <input className="mt-1" type="checkbox" checked={autoDial} onChange={(event) => setAutoDial(event.target.checked)}/>
        Automatically dial the next eligible lead after saving
      </label>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  </div>;
}

function IncomingCall({ call, onClose }: { call: VoiceCall; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState("");
  const accept = () => { call.accept(); setAccepted(true); };
  const reject = () => { call.reject(); onClose(); };
  const handleDigit = (digit: string) => {
    call.sendDigits(digit);
    setSentDigits((prev) => prev + digit);
  };
  useEffect(() => { const done = () => onClose(); call.on("disconnect", done); call.on("cancel", done); return () => { call.removeListener("disconnect", done); call.removeListener("cancel", done); }; }, [call, onClose]);
  return <div className="fixed inset-x-3 top-3 z-[90] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-[#b8d0e6] bg-white p-5 shadow-2xl sm:left-auto sm:right-5 sm:top-5 sm:w-[340px]">
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#e2effb] text-[#1266c4]"><Icon name="phone" className="h-5 w-5"/></div>
      <div>
        <div className="text-xs font-bold uppercase tracking-[.14em] text-[#1266c4]">Inbound callback</div>
        <div className="mt-1 font-semibold text-[#0f172a]">{formatPhone(call.parameters.From)}</div>
      </div>
    </div>
    {accepted ? (
      <>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setKeypadOpen((current) => !current)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${keypadOpen ? "bg-[#1266c4] text-white" : "bg-[#edf5fc] text-[#1266c4] hover:bg-[#e1effb]"}`}><Icon name="dialpad"/>Keypad</button>
          <button onClick={() => call.disconnect()} className="min-h-11 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition">End call</button>
        </div>
        {keypadOpen && (
          <div className="mt-5 border-t border-[#dce8f3] pt-5">
            {sentDigits && (
              <div className="mb-2 text-center text-xs font-mono font-bold tracking-widest text-[#1266c4]">
                Sent: {sentDigits}
              </div>
            )}
            <PhoneKeypad onPress={handleDigit}/>
          </div>
        )}
      </>
    ) : (
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={reject} className="min-h-11 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition">Decline</button>
        <button onClick={accept} className="min-h-11 rounded-xl bg-[#1266c4] py-2.5 text-sm font-bold text-white hover:bg-[#0f57aa] transition">Answer</button>
      </div>
    )}
  </div>;
}
