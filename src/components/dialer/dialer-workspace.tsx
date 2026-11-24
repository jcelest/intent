"use client";

import type { Call as VoiceCall, Device as VoiceDevice } from "@twilio/voice-sdk";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/logo";

type Row = Record<string, unknown>;
type View = "dashboard" | "leads" | "calls" | "tasks" | "sequences" | "pipeline" | "dnc" | "settings";
type CallPhase = "idle" | "connecting" | "ringing" | "open" | "completed" | "error";
type DialSessionState = "idle" | "running" | "paused";
type VoiceReadiness = "idle" | "preparing" | "ready" | "offline" | "blocked";
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

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

const RETRY_DISPOSITIONS = ["voicemail", "no_answer", "busy", "failed"] as const;

const STATUS_LABELS: Record<string, string> = {
  to_call: "To call", try_again: "Try again", follow_up: "Follow up", closed: "Closed",
  no_answer: "No answer", voicemail: "Voicemail", busy: "Busy", failed: "Failed", contacted: "Contacted",
  interested: "Interested", callback: "Callback", appointment: "Appointment", not_interested: "Not interested",
  wrong_number: "Wrong number", dnc: "DNC", converted: "Converted", queued: "Queued", initiated: "Initiated",
  ringing: "Ringing", "in-progress": "Connected", completed: "Completed", canceled: "Canceled",
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401 && typeof window !== "undefined") {
    if (!window.location.pathname.includes("/login")) {
      window.location.href = `/admin/dialer/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error("Session expired. Please sign in again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || `Request failed (${response.status}).`);
  return data as T;
}

function readableError(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause.trim();
  if (cause && typeof cause === "object") {
    const error = cause as { message?: unknown; explanation?: unknown; code?: unknown };
    const message = typeof error.message === "string" && error.message.trim()
      ? error.message.trim()
      : typeof error.explanation === "string" && error.explanation.trim()
        ? error.explanation.trim()
        : "";
    const code = typeof error.code === "number" || typeof error.code === "string" ? String(error.code) : "";
    if (message) return code && !message.includes(code) ? `${message} (Twilio ${code})` : message;
    if (code) return `Twilio browser phone error ${code}.`;
  }
  return fallback;
}

function notifyDialerSync() {
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("intent_dialer_sync");
      bc.postMessage("refresh");
      bc.close();
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("intent_dialer_sync_ping", String(Date.now()));
    }
  } catch {}
}

function text(row: Row | null | undefined, key: string) {
  return row?.[key] == null ? "" : String(row[key]);
}

function number(row: Row | null | undefined, key: string) {
  return Number(row?.[key] || 0);
}

function getBusinessOwner(lead: Row | null | undefined): string {
  if (!lead) return "";
  const first = text(lead, "first_name").trim();
  const last = text(lead, "last_name").trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  const meta = (lead.metadata || {}) as Record<string, unknown>;
  const fromMeta = text(meta, "owner_name")
    || text(meta, "business_owner")
    || text(meta, "raw_contractor_name")
    || text(meta, "contractor_name")
    || text(meta, "licensee_owner")
    || text(meta, "contact");
  if (fromMeta.trim()) return fromMeta.trim();

  const allCsv = (meta.all_csv_fields || {}) as Record<string, string>;
  for (const [k, v] of Object.entries(allCsv)) {
    const lk = k.toLowerCase();
    if (
      (lk.includes("ask for") || lk.includes("licensee") || lk.includes("qualifier") || lk.includes("owner") || lk.includes("contact")) &&
      !lk.includes("company") && !lk.includes("business name") && !lk.includes("phone") && !lk.includes("email") && !lk.includes("address")
    ) {
      const val = String(v || "").trim();
      if (val) {
        const parsed = parseOwnerName(val);
        return parsed.fullName || val;
      }
    }
  }

  return "";
}

function googleSearchUrl(company: string, city?: string, state?: string): string {
  const query = [company, city, state].filter(Boolean).join(" ").trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query || "business")}`;
}

function leadName(lead: Row | null | undefined) {
  const name = `${text(lead, "first_name")} ${text(lead, "last_name")}`.trim();
  if (name) return name;
  const owner = getBusinessOwner(lead);
  if (owner) return owner;
  return text(lead, "company") || "Unnamed lead";
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

type ParsedLead = Record<string, unknown>;

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

function parseOwnerName(raw: string): { firstName: string; lastName: string; fullName: string; rawOwner: string; title?: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { firstName: "", lastName: "", fullName: "", rawOwner: "" };

  const primaryPart = trimmed.split("/")[0].trim();
  const titleMatch = primaryPart.match(/\(([^)]+)\)/);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  const cleanName = primaryPart.replace(/\([^)]*\)/g, "").replace(/\b(P:|MGR:|AMBR:|Mana:|AR:|VP:|PRES:|DIR:|OFFI:)\b/gi, "").trim();

  const toTitleCase = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  let firstName = "";
  let lastName = "";

  if (cleanName.includes(",")) {
    const [lPart, fPart] = cleanName.split(",").map((s) => s.trim());
    const fTokens = fPart.split(/\s+/).filter(Boolean);
    const lTokens = lPart.split(/\s+/).filter(Boolean);
    firstName = fTokens.map(toTitleCase).join(" ");
    lastName = lTokens.map(toTitleCase).join(" ");
  } else {
    const tokens = cleanName.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      firstName = toTitleCase(tokens[0]);
    } else if (tokens.length > 1) {
      firstName = toTitleCase(tokens[0]);
      lastName = tokens.slice(1).map(toTitleCase).join(" ");
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || cleanName;
  return { firstName, lastName, fullName, rawOwner: trimmed, title };
}

function parseLeadCsv(input: string): ParsedLead[] {
  const rows = csvRows(input);
  if (rows.length < 2) return [];
  const rawHeaders = rows[0].map((h) => h.trim());
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rawHeaders.map(normalize);
  const get = (row: string[], ...names: string[]) => {
    const normalizedNames = names.map(normalize);
    const index = headers.findIndex((header) => normalizedNames.includes(header));
    return index >= 0 ? (row[index] || "").trim() : "";
  };

  return rows.slice(1).map((row) => {
    let rawOwner = get(row,
      "ask for (licensee/qualifier)",
      "ask for (licensee / qualifier)",
      "ask for (qualifier/licensee)",
      "ask for (qualifier / licensee)",
      "ask for licensee",
      "ask for qualifier",
      "ask for",
      "licensee / qualifier",
      "licensee/qualifier",
      "qualifier / licensee",
      "qualifier/licensee",
      "verified licensee / owner (dbpr & sunbiz)",
      "contractor_name",
      "contractor name",
      "licensee / owner",
      "licensee owner",
      "licensee",
      "qualifier",
      "licensee name",
      "qualifier name",
      "primary qualifier",
      "decision maker",
      "contact person",
      "prospect name",
      "lead name",
      "business owner",
      "business owner name",
      "owner",
      "owner name",
      "contact name",
      "contact",
      "full name",
      "name"
    );

    if (!rawOwner) {
      const fuzzyIdx = headers.findIndex((h, idx) => {
        const rawH = (rawHeaders[idx] || "").toLowerCase();
        if (rawH.includes("company") || rawH.includes("business name") || rawH.includes("dba") || rawH.includes("email") || rawH.includes("phone") || rawH.includes("address")) {
          return false;
        }
        return h.includes("askfor") || h.includes("licensee") || h.includes("qualifier") || (h.includes("owner") && !h.includes("hours")) || (h.includes("contact") && !h.includes("email") && !h.includes("phone"));
      });
      if (fuzzyIdx >= 0) {
        rawOwner = (row[fuzzyIdx] || "").trim();
      }
    }

    const explicitFirst = get(row, "first name", "firstname", "contact first name");
    const explicitLast = get(row, "last name", "lastname", "contact last name");

    let firstName = explicitFirst;
    let lastName = explicitLast;
    let title = get(row, "title", "job title");
    let ownerFullName = [firstName, lastName].filter(Boolean).join(" ");

    if (rawOwner && (!firstName || !lastName)) {
      const parsed = parseOwnerName(rawOwner);
      if (!firstName && parsed.firstName) firstName = parsed.firstName;
      if (!lastName && parsed.lastName) lastName = parsed.lastName;
      if (!title && parsed.title) title = parsed.title;
      ownerFullName = parsed.fullName;
    }

    const company = get(row,
      "google business profile name",
      "dba business name",
      "company name",
      "company",
      "business name",
      "business",
      "sunbiz entity name"
    );

    const phone = get(row,
      "direct / cell phone",
      "direct phone",
      "cell phone",
      "verified business phone",
      "phone",
      "phone number",
      "mobile",
      "telephone",
      "office / lsa phone",
      "office phone"
    );

    const email = get(row, "email", "email address", "contact email");

    let city = get(row, "city");
    let state = get(row, "state");
    const cityMetro = get(row, "city / metro", "city metro", "metro");
    if (cityMetro && (!city || !state)) {
      const parts = cityMetro.split(",");
      if (!city && parts[0]) city = parts[0].split("/")[0].trim();
      if (!state && parts[1]) state = parts[1].trim().slice(0, 2);
    }
    const postalCode = get(row, "zip", "zipcode", "postal code", "postal_code");
    const address = get(row, "business address", "address", "street address", "street");
    const county = get(row, "county");

    const website = get(row, "website", "google website uri", "url", "web");
    const trade = get(row, "trade", "industry", "license type");
    const licenseNumber = get(row, "state license # (cac / cfc / cmc)", "dbpr license number", "license number", "license", "state license");
    const licenseStatus = get(row, "license status");
    const licenseAge = get(row, "license age days", "license age", "license days", "days licensed");

    const reviews = get(row, "google rating / reviews", "google review count", "google reviews", "reviews", "rating");
    const googlePlaceUrl = get(row, "google business profile url or place id", "place id", "google maps");

    const sunbizEntity = get(row, "sunbiz entity name");
    const sunbizDocNumber = get(row, "sunbiz document number");
    const sunbizOfficer = get(row, "sunbiz officer manager match", "officer match");

    const painPoint = get(row, "speed to lead hook / paid ad pain point", "pain point", "hook");
    const operatingHours = get(row, "store / operating hours", "operating hours", "hours");
    const runningAds = get(row, "running google ads?", "running google ads", "google ads");

    const note = get(row, "notes / next action", "notes", "note", "call notes", "comments", "comment");
    const contextParts = [
      painPoint ? `Hook: ${painPoint}` : "",
      operatingHours ? `Hours: ${operatingHours}` : "",
      note,
      reviews ? `${reviews} Google reviews` : "",
      licenseAge ? `license ${licenseAge} days old` : ""
    ].filter(Boolean);
    const context = contextParts.join(" · ");

    const outcome = get(row, "disposition", "outcome", "result", "call result", "call status", "lead status", "status", "stage", "category", "dial 1 outcome");

    const allCsvFields: Record<string, string> = {};
    rawHeaders.forEach((header, idx) => {
      if (header && row[idx]) allCsvFields[header] = row[idx].trim();
    });

    const metadata: Record<string, unknown> = {
      owner_name: ownerFullName || rawOwner || undefined,
      business_owner: ownerFullName || rawOwner || undefined,
      raw_contractor_name: rawOwner || undefined,
      trade: trade || undefined,
      website: website || undefined,
      address: address || undefined,
      county: county || undefined,
      license_number: licenseNumber || undefined,
      license_type: trade || undefined,
      license_status: licenseStatus || undefined,
      license_age_days: licenseAge || undefined,
      sunbiz_entity: sunbizEntity || undefined,
      sunbiz_doc_number: sunbizDocNumber || undefined,
      sunbiz_officer: sunbizOfficer || undefined,
      google_reviews: reviews || undefined,
      google_places_url: googlePlaceUrl || undefined,
      operating_hours: operatingHours || undefined,
      running_google_ads: runningAds || undefined,
      speed_to_lead_hook: painPoint || undefined,
      all_csv_fields: allCsvFields,
    };

    return {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      company: company || undefined,
      title: title || undefined,
      phone: phone || undefined,
      email: email || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      source: get(row, "source", "list", "campaign") || "CSV import",
      notes: context || undefined,
      nextCallAt: get(row, "callback at", "callback date", "follow up date", "next call", "next call at", "due date") || undefined,
      metadata,
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
  const [assigneeFilter, setAssigneeFilter] = useState("all");
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
  const [autoDial, setAutoDial] = useState(false);
  const [dialSessionState, setDialSessionState] = useState<DialSessionState>("idle");
  const [voiceReadiness, setVoiceReadiness] = useState<VoiceReadiness>("idle");
  const [voiceReadinessMessage, setVoiceReadinessMessage] = useState("Tap Enable phone or Start outbound to allow microphone access.");
  const [isOnline, setIsOnline] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const deviceRef = useRef<VoiceDevice | null>(null);
  const devicePromiseRef = useRef<Promise<VoiceDevice> | null>(null);
  const callRef = useRef<VoiceCall | null>(null);
  const activeLeadRef = useRef<Row | null>(null);
  const autoDialRef = useRef(false);
  const dialSessionStateRef = useRef<DialSessionState>("idle");
  const voicePreparedRef = useRef(false);
  const deviceErrorRef = useRef("");
  const voiceEnabledRef = useRef(false);
  const placingCallRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const pausedForBackgroundRef = useRef(false);
  const placeCallRef = useRef<(lead: Row) => Promise<void>>(async () => undefined);

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

  const silentSync = useCallback(async () => {
    try {
      const [overviewData, leadsData] = await Promise.all([
        api<Row>("/api/dialer/overview"),
        api<{ leads: Row[] }>("/api/dialer/leads?limit=1000"),
      ]);
      setOverview((prev) => ({ ...prev, ...overviewData }));
      setLeads((prev) => {
        const prevKey = prev.map((l) => `${text(l, "id")}:${text(l, "assigned_user_id")}:${text(l, "status")}:${l.archived}`).join(";");
        const nextKey = leadsData.leads.map((l) => `${text(l, "id")}:${text(l, "assigned_user_id")}:${text(l, "status")}:${l.archived}`).join(";");
        return prevKey === nextKey ? prev : leadsData.leads;
      });
    } catch {
      // background polling fails silently
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void silentSync();
      }
    }, 6000);

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void silentSync();
      }
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("intent_dialer_sync");
        bc.onmessage = (ev) => {
          if (ev.data === "refresh") void silentSync();
        };
      }
    } catch {}

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "intent_dialer_sync_ping") void silentSync();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, [silentSync]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => { activeLeadRef.current = activeLead; }, [activeLead]);
  useEffect(() => { autoDialRef.current = autoDial; }, [autoDial]);
  useEffect(() => { dialSessionStateRef.current = dialSessionState; }, [dialSessionState]);

  const currentUser = useMemo(() => (overview.user || settings.currentUser || {}) as Row, [overview.user, settings.currentUser]);
  const users = (settings.users || []) as Row[];
  const counts = (overview.counts || {}) as Row;
  const metrics = (overview.metrics || {}) as Row;

  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const isArchived = Boolean(lead.archived);
    if (statusFilter === "archived") {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
    }

    const matchesStatus = statusFilter === "all" || statusFilter === "archived" || (
      (RETRY_DISPOSITIONS as readonly string[]).includes(statusFilter)
        ? text(lead, "disposition") === statusFilter
        : text(lead, "status") === statusFilter
    );
    const leadAssigneeId = text(lead, "assigned_user_id");
    const currentUserId = text(currentUser, "id");
    const matchesAssignee = assigneeFilter === "all" || (
      assigneeFilter === "unassigned"
        ? !leadAssigneeId
        : assigneeFilter === "me"
        ? leadAssigneeId === currentUserId
        : leadAssigneeId === assigneeFilter
    );
    const haystack = `${leadName(lead)} ${text(lead, "company")} ${text(lead, "phone_e164")} ${text(lead, "email")} ${text(lead, "disposition")} ${text(lead, "status")} ${text(lead, "assigned_name")}`.toLowerCase();
    return matchesStatus && matchesAssignee && haystack.includes(search.toLowerCase());
  }), [leads, search, statusFilter, assigneeFilter, currentUser]);
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

  const requestWakeLock = useCallback(async () => {
    if (typeof document === "undefined" || document.visibilityState !== "visible" || wakeLockRef.current) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wakeLock) return;
    try {
      const sentinel = await wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (sentinel && !sentinel.released) await sentinel.release().catch(() => undefined);
  }, []);

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) {
      if (deviceRef.current.state !== "registered") await deviceRef.current.register();
      return deviceRef.current;
    }
    if (devicePromiseRef.current) return devicePromiseRef.current;
    devicePromiseRef.current = (async () => {
      const tokenData = await api<{ token: string }>("/api/twilio/token");
      const { Device } = await import("@twilio/voice-sdk");
      if (!Device.isSupported) throw new Error("This browser cannot place web calls. Update Chrome or Safari and try again.");
      const device = new Device(tokenData.token, { closeProtection: true });
      deviceErrorRef.current = "";
      device.on("incoming", (call) => setIncomingCall(call));
      device.on("registered", () => {
        voicePreparedRef.current = true;
        setVoiceReadiness("ready");
        setVoiceReadinessMessage("Phone browser ready. Keep this tab open while dialing.");
      });
      device.on("unregistered", () => {
        voicePreparedRef.current = false;
        if (!navigator.onLine) {
          setVoiceReadiness("offline");
          setVoiceReadinessMessage("No internet connection. Dialing is paused.");
        } else {
          setVoiceReadiness("idle");
          setVoiceReadinessMessage(voiceEnabledRef.current ? "Phone connection dropped. Reconnecting…" : "Phone connection dropped. Tap Enable phone to reconnect.");
          if (voiceEnabledRef.current) {
            window.setTimeout(() => {
              if (navigator.onLine && deviceRef.current === device && device.state !== "registered") {
                void device.register().catch(() => setVoiceReadinessMessage("Could not reconnect. Tap Enable phone to retry."));
              }
            }, 1000);
          }
        }
      });
      device.on("tokenWillExpire", async () => {
        try { device.updateToken((await api<{ token: string }>("/api/twilio/token")).token); } catch { setVoiceReadinessMessage("Phone session needs to reconnect before the next call."); }
      });
      device.on("error", (event) => {
        const code = "code" in event && event.code ? ` (Twilio ${event.code})` : "";
        const message = `${event.message || "Twilio device error."}${code}`;
        deviceErrorRef.current = message;
        setCallError(message);
        setVoiceReadinessMessage(message);
      });
      deviceRef.current = device;
      await device.register();
      return device;
    })();
    try {
      return await devicePromiseRef.current;
    } catch (cause) {
      const failedDevice = deviceRef.current as VoiceDevice | null;
      failedDevice?.destroy();
      deviceRef.current = null;
      throw new Error(readableError(cause, deviceErrorRef.current || "Unable to register the Twilio browser phone."));
    } finally {
      devicePromiseRef.current = null;
    }
  }, []);

  const prepareMobileCalling = useCallback(async () => {
    if (!Boolean(twilio.configured)) throw new Error("Connect Twilio in Settings before placing calls.");
    if (!navigator.onLine) {
      setVoiceReadiness("offline");
      setVoiceReadinessMessage("No internet connection. Reconnect before dialing.");
      throw new Error("You are offline. Reconnect before dialing.");
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setVoiceReadiness("blocked");
      setVoiceReadinessMessage("Microphone calling requires HTTPS in a supported browser.");
      throw new Error("Open the secure call.intentrev.net URL in current Chrome or Safari.");
    }
    if (voicePreparedRef.current && deviceRef.current?.state === "registered") {
      return deviceRef.current;
    }
    setVoiceReadiness("preparing");
    setVoiceReadinessMessage("Checking microphone and connecting to Twilio…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getTracks().forEach((track) => track.stop());
      const device = await ensureDevice();
      voicePreparedRef.current = true;
      voiceEnabledRef.current = true;
      setVoiceReadiness("ready");
      setVoiceReadinessMessage("Phone browser ready. Keep this tab open while dialing.");
      return device;
    } catch (cause) {
      const denied = cause instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(cause.name);
      const message = denied
        ? "Microphone access is blocked. Allow it in this site's browser settings, then tap Enable phone."
        : readableError(cause, deviceErrorRef.current || "Unable to prepare browser calling.");
      voicePreparedRef.current = false;
      if (denied) voiceEnabledRef.current = false;
      setVoiceReadiness("blocked");
      setVoiceReadinessMessage(message);
      throw new Error(message);
    }
  }, [ensureDevice, twilio.configured]);

  const handlePrepareCalling = useCallback(async () => {
    try {
      await prepareMobileCalling();
      setToast("Phone browser is ready for calls");
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Unable to prepare browser calling.");
    }
  }, [prepareMobileCalling]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      setVoiceReadiness(voicePreparedRef.current ? "ready" : "idle");
      setVoiceReadinessMessage(voicePreparedRef.current ? "Phone browser ready. Keep this tab open while dialing." : voiceEnabledRef.current ? "Back online. Reconnecting phone…" : "Back online. Tap Enable phone to reconnect calling.");
      if (voiceEnabledRef.current && !voicePreparedRef.current) {
        void ensureDevice().catch(() => setVoiceReadinessMessage("Could not reconnect. Tap Enable phone to retry."));
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setVoiceReadiness("offline");
      setVoiceReadinessMessage("No internet connection. Dialing is paused.");
      if (dialSessionStateRef.current === "running") {
        dialSessionStateRef.current = "paused"; autoDialRef.current = false;
        setDialSessionState("paused"); setAutoDial(false);
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [ensureDevice]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (dialSessionStateRef.current === "running") {
          pausedForBackgroundRef.current = true;
          dialSessionStateRef.current = "paused"; autoDialRef.current = false;
          setDialSessionState("paused"); setAutoDial(false);
        }
        void releaseWakeLock();
        return;
      }
      if (pausedForBackgroundRef.current) {
        pausedForBackgroundRef.current = false;
        setToast(callRef.current ? "Call is still active. Keep this tab open; dialing will remain paused afterward." : "Power dialing paused because the app went to the background.");
      }
      if (callRef.current || dialSessionStateRef.current === "running") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => () => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
    void releaseWakeLock();
  }, [releaseWakeLock]);

  const advanceToNextLead = useCallback(async (excludeLeadId?: string | null) => {
    if (callRef.current) return;
    try {
      const result = await api<{ lead: Row | null }>("/api/dialer/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next", excludeLeadId: excludeLeadId || null }),
      });
      if (!result.lead) {
        dialSessionStateRef.current = "paused";
        autoDialRef.current = false;
        setDialSessionState("paused");
        setAutoDial(false);
        setToast("Queue complete — no eligible leads are due right now");
        return;
      }
      await placeCallRef.current(result.lead);
    } catch (cause) {
      dialSessionStateRef.current = "paused";
      autoDialRef.current = false;
      setDialSessionState("paused");
      setAutoDial(false);
      setToast(cause instanceof Error ? cause.message : "Unable to reserve the next lead.");
    }
  }, []);

  const reconcileAutomaticOutcome = useCallback(async (callId: string) => {
    const automaticOutcomes = new Set(["no_answer", "busy", "failed"]);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 650));
      try {
        const result = await api<{ call: Row }>(`/api/dialer/calls/${callId}`);
        const automaticDisposition = text(result.call, "disposition");
        if (automaticOutcomes.has(automaticDisposition)) {
          setDisposition(automaticDisposition);
          setToast(`${STATUS_LABELS[automaticDisposition]} — save the outcome to dial the next lead`);
          return;
        }
        // A terminal status can be visible just before its automatic disposition update.
        // Keep polling briefly so the outcome selector is populated before the rep saves.
      } catch {
        // The Twilio voice/status webhooks can arrive just after the browser disconnect event.
      }
    }
  }, []);

  const placeCall = useCallback(async (lead: Row) => {
    if (callRef.current || activeLeadRef.current || placingCallRef.current) return;
    placingCallRef.current = true;
    const requestedLeadId = text(lead, "id");
    let claimedLead = lead;
    let hasReservation = false;
    try {
      const device = await prepareMobileCalling();
      await requestWakeLock();
      const claimed = await api<{ lead: Row }>("/api/dialer/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", leadId: requestedLeadId }),
      });
      claimedLead = claimed.lead;
      hasReservation = true;
      activeLeadRef.current = claimedLead;
      setActiveLead(claimedLead); setCallError(""); setCallNotes(""); setCallbackAt(""); setDisposition("contacted");
      setCallPhase("connecting");
      const localCallId = crypto.randomUUID();
      setActiveCallId(localCallId);
      const call = await device.connect({ params: { leadId: text(claimedLead, "id"), dialerCallId: localCallId } });
      callRef.current = call;
      placingCallRef.current = false;
      let finished = false;
      call.on("ringing", () => setCallPhase("ringing"));
      call.on("accept", () => setCallPhase("open"));
      const finish = () => {
        if (finished) return;
        finished = true;
        callRef.current = null;
        setCallPhase("completed");
        if (dialSessionStateRef.current !== "running") void releaseWakeLock();
        void reconcileAutomaticOutcome(localCallId);
      };
      call.on("disconnect", finish); call.on("cancel", finish); call.on("reject", finish);
      call.on("error", (event) => {
        if (finished) return;
        finished = true;
        callRef.current = null;
        const message = event.message || "Call failed.";
        setCallError(message); setToast(message); setCallPhase("error");
        setDisposition("failed");
        if (dialSessionStateRef.current !== "running") void releaseWakeLock();
      });
    } catch (cause) {
      placingCallRef.current = false;
      activeLeadRef.current = hasReservation ? claimedLead : null;
      setActiveLead(hasReservation ? claimedLead : null);
      const message = cause instanceof Error ? cause.message : "Unable to start call.";
      setCallError(message); setToast(message);
      setCallPhase("error");
      if (hasReservation) {
        setDisposition("failed");
        if (dialSessionStateRef.current !== "running") void releaseWakeLock();
      } else {
        dialSessionStateRef.current = "paused"; autoDialRef.current = false;
        setDialSessionState("paused"); setAutoDial(false);
        void releaseWakeLock();
      }
    }
  }, [prepareMobileCalling, reconcileAutomaticOutcome, releaseWakeLock, requestWakeLock]);
  placeCallRef.current = placeCall;

  useEffect(() => {
    if (!activeLead || !["connecting", "ringing", "open", "completed", "error"].includes(callPhase)) return;
    const heartbeat = () => void api("/api/dialer/queue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "heartbeat", leadId: text(activeLead, "id") }),
    }).catch(() => undefined);
    heartbeat();
    const timer = setInterval(heartbeat, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [activeLead, callPhase]);

  const startPowerDial = useCallback(async () => {
    if (callRef.current || activeLeadRef.current) {
      setToast("Finish the current call before starting another dialing session");
      return;
    }
    try {
      await prepareMobileCalling();
      await requestWakeLock();
      dialSessionStateRef.current = "running"; autoDialRef.current = true;
      setDialSessionState("running"); setAutoDial(true);
      await advanceToNextLead();
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : "Unable to prepare browser calling.");
    }
  }, [advanceToNextLead, prepareMobileCalling, requestWakeLock]);

  const pausePowerDial = useCallback(() => {
    dialSessionStateRef.current = "paused"; autoDialRef.current = false;
    setDialSessionState("paused"); setAutoDial(false);
    setToast(callRef.current ? "Dialing will pause after this call" : "Power dialing paused");
    if (!callRef.current) void releaseWakeLock();
  }, [releaseWakeLock]);

  const endCall = () => callRef.current?.disconnect();

  const sendDigit = (digit: string) => {
    if (!callRef.current || callPhase !== "open") return;
    callRef.current.sendDigits(digit);
  };

  const saveDisposition = async () => {
    if (!activeLead) return;
    try {
      const reserveNext = dialSessionStateRef.current === "running" && autoDialRef.current;
      const result = await api<{ nextLead: Row | null }>("/api/dialer/disposition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: text(activeLead, "id"), callId: activeCallId, disposition, notes: callNotes, callbackAt: callbackAt || null, reserveNext }),
      });
      setToast("Outcome saved");
      activeLeadRef.current = null;
      setActiveLead(null); setActiveCallId(null); setCallPhase("idle");
      await refresh();
      if (reserveNext && result.nextLead) setTimeout(() => void placeCallRef.current(result.nextLead as Row), 450);
      if (!reserveNext) void releaseWakeLock();
      if (reserveNext && !result.nextLead) {
        dialSessionStateRef.current = "paused"; autoDialRef.current = false;
        setDialSessionState("paused"); setAutoDial(false);
        setToast("Outcome saved — queue complete for now");
      }
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
    window.location.href = isDialerHost ? "/login" : "/admin/dialer/login";
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
          {view === "leads" && <ResponsiveLeadsView leads={visibleLeads} allLeads={leads} counts={counts} users={users} lists={lists} statusFilter={statusFilter} setStatusFilter={setStatusFilter} assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter} currentUser={currentUser} setterLeadStats={(overview.setterLeadStats || []) as Row[]} search={search} setSearch={setSearch} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onDial={placeCall} dialSessionState={dialSessionState} voiceReadiness={voiceReadiness} voiceReadinessMessage={voiceReadinessMessage} isOnline={isOnline} wakeLockActive={wakeLockActive} onPrepareCalling={handlePrepareCalling} onStartPowerDial={startPowerDial} onPausePowerDial={pausePowerDial} onOpenDialpad={() => setModal("dialpad")} onOpenGuardrails={() => setModal("guardrails")} onAdd={() => setModal("lead")} onImport={() => setModal("import")} onRefresh={refresh} onRequestDeleteLead={(id, name) => setConfirmDelete({ type: "single", id, name })} onRequestDeleteBulk={() => setConfirmDelete({ type: "bulk", count: selectedIds.length })} onNotify={(msg) => setToast(msg)} />}
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
      {modal === "dialpad" && <ManualDialModal onClose={() => setModal(null)} onPrepare={prepareMobileCalling} onDial={(lead) => { setModal(null); void refresh(); void placeCall(lead); }} />}
      {modal === "guardrails" && <GuardrailsModal workspace={workspace} onClose={() => setModal(null)} onRefresh={refresh} onNotify={(msg) => setToast(msg)} />}
      {activeLead && <CallDock lead={activeLead} phase={callPhase} error={callError} disposition={disposition} setDisposition={setDisposition} notes={callNotes} setNotes={setCallNotes} callbackAt={callbackAt} setCallbackAt={setCallbackAt} autoDial={autoDial} setAutoDial={(value) => { autoDialRef.current = value; dialSessionStateRef.current = value ? "running" : "paused"; setAutoDial(value); setDialSessionState(value ? "running" : "paused"); }} onEnd={endCall} onSendDigit={sendDigit} onSave={saveDisposition} onClose={() => {
        const hadActiveCall = Boolean(callRef.current);
        const enteredNotes = callNotes.trim();
        const currentLeadId = text(activeLead, "id");
        const currentCallId = activeCallId;
        const currentDisp = disposition || "contacted";

        dialSessionStateRef.current = "paused";
        autoDialRef.current = false;
        setDialSessionState("paused");
        setAutoDial(false);
        if (hadActiveCall) endCall();

        if (enteredNotes && currentLeadId) {
          void api("/api/dialer/disposition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadId: currentLeadId,
              callId: currentCallId,
              disposition: currentDisp,
              notes: enteredNotes,
            }),
          }).then(() => void refresh()).catch(() => undefined);
        } else if (!hadActiveCall && currentLeadId) {
          void releaseWakeLock();
          void api("/api/dialer/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "release", leadId: currentLeadId }),
          }).catch(() => undefined);
        }

        activeLeadRef.current = null;
        setActiveLead(null);
        setActiveCallId(null);
        setCallPhase("idle");
      }} />}
      {incomingCall && <IncomingCall call={incomingCall} onAccept={() => void requestWakeLock()} onClose={() => { setIncomingCall(null); void releaseWakeLock(); }} />}
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
    archive: <><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></>,
    restore: <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></>,
    play: <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>,
    pause: <><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    minimize: <path d="M4 14h6v6m10-10h-6V4"/>,
    maximize: <><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><polyline points="9 21 3 21 3 15"/><line x1="14" y1="10" x2="3" y2="21"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
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
  assigneeFilter?: string;
  setAssigneeFilter?: (value: string) => void;
  currentUser?: Row;
  setterLeadStats?: Row[];
  search: string;
  setSearch: (value: string) => void;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onDial: (lead: Row) => void;
  dialSessionState: DialSessionState;
  voiceReadiness: VoiceReadiness;
  voiceReadinessMessage: string;
  isOnline: boolean;
  wakeLockActive: boolean;
  onPrepareCalling: () => void;
  onStartPowerDial: () => void;
  onPausePowerDial: () => void;
  onOpenDialpad: () => void;
  onOpenGuardrails?: () => void;
  onAdd: () => void;
  onImport: () => void;
  onRefresh: () => Promise<void>;
  onRequestDeleteLead?: (id: string, name: string) => void;
  onRequestDeleteBulk?: () => void;
  onNotify?: (msg: string) => void;
};

function useLeadSelectionController(leads: Row[], selectedIds: string[], setSelectedIds: Dispatch<SetStateAction<string[]>>) {
  const anchorIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ active: boolean; selecting: boolean; visited: Set<string> }>({ active: false, selecting: true, visited: new Set() });

  useEffect(() => {
    const stopDragging = () => { dragRef.current.active = false; };
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) {
      anchorIdRef.current = null;
    }
  }, [selectedIds.length]);

  const applySelection = useCallback((ids: string[], selecting: boolean) => {
    const changedIds = new Set(ids);
    setSelectedIds((current) => selecting
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !changedIds.has(id)));
  }, [setSelectedIds]);

  const toggleLead = useCallback((leadId: string, shiftKey: boolean) => {
    const selecting = !selectedIds.includes(leadId);
    const anchorIndex = anchorIdRef.current ? leads.findIndex((lead) => text(lead, "id") === anchorIdRef.current) : -1;
    const leadIndex = leads.findIndex((lead) => text(lead, "id") === leadId);
    if (shiftKey && anchorIndex >= 0 && leadIndex >= 0) {
      const start = Math.min(anchorIndex, leadIndex);
      const end = Math.max(anchorIndex, leadIndex);
      applySelection(leads.slice(start, end + 1).map((lead) => text(lead, "id")), selecting);
      anchorIdRef.current = null; // Clears anchor so next bulk selection interval starts fresh
    } else {
      applySelection([leadId], selecting);
      anchorIdRef.current = leadId;
    }
  }, [applySelection, leads, selectedIds]);

  const startDragging = useCallback((leadId: string, shiftKey: boolean) => {
    if (shiftKey) {
      toggleLead(leadId, true);
      return;
    }
    const selecting = !selectedIds.includes(leadId);
    dragRef.current = { active: true, selecting, visited: new Set([leadId]) };
    anchorIdRef.current = leadId;
    applySelection([leadId], selecting);
  }, [applySelection, selectedIds, toggleLead]);

  const enterWhileDragging = useCallback((leadId: string) => {
    const drag = dragRef.current;
    if (!drag.active || drag.visited.has(leadId)) return;
    drag.visited.add(leadId);
    applySelection([leadId], drag.selecting);
  }, [applySelection]);

  return { toggleLead, startDragging, enterWhileDragging };
}

function LeadSelectionCheckbox({
  checked,
  label,
  className = "",
  onToggle,
  onDragStart,
  onDragEnter,
}: {
  checked: boolean;
  label: string;
  className?: string;
  onToggle: (shiftKey: boolean) => void;
  onDragStart: (shiftKey: boolean) => void;
  onDragEnter: () => void;
}) {
  const suppressClickUntilRef = useRef(0);
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      className={`cursor-pointer select-none ${className}`}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        event.preventDefault();
        suppressClickUntilRef.current = Date.now() + 700;
        onDragStart(event.shiftKey);
      }}
      onPointerEnter={onDragEnter}
      onClick={(event) => {
        if (Date.now() < suppressClickUntilRef.current) {
          event.preventDefault();
          return;
        }
        onToggle(event.shiftKey);
      }}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        onToggle(event.shiftKey);
      }}
    >
      <input aria-hidden="true" tabIndex={-1} type="checkbox" checked={checked} readOnly className="pointer-events-none" />
    </span>
  );
}

function ResponsiveLeadsView(props: LeadsViewProps) {
  const { leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, assigneeFilter = "all", setAssigneeFilter, currentUser, setterLeadStats = [], search, setSearch, selectedIds, setSelectedIds, onDial, dialSessionState, voiceReadiness, voiceReadinessMessage, isOnline, wakeLockActive, onPrepareCalling, onStartPowerDial, onPausePowerDial, onOpenDialpad, onAdd, onImport, onRefresh, onRequestDeleteLead, onRequestDeleteBulk, onNotify } = props;
  const [assigning, setAssigning] = useState(false);
  const currentUserId = text(currentUser, "id");
  const isOwner = text(currentUser, "role") === "owner";
  const myAssignedLeads = allLeads.filter((l) => text(l, "assigned_user_id") === currentUserId);
  const myAssignedCount = number(counts, "assigned_to_me") || myAssignedLeads.length;
  const myToCall = number(counts, "assigned_to_me_to_call") || myAssignedLeads.filter((l) => text(l, "status") === "to_call" && !l.do_not_call).length;
  const myTryAgain = number(counts, "assigned_to_me_try_again") || myAssignedLeads.filter((l) => text(l, "status") === "try_again" && !l.do_not_call).length;
  const myFollowUp = number(counts, "assigned_to_me_follow_up") || myAssignedLeads.filter((l) => text(l, "status") === "follow_up" && !l.do_not_call).length;
  const unassignedLeads = allLeads.filter((l) => !text(l, "assigned_user_id"));
  const unassignedCount = number(counts, "total_unassigned") || unassignedLeads.length;
  const totalAssignedCount = number(counts, "total_assigned") || (allLeads.length - unassignedLeads.length);
  const filters = [
    ["all", "All", number(counts, "all_leads")],
    ["to_call", "Ready", number(counts, "to_call")],
    ["try_again", "Retry", number(counts, "try_again")],
    ["follow_up", "Follow up", number(counts, "follow_up")],
    ["closed", "Closed", number(counts, "closed")],
    ["archived", "Archived", number(counts, "archived") || allLeads.filter((l) => Boolean(l.archived)).length],
  ];
  const retryFilters = RETRY_DISPOSITIONS.map((value) => [value, STATUS_LABELS[value], allLeads.filter((lead) => text(lead, "disposition") === value).length] as const);
  const selection = useLeadSelectionController(leads, selectedIds, setSelectedIds);
  const shownIds = leads.map((lead) => text(lead, "id"));
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id));
  const hasRetrySelection = allLeads.some((lead) => selectedIds.includes(text(lead, "id")) && (text(lead, "status") === "try_again" || (RETRY_DISPOSITIONS as readonly string[]).includes(text(lead, "disposition"))));
  const toggleShown = () => setSelectedIds(allShownSelected
    ? selectedIds.filter((id) => !shownIds.includes(id))
    : Array.from(new Set([...selectedIds, ...shownIds])));
  const changeAssignment = async (userId: string) => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, assignedUserId: userId || null }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} ${userId ? "assigned" : "unassigned"}`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to assign leads.");
    } finally { setAssigning(false); }
  };
  const requeueSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "requeue" }) });
      setSelectedIds([]);
      setStatusFilter("to_call");
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} returned to Ready and unassigned`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to return leads to Ready.");
    } finally { setAssigning(false); }
  };
  const archiveSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "archive" }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} archived`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to archive leads.");
    } finally { setAssigning(false); }
  };
  const restoreSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "unarchive" }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} restored to main lead list`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to restore leads.");
    } finally { setAssigning(false); }
  };
  const archiveSingleLead = async (leadId: string) => {
    try {
      await api(`/api/dialer/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) });
      await onRefresh();
      notifyDialerSync();
      onNotify?.("Lead archived");
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to archive lead.");
    }
  };
  const restoreSingleLead = async (leadId: string) => {
    try {
      await api(`/api/dialer/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) });
      await onRefresh();
      notifyDialerSync();
      onNotify?.("Lead restored to main lead list");
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to restore lead.");
    }
  };
  return <>
    <div className="lg:hidden">
      <PageHeader eyebrow="Your sheet" title="Leads" description="Your calling queue, optimized for one-handed dialing." action={<><SecondaryButton onClick={onImport}><Icon name="upload" className="h-4 w-4"/>Import</SecondaryButton><PrimaryButton onClick={onAdd}><Icon name="plus" className="h-4 w-4"/>Add lead</PrimaryButton></>}/>
      <section className="mb-4 min-w-0 rounded-2xl border border-[#b8d0e6] bg-gradient-to-br from-[#edf5fc] to-white p-3 shadow-[0_8px_24px_rgba(18,102,196,.08)]">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#1266c4]">Outbound dialing</div><p className="mt-0.5 truncate text-xs text-[#64748b]">Key in a number or call the next eligible lead.</p></div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${dialSessionState === "running" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : dialSessionState === "paused" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[#c9def1] bg-white text-[#1266c4]"}`}>{dialSessionState === "running" ? "Running" : dialSessionState === "paused" ? "Paused" : "Ready"}</span>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <button type="button" onClick={onOpenDialpad} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-[#b8d0e6] bg-white px-2 text-sm font-bold text-[#1266c4] shadow-xs transition hover:bg-[#f8fbfe]"><Icon name="dialpad" className="h-4 w-4 shrink-0"/><span className="truncate">Keypad</span></button>
          <button type="button" onClick={dialSessionState === "running" ? onPausePowerDial : onStartPowerDial} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold shadow-sm transition ${dialSessionState === "running" ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "bg-[#1266c4] text-white shadow-blue-700/15 hover:bg-[#0f57aa]"}`}><Icon name={dialSessionState === "running" ? "pause" : "phone"} className="h-4 w-4 shrink-0"/><span className="truncate">{dialSessionState === "running" ? "Pause session" : dialSessionState === "paused" ? "Resume dialing" : "Start outbound"}</span></button>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-[#d5e3f1] bg-white/85 p-2.5" aria-live="polite">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${voiceReadiness === "ready" && isOnline ? "bg-emerald-500" : voiceReadiness === "preparing" ? "animate-pulse bg-[#1266c4]" : voiceReadiness === "blocked" || !isOnline ? "bg-red-500" : "bg-amber-500"}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-[#173d6b]">{voiceReadiness === "ready" ? `Phone ready${wakeLockActive ? " · screen awake" : ""}` : voiceReadiness === "preparing" ? "Preparing phone…" : !isOnline ? "Phone offline" : voiceReadiness === "blocked" ? "Phone needs attention" : "Phone not enabled"}</div>
            <p className="mt-0.5 text-[10px] leading-4 text-[#64748b]">{voiceReadinessMessage}</p>
          </div>
          {voiceReadiness !== "ready" && voiceReadiness !== "preparing" && <button type="button" disabled={!isOnline} onClick={onPrepareCalling} className="min-h-9 shrink-0 rounded-lg bg-[#edf5fc] px-2.5 text-[11px] font-bold text-[#1266c4] disabled:opacity-45">Enable phone</button>}
        </div>
      </section>
      {/* MOBILE LEAD ASSIGNMENT METRIC */}
      <section className="mb-3 rounded-2xl border border-[#d5e3f1] bg-white p-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[#1266c4]">
            <Icon name="users" className="h-3.5 w-3.5" />
            <span>{isOwner ? "Lead Distribution" : "Your Assigned Leads"}</span>
          </div>
          <span className="text-xs font-bold text-[#0f172a]">
            {isOwner ? `${totalAssignedCount} assigned · ${unassignedCount} pool` : `${myAssignedCount} assigned`}
          </span>
        </div>

        {!isOwner && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700 border border-blue-200">
              {myToCall} ready
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700 border border-amber-200">
              {myTryAgain} retry
            </span>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 font-bold text-purple-700 border border-purple-200">
              {myFollowUp} follow-up
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 border border-slate-200">
              {unassignedCount} unassigned
            </span>
          </div>
        )}

        {/* 1-click Filter Pills */}
        {setAssigneeFilter && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => { setAssigneeFilter("all"); setSelectedIds([]); }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                assigneeFilter === "all"
                  ? "bg-[#1266c4] text-white"
                  : "border border-[#d0dbe7] bg-white text-[#64748b]"
              }`}
            >
              All ({allLeads.length})
            </button>
            <button
              type="button"
              onClick={() => { setAssigneeFilter("me"); setSelectedIds([]); }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                assigneeFilter === "me" || assigneeFilter === currentUserId
                  ? "bg-[#1266c4] text-white"
                  : "border border-[#d0dbe7] bg-white text-[#1266c4]"
              }`}
            >
              Assigned to You ({myAssignedCount})
            </button>
            <button
              type="button"
              onClick={() => { setAssigneeFilter("unassigned"); setSelectedIds([]); }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                assigneeFilter === "unassigned"
                  ? "bg-[#1266c4] text-white"
                  : "border border-[#d0dbe7] bg-white text-[#64748b]"
              }`}
            >
              Unassigned Pool ({unassignedCount})
            </button>
            {isOwner &&
              users
                .filter((u) => Boolean(u.active))
                .map((u) => {
                  const uId = text(u, "id");
                  const uName = text(u, "display_name") || "Setter";
                  const stat = setterLeadStats.find((s) => text(s, "user_id") === uId);
                  const uTotal = stat ? number(stat, "total") : allLeads.filter((l) => text(l, "assigned_user_id") === uId).length;
                  return (
                    <button
                      key={uId}
                      type="button"
                      onClick={() => { setAssigneeFilter(assigneeFilter === uId ? "all" : uId); setSelectedIds([]); }}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        assigneeFilter === uId
                          ? "bg-[#1266c4] text-white"
                          : "border border-[#d0dbe7] bg-white text-[#334155]"
                      }`}
                    >
                      {uName} ({uTotal})
                    </button>
                  );
                })}
          </div>
        )}
      </section>
      <div className="mb-3 grid min-w-0 grid-cols-6 gap-2">{filters.map(([id, label, count], index) => <button key={String(id)} onClick={() => { setStatusFilter(String(id)); setSelectedIds([]); }} className={`min-w-0 rounded-xl border p-2.5 text-left transition ${index < 3 ? "col-span-2" : "col-span-3"} ${statusFilter === id ? "border-[#1266c4] bg-[#1266c4] text-white shadow-md shadow-blue-900/10" : "border-[#e2e8f0] bg-white text-[#334155]"}`}><div className="truncate text-lg font-bold">{count}</div><div className={`mt-0.5 truncate text-[11px] font-semibold ${statusFilter === id ? "text-white/80" : "text-[#64748b]"}`}>{label}</div></button>)}</div>
      <div className="mb-4 flex min-w-0 gap-2 overflow-x-auto pb-1">{retryFilters.map(([id, label, count]) => <button key={id} onClick={() => { setStatusFilter(id); setSelectedIds([]); }} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${statusFilter === id ? "border-amber-400 bg-amber-50 text-amber-800" : "border-[#e2e8f0] bg-white text-[#64748b]"}`}>{label} ({count})</button>)}</div>
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_8px_30px_rgba(18,59,112,.05)]">
        <div className="space-y-3 border-b border-[#e2e8f0] p-3">
          <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/><input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIds([]); }} placeholder="Search leads..." className="min-h-11 w-full rounded-xl border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/></div>
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={!shownIds.length} onClick={toggleShown} className="min-h-10 rounded-lg border border-[#b8d0e6] bg-[#edf5fc] px-3 text-xs font-bold text-[#1266c4] disabled:opacity-50">{allShownSelected ? "Clear shown" : `Select all shown (${shownIds.length})`}</button>
            {selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} className="min-h-10 px-2 text-xs font-bold text-[#64748b]">Clear {selectedIds.length} selected</button>}
          </div>
          <p className="px-1 text-[10px] text-[#64748b]">Tap individual leads for a random selection. On desktop, drag down the checkboxes or Shift-click to select a range.</p>
          {selectedIds.length > 0 ? (
            <div className="grid min-w-0 gap-2 sm:flex">
              <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value === "__unassigned__" ? "" : event.target.value)} defaultValue="__choose__" className="min-h-11 flex-1 rounded-xl border border-[#d0dbe7] bg-white px-3 text-sm text-[#0f172a]"><option value="__choose__" disabled>Assign {selectedIds.length} selected...</option><option value="__unassigned__">Unassigned</option>{users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}</select>
              {hasRetrySelection && <button type="button" disabled={assigning} onClick={() => void requeueSelected()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">Ready + unassign</button>}
              {statusFilter === "archived" ? (
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => void restoreSelected()}
                  className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 sm:shrink-0 disabled:opacity-50"
                >
                  <Icon name="restore" className="h-4 w-4" />
                  <span>Restore ({selectedIds.length}) to Lead List</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => void archiveSelected()}
                  className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 sm:shrink-0 disabled:opacity-50"
                >
                  <Icon name="archive" className="h-4 w-4" />
                  <span>Archive ({selectedIds.length})</span>
                </button>
              )}
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
        <div className="divide-y divide-[#e2e8f0]">{leads.map((lead) => {
          const leadId = text(lead, "id");
          const disabled = Boolean(lead.do_not_call) || text(lead, "status") === "closed";
          const owner = getBusinessOwner(lead);
          const comp = text(lead, "company");
          return (
            <article key={leadId} className="p-4">
              <div className="flex items-start gap-3">
                <LeadSelectionCheckbox
                  checked={selectedIds.includes(leadId)}
                  label={`Select ${leadName(lead)}`}
                  className="flex min-h-11 items-center"
                  onToggle={(shiftKey) => selection.toggleLead(leadId, shiftKey)}
                  onDragStart={(shiftKey) => selection.startDragging(leadId, shiftKey)}
                  onDragEnter={() => selection.enterWhileDragging(leadId)}
                />
                <Avatar name={owner || leadName(lead)}/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {comp ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={googleSearchUrl(comp, text(lead, "city"), text(lead, "state"))}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Search ${comp} on Google`}
                            className="truncate text-sm font-bold text-[#0f172a] hover:text-[#1266c4] hover:underline inline-flex items-center gap-1"
                          >
                            <span>{comp}</span>
                            <Icon name="external" className="h-3 w-3 text-[#1266c4] shrink-0" />
                          </a>
                        </div>
                      ) : (
                        <h2 className="truncate text-sm font-bold text-[#0f172a]">{leadName(lead)}</h2>
                      )}
                      {owner ? (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#334155]">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1]">Owner</span>
                          <span className="font-semibold text-[#0f172a] truncate">{owner}</span>
                        </div>
                      ) : null}
                      {text(lead, "title") && (
                        <p className="truncate text-xs text-[#64748b]">{text(lead, "title")}</p>
                      )}
                    </div>
                    <StatusBadge status={text(lead, "disposition") || text(lead, "status")}/>
                  </div>
                  <a href={`tel:${text(lead, "phone_e164")}`} className="mt-3 block text-base font-bold tracking-tight text-[#1266c4]">{formatPhone(lead.phone_e164)}</a>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#64748b]">
                    <span>{localTime(lead)} local</span>
                    <span>{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</span>
                    <span>{text(lead, "assigned_name") || "Unassigned"}</span>
                  </div>
                  {text(lead, "notes") && (
                    <div className="mt-2 rounded-xl bg-[#f8fbfe] border border-[#d5e3f1] px-3 py-1.5 text-xs text-[#334155] break-words">
                      <strong className="text-[#1266c4]">Note:</strong> {text(lead, "notes")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  disabled={disabled}
                  onClick={() => onDial(lead)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#edf5fc] text-sm font-bold text-[#1266c4] transition hover:bg-[#e1effb] active:scale-[.99] disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
                >
                  <Icon name="phone"/>Dial {owner ? owner.split(" ")[0] : leadName(lead).split(" ")[0]}
                </button>
                {Boolean(lead.archived) ? (
                  <button
                    title="Restore to main lead list"
                    onClick={() => void restoreSingleLead(leadId)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shrink-0"
                  >
                    <Icon name="restore" className="h-4 w-4" />
                    <span>Restore</span>
                  </button>
                ) : (
                  <button
                    title="Archive lead"
                    onClick={() => void archiveSingleLead(leadId)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                  >
                    <Icon name="archive" className="h-5 w-5" />
                  </button>
                )}
                <button
                  title="Delete lead"
                  onClick={() => onRequestDeleteLead && onRequestDeleteLead(leadId, leadName(lead))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition"
                >
                  <Icon name="trash" className="h-5 w-5" />
                </button>
              </div>
            </article>
          );
        })}{!leads.length && <Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/>}</div>
      </section>
    </div>
    <div className="hidden lg:block"><LeadsView {...props}/></div>
  </>;
}

function LeadsView({ leads, allLeads, counts, users, lists, statusFilter, setStatusFilter, assigneeFilter = "all", setAssigneeFilter, currentUser, setterLeadStats = [], search, setSearch, selectedIds, setSelectedIds, onDial, dialSessionState, voiceReadiness, voiceReadinessMessage, isOnline, wakeLockActive, onPrepareCalling, onStartPowerDial, onPausePowerDial, onOpenDialpad, onOpenGuardrails, onAdd, onImport, onRefresh, onRequestDeleteLead, onRequestDeleteBulk, onNotify }: LeadsViewProps) {
  const [assigning, setAssigning] = useState(false);
  const currentUserId = text(currentUser, "id");
  const isOwner = text(currentUser, "role") === "owner";
  const myAssignedLeads = allLeads.filter((l) => text(l, "assigned_user_id") === currentUserId);
  const myAssignedCount = number(counts, "assigned_to_me") || myAssignedLeads.length;
  const myToCall = number(counts, "assigned_to_me_to_call") || myAssignedLeads.filter((l) => text(l, "status") === "to_call" && !l.do_not_call).length;
  const myTryAgain = number(counts, "assigned_to_me_try_again") || myAssignedLeads.filter((l) => text(l, "status") === "try_again" && !l.do_not_call).length;
  const myFollowUp = number(counts, "assigned_to_me_follow_up") || myAssignedLeads.filter((l) => text(l, "status") === "follow_up" && !l.do_not_call).length;
  const myClosed = number(counts, "assigned_to_me_closed") || myAssignedLeads.filter((l) => text(l, "status") === "closed" || l.do_not_call).length;
  const unassignedLeads = allLeads.filter((l) => !text(l, "assigned_user_id"));
  const unassignedCount = number(counts, "total_unassigned") || unassignedLeads.length;
  const totalAssignedCount = number(counts, "total_assigned") || (allLeads.length - unassignedLeads.length);

  const retryFilters = RETRY_DISPOSITIONS.map((value) => [value, STATUS_LABELS[value], allLeads.filter((lead) => text(lead, "disposition") === value).length] as const);
  const selection = useLeadSelectionController(leads, selectedIds, setSelectedIds);
  const shownIds = leads.map((lead) => text(lead, "id"));
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id));
  const hasRetrySelection = allLeads.some((lead) => selectedIds.includes(text(lead, "id")) && (text(lead, "status") === "try_again" || (RETRY_DISPOSITIONS as readonly string[]).includes(text(lead, "disposition"))));
  const toggleShown = () => setSelectedIds(allShownSelected
    ? selectedIds.filter((id) => !shownIds.includes(id))
    : Array.from(new Set([...selectedIds, ...shownIds])));
  const changeAssignment = async (userId: string) => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, assignedUserId: userId || null }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} ${userId ? "assigned" : "unassigned"}`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to assign leads.");
    } finally { setAssigning(false); }
  };
  const requeueSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "requeue" }) });
      setSelectedIds([]);
      setStatusFilter("to_call");
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} returned to Ready and unassigned`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to return leads to Ready.");
    } finally { setAssigning(false); }
  };
  const archiveSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "archive" }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} archived`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to archive leads.");
    } finally { setAssigning(false); }
  };
  const restoreSelected = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    try {
      const result = await api<{ updated: number }>("/api/dialer/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedIds, action: "unarchive" }) });
      setSelectedIds([]);
      await onRefresh();
      notifyDialerSync();
      onNotify?.(`${result.updated} lead${result.updated === 1 ? "" : "s"} restored to main lead list`);
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to restore leads.");
    } finally { setAssigning(false); }
  };
  const archiveSingleLead = async (leadId: string) => {
    try {
      await api(`/api/dialer/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) });
      await onRefresh();
      notifyDialerSync();
      onNotify?.("Lead archived");
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to archive lead.");
    }
  };
  const restoreSingleLead = async (leadId: string) => {
    try {
      await api(`/api/dialer/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) });
      await onRefresh();
      notifyDialerSync();
      onNotify?.("Lead restored to main lead list");
    } catch (cause) {
      onNotify?.(cause instanceof Error ? cause.message : "Unable to restore lead.");
    }
  };
  const filters = [
    ["all", "All leads", number(counts, "all_leads")],
    ["to_call", "To call", number(counts, "to_call")],
    ["try_again", "Try again", number(counts, "try_again")],
    ["follow_up", "Follow up", number(counts, "follow_up")],
    ["closed", "Closed", number(counts, "closed")],
    ["archived", "Archived", number(counts, "archived") || allLeads.filter((l) => Boolean(l.archived)).length],
  ];
  return <>
    <PageHeader eyebrow="Your sheet" title="Leads" description="Everyone you're calling, where each contact stands, and what needs attention next." action={<div className="flex flex-wrap gap-2">{onOpenGuardrails && <SecondaryButton onClick={onOpenGuardrails}><Icon name="sliders"/>Guardrails</SecondaryButton>}<SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton><SecondaryButton onClick={onImport}><Icon name="upload"/>Import CSV</SecondaryButton><PrimaryButton onClick={dialSessionState === "running" ? onPausePowerDial : onStartPowerDial}><Icon name={dialSessionState === "running" ? "pause" : "phone"}/>{dialSessionState === "running" ? "Pause dialing" : dialSessionState === "paused" ? "Resume dialing" : "Start power dial"}</PrimaryButton><SecondaryButton onClick={onAdd}><Icon name="plus"/>Add lead</SecondaryButton></div>}/>
    <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[#d5e3f1] bg-white px-4 py-3 text-xs text-[#64748b]" aria-live="polite">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${voiceReadiness === "ready" && isOnline ? "bg-emerald-500" : voiceReadiness === "preparing" ? "animate-pulse bg-[#1266c4]" : voiceReadiness === "blocked" || !isOnline ? "bg-red-500" : "bg-amber-500"}`} />
      <strong className="text-[#173d6b]">{voiceReadiness === "ready" ? `Browser phone ready${wakeLockActive ? " · screen awake" : ""}` : voiceReadiness === "preparing" ? "Preparing browser phone…" : !isOnline ? "Browser phone offline" : "Browser phone not enabled"}</strong>
      <span className="min-w-0 flex-1">{voiceReadinessMessage}</span>
      {voiceReadiness !== "ready" && voiceReadiness !== "preparing" && <SecondaryButton onClick={onPrepareCalling} disabled={!isOnline}>Enable phone</SecondaryButton>}
    </div>

    {/* LEAD ASSIGNMENT & SETTER WORKLOAD SECTION */}
    <div className="mb-4 rounded-2xl border border-[#d5e3f1] bg-gradient-to-r from-[#edf5fc] via-white to-[#f8fbfe] p-4 shadow-[0_4px_20px_rgba(18,59,112,.04)]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Summary Headline Metric */}
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1266c4]/10 text-[#1266c4]">
              <Icon name="users" className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.14em] text-[#1266c4]">
              {isOwner ? "Lead Distribution & Setter Workload" : "Your Assigned Workload"}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <div className="text-2xl font-black tracking-tight text-[#0f172a]">
              {isOwner ? (
                <span>
                  {totalAssignedCount} <span className="text-base font-normal text-[#64748b]">assigned across team</span>
                </span>
              ) : (
                <span>
                  {myAssignedCount} <span className="text-base font-normal text-[#64748b]">leads assigned to you</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 border border-blue-200">
                {isOwner ? `${myAssignedCount} assigned to you` : `${myToCall} ready to call`}
              </span>
              {!isOwner && (
                <>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 border border-amber-200">
                    {myTryAgain} retry
                  </span>
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 font-bold text-purple-700 border border-purple-200">
                    {myFollowUp} follow-up
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 border border-slate-200">
                    {myClosed} closed
                  </span>
                </>
              )}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700 border border-slate-200">
                {unassignedCount} in unassigned pool
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Filter Buttons */}
        {setAssigneeFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setAssigneeFilter("all"); setSelectedIds([]); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                assigneeFilter === "all"
                  ? "bg-[#1266c4] text-white shadow-xs"
                  : "border border-[#d0dbe7] bg-white text-[#64748b] hover:bg-[#f8fafc]"
              }`}
            >
              All Leads ({number(counts, "all_leads") || allLeads.length})
            </button>

            <button
              type="button"
              onClick={() => { setAssigneeFilter("me"); setSelectedIds([]); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                assigneeFilter === "me" || assigneeFilter === currentUserId
                  ? "bg-[#1266c4] text-white shadow-xs"
                  : "border border-[#d0dbe7] bg-white text-[#1266c4] hover:bg-[#edf5fc]"
              }`}
            >
              Assigned to You ({myAssignedCount})
            </button>

            <button
              type="button"
              onClick={() => { setAssigneeFilter("unassigned"); setSelectedIds([]); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                assigneeFilter === "unassigned"
                  ? "bg-[#1266c4] text-white shadow-xs"
                  : "border border-[#d0dbe7] bg-white text-[#64748b] hover:bg-[#f8fafc]"
              }`}
            >
              Unassigned Pool ({unassignedCount})
            </button>
          </div>
        )}
      </div>

      {/* For Owner: Full Setter Workload Breakdown Chips */}
      {isOwner && users.filter((u) => Boolean(u.active)).length > 0 && (
        <div className="mt-3 border-t border-[#e2e8f0]/80 pt-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#64748b]">
            Setter Workload Breakdown (Click to filter leads by setter)
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {users
              .filter((u) => Boolean(u.active))
              .map((u) => {
                const uId = text(u, "id");
                const uName = text(u, "display_name") || "Setter";
                const stat = setterLeadStats.find((s) => text(s, "user_id") === uId);
                const uLeads = allLeads.filter((l) => text(l, "assigned_user_id") === uId);
                const uTotal = stat ? number(stat, "total") : uLeads.length;
                const uToCall = stat ? number(stat, "to_call") : uLeads.filter((l) => text(l, "status") === "to_call" && !l.do_not_call).length;
                const isSelected = assigneeFilter === uId;

                return (
                  <button
                    key={uId}
                    type="button"
                    onClick={() => { setAssigneeFilter?.(isSelected ? "all" : uId); setSelectedIds([]); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? "border-[#1266c4] bg-[#edf5fc] text-[#1266c4] ring-2 ring-[#1266c4]/30"
                        : "border-[#e2e8f0] bg-white text-[#334155] hover:border-[#b8d0e6] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <span className="font-bold">{uName}:</span>
                    <span className="rounded-full bg-[#1266c4]/10 px-1.5 py-0.2 text-[10px] font-extrabold text-[#1266c4]">
                      {uTotal} leads
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      ({uToCall} ready)
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{filters.map(([id, label, count]) => <button key={String(id)} onClick={() => { setStatusFilter(String(id)); setSelectedIds([]); }} className={`rounded-xl border p-4 text-left transition ${statusFilter === id ? "border-[#1266c4] bg-white shadow-sm ring-2 ring-[#1266c4]" : "border-[#e2e8f0] bg-white/75 hover:bg-white hover:border-[#b8d0e6]"}`}><div className="text-2xl font-bold text-[#0f172a]">{count}</div><div className="mt-1 text-sm font-semibold text-[#0f172a]">{label}</div><div className="mt-1 text-[11px] text-[#64748b]">{id === "all" ? "Everything except deleted" : id === "to_call" ? "Never dialed and ready" : id === "try_again" ? "No answer, voicemail, busy, failed" : id === "follow_up" ? "Callbacks and interest" : id === "archived" ? "Archived and hidden from queue" : "Completed or suppressed"}</div></button>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#64748b]">Retry outcomes</span>{retryFilters.map(([id, label, count]) => <button key={id} onClick={() => { setStatusFilter(id); setSelectedIds([]); }} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusFilter === id ? "border-amber-400 bg-amber-50 text-amber-800" : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#b8d0e6]"}`}>{label} ({count})</button>)}</div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_20px_rgba(18,59,112,.035)]">
      <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"/><input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIds([]); }} placeholder="Search names, companies, phones…" className="w-full rounded-lg border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/></div>
        {setAssigneeFilter && (
          <select
            value={assigneeFilter}
            onChange={(event) => { setAssigneeFilter(event.target.value); setSelectedIds([]); }}
            className="rounded-lg border border-[#d0dbe7] bg-white px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"
          >
            <option value="all">All Assignees ({number(counts, "all_leads") || allLeads.length})</option>
            <option value="me">Assigned to You ({myAssignedCount})</option>
            <option value="unassigned">Unassigned Pool ({unassignedCount})</option>
            {users.filter((user) => Boolean(user.active)).map((user) => {
              const uId = text(user, "id");
              const stat = setterLeadStats.find((s) => text(s, "user_id") === uId);
              const uCount = stat ? number(stat, "total") : allLeads.filter((l) => text(l, "assigned_user_id") === uId).length;
              return (
                <option key={uId} value={uId}>
                  {text(user, "display_name")} ({uCount} leads)
                </option>
              );
            })}
          </select>
        )}
        <button type="button" disabled={!shownIds.length} onClick={toggleShown} className="rounded-lg border border-[#b8d0e6] bg-[#edf5fc] px-3 py-2 text-xs font-bold text-[#1266c4] disabled:opacity-50">{allShownSelected ? "Clear shown" : `Select all shown (${shownIds.length})`}</button>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <select disabled={assigning} onChange={(event) => void changeAssignment(event.target.value === "__unassigned__" ? "" : event.target.value)} defaultValue="__choose__" className="rounded-lg border border-[#d0dbe7] bg-white px-3 py-2 text-sm text-[#0f172a]">
              <option value="__choose__" disabled>Assign {selectedIds.length} leads…</option>
              <option value="__unassigned__">Unassigned</option>
              {users.filter((user) => Boolean(user.active)).map((user) => <option key={text(user, "id")} value={text(user, "id")}>{text(user, "display_name")}</option>)}
            </select>
            {hasRetrySelection && <button type="button" disabled={assigning} onClick={() => void requeueSelected()} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">Ready + unassign</button>}
            {statusFilter === "archived" ? (
              <button
                type="button"
                disabled={assigning}
                onClick={() => void restoreSelected()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs disabled:opacity-50"
              >
                <Icon name="restore" className="h-3.5 w-3.5" />
                <span>Restore ({selectedIds.length}) to Lead List</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={assigning}
                onClick={() => void archiveSelected()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shadow-xs disabled:opacity-50"
              >
                <Icon name="archive" className="h-3.5 w-3.5" />
                <span>Archive ({selectedIds.length})</span>
              </button>
            )}
            <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-2 py-2 text-xs font-bold text-[#64748b]">Clear</button>
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
        <div className="text-xs text-[#64748b]">
          {leads.length} shown
          {assigneeFilter === "me"
            ? " (Assigned to You)"
            : assigneeFilter === "unassigned"
            ? " (Unassigned Pool)"
            : assigneeFilter !== "all"
            ? ` (Assigned to ${users.find((u) => text(u, "id") === assigneeFilter)?.display_name || "Setter"})`
            : ""}
          {" · "}{lists.length} lists · Drag checkboxes or Shift-click a range
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-[.12em] text-[#64748b]"><th className="w-12 px-4 py-3"><input aria-label="Select all shown leads" type="checkbox" checked={allShownSelected} onChange={toggleShown}/></th><th className="px-3 py-3">Prospect</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last call</th><th className="px-3 py-3">Setter</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{leads.map((lead) => {
        const owner = getBusinessOwner(lead);
        const comp = text(lead, "company");
        return (
          <tr key={text(lead, "id")} className="group hover:bg-[#f8fafc]">
            <td className="px-4 py-3">
              <LeadSelectionCheckbox
                checked={selectedIds.includes(text(lead, "id"))}
                label={`Select ${leadName(lead)}`}
                onToggle={(shiftKey) => selection.toggleLead(text(lead, "id"), shiftKey)}
                onDragStart={(shiftKey) => selection.startDragging(text(lead, "id"), shiftKey)}
                onDragEnter={() => selection.enterWhileDragging(text(lead, "id"))}
              />
            </td>
            <td className="px-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={owner || leadName(lead)}/>
                <div className="min-w-0 max-w-[300px]">
                  {comp ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={googleSearchUrl(comp, text(lead, "city"), text(lead, "state"))}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Search "${comp}" on Google`}
                        className="font-bold text-sm text-[#0f172a] hover:text-[#1266c4] hover:underline inline-flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{comp}</span>
                        <Icon name="external" className="h-3 w-3 text-[#1266c4] shrink-0" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-[#0f172a] truncate">{leadName(lead)}</div>
                  )}
                  {owner ? (
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#334155]">
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1]">Owner</span>
                      <span className="font-semibold text-[#0f172a] truncate">{owner}</span>
                    </div>
                  ) : null}
                  {text(lead, "title") && (
                    <div className="truncate text-[11px] text-[#64748b]">{text(lead, "title")}</div>
                  )}
                  {text(lead, "notes") && (
                    <div className="truncate text-xs text-[#475569] mt-0.5" title={text(lead, "notes")}>
                      <span className="font-semibold text-[#1266c4]">Note:</span> {text(lead, "notes")}
                    </div>
                  )}
                </div>
              </div>
            </td>
            <td className="px-3 py-3">
              <div className="text-sm font-semibold text-[#0f172a]">{formatPhone(lead.phone_e164)}</div>
              <div className="mt-0.5 text-[11px] text-[#64748b]">{localTime(lead)} local</div>
            </td>
            <td className="px-3 py-3">
              <StatusBadge status={text(lead, "disposition") || text(lead, "status")}/>
            </td>
            <td className="px-3 py-3">
              <div className="text-xs font-medium text-[#0f172a]">{formatDate(lead.last_call_at)}</div>
              <div className="text-[11px] text-[#64748b]">{number(lead, "call_attempts")} call{number(lead, "call_attempts") === 1 ? "" : "s"}</div>
            </td>
            <td className="px-3 py-3 text-xs text-[#475569]">{text(lead, "assigned_name") || "Unassigned"}</td>
            <td className="px-3 py-3 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {Boolean(lead.archived) ? (
                  <button
                    title="Restore lead to active list"
                    onClick={(e) => { e.stopPropagation(); void restoreSingleLead(text(lead, "id")); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
                  >
                    <Icon name="restore" className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </button>
                ) : (
                  <>
                    <button
                      disabled={Boolean(lead.do_not_call) || text(lead, "status") === "closed"}
                      onClick={() => onDial(lead)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5fc] px-3 py-2 text-xs font-bold text-[#1266c4] hover:bg-[#e1effb] transition disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
                    >
                      <Icon name="phone" className="h-3.5 w-3.5"/>Dial
                    </button>
                    <button
                      title="Archive lead"
                      onClick={(e) => { e.stopPropagation(); void archiveSingleLead(text(lead, "id")); }}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                      <Icon name="archive" className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  title="Delete lead"
                  onClick={(e) => { e.stopPropagation(); if (onRequestDeleteLead) onRequestDeleteLead(text(lead, "id"), leadName(lead)); }}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        );
      })}{!leads.length && <tr><td colSpan={7}><Empty message={allLeads.length ? "No leads match these filters." : "Import a CSV or add your first lead to begin."}/></td></tr>}</tbody></table></div>
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

function EditCallNoteModal({
  call,
  onClose,
  onDone,
}: {
  call: Row;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [notes, setNotes] = useState(text(call, "notes") || text(call, "lead_notes") || "");
  const [disposition, setDisposition] = useState(text(call, "disposition") || "contacted");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const callId = text(call, "id");
  const comp = text(call, "company");
  const owner = getBusinessOwner(call);
  const name = owner || leadName(call);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/api/dialer/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, disposition, syncLead: true }),
      });
      onDone("Call log and notes updated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update call log.");
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Call Log & Notes"
      description={comp ? `${comp}${owner ? ` · ${owner}` : ""}` : name}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d5e3f1] bg-[#f8fbfe] p-3 text-xs text-[#334155]">
          <span>Date: <strong>{formatDate(call.started_at)}</strong></span>
          <span>·</span>
          <span>Duration: <strong>{number(call, "duration_seconds") ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}` : "0s"}</strong></span>
          <span>·</span>
          <span className="capitalize">Direction: <strong>{text(call, "direction")}</strong></span>
          {text(call, "user_name") && <span>· Rep: <strong>{text(call, "user_name")}</strong></span>}
        </div>

        <Field label="Call Outcome / Disposition">
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
            className={inputClass}
          >
            {DISPOSITIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Call Notes">
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} min-h-[100px] resize-none text-base sm:text-sm py-2`}
            placeholder="Type notes on what happened, key objections, decision maker comments, quote details…"
          />
        </Field>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Call Log"}
          </PrimaryButton>
        </div>
      </form>
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
  const [editNoteCall, setEditNoteCall] = useState<Row | null>(null);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      const q = query.toLowerCase();
      const matchesSearch = !query || `${leadName(call)} ${text(call, "company")} ${getBusinessOwner(call)} ${text(call, "notes")} ${text(call, "lead_notes")} ${text(call, "disposition")} ${text(call, "to_number")} ${text(call, "from_number")} ${text(call, "user_name")}`.toLowerCase().includes(q);
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contact, company, notes, phone, outcome…" className="min-h-11 w-full rounded-xl border border-[#d0dbe7] bg-[#f8fafc] py-2.5 pl-9 pr-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]"/>
          </div>
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {visible.map((call) => {
            const owner = getBusinessOwner(call);
            const comp = text(call, "company");
            const callNote = text(call, "notes") || text(call, "lead_notes");
            return (
              <article key={text(call, "id")} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={owner || leadName(call)}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {comp ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={googleSearchUrl(comp, text(call, "city"), text(call, "state"))}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Search "${comp}" on Google`}
                              className="truncate text-sm font-bold text-[#0f172a] hover:text-[#1266c4] hover:underline inline-flex items-center gap-1"
                            >
                              <span>{comp}</span>
                              <Icon name="external" className="h-3 w-3 text-[#1266c4] shrink-0" />
                            </a>
                          </div>
                        ) : (
                          <h2 className="truncate text-sm font-bold text-[#0f172a]">{leadName(call)}</h2>
                        )}
                        {owner ? (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-[#334155]">
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1]">Owner</span>
                            <span className="font-semibold text-[#0f172a] truncate">{owner}</span>
                          </div>
                        ) : (
                          <p className="truncate text-xs text-[#64748b]">{formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}</p>
                        )}
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
                  <div className="mt-1 font-semibold text-[#0f172a]">{number(call, "duration_seconds") ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}` : "0s"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Started</div>
                  <div className="mt-1 font-semibold text-[#0f172a]">{formatDate(call.started_at)}</div>
                </div>
              </div>

              {/* Dedicated Call Notes Box */}
              <div className="rounded-xl border border-[#d5e3f1] bg-[#f8fbfe] p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1266c4] flex items-center gap-1">
                    <Icon name="check" className="h-3 w-3" />
                    <span>Call Notes</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditNoteCall(call)}
                    className="text-xs font-bold text-[#1266c4] hover:underline inline-flex items-center gap-1"
                  >
                    <Icon name={callNote ? "sliders" : "plus"} className="h-3 w-3" />
                    <span>{callNote ? "Edit note" : "+ Add note"}</span>
                  </button>
                </div>
                {callNote ? (
                  <p className="text-xs text-[#0f172a] whitespace-pre-wrap break-words leading-relaxed font-medium">
                    {callNote}
                  </p>
                ) : (
                  <p className="text-xs text-[#94a3b8] italic">No notes logged for this call.</p>
                )}
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
          );
        })}
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

    {editNoteCall && (
      <EditCallNoteModal
        call={editNoteCall}
        onClose={() => setEditNoteCall(null)}
        onDone={(msg) => {
          setEditNoteCall(null);
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
  const [editNoteCall, setEditNoteCall] = useState<Row | null>(null);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      const q = query.toLowerCase();
      const matchesSearch = !query || `${leadName(call)} ${text(call, "company")} ${getBusinessOwner(call)} ${text(call, "notes")} ${text(call, "lead_notes")} ${text(call, "disposition")} ${text(call, "to_number")} ${text(call, "from_number")} ${text(call, "user_name")}`.toLowerCase().includes(q);
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
            placeholder="Search contact, company, notes, phone, rep, outcome…"
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
        <table className="w-full min-w-[1100px] text-left">
          <thead>
            <tr className="bg-[#f8fafc] text-[10px] uppercase tracking-[.12em] text-[#64748b] border-b border-[#e2e8f0]">
              <th className="px-5 py-3">Contact</th>
              <th className="px-4 py-3">Rep (Caller)</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3 min-w-[240px]">Call Notes</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3 min-w-[280px]">Recording</th>
              <th className="px-5 py-3 text-right">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {visible.map((call) => {
              const owner = getBusinessOwner(call);
              const comp = text(call, "company");
              const callNote = text(call, "notes") || text(call, "lead_notes");
              return (
                <tr key={text(call, "id")} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={owner || leadName(call)}/>
                      <div className="min-w-0 max-w-[260px]">
                        {comp ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={googleSearchUrl(comp, text(call, "city"), text(call, "state"))}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Search "${comp}" on Google`}
                              className="text-sm font-semibold text-[#0f172a] hover:text-[#1266c4] hover:underline inline-flex items-center gap-1 truncate"
                            >
                              <span className="truncate">{comp}</span>
                              <Icon name="external" className="h-3 w-3 text-[#1266c4] shrink-0" />
                            </a>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-[#0f172a] truncate">{leadName(call)}</div>
                        )}
                        {owner ? (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-[#334155]">
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1]">Owner</span>
                            <span className="font-semibold text-[#0f172a] truncate">{owner}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-[#64748b]">
                            {formatPhone(text(call, "direction") === "inbound" ? call.from_number : call.to_number)}
                          </div>
                        )}
                      </div>
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
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setEditNoteCall(call)}
                    title="Change call outcome"
                    className="hover:opacity-80 transition cursor-pointer"
                  >
                    <StatusBadge status={text(call, "disposition") || text(call, "status")}/>
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  {callNote ? (
                    <div className="flex items-start justify-between gap-2 rounded-xl border border-[#d5e3f1] bg-[#f8fbfe] p-2 text-xs">
                      <p className="min-w-0 flex-1 font-medium text-[#0f172a] whitespace-pre-wrap break-words line-clamp-2 hover:line-clamp-none transition">
                        {callNote}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditNoteCall(call)}
                        title="Edit call notes"
                        className="shrink-0 p-1 text-[#64748b] hover:text-[#1266c4] hover:bg-white rounded transition"
                      >
                        <Icon name="sliders" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditNoteCall(call)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1266c4] hover:underline px-2.5 py-1 rounded-lg hover:bg-[#edf5fc] transition"
                    >
                      <Icon name="plus" className="h-3 w-3" />
                      <span>Add note</span>
                    </button>
                  )}
                </td>
                <td className="px-4 py-3.5 text-xs text-[#334155]">
                  {number(call, "duration_seconds")
                    ? `${Math.floor(number(call, "duration_seconds") / 60)}:${String(number(call, "duration_seconds") % 60).padStart(2, "0")}`
                    : "0s"}
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
            );
          })}
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

    {editNoteCall && (
      <EditCallNoteModal
        call={editNoteCall}
        onClose={() => setEditNoteCall(null)}
        onDone={(msg) => {
          setEditNoteCall(null);
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
  return <><PageHeader eyebrow="Pipeline" title="Lead pipeline" description="A compact board organized by the next action your team needs to take." action={onOpenDialpad ? <SecondaryButton onClick={onOpenDialpad}><Icon name="dialpad"/>Keypad</SecondaryButton> : undefined}/><div className="grid gap-4 lg:grid-cols-4">{columns.map(([status, label]) => { const items = leads.filter((lead) => text(lead, "status") === status); return <section key={status} className="rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9]/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-bold text-[#0f172a]">{label}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#64748b] border border-[#e2e8f0]">{items.length}</span></div><div className="space-y-3">{items.slice(0, 100).map((lead) => {
  const owner = getBusinessOwner(lead);
  const comp = text(lead, "company");
  return (
    <div key={text(lead, "id")} className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-xs">
      <div className="flex items-start gap-2">
        <Avatar name={owner || leadName(lead)}/>
        <div className="min-w-0 flex-1">
          {comp ? (
            <a
              href={googleSearchUrl(comp, text(lead, "city"), text(lead, "state"))}
              target="_blank"
              rel="noopener noreferrer"
              title={`Search "${comp}" on Google`}
              className="truncate text-sm font-bold text-[#0f172a] hover:text-[#1266c4] hover:underline inline-flex items-center gap-1 max-w-full"
            >
              <span className="truncate">{comp}</span>
              <Icon name="external" className="h-3 w-3 text-[#1266c4] shrink-0" />
            </a>
          ) : (
            <div className="truncate text-sm font-semibold text-[#0f172a]">{leadName(lead)}</div>
          )}
          {owner ? (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-[#334155]">
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1]">Owner</span>
              <span className="font-semibold text-[#0f172a] truncate">{owner}</span>
            </div>
          ) : (
            <div className="truncate text-xs text-[#64748b]">{formatPhone(lead.phone_e164)}</div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <StatusBadge status={text(lead, "disposition") || status}/>
        <div className="flex items-center gap-1">
          {status !== "closed" && (
            <button onClick={() => onDial(lead)} className="rounded-full bg-[#edf5fc] p-2 text-[#1266c4] hover:bg-[#e1effb] transition">
              <Icon name="phone" className="h-3.5 w-3.5"/>
            </button>
          )}
          <button title="Delete lead" onClick={() => onDeleteLead && onDeleteLead(text(lead, "id"), leadName(lead))} className="rounded-full p-2 text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition">
            <Icon name="trash" className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>
    </div>
  );
})}</div></section>; })}</div></>;
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
const inputClass = "min-w-0 max-w-full w-full rounded-xl border border-[#d0dbe7] bg-white px-3 py-2.5 text-base sm:text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#5d9bd3] focus:ring-2 focus:ring-[#d9eaf8]";

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

function ManualDialModal({ onClose, onPrepare, onDial }: { onClose: () => void; onPrepare: () => Promise<VoiceDevice>; onDial: (lead: Row) => void }) {
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
      // Keep permission and Twilio registration attached to this explicit tap on mobile browsers.
      await onPrepare();
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

function CallDock({
  lead,
  phase,
  error,
  disposition,
  setDisposition,
  notes,
  setNotes,
  callbackAt,
  setCallbackAt,
  autoDial,
  setAutoDial,
  onEnd,
  onSendDigit,
  onSave,
  onClose,
}: {
  lead: Row;
  phase: CallPhase;
  error: string;
  disposition: string;
  setDisposition: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  callbackAt: string;
  setCallbackAt: (value: string) => void;
  autoDial: boolean;
  setAutoDial: (value: boolean) => void;
  onEnd: () => void;
  onSendDigit: (digit: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [isDocked, setIsDocked] = useState(false);
  const [showAllCsv, setShowAllCsv] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);

  const active = ["connecting", "ringing", "open"].includes(phase);

  useEffect(() => {
    if (phase !== "open") {
      if (phase === "connecting" || phase === "ringing") setCallSeconds(0);
      return;
    }
    const timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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

  const company = text(lead, "company");
  const ownerName = getBusinessOwner(lead);
  const title = text(lead, "title");
  const phone = formatPhone(lead.phone_e164);
  const city = text(lead, "city");
  const state = text(lead, "state");
  const postalCode = text(lead, "postal_code");

  const meta = (lead.metadata || {}) as Record<string, unknown>;
  const address = text(meta, "address");
  const county = text(meta, "county");
  const trade = text(meta, "trade") || text(meta, "license_type");
  const website = text(meta, "website");
  const licenseNumber = text(meta, "license_number");
  const licenseStatus = text(meta, "license_status");
  const licenseAge = text(meta, "license_age_days");
  const sunbizEntity = text(meta, "sunbiz_entity");
  const sunbizDoc = text(meta, "sunbiz_doc_number");
  const sunbizOfficer = text(meta, "sunbiz_officer");
  const googleReviews = text(meta, "google_reviews");
  const googlePlaceUrl = text(meta, "google_places_url");
  const operatingHours = text(meta, "operating_hours");
  const runningAds = text(meta, "running_google_ads");
  const painPoint = text(meta, "speed_to_lead_hook");
  const leadNotes = text(lead, "notes");
  const allCsvFields = (meta.all_csv_fields || {}) as Record<string, string>;
  const rawCsvKeys = Object.keys(allCsvFields);

  // Minimized bottom dock view (floats above mobile bottom navigation)
  if (isDocked) {
    return (
      <div className="fixed inset-x-2 sm:inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] lg:bottom-4 z-[70] mx-auto max-w-4xl rounded-2xl border border-[#9ebbd6] bg-gradient-to-r from-[#123b70] via-[#14579a] to-[#1266c4] p-3 sm:p-4 text-white shadow-2xl flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-full ${phase === "open" ? "animate-pulse bg-emerald-500 text-white" : "bg-white/15"}`}>
            <Icon name="phone" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {company ? (
                <a
                  href={googleSearchUrl(company, city, state)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white hover:underline truncate max-w-[150px] sm:max-w-xs flex items-center gap-1 text-xs sm:text-sm"
                  title={`Search "${company}" on Google`}
                >
                  <span className="truncate">{company}</span>
                  <Icon name="external" className="h-3 w-3 text-white/80 shrink-0" />
                </a>
              ) : (
                <span className="font-bold text-white truncate text-xs sm:text-sm">{ownerName || leadName(lead)}</span>
              )}
              {ownerName && company && (
                <span className="text-[11px] text-white/80 truncate">({ownerName})</span>
              )}
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                {phase === "open" ? `Live ${formatDuration(callSeconds)}` : phase}
              </span>
            </div>
            <div className="text-[11px] text-white/75 truncate mt-0.5">
              {phone} · {localTime(lead)} local
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsDocked(false)}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/15 hover:bg-white/25 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white transition border border-white/20 shadow-xs active:scale-95"
            title="Expand Active Call Screen"
          >
            <Icon name="maximize" className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Active Call</span>
          </button>
          {active && (
            <button
              onClick={onEnd}
              className="min-h-9 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 px-3 sm:px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition"
            >
              {phase === "open" ? "End" : "Skip"}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close call dock"
            className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Full Active Call Screen (Full-height sheet on mobile, centered modal on desktop)
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[94dvh] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col border-t sm:border border-[#b8d0e6] shadow-[0_25px_80px_rgba(18,59,112,.35)] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Dynamic Top Banner */}
        <div className="bg-gradient-to-r from-[#123b70] via-[#14579a] to-[#1266c4] px-3.5 py-3 sm:px-6 sm:py-3.5 text-white shrink-0 shadow-md">
          <div className="sm:hidden mx-auto w-10 h-1 rounded-full bg-white/35 mb-2.5" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider shrink-0 ${
                phase === "open"
                  ? "bg-emerald-500 text-white animate-pulse"
                  : phase === "connecting"
                  ? "bg-amber-400 text-slate-900"
                  : phase === "ringing"
                  ? "bg-cyan-400 text-slate-900 animate-pulse"
                  : "bg-white/20 text-white"
              }`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                <span>{phase === "open" ? `Live · ${formatDuration(callSeconds)}` : phase === "connecting" ? "Connecting…" : phase === "ringing" ? "Ringing…" : "Call Ended"}</span>
              </span>
              <span className="hidden md:inline-block text-xs text-white/80 truncate">
                {localTime(lead)} local
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {active && (
                <button
                  type="button"
                  onClick={() => setKeypadOpen((current) => !current)}
                  className={`inline-flex min-h-8 sm:min-h-9 items-center gap-1 sm:gap-1.5 rounded-xl px-2.5 sm:px-3 py-1 text-xs font-bold transition shadow-xs active:scale-95 ${
                    keypadOpen ? "bg-white text-[#1266c4]" : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
                  }`}
                >
                  <Icon name="dialpad" className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline sm:inline">Keypad</span>
                  {sentDigits && <span className="rounded-full bg-blue-100 text-[#1266c4] px-1 text-[10px] font-mono">{sentDigits.slice(-3)}</span>}
                </button>
              )}
              {active && (
                <button
                  onClick={onEnd}
                  className="min-h-8 sm:min-h-9 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 px-3 sm:px-4 py-1 text-xs font-black text-white shadow-xs transition"
                >
                  {phase === "open" ? "End Call" : "Skip"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDocked(true)}
                title="Minimize to bottom dock"
                className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition"
              >
                <Icon name="minimize" className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                title="Close active call screen"
                className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Intelligence Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-3.5 bg-gradient-to-b from-[#f8fafc] to-white">
          {/* Header Card: Company with Google Search & Business Owner */}
          <div className="rounded-2xl border border-[#d5e3f1] bg-white p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#64748b]">
                    Active Prospect
                  </span>
                  {state && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                      {state}
                    </span>
                  )}
                </div>
                {company ? (
                  <div className="space-y-1.5">
                    <h1 className="text-lg sm:text-2xl font-black text-[#0f172a] leading-tight break-words">
                      {company}
                    </h1>
                    <div>
                      <a
                        href={googleSearchUrl(company, city, state)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Search "${company}" on Google`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5fc] px-2.5 py-1 text-xs font-bold text-[#1266c4] border border-[#b8d0e6] hover:bg-[#e1effb] active:scale-95 transition"
                      >
                        <Icon name="search" className="h-3 w-3 shrink-0" />
                        <span>Search Google</span>
                        <Icon name="external" className="h-3 w-3 shrink-0 opacity-70" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <h1 className="text-lg sm:text-2xl font-black text-[#0f172a] break-words leading-tight">
                    {ownerName || leadName(lead)}
                  </h1>
                )}

                {/* Business Owner Highlight Card */}
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-2.5 sm:p-3">
                  <Avatar name={ownerName || leadName(lead)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                        Business Owner:
                      </span>
                      <span className="text-sm font-black text-[#0f172a] break-words">
                        {ownerName || "Not listed on file"}
                      </span>
                      {ownerName && (
                        <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Verified
                        </span>
                      )}
                      {title && <span className="text-xs text-[#64748b]">({title})</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475569]">
                      <a href={`tel:${text(lead, "phone_e164")}`} className="font-bold text-[#1266c4] hover:underline inline-flex items-center gap-1">
                        <Icon name="phone" className="h-3 w-3" />
                        {phone}
                      </a>
                      {city || state ? <span>· {[city, state].filter(Boolean).join(", ")}</span> : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Website and Google Links */}
              <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto">
                {website && (
                  <a
                    href={website.startsWith("http") ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#b8d0e6] bg-[#edf5fc] px-3 py-1.5 text-xs font-bold text-[#1266c4] hover:bg-[#e1effb] active:scale-95 transition flex-1 sm:flex-initial"
                  >
                    <Icon name="globe" className="h-3.5 w-3.5 shrink-0" />
                    <span>Company Website</span>
                    <Icon name="external" className="h-3 w-3 shrink-0 opacity-70" />
                  </a>
                )}
                {googlePlaceUrl && (
                  <a
                    href={googlePlaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:border-[#b8d0e6] active:scale-95 transition flex-1 sm:flex-initial"
                  >
                    <Icon name="search" className="h-3.5 w-3.5 text-[#1266c4] shrink-0" />
                    <span>Google Reviews</span>
                    <Icon name="external" className="h-3 w-3 shrink-0 opacity-70" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Sales Hook & Paid Ad Pain Point Callout (from CSV) */}
          {(painPoint || operatingHours || runningAds || leadNotes) && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500 text-white font-black text-xs shadow-xs">
                  ★
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Lead Intelligence & Sales Angle (from CSV)
                  </div>
                  {painPoint && (
                    <div className="mt-1 text-sm font-semibold text-[#0f172a] leading-snug break-words">
                      {painPoint}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-amber-950/85">
                    {operatingHours && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" className="h-3 w-3 text-amber-700 shrink-0" />
                        <span><strong>Hours:</strong> {operatingHours}</span>
                      </span>
                    )}
                    {runningAds && (
                      <span>
                        <strong>Google Ads:</strong> {runningAds}
                      </span>
                    )}
                  </div>
                  {leadNotes && (
                    <div className="mt-2 text-xs text-[#334155] border-t border-amber-200/60 pt-2 font-medium break-words">
                      <strong>{leadNotes.startsWith("Hook:") ? "Sales Hook:" : "Prospect Notes:"}</strong> {leadNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Business & CSV Data Cards Grid */}
          <div className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Trade & DBPR License Card */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-2xs space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Trade & Licensing (DBPR)
              </div>
              <div className="text-sm font-bold text-[#0f172a] break-words">
                {trade || "Contractor"}
              </div>
              {licenseNumber && (
                <div className="text-xs text-[#475569] break-words">
                  License: <span className="font-mono font-semibold text-[#0f172a]">{licenseNumber}</span>
                </div>
              )}
              {licenseStatus && (
                <div className="text-xs text-[#475569]">
                  Status: <span className="font-medium text-emerald-700">{licenseStatus}</span>
                </div>
              )}
              {licenseAge && (
                <div className="text-[11px] text-[#64748b]">
                  License age: {licenseAge} days
                </div>
              )}
            </div>

            {/* Location & Contact Card */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-2xs space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Physical Address
              </div>
              <div className="text-sm font-semibold text-[#0f172a] break-words">
                {address || "Address not provided"}
              </div>
              <div className="text-xs text-[#475569] break-words">
                {[city, state, postalCode].filter(Boolean).join(", ") || "Florida"}
              </div>
              {county && (
                <div className="text-[11px] text-[#64748b]">
                  County: {county}
                </div>
              )}
            </div>

            {/* Online Presence & Sunbiz Corporate Match */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-2xs space-y-1.5 sm:col-span-2 lg:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Sunbiz & Google Presence
              </div>
              {googleReviews && (
                <div className="text-xs font-semibold text-[#0f172a]">
                  ★ Reviews: <span className="text-[#1266c4] font-bold">{googleReviews} reviews</span>
                </div>
              )}
              {sunbizEntity && (
                <div className="text-xs text-[#475569] truncate" title={sunbizEntity}>
                  Entity: <span className="font-semibold text-[#0f172a]">{sunbizEntity}</span>
                </div>
              )}
              {sunbizOfficer && (
                <div className="text-[11px] text-[#64748b] truncate" title={sunbizOfficer}>
                  Officer: {sunbizOfficer}
                </div>
              )}
              {sunbizDoc && (
                <div className="text-[11px] text-[#64748b]">
                  Doc #: {sunbizDoc}
                </div>
              )}
            </div>
          </div>

          {/* Expandable Full CSV Raw Fields Drawer */}
          {rawCsvKeys.length > 0 && (
            <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowAllCsv((prev) => !prev)}
                className="w-full min-h-11 flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#475569] hover:bg-[#f8fafc] active:bg-[#f1f5f9] transition"
              >
                <span>All CSV Data Fields ({rawCsvKeys.length} columns imported)</span>
                <span className="text-[#1266c4]">{showAllCsv ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showAllCsv && (
                <div className="border-t border-[#e2e8f0] p-3 max-h-56 overflow-y-auto overscroll-contain bg-[#f8fafc]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {rawCsvKeys.map((key) => (
                      <div key={key} className="rounded-lg bg-white p-2.5 border border-[#e2e8f0]">
                        <span className="font-bold text-[#64748b] block text-[10px] uppercase truncate">{key}</span>
                        <span className="text-[#0f172a] font-medium break-words block mt-0.5">{allCsvFields[key] || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DTMF In-Call Keypad (if toggled) */}
          {keypadOpen && active && (
            <div className="rounded-2xl border border-[#b8d0e6] bg-[#f5f9fd] p-4 text-center animate-in fade-in duration-150">
              <div className="text-xs font-bold text-[#173d6b] uppercase tracking-wider mb-1">
                In-call Keypad (DTMF Phone Trees)
              </div>
              <p className="text-[11px] text-[#64748b] mb-3">
                Tap numbers to navigate automated phone options (e.g. press 1 for dispatch).
              </p>
              {sentDigits && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-white border border-[#d5e3f1] px-3 py-1 text-xs">
                  <span className="text-[#64748b]">Sent:</span>
                  <span className="font-mono font-bold text-[#1266c4] tracking-widest">{sentDigits}</span>
                  <button type="button" onClick={() => setSentDigits("")} className="text-[10px] text-[#94a3b8] hover:text-[#1266c4]">Clear</button>
                </div>
              )}
              <PhoneKeypad onPress={handleDigit} disabled={phase !== "open"} />
            </div>
          )}
        </div>

        {/* Action & Disposition Footer */}
        <div className="border-t border-[#d5e3f1] bg-white p-3.5 sm:p-5 shrink-0 shadow-lg space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-[200px_1fr_auto] items-end">
            <Field label="Call Outcome">
              <select
                value={disposition}
                onChange={(event) => setDisposition(event.target.value)}
                className={`${inputClass} min-h-11 text-base sm:text-sm`}
              >
                {DISPOSITIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Live Call Notes">
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={`${inputClass} min-h-[50px] resize-none text-base sm:text-sm py-2`}
                placeholder="What happened on the call? Type notes here…"
              />
            </Field>

            <button
              type="button"
              onClick={onSave}
              disabled={active}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1266c4] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#0f57aa] active:scale-95 transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 w-full sm:w-auto shrink-0"
            >
              Save &amp; {autoDial ? "Dial Next" : "Close"}
            </button>
          </div>

          {(disposition === "callback" || disposition === "appointment") && (
            <div className="border-t border-[#e2e8f0] pt-2.5">
              <Field label="Callback / Appointment Time">
                <input
                  type="datetime-local"
                  value={callbackAt}
                  onChange={(event) => setCallbackAt(event.target.value)}
                  className={`${inputClass} min-h-11 text-base sm:text-sm max-w-sm`}
                />
              </Field>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-[#f1f5f9]">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#475569] cursor-pointer min-h-8">
              <input
                type="checkbox"
                checked={autoDial}
                onChange={(event) => setAutoDial(event.target.checked)}
                className="h-4 w-4 rounded border-[#cbd5e1] text-[#1266c4] focus:ring-[#1266c4]"
              />
              <span>Automatically dial the next eligible lead after saving outcome</span>
            </label>
            {error && <span className="text-xs font-bold text-red-600">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomingCall({ call, onAccept, onClose }: { call: VoiceCall; onAccept: () => void; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [sentDigits, setSentDigits] = useState("");
  const accept = () => { onAccept(); call.accept(); setAccepted(true); };
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
