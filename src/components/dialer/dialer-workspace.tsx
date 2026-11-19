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
  const [modal, setModal] = useState<"lead" | "import" | "task" | "user" | "password" | null>(null);
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

  const logout = async () => {
    deviceRef.current?.destroy();
    await fetch("/api/admin/logout", { method: "POST" });
    const isDialerHost = window.location.hostname === "call.intentrev.net" || window.location.hostname.startsWith("call.localhost");
    window.location.href = isDialerHost ? "/login" : "/admin/login";
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#17211d]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#dfe4df] bg-[#f2f3f0] lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[#dfe4df] px-5">
          <DialerBrandMark />
          <div><div className="font-semibold tracking-tight">Intent Dialer</div><div className="text-[10px] uppercase tracking-[.2em] text-[#78817c]">Private workspace</div></div>
        </div>
        <div className="px-4 pt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-[#87908b]">Workspace</div>
        <nav className="mt-2 space-y-1 px-3">
          {VIEWS.map((item) => <NavButton key={item.id} {...item} active={view === item.id} onClick={() => navigate(item.id)} />)}
        </nav>
        <div className="mt-auto space-y-1 border-t border-[#dfe4df] p-3">
          <NavButton id="dnc" label="Do not call" icon="shield" active={view === "dnc"} onClick={() => navigate("dnc")} />
          <NavButton id="settings" label="Settings & team" icon="settings" active={view === "settings"} onClick={() => navigate("settings")} />
          <div className="mt-3 rounded-xl border border-[#dfe4df] bg-white p-3">
            <div className="flex items-center gap-3">
              <Avatar name={text(currentUser, "displayName") || text(currentUser, "display_name")} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{text(currentUser, "displayName") || text(currentUser, "display_name")}</div><div className="text-xs capitalize text-[#7a837f]">{text(currentUser, "role")}</div></div>
              <button onClick={logout} title="Log out" className="rounded-md p-1.5 text-[#77807b] hover:bg-[#eef1ee] hover:text-red-600"><Icon name="logout" /></button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <MobileHeader view={view} navigate={navigate} logout={logout} />
        {error && <div className="mx-auto mt-5 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!Boolean(twilio.configured) && view !== "settings" && (
          <button onClick={() => navigate("settings")} className="mx-auto mt-5 flex max-w-7xl items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
            <Icon name="alert" /> Add the Twilio environment variables before placing calls. Open settings for the exact webhook URLs.
          </button>
        )}
        <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10">
          {view === "dashboard" && <Dashboard counts={counts} metrics={metrics} recentCalls={(overview.recentCalls || []) as Row[]} conversations={(overview.conversations || []) as Row[]} outcomeBreakdown={(overview.outcomeBreakdown || []) as Row[]} tasks={(overview.tasks || []) as Row[]} repStats={(overview.repStats || []) as Row[]} onNavigate={navigate} />}
          {view === "leads" && <ResponsiveLeadsView leads={visibleLeads} allLeads={leads} counts={counts} users={users} lists={lists} statusFilter={statusFilter} setStatusFilter={setStatusFilter} search={search} setSearch={setSearch} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onDial={placeCall} onAdd={() => setModal("lead")} onImport={() => setModal("import")} onRefresh={refresh} />}
          {view === "calls" && <ResponsiveCallsView calls={calls} />}
          {view === "tasks" && <TasksView tasks={tasks} onCreate={() => setModal("task")} onRefresh={refresh} />}
          {view === "sequences" && <SequencesView sequences={sequences} onRefresh={refresh} />}
          {view === "pipeline" && <PipelineView leads={leads} onDial={placeCall} />}
          {view === "dnc" && <DncView entries={dnc} onRefresh={refresh} />}
          {view === "settings" && <SettingsView settings={settings} currentUser={currentUser} onCreateUser={() => setModal("user")} onChangePassword={() => setModal("password")} onRefresh={refresh} />}
        </main>
      </div>

      <MobileBottomNav view={view} navigate={navigate} />
      {toast && <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#173e38] px-5 py-2.5 text-sm font-medium text-white shadow-xl lg:bottom-5">{toast}</div>}
      {modal === "lead" && <AddLeadModal users={users} lists={lists} onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Lead added"); void refresh(); }} />}
      {modal === "import" && <ImportModal users={users} onClose={() => setModal(null)} onDone={(message) => { setModal(null); setToast(message); void refresh(); }} />}
      {modal === "task" && <TaskModal leads={leads} users={users} onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Task created"); void refresh(); }} />}
      {modal === "user" && <UserModal onClose={() => setModal(null)} onDone={() => { setModal(null); setToast("Setter account created"); void refresh(); }} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} onDone={() => { setPasswordChanged(true); setModal(null); setToast("Password updated"); void refresh(); }} />}
      {activeLead && <CallDock lead={activeLead} phase={callPhase} error={callError} disposition={disposition} setDisposition={setDisposition} notes={callNotes} setNotes={setCallNotes} callbackAt={callbackAt} setCallbackAt={setCallbackAt} autoDial={autoDial} setAutoDial={setAutoDial} onEnd={endCall} onSave={saveDisposition} onClose={() => { if (callRef.current) endCall(); setActiveLead(null); setCallPhase("idle"); }} />}
      {incomingCall && <IncomingCall call={incomingCall} onClose={() => setIncomingCall(null)} />}
    </div>
  );
}

function NavButton({ label, icon, active, onClick }: { id: string; label: string; icon: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-white font-semibold text-[#0d6f67] shadow-sm ring-1 ring-[#dfe4df]" : "text-[#626c67] hover:bg-white/70 hover:text-[#24352f]"}`}><Icon name={icon} /><span>{label}</span></button>;
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
    close: <path d="M18 6L6 18M6 6l12 12"/>, menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] || paths.grid}</svg>;
}

function Avatar({ name }: { name: string }) {
  return <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dcece8] text-xs font-bold text-[#0d6f67]">{name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "I"}</div>;
}

function DialerBrandMark({ large = false }: { large?: boolean }) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-[#159ed8] to-[#1266c4] shadow-[0_6px_18px_rgba(18,102,196,.24)] ${large ? "h-16 w-16 rounded-2xl" : "h-9 w-9 rounded-xl"}`}><Logo className={`${large ? "!h-14 sm:!h-14" : "!h-8 sm:!h-8"} [&>img]:brightness-0 [&>img]:invert [&>img]:drop-shadow-none`}/></span>;
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#f7f7f5]"><div className="text-center"><div className="flex justify-center"><DialerBrandMark large/></div><div className="mx-auto mt-5 h-8 w-8 animate-spin rounded-full border-4 border-[#d4e7e3] border-t-[#1266c4]"/><p className="mt-4 text-sm text-[#66716b]">Opening Intent Dialer…</p></div></div>;
}

function MobileHeader({ view, navigate, logout }: { view: View; navigate: (view: View) => void; logout: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#dfe4df]/80 bg-white/90 px-4 shadow-sm backdrop-blur-xl lg:hidden">
      <button aria-label="Open navigation" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl text-[#31423c] transition hover:bg-[#eef3f0]"><Icon name="menu" className="h-5 w-5"/></button>
      <div className="flex items-center gap-2.5"><DialerBrandMark/><div><div className="text-sm font-bold leading-none">Intent Dialer</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.18em] text-[#7c8781]">Private workspace</div></div></div>
      <button onClick={() => navigate("leads")} className="grid h-11 w-11 place-items-center rounded-xl bg-[#e0f1ed] text-[#0e766e]" aria-label="Open calling queue"><Icon name="phone" className="h-5 w-5"/></button>
    </header>
    {open && <div className="fixed inset-0 z-[85] bg-[#101a17]/45 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}><div className="h-full w-[min(86vw,340px)] overflow-y-auto bg-[#f4f5f2] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between rounded-2xl bg-[#173e38] p-4 text-white"><div className="flex items-center gap-3"><DialerBrandMark/><div><div className="font-bold">Intent Dialer</div><div className="mt-1 text-[10px] uppercase tracking-[.16em] text-white/55">Workspace menu</div></div></div><button aria-label="Close navigation" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Icon name="close"/></button></div><div className="space-y-1">{[...VIEWS, { id: "dnc" as View, label: "Do not call", icon: "shield" }, { id: "settings" as View, label: "Settings & team", icon: "settings" }].map((item) => <NavButton key={item.id} {...item} active={view === item.id} onClick={() => { navigate(item.id); setOpen(false); }}/>)}</div><button onClick={logout} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700"><Icon name="logout"/>Log out</button></div></div>}
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
  return <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9e0dc] bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(24,45,37,.08)] backdrop-blur-xl [padding-bottom:calc(env(safe-area-inset-bottom)+.5rem)] lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-5">{items.map((item) => { const active = view === item.id || (item.id === "settings" && ["settings", "dnc", "sequences", "pipeline"].includes(view)); return <button key={item.id} onClick={() => navigate(item.id)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${active ? "bg-[#e6f2ef] text-[#0e766e]" : "text-[#78827d]"}`}><Icon name={item.icon} className="h-4.5 w-4.5"/><span>{item.label}</span></button>; })}</div></nav>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#0f766e]">{eyebrow}</div><h1 className="text-[2rem] font-bold tracking-[-.04em] text-[#17211d] sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[#727b77]">{description}</p></div>{action && <div className="grid grid-cols-2 gap-2 sm:flex">{action}</div>}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "interested" || status === "contacted" || status === "completed" || status === "converted" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : status === "no_answer" || status === "voicemail" || status === "try_again" ? "bg-amber-50 text-amber-700 ring-amber-200" : status === "callback" || status === "follow_up" || status === "appointment" ? "bg-violet-50 text-violet-700 ring-violet-200" : status === "dnc" || status === "failed" ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>{STATUS_LABELS[status] || status || "New"}</span>;
}

function PrimaryButton({ children, onClick, type = "button", disabled = false }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17211d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e766e] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function SecondaryButton({ children, onClick, type = "button" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d7ddd8] bg-white px-4 py-2.5 text-sm font-semibold text-[#34423c] shadow-sm transition hover:border-[#9ebbb4] hover:text-[#0e766e]">{children}</button>;
}

function Dashboard({ counts, metrics, recentCalls, conversations, outcomeBreakdown, tasks, repStats, onNavigate }: { counts: Row; metrics: Row; recentCalls: Row[]; conversations: Row[]; outcomeBreakdown: Row[]; tasks: Row[]; repStats: Row[]; onNavigate: (view: View) => void }) {
  const connected = number(metrics, "conversations_today");
  const total = number(metrics, "calls_today");
  return <>
    <PageHeader eyebrow="Your workspace" title="Good calls start here" description="A live view of your team, queue, and follow-ups." action={<PrimaryButton onClick={() => onNavigate("leads")}><Icon name="phone"/>Start dialing</PrimaryButton>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Calls today", total, `${number(metrics, "calls_week")} this week`],
        ["Conversations", connected, `${total ? Math.round(connected / total * 100) : 0}% conversation rate`],
        ["Talk time", `${Math.floor(number(metrics, "talk_seconds_today") / 60)}m`, "Today across the team"],
        ["Ready to call", number(counts, "to_call"), `${number(counts, "try_again")} to retry`],
      ].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-[0_4px_20px_rgba(25,45,37,.04)]"><div className="text-xs font-semibold uppercase tracking-[.12em] text-[#7b8580]">{label}</div><div className="mt-3 text-3xl font-bold tracking-tight">{value}</div><div className="mt-2 text-xs text-[#87908b]">{sub}</div></div>)}
    </div>
    <DailyRecap metrics={metrics} conversations={conversations} outcomeBreakdown={outcomeBreakdown}/>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white"><div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4"><h2 className="font-semibold">Recent calls</h2><button onClick={() => onNavigate("calls")} className="text-xs font-semibold text-[#0e766e]">View all</button></div><div className="divide-y divide-[#edf0ed]">{recentCalls.length ? recentCalls.map((call) => <div key={text(call, "id")} className="flex items-center gap-3 px-5 py-3.5"><Avatar name={leadName(call)}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{leadName(call)}</div><div className="truncate text-xs text-[#7a847f]">{text(call, "company")} · {text(call, "user_name") || "Unassigned"}</div></div><StatusBadge status={text(call, "disposition") || text(call, "status")}/><div className="hidden w-28 text-right text-xs text-[#7a847f] sm:block">{formatDate(call.started_at)}</div></div>) : <Empty message="No calls yet. Start with your ready queue."/>}</div></section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#dfe4df] bg-white"><div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4"><h2 className="font-semibold">Upcoming tasks</h2><button onClick={() => onNavigate("tasks")} className="text-xs font-semibold text-[#0e766e]">Open tasks</button></div><div className="divide-y divide-[#edf0ed]">{tasks.slice(0, 5).map((task) => <div key={text(task, "id")} className="px-5 py-3.5"><div className="text-sm font-semibold">{text(task, "title")}</div><div className="mt-1 text-xs text-[#7a847f]">{leadName(task)} · {formatDate(task.due_at)}</div></div>)}{!tasks.length && <Empty message="Nothing due right now."/>}</div></section>
        <section className="rounded-2xl border border-[#dfe4df] bg-white"><div className="border-b border-[#edf0ed] px-5 py-4"><h2 className="font-semibold">Team today</h2></div><div className="divide-y divide-[#edf0ed]">{repStats.map((rep) => <div key={text(rep, "id")} className="flex items-center gap-3 px-5 py-3.5"><Avatar name={text(rep, "display_name")}/><div className="flex-1"><div className="text-sm font-semibold">{text(rep, "display_name")}</div><div className="text-xs capitalize text-[#7a847f]">{text(rep, "role")}</div></div><div className="text-right"><div className="text-sm font-bold">{number(rep, "calls_today")}</div><div className="text-[10px] uppercase text-[#8a938f]">calls</div></div></div>)}</div></section>
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
  return <section className="mt-6 overflow-hidden rounded-3xl border border-[#cfded9] bg-white shadow-[0_12px_40px_rgba(23,62,56,.06)]">
    <div className="bg-gradient-to-br from-[#173e38] via-[#1b5149] to-[#0e766e] px-5 py-6 text-white sm:px-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="text-[10px] font-bold uppercase tracking-[.22em] text-[#a9d7ce]">Today&apos;s recap</div><h2 className="mt-2 text-2xl font-bold tracking-[-.035em]">Your day at a glance</h2><p className="mt-1 text-sm text-white/55">Live totals update as calls and outcomes are saved.</p></div><div className="text-xs font-semibold text-white/55">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</div></div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">{summary.map(([label, value], index) => <div key={String(label)} className={`rounded-2xl border border-white/10 bg-white/[.07] p-4 ${index === 4 ? "col-span-2 sm:col-span-1" : ""}`}><div className="text-2xl font-bold tracking-tight">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/50">{label}</div></div>)}</div>
    </div>
    <div className="grid lg:grid-cols-[1fr_280px]">
      <div className="border-b border-[#e8eeeb] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 sm:px-7"><div><h3 className="font-bold">Who you talked to</h3><p className="mt-0.5 text-xs text-[#7d8882]">Notes and open follow-ups from today</p></div><span className="rounded-full bg-[#e5f2ef] px-3 py-1 text-xs font-bold text-[#0e766e]">{conversations.length}</span></div>
        <div className="divide-y divide-[#edf1ef]">{conversations.map((call) => <article key={text(call, "id")} className="px-5 py-4 sm:px-7"><div className="flex items-start gap-3"><Avatar name={leadName(call)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-bold text-[#23332d]">{leadName(call)}</div><div className="mt-0.5 text-xs text-[#7d8882]">{text(call, "company") || formatPhone(call.phone_e164)} · {text(call, "user_name") || "Unassigned"}</div></div><StatusBadge status={text(call, "disposition")}/></div>{(text(call, "notes") || text(call, "lead_notes")) && <div className="mt-3 rounded-xl bg-[#f6f8f6] px-3 py-2.5 text-xs leading-5 text-[#56635d]"><span className="font-bold text-[#33443d]">Note: </span>{text(call, "notes") || text(call, "lead_notes")}</div>}{text(call, "open_task_title") && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-violet-700"><Icon name="check" className="h-3.5 w-3.5"/><span>{text(call, "open_task_title")}{call.open_task_due_at ? ` · ${formatDate(call.open_task_due_at)}` : ""}</span></div>}</div></div></article>)}{!conversations.length && <Empty message="Conversations will appear here after you save contacted, interested, callback, appointment, or converted outcomes."/>}</div>
      </div>
      <aside className="bg-[#fafbf9] px-5 py-5 sm:px-7 lg:px-5"><h3 className="text-xs font-bold uppercase tracking-[.14em] text-[#66736c]">Outcome mix</h3><div className="mt-4 space-y-3">{outcomeBreakdown.map((item) => { const count = number(item, "count"); const total = Math.max(number(metrics, "calls_today"), 1); return <div key={text(item, "outcome")}><div className="mb-1.5 flex items-center justify-between gap-2"><StatusBadge status={text(item, "outcome")}/><span className="text-xs font-bold">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e4e9e6]"><div className="h-full rounded-full bg-[#4d9489]" style={{ width: `${Math.max(4, Math.round(count / total * 100))}%` }}/></div></div>; })}{!outcomeBreakdown.length && <p className="text-xs leading-5 text-[#89928e]">Outcome categories will fill in as calls are completed.</p>}</div></aside>
    </div>
  </section>;
}

type LeadsViewProps = { leads: Row[]; allLeads: Row[]; counts: Row; users: Row[]; lists: Row[]; statusFilter: string; setStatusFilter: (value: string) => void; search: string; setSearch: (value: string) => void; selectedIds: string[]; setSelectedIds: (value: string[]) => void; onDial: (lead: Row) => void; onAdd: () => void; onImport: () => void; onRefresh: () => Promise<void> };

function ResponsiveLeadsView(props: LeadsViewProps) {
  const { leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, search, setSearch, selectedIds, setSelectedIds, onDial, onAdd, onImport, onRefresh } = props;
  const [assigning, setAssigning] = useState(false);
  const filters = [["all", "All", number(counts, "all_leads")], ["to_call", "Ready", number(counts, "to_call")], ["try_again", "Retry", number(counts, "try_again")], ["follow_up", "Follow up", number(counts, "follow_up")], ["closed", "Closed", number(counts, "closed")]];
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
      <PageHeader eyebrow="Your sheet" title="Leads" description="Your calling queue, optimized for one-handed dialing." action={<><SecondaryButton onClick={onImport}><Icon name="upload"/>Import</SecondaryButton><PrimaryButton onClick={onAdd}><Icon name="plus"/>Add lead</PrimaryButton></>}/>
      <div className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">{filters.map(([id, label, count]) => <button key={String(id)} onClick={() => setStatusFilter(String(id))} className={`min-w-[104px] snap-start rounded-2xl border p-3 text-left transition ${statusFilter === id ? "border-[#173e38] bg-[#173e38] text-white shadow-lg shadow-[#173e38]/10" : "border-[#dfe4df] bg-white"}`}><div className="text-xl font-bold">{count}</div><div className={`mt-1 text-xs font-semibold ${statusFilter === id ? "text-white/70" : "text-[#68736d]"}`}>{label}</div></button>)}</div>
      <section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white shadow-[0_8px_30px_rgba(25,45,37,.05)]">
        <div className="space-y-3 border-b border-[#e8ece8] p-3"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#89928d]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..." className="min-h-11 w-full rounded-xl border border-[#dfe4df] bg-[#fafbf9] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6aa79e] focus:ring-2 focus:ring-[#d8ece8]"/></div>{selectedIds.length > 0 ? <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value)} defaultValue="" className="min-h-11 w-full rounded-xl border border-[#dfe4df] bg-white px-3 text-sm"><option value="" disabled>Assign {selectedIds.length} selected...</option><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select> : <div className="px-1 text-xs text-[#7f8984]">{leads.length} shown · {lists.length} lists</div>}</div>
        <div className="divide-y divide-[#edf0ed]">{leads.map((lead) => { const leadId = text(lead, "id"); const disabled = Boolean(lead.do_not_call) || text(lead, "status") === "closed"; return <article key={leadId} className="p-4"><div className="flex items-start gap-3"><label className="flex min-h-11 items-center"><input aria-label={`Select ${leadName(lead)}`} type="checkbox" checked={selectedIds.includes(leadId)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, leadId] : selectedIds.filter((id) => id !== leadId))}/></label><Avatar name={leadName(lead)}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#23332d]">{leadName(lead)}</h2><p className="truncate text-xs text-[#87908b]">{text(lead, "company") || text(lead, "title") || "No company"}</p></div><StatusBadge status={text(lead, "disposition") || text(lead, "status")}/></div><a href={`tel:${text(lead, "phone_e164")}`} className="mt-3 block text-base font-bold tracking-tight text-[#173e38]">{formatPhone(lead.phone_e164)}</a><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#7c8781]"><span>{localTime(lead)} local</span><span>{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</span><span>{text(lead, "assigned_name") || "Unassigned"}</span></div></div></div><button disabled={disabled} onClick={() => onDial(lead)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e2f1ee] text-sm font-bold text-[#0e766e] transition active:scale-[.99] disabled:cursor-not-allowed disabled:bg-[#f0f2f0] disabled:text-[#a0a7a3]"><Icon name="phone"/>Dial {leadName(lead).split(" ")[0]}</button></article>; })}{!leads.length && <Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/>}</div>
      </section>
    </div>
    <div className="hidden lg:block"><LeadsView {...props}/></div>
  </>;
}

function LeadsView({ leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, search, setSearch, selectedIds, setSelectedIds, onDial, onAdd, onImport, onRefresh }: LeadsViewProps) {
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
    <PageHeader eyebrow="Your sheet" title="Leads" description="Everyone you're calling, where each contact stands, and what needs attention next." action={<div className="flex gap-2"><SecondaryButton onClick={onImport}><Icon name="upload"/>Import CSV</SecondaryButton><PrimaryButton onClick={onAdd}><Icon name="plus"/>Add lead</PrimaryButton></div>}/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{filters.map(([id, label, count]) => <button key={String(id)} onClick={() => setStatusFilter(String(id))} className={`rounded-xl border p-4 text-left transition ${statusFilter === id ? "border-[#163f38] bg-white shadow-sm ring-1 ring-[#163f38]" : "border-[#dfe4df] bg-white/75 hover:bg-white"}`}><div className="text-2xl font-bold">{count}</div><div className="mt-1 text-sm font-semibold">{label}</div><div className="mt-1 text-[11px] text-[#8a938f]">{id === "all" ? "Everything except deleted" : id === "to_call" ? "Never dialed and ready" : id === "try_again" ? "No answer, busy, failed" : id === "follow_up" ? "Callbacks and interest" : "Completed or suppressed"}</div></button>)}</div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#dfe4df] bg-white shadow-[0_4px_20px_rgba(25,45,37,.035)]">
      <div className="flex flex-col gap-3 border-b border-[#e8ece8] p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#89928d]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, companies, phones…" className="w-full rounded-lg border border-[#dfe4df] bg-[#fafbf9] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6aa79e] focus:ring-2 focus:ring-[#d8ece8]"/></div>
        {selectedIds.length > 0 && <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value)} defaultValue="" className="rounded-lg border border-[#dfe4df] bg-white px-3 py-2.5 text-sm"><option value="" disabled>Assign {selectedIds.length} leads…</option><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select>}
        <div className="text-xs text-[#7f8984]">{leads.length} shown · {lists.length} lists</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-[#e8ece8] bg-[#fafbf9] text-[10px] font-bold uppercase tracking-[.12em] text-[#8a938f]"><th className="w-12 px-4 py-3"><input type="checkbox" checked={leads.length > 0 && leads.every((lead) => selectedIds.includes(text(lead, "id")))} onChange={(event) => setSelectedIds(event.target.checked ? leads.map((lead) => text(lead, "id")) : [])}/></th><th className="px-3 py-3">Prospect</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last call</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{leads.map((lead) => <tr key={text(lead, "id")} className="group hover:bg-[#fbfcfb]"><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(text(lead, "id"))} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, text(lead, "id")] : selectedIds.filter((id) => id !== text(lead, "id")))}/></td><td className="px-3 py-3"><div className="flex items-center gap-3"><Avatar name={leadName(lead)}/><div><div className="text-sm font-semibold text-[#23332d]">{leadName(lead)}</div><div className="max-w-[240px] truncate text-xs text-[#87908b]">{text(lead, "company") || text(lead, "title") || "—"}</div></div></div></td><td className="px-3 py-3"><div className="text-sm font-semibold">{formatPhone(lead.phone_e164)}</div><div className="mt-0.5 text-[11px] text-[#87908b]">{localTime(lead)} local</div></td><td className="px-3 py-3"><StatusBadge status={text(lead, "disposition") || text(lead, "status")}/></td><td className="px-3 py-3"><div className="text-xs font-medium">{formatDate(lead.last_call_at)}</div><div className="text-[11px] text-[#87908b]">{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</div></td><td className="px-3 py-3 text-xs text-[#58635e]">{text(lead, "assigned_name") || "Unassigned"}</td><td className="px-3 py-3 text-right"><button disabled={Boolean(lead.do_not_call) || text(lead, "status") === "closed"} onClick={() => onDial(lead)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e2f1ee] px-3 py-2 text-xs font-bold text-[#0e766e] hover:bg-[#cae7e2] disabled:cursor-not-allowed disabled:bg-[#f0f2f0] disabled:text-[#a0a7a3]"><Icon name="phone" className="h-3.5 w-3.5"/>Dial</button></td></tr>)}{!leads.length && <tr><td colSpan={7}><Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/></td></tr>}</tbody></table></div>
    </section>
  </>;
}

function Empty({ message }: { message: string }) { return <div className="px-5 py-10 text-center text-sm text-[#89928e]">{message}</div>; }

function ResponsiveCallsView({ calls }: { calls: Row[] }) {
  const [query, setQuery] = useState("");
  const visible = calls.filter((call) => `${leadName(call)} ${text(call, "company")} ${text(call, "to_number")} ${text(call, "user_name")}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="lg:hidden"><PageHeader eyebrow="Activity" title="Calls" description="Every attempt, outcome, and rep in one timeline."/><section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white shadow-[0_8px_30px_rgba(25,45,37,.05)]"><div className="border-b border-[#e8ece8] p-3"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#89928d]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search call history..." className="min-h-11 w-full rounded-xl border border-[#dfe4df] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6aa79e]"/></div></div><div className="divide-y divide-[#edf0ed]">{visible.map((call) => <article key={text(call, "id")} className="p-4"><div className="flex items-start gap-3"><Avatar name={leadName(call)}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold">{leadName(call)}</h2><p className="truncate text-xs text-[#87908b]">{text(call, "company") || formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}</p></div><StatusBadge status={text(call, "disposition") || text(call, "status")}/></div><div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f9f7] p-3 text-xs"><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#8a938f]">Direction</div><div className="mt-1 font-semibold capitalize">{text(call, "direction")}</div></div><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#8a938f]">Rep</div><div className="mt-1 truncate font-semibold">{text(call, "user_name") || "Unclaimed"}</div></div><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#8a938f]">Duration</div><div className="mt-1 font-semibold">{number(call, "duration_seconds") ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}` : "—"}</div></div></div><div className="mt-2 text-[11px] text-[#77817c]">{formatDate(call.started_at)}</div></div></div></article>)}{!visible.length && <Empty message="No call records found."/>}</div></section></div>
    <div className="hidden lg:block"><CallsView calls={calls}/></div>
  </>;
}

function CallsView({ calls }: { calls: Row[] }) {
  const [query, setQuery] = useState("");
  const visible = calls.filter((call) => `${leadName(call)} ${text(call, "company")} ${text(call, "to_number")} ${text(call, "user_name")}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="Activity" title="Calls" description="Every outbound attempt and inbound callback, attributed to the rep who handled it."/><section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white"><div className="border-b border-[#e8ece8] p-3"><div className="relative max-w-xl"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#89928d]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search call history…" className="w-full rounded-lg border border-[#dfe4df] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6aa79e]"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-[#fafbf9] text-[10px] uppercase tracking-[.12em] text-[#8a938f]"><th className="px-5 py-3">Contact</th><th className="px-4 py-3">Direction</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Rep</th><th className="px-4 py-3">Duration</th><th className="px-5 py-3 text-right">Started</th></tr></thead><tbody className="divide-y divide-[#edf0ed]">{visible.map((call) => <tr key={text(call, "id")} className="hover:bg-[#fbfcfb]"><td className="px-5 py-3.5"><div className="text-sm font-semibold">{leadName(call)}</div><div className="text-xs text-[#87908b]">{text(call, "company") || formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}</div></td><td className="px-4 py-3.5 text-xs capitalize">{text(call, "direction")}</td><td className="px-4 py-3.5"><StatusBadge status={text(call, "disposition") || text(call, "status")}/></td><td className="px-4 py-3.5 text-xs">{text(call, "user_name") || "Unclaimed"}</td><td className="px-4 py-3.5 text-xs">{number(call, "duration_seconds") ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}` : "—"}</td><td className="px-5 py-3.5 text-right text-xs text-[#77817c]">{formatDate(call.started_at)}</td></tr>)}{!visible.length && <tr><td colSpan={6}><Empty message="No call records found."/></td></tr>}</tbody></table></div></section></>;
}

function TasksView({ tasks, onCreate, onRefresh }: { tasks: Row[]; onCreate: () => void; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState("open");
  const visible = tasks.filter((task) => tab === "all" || text(task, "status") === tab);
  const complete = async (id: string) => { await api("/api/dialer/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed" }) }); await onRefresh(); };
  return <><PageHeader eyebrow="Follow-through" title="Tasks" description="Callbacks, follow-ups, and reminders that keep interested leads from slipping away." action={<PrimaryButton onClick={onCreate}><Icon name="plus"/>New task</PrimaryButton>}/><div className="mb-4 flex gap-2">{["open", "completed", "all"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${tab === item ? "bg-[#173e38] text-white" : "border border-[#dfe4df] bg-white text-[#69736e]"}`}>{item}</button>)}</div><section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white"><div className="divide-y divide-[#edf0ed]">{visible.map((task) => <div key={text(task, "id")} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><button disabled={text(task, "status") !== "open"} onClick={() => void complete(text(task, "id"))} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${text(task, "status") === "completed" ? "border-[#0e766e] bg-[#0e766e] text-white" : "border-[#bac3be] hover:border-[#0e766e]"}`}>{text(task, "status") === "completed" && <Icon name="check" className="h-3.5 w-3.5"/>}</button><div className="min-w-0 flex-1"><div className={`font-semibold ${text(task, "status") === "completed" ? "text-[#8a938f] line-through" : ""}`}>{text(task, "title")}</div><div className="mt-1 text-xs text-[#7e8883]">{leadName(task)}{text(task, "company") ? ` · ${text(task, "company")}` : ""}</div></div><StatusBadge status={text(task, "task_type")}/><div className={`text-xs font-medium ${task.due_at && new Date(String(task.due_at)) < new Date() && text(task, "status") === "open" ? "text-red-600" : "text-[#68726d]"}`}>{formatDate(task.due_at)}</div><div className="text-xs text-[#7e8883]">{text(task, "assigned_name") || "Unassigned"}</div></div>)}{!visible.length && <Empty message="No tasks in this view."/>}</div></section></>;
}

function SequencesView({ sequences, onRefresh }: { sequences: Row[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const create = async () => { if (!name.trim()) return; await api("/api/dialer/sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: "Three-touch call cadence", steps: [{ day: 0, type: "call" }, { day: 2, type: "call" }, { day: 5, type: "call" }] }) }); setName(""); await onRefresh(); };
  return <><PageHeader eyebrow="Cadences" title="Sequences" description="Reusable call schedules for consistent follow-up without parallel or predictive dialing."/><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><section className="grid content-start gap-4 sm:grid-cols-2">{sequences.map((sequence) => { const steps = Array.isArray(sequence.steps) ? sequence.steps as Row[] : []; return <div key={text(sequence, "id")} className="rounded-2xl border border-[#dfe4df] bg-white p-5"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{text(sequence, "name")}</h3><p className="mt-1 text-xs text-[#7e8883]">{text(sequence, "description") || "Call sequence"}</p></div><StatusBadge status={Boolean(sequence.active) ? "contacted" : "closed"}/></div><div className="mt-5 flex items-center gap-2">{steps.map((step, index) => <div key={index} className="contents"><div className="grid h-10 min-w-10 place-items-center rounded-full bg-[#e2f1ee] text-xs font-bold text-[#0e766e]">D{number(step, "day")}</div>{index < steps.length - 1 && <div className="h-px flex-1 bg-[#ced7d2]"/>}</div>)}</div></div>; })}{!sequences.length && <div className="sm:col-span-2 rounded-2xl border border-dashed border-[#cbd3cf] bg-white"><Empty message="Create your first call sequence."/></div>}</section><aside className="rounded-2xl border border-[#dfe4df] bg-white p-5"><h2 className="font-semibold">New sequence</h2><p className="mt-1 text-xs leading-relaxed text-[#7e8883]">Creates a simple three-call cadence on days 0, 2, and 5. Calls are always placed one at a time by a rep.</p><label className="mt-5 block text-xs font-semibold">Sequence name</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Florida HVAC follow-up" className="mt-2 w-full rounded-lg border border-[#dfe4df] px-3 py-2.5 text-sm outline-none focus:border-[#6aa79e]"/><PrimaryButton onClick={() => void create()} disabled={!name.trim()}><Icon name="plus"/>Create sequence</PrimaryButton></aside></div></>;
}

function PipelineView({ leads, onDial }: { leads: Row[]; onDial: (lead: Row) => void }) {
  const columns = [["to_call", "To call"], ["try_again", "Try again"], ["follow_up", "Follow up"], ["closed", "Closed"]] as const;
  return <><PageHeader eyebrow="Pipeline" title="Lead pipeline" description="A compact board organized by the next action your team needs to take."/><div className="grid gap-4 lg:grid-cols-4">{columns.map(([status, label]) => { const items = leads.filter((lead) => text(lead, "status") === status); return <section key={status} className="rounded-2xl border border-[#dfe4df] bg-[#eef1ee]/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-bold">{label}</h2><span className="rounded-full bg-white px-2 py-1 text-xs text-[#6e7873]">{items.length}</span></div><div className="space-y-3">{items.slice(0, 100).map((lead) => <div key={text(lead, "id")} className="rounded-xl border border-[#dfe4df] bg-white p-3 shadow-sm"><div className="flex items-start gap-2"><Avatar name={leadName(lead)}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{leadName(lead)}</div><div className="truncate text-xs text-[#828c87]">{text(lead, "company") || formatPhone(lead.phone_e164)}</div></div></div><div className="mt-3 flex items-center justify-between"><StatusBadge status={text(lead, "disposition") || status}/>{status !== "closed" && <button onClick={() => onDial(lead)} className="rounded-full bg-[#e2f1ee] p-2 text-[#0e766e]"><Icon name="phone" className="h-3.5 w-3.5"/></button>}</div></div>)}</div></section>; })}</div></>;
}

function DncView({ entries, onRefresh }: { entries: Row[]; onRefresh: () => Promise<void> }) {
  const [phone, setPhone] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const add = async () => { try { await api("/api/dialer/dnc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, reason }) }); setPhone(""); setReason(""); await onRefresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to suppress number."); } };
  const remove = async (value: string) => { await api("/api/dialer/dnc", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: value }) }); await onRefresh(); };
  return <><PageHeader eyebrow="Compliance" title="Do not call" description="A workspace-wide suppression list. Numbers here are blocked before Twilio receives a dial request."/><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><aside className="h-fit rounded-2xl border border-[#dfe4df] bg-white p-5"><h2 className="font-semibold">Suppress a number</h2><p className="mt-1 text-xs leading-relaxed text-[#7e8883]">This closes every matching lead and prevents future calls.</p>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}<label className="mt-5 block text-xs font-semibold">Phone number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(407) 555-0123" className="mt-2 w-full rounded-lg border border-[#dfe4df] px-3 py-2.5 text-sm"/><label className="mt-4 block text-xs font-semibold">Reason</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Requested no further calls" className="mt-2 min-h-24 w-full rounded-lg border border-[#dfe4df] px-3 py-2.5 text-sm"/><PrimaryButton onClick={() => void add()} disabled={!phone.trim()}><Icon name="shield"/>Add to DNC</PrimaryButton></aside><section className="overflow-hidden rounded-2xl border border-[#dfe4df] bg-white"><div className="border-b border-[#edf0ed] px-5 py-4 text-sm font-semibold">{entries.length} suppressed numbers</div><div className="divide-y divide-[#edf0ed]">{entries.map((entry) => <div key={text(entry, "id")} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center"><div className="flex-1"><div className="font-semibold">{formatPhone(entry.phone_e164)}</div><div className="mt-1 text-xs text-[#7e8883]">{text(entry, "reason") || "No reason provided"} · {formatDate(entry.created_at)}</div></div><div className="text-xs text-[#7e8883]">{text(entry, "requested_by_name") || text(entry, "source")}</div><button onClick={() => void remove(text(entry, "phone_e164"))} className="text-xs font-semibold text-red-600">Remove</button></div>)}{!entries.length && <Empty message="No suppressed numbers."/>}</div></section></div></>;
}

function SettingsView({ settings, currentUser, onCreateUser, onChangePassword, onRefresh }: { settings: Row; currentUser: Row; onCreateUser: () => void; onChangePassword: () => void; onRefresh: () => Promise<void> }) {
  const workspace = (settings.settings as Row | undefined)?.workspace as Row | undefined || {};
  const twilio = settings.twilio as Row | undefined || {};
  const users = settings.users as Row[] | undefined || [];
  const [name, setName] = useState(text(workspace, "name") || "Intent Dialer");
  const [start, setStart] = useState(text(workspace, "callWindowStart") || "08:00");
  const [end, setEnd] = useState(text(workspace, "callWindowEnd") || "20:00");
  const [attempts, setAttempts] = useState(number(workspace, "maxDailyAttempts") || 3);
  const [message, setMessage] = useState("");
  const save = async () => { await api("/api/dialer/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "workspace", value: { ...workspace, name, callWindowStart: start, callWindowEnd: end, maxDailyAttempts: attempts } }) }); setMessage("Workspace settings saved."); await onRefresh(); };
  return <><PageHeader eyebrow="Workspace" title="Settings & team" description="Manage calling guardrails, Twilio connection details, and the people who can access this dialer." action={<SecondaryButton onClick={onChangePassword}>Change my password</SecondaryButton>}/><div className="grid gap-6 xl:grid-cols-2">
    <section className="rounded-2xl border border-[#dfe4df] bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Team accounts</h2><p className="mt-1 text-xs text-[#7e8883]">Separate logins keep assignments, calls, and tasks attributable.</p></div>{text(currentUser, "role") === "owner" && <PrimaryButton onClick={onCreateUser}><Icon name="plus"/>Add setter</PrimaryButton>}</div><div className="mt-5 divide-y divide-[#edf0ed]">{users.map((user) => <div key={text(user, "id")} className="flex items-center gap-3 py-3"><Avatar name={text(user, "display_name")}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{text(user, "display_name")}</div><div className="text-xs text-[#7e8883]">@{text(user, "username")} · {text(user, "last_login_at") ? `last active ${formatDate(user.last_login_at)}` : "never signed in"}</div></div><span className="rounded-full bg-[#eef2ef] px-2.5 py-1 text-[10px] font-bold uppercase text-[#66716b]">{text(user, "role")}</span><span className={`h-2.5 w-2.5 rounded-full ${Boolean(user.active) ? "bg-emerald-500" : "bg-slate-300"}`}/></div>)}</div></section>
    <section className="rounded-2xl border border-[#dfe4df] bg-white p-6"><div className="flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-full ${Boolean(twilio.configured) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><Icon name={Boolean(twilio.configured) ? "check" : "alert"}/></div><div><h2 className="font-semibold">Twilio connection</h2><p className="text-xs text-[#7e8883]">{Boolean(twilio.configured) ? `Ready on ${formatPhone(twilio.phoneNumber)}` : "Environment variables still required"}</p></div></div><div className="mt-5 space-y-4 rounded-xl bg-[#f6f8f6] p-4 text-xs"><div><div className="font-semibold text-[#5d6862]">TwiML App voice URL</div><code className="mt-1 block overflow-x-auto rounded bg-white p-2 text-[#0e766e]">{text(twilio, "voiceUrl")}</code></div><div><div className="font-semibold text-[#5d6862]">Phone number inbound webhook</div><code className="mt-1 block overflow-x-auto rounded bg-white p-2 text-[#0e766e]">{text(twilio, "inboundUrl")}</code></div></div><p className="mt-4 text-xs leading-relaxed text-[#7e8883]">Use HTTP POST for both URLs. Outbound calls use your Twilio number and inbound callbacks ring every active dialer account.</p></section>
    <section className="rounded-2xl border border-[#dfe4df] bg-white p-6 xl:col-span-2"><h2 className="font-semibold">Calling guardrails</h2><p className="mt-1 text-xs text-[#7e8883]">These checks run server-side before every call and cannot be bypassed in the browser.</p>{message && <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Workspace name"><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass}/></Field><Field label="Local start time"><input type="time" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass}/></Field><Field label="Local end time"><input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass}/></Field><Field label="Max attempts / 24h"><input type="number" min={1} max={10} value={attempts} onChange={(event) => setAttempts(Number(event.target.value))} className={inputClass}/></Field></div>{text(currentUser, "role") === "owner" && <div className="mt-5"><PrimaryButton onClick={() => void save()}>Save workspace settings</PrimaryButton></div>}</section>
  </div></>;
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[70] flex items-end overflow-y-auto bg-[#101a17]/45 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" onMouseDown={onClose}><div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/60 bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:my-8 sm:max-w-xl sm:rounded-2xl sm:p-6" onMouseDown={(event) => event.stopPropagation()}><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d7ddd8] sm:hidden"/><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{title}</h2>{description && <p className="mt-1 text-sm leading-5 text-[#77817c]">{description}</p>}</div><button aria-label="Close" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#77817c] hover:bg-[#f0f2f0]"><Icon name="close"/></button></div><div className="mt-5 sm:mt-6">{children}</div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#59655f]">{label}</span>{children}</label>; }
const inputClass = "w-full rounded-lg border border-[#d7ddd8] bg-white px-3 py-2.5 text-sm outline-none placeholder:text-[#a3aaa6] focus:border-[#5b9f95] focus:ring-2 focus:ring-[#d7ece8]";

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
  return <Modal title="Import CSV" description="Headers are detected automatically. A phone column is the only requirement." onClose={onClose}><label className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#cbd6d1] bg-[#f8faf8] px-5 py-9 text-center hover:border-[#66a59b]"><Icon name="upload" className="h-7 w-7 text-[#0e766e]"/><span className="mt-3 text-sm font-semibold">{fileName || "Choose a CSV file"}</span><span className="mt-1 text-xs text-[#7e8883]">Up to 5,000 leads per import</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void choose(event.target.files?.[0])}/></label>{parsed.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="New list name"><input className={inputClass} value={listName} onChange={(event) => setListName(event.target.value)}/></Field><Field label="Assign imported leads"><select className={inputClass} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select></Field><div className="sm:col-span-2 rounded-lg bg-[#eaf5f2] px-4 py-3 text-sm text-[#176c63]">Ready to import {parsed.length} leads. Duplicate phone/company pairs will be updated instead of duplicated.</div></div>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 flex justify-end gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton onClick={() => void submit()} disabled={!parsed.length || saving}>{saving ? "Importing…" : `Import ${parsed.length || ""} leads`}</PrimaryButton></div></Modal>;
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

function CallDock({ lead, phase, error, disposition, setDisposition, notes, setNotes, callbackAt, setCallbackAt, autoDial, setAutoDial, onEnd, onSave, onClose }: { lead: Row; phase: CallPhase; error: string; disposition: string; setDisposition: (value: string) => void; notes: string; setNotes: (value: string) => void; callbackAt: string; setCallbackAt: (value: string) => void; autoDial: boolean; setAutoDial: (value: boolean) => void; onEnd: () => void; onSave: () => void; onClose: () => void }) {
  const active = ["connecting", "ringing", "open"].includes(phase);
  return <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[95dvh] max-w-5xl overflow-y-auto rounded-t-3xl border border-[#9fb9b3] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_25px_80px_rgba(15,35,29,.28)] sm:inset-x-3 sm:bottom-3 sm:rounded-2xl lg:left-[252px]">
    <div className="flex items-center gap-3 bg-[#173e38] px-4 py-4 text-white sm:px-5">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${phase === "open" ? "animate-pulse bg-emerald-400/20 text-emerald-200" : "bg-white/10"}`}><Icon name="phone" className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="truncate font-semibold">{leadName(lead)}</div><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">{phase === "open" ? "Connected" : phase}</span></div><div className="mt-1 text-sm text-white/65">{text(lead, "company")} · {formatPhone(lead.phone_e164)} · {localTime(lead)} local</div></div>{active && <button onClick={onEnd} className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600">End call</button>}<button onClick={onClose} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><Icon name="close"/></button>
    </div>
    <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr_auto] lg:items-end"><Field label="Outcome"><select value={disposition} onChange={(event) => setDisposition(event.target.value)} className={inputClass}>{DISPOSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Call notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="What happened on the call?"/></Field><PrimaryButton onClick={onSave} disabled={active}>Save & {autoDial ? "dial next" : "close"}</PrimaryButton></div>
    {(disposition === "callback" || disposition === "appointment") && <div className="border-t border-[#edf0ed] px-4 py-3"><Field label="Callback / appointment time"><input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} className={`${inputClass} max-w-sm`}/></Field></div>}
    <div className="flex flex-col gap-2 border-t border-[#edf0ed] bg-[#fafbf9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-start gap-2 text-xs leading-5 text-[#65706a]"><input className="mt-1" type="checkbox" checked={autoDial} onChange={(event) => setAutoDial(event.target.checked)}/>Automatically dial the next eligible lead after saving</label>{error && <span className="text-xs font-semibold text-red-600">{error}</span>}</div>
  </div>;
}

function IncomingCall({ call, onClose }: { call: VoiceCall; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const accept = () => { call.accept(); setAccepted(true); };
  const reject = () => { call.reject(); onClose(); };
  useEffect(() => { const done = () => onClose(); call.on("disconnect", done); call.on("cancel", done); return () => { call.removeListener("disconnect", done); call.removeListener("cancel", done); }; }, [call, onClose]);
  return <div className="fixed inset-x-3 top-3 z-[90] rounded-2xl border border-[#b9d3cd] bg-white p-5 shadow-2xl sm:left-auto sm:right-5 sm:top-5 sm:w-[340px]"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#daf0eb] text-[#0e766e]"><Icon name="phone" className="h-5 w-5"/></div><div><div className="text-xs font-bold uppercase tracking-[.14em] text-[#0e766e]">Inbound callback</div><div className="mt-1 font-semibold">{formatPhone(call.parameters.From)}</div></div></div>{accepted ? <button onClick={() => call.disconnect()} className="mt-5 min-h-11 w-full rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white">End call</button> : <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={reject} className="min-h-11 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-600">Decline</button><button onClick={accept} className="min-h-11 rounded-xl bg-[#0e766e] py-2.5 text-sm font-bold text-white">Answer</button></div>}</div>;
}
