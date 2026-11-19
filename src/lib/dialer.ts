import { sql } from "@/lib/db";

export const LEAD_STATUSES = ["to_call", "try_again", "follow_up", "closed"] as const;
export const DISPOSITIONS = [
  "no_answer",
  "voicemail",
  "busy",
  "failed",
  "contacted",
  "interested",
  "callback",
  "appointment",
  "not_interested",
  "wrong_number",
  "dnc",
  "converted",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type Disposition = (typeof DISPOSITIONS)[number];

const STATE_TIMEZONES: Record<string, string> = {
  FL: "America/New_York", GA: "America/New_York", SC: "America/New_York", NC: "America/New_York",
  VA: "America/New_York", WV: "America/New_York", DC: "America/New_York", MD: "America/New_York",
  DE: "America/New_York", PA: "America/New_York", NJ: "America/New_York", NY: "America/New_York",
  CT: "America/New_York", RI: "America/New_York", MA: "America/New_York", VT: "America/New_York",
  NH: "America/New_York", ME: "America/New_York", OH: "America/New_York", MI: "America/Detroit",
  IN: "America/Indiana/Indianapolis", KY: "America/Kentucky/Louisville", TN: "America/Chicago",
  AL: "America/Chicago", MS: "America/Chicago", LA: "America/Chicago", AR: "America/Chicago",
  TX: "America/Chicago", OK: "America/Chicago", KS: "America/Chicago", NE: "America/Chicago",
  SD: "America/Chicago", ND: "America/Chicago", MN: "America/Chicago", IA: "America/Chicago",
  MO: "America/Chicago", WI: "America/Chicago", IL: "America/Chicago", CO: "America/Denver",
  WY: "America/Denver", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver",
  AZ: "America/Phoenix", ID: "America/Boise", NV: "America/Los_Angeles", CA: "America/Los_Angeles",
  OR: "America/Los_Angeles", WA: "America/Los_Angeles", AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

export function normalizePhone(value: string): string | null {
  const cleaned = value.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+") && cleaned.length >= 9 && cleaned.length <= 16) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

export function timezoneForState(state?: string | null) {
  return STATE_TIMEZONES[(state || "").trim().toUpperCase()] || "America/New_York";
}

export function statusForDisposition(disposition: Disposition): LeadStatus {
  if (["no_answer", "voicemail", "busy", "failed"].includes(disposition)) return "try_again";
  if (["contacted", "interested", "callback", "appointment"].includes(disposition)) return "follow_up";
  return "closed";
}

export function nextAttemptForDisposition(disposition: Disposition, callbackAt?: string | null) {
  if (callbackAt) return new Date(callbackAt);
  const date = new Date();
  if (disposition === "no_answer" || disposition === "busy" || disposition === "failed") {
    date.setHours(date.getHours() + 4);
    return date;
  }
  if (disposition === "voicemail") {
    date.setDate(date.getDate() + 1);
    return date;
  }
  return null;
}

export async function addActivity(input: {
  leadId?: string | null;
  userId?: string | null;
  type: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await sql`
    INSERT INTO dialer_activities (lead_id, user_id, activity_type, summary, metadata)
    VALUES (${input.leadId || null}, ${input.userId || null}, ${input.type}, ${input.summary}, ${JSON.stringify(input.metadata || {})})
  `;
}

export async function leadIsCallable(leadId: string) {
  const rows = await sql`
    SELECT l.*, d.id AS dnc_match
    FROM dialer_leads l
    LEFT JOIN dialer_dnc d ON d.phone_e164 = l.phone_e164
    WHERE l.id = ${leadId}
    LIMIT 1
  `;
  const lead = rows[0];
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (lead.do_not_call || lead.dnc_match) return { ok: false as const, error: "This number is on the DNC list." };
  if (lead.status === "closed") return { ok: false as const, error: "This lead is closed." };

  const settingsRows = await sql`SELECT value FROM dialer_settings WHERE key = 'workspace' LIMIT 1`;
  const settings = (settingsRows[0]?.value || {}) as {
    callWindowStart?: string;
    callWindowEnd?: string;
    maxDailyAttempts?: number;
    guardrailsEnabled?: boolean;
    enforceCallingWindow?: boolean;
    allowWeekendCalling?: boolean;
    enforceDailyLimit?: boolean;
  };

  const guardrailsActive = settings.guardrailsEnabled !== false;

  if (guardrailsActive && settings.enforceCallingWindow !== false) {
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: lead.timezone || "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }).formatToParts(new Date());
    } catch {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }).formatToParts(new Date());
    }

    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    const weekday = parts.find((part) => part.type === "weekday")?.value || "";
    const localMinutes = hour * 60 + minute;
    const parseClock = (value: string | undefined, fallback: number) => {
      if (!value) return fallback;
      const [h, m] = value.split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : fallback;
    };

    if (
      localMinutes < parseClock(settings.callWindowStart, 8 * 60) ||
      localMinutes >= parseClock(settings.callWindowEnd, 20 * 60)
    ) {
      return { ok: false as const, error: "Outside the configured local calling window." };
    }

    if (settings.allowWeekendCalling === false && (weekday === "Sat" || weekday === "Sun")) {
      return { ok: false as const, error: "Weekend calling is currently restricted by workspace guardrails." };
    }
  }

  if (guardrailsActive && settings.enforceDailyLimit !== false) {
    const attempts = await sql`
      SELECT COUNT(*)::int AS count FROM dialer_calls
      WHERE lead_id = ${leadId} AND direction = 'outbound' AND started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `;
    if (Number(attempts[0]?.count || 0) >= Number(settings.maxDailyAttempts || 3)) {
      return { ok: false as const, error: "Daily attempt limit reached for this lead." };
    }
  }

  return { ok: true as const, lead };
}

