import { createHash } from "node:crypto";
import { Resend, type EmailReceivedEvent, type GetReceivingEmailResponseSuccess } from "resend";
import { sql } from "@/lib/db";
import { ingestOpportunityBatch } from "@/lib/opportunity-ingestion";
import {
  persistOpportunitySupplemental,
  type LiveSourceRecord,
} from "@/lib/opportunity-live-sources";
import { plainHtml, storeOpportunityDocumentContent } from "@/lib/opportunity-documents";

type Row = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<Row[]> };
const queryDb = (query: string, params: unknown[] = []) =>
  (sql as unknown as Queryable).query(query, params);

type PortalSource = "opengov" | "demandstar" | "unknown";

export interface ProcurementNoticeInput {
  providerMessageId: string;
  internetMessageId?: string | null;
  from: string;
  to: string[];
  subject: string;
  receivedAt: string;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string>;
}

export interface ParsedProcurementOpportunity {
  sourceId: string;
  sourceRecordId: string;
  title: string;
  summary: string;
  solicitationNumber: string;
  purchasingOrganization: string;
  sourceUrl: string;
  county: string | null;
  city: string | null;
  tradeSlug: string;
  status: "active" | "expired" | "cancelled" | "awarded" | "needs_review";
  deadline: string | null;
  amendments: Row[];
}

export interface ParsedProcurementNotice {
  portalSource: PortalSource;
  disposition: "accepted" | "ignored" | "needs_review";
  reason: string;
  senderAddress: string;
  opportunities: ParsedProcurementOpportunity[];
}

interface NoticeLink {
  url: string;
  label: string;
  context: string;
  portal: PortalSource;
}

const SOURCE_IDS: Record<Exclude<PortalSource, "unknown">, string> = {
  opengov: "portal-notice-opengov",
  demandstar: "portal-notice-demandstar",
};

const PORTAL_URLS: Record<Exclude<PortalSource, "unknown">, string> = {
  opengov: "https://procurement.opengov.com/",
  demandstar: "https://www.demandstar.com/",
};

const AGENCY_BY_PORTAL_SLUG: Record<string, { organization: string; county: string; city?: string }> = {
  orangecountyfl: { organization: "Orange County, Florida", county: "Orange" },
  orlando: { organization: "City of Orlando", county: "Orange", city: "Orlando" },
  goaa: { organization: "Greater Orlando Aviation Authority", county: "Orange", city: "Orlando" },
  apopka: { organization: "City of Apopka", county: "Orange", city: "Apopka" },
  stcloudfl: { organization: "City of St. Cloud", county: "Osceola", city: "St. Cloud" },
  stcloud: { organization: "City of St. Cloud", county: "Osceola", city: "St. Cloud" },
  osceolacountyfl: { organization: "Osceola County, Florida", county: "Osceola" },
  kissimmee: { organization: "City of Kissimmee", county: "Osceola", city: "Kissimmee" },
};

const TRADE_RULES: Array<[string, RegExp]> = [
  ["automation_controls", /building automation|\bbas\b|\bbms\b|ddc|bacnet|controls? system/i],
  ["monitoring", /remote monitoring|fault detection|diagnostic|sensor|telemetry/i],
  ["energy", /energy (?:audit|optimization|efficiency|management)|retro.?commission|demand response/i],
  ["refrigeration", /refrigerat|walk[ -]in cooler|walk[ -]in freezer|cold storage/i],
  ["hvac", /hvac|air condition|chiller|boiler|mechanical|cooling tower/i],
  ["roofing", /roof|waterproof|building envelope/i],
  ["electrical", /electrical|lighting|generator|traffic signal/i],
  ["fire_protection", /fire alarm|fire protection|sprinkler/i],
  ["plumbing", /plumbing|water treatment|wastewater|pump station/i],
  ["security", /security|access control|surveillance/i],
  ["property_maintenance", /maintenance|janitorial|lawn care|landscap|repair service/i],
  ["commercial_construction", /construction|renovation|replacement|improvement|demolition|resurfacing|drainage/i],
];

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function list(value: string | undefined, fallback: string[] = []) {
  const configured = value?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return configured?.length ? configured : fallback;
}

function emailAddress(value: string) {
  return (value.match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase();
}

function senderAllowed(sender: string, allowed: string[]) {
  const address = emailAddress(sender);
  const domain = address.split("@")[1] || "";
  return allowed.some((entry) => {
    const normalized = entry.replace(/^@/, "").toLowerCase();
    return entry.includes("@") ? address === entry.toLowerCase() : domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

function recipientAllowed(recipients: string[], allowed: string[]) {
  if (!allowed.length) return true;
  const addresses = recipients.map(emailAddress);
  return allowed.some((entry) => addresses.includes(emailAddress(entry)));
}

function failedAuthentication(headers: Record<string, string> = {}) {
  const auth = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === "authentication-results")
    .map(([, value]) => value).join(" ").toLowerCase();
  if (!auth) return false;
  if (/dmarc=fail/.test(auth)) return true;
  return /spf=fail/.test(auth) && /dkim=fail/.test(auth);
}

function portalForUrl(url: URL): PortalSource {
  const host = url.hostname.toLowerCase();
  if (host === "opengov.com" || host.endsWith(".opengov.com")) return "opengov";
  if (host === "demandstar.com" || host.endsWith(".demandstar.com")) return "demandstar";
  return "unknown";
}

function portalForMessage(sender: string, subject: string, links: NoticeLink[]): PortalSource {
  const senderDomain = emailAddress(sender).split("@")[1] || "";
  if (senderDomain === "opengov.com" || senderDomain.endsWith(".opengov.com") || /\bopengov\b/i.test(subject)) return "opengov";
  if (senderDomain === "demandstar.com" || senderDomain.endsWith(".demandstar.com") || /\bdemandstar\b/i.test(subject)) return "demandstar";
  const portals = new Set(links.map((link) => link.portal).filter((portal) => portal !== "unknown"));
  return portals.size === 1 ? Array.from(portals)[0] : "unknown";
}

function canonicalUrl(raw: string) {
  try {
    const url = new URL(raw.replace(/&amp;/gi, "&"));
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(?:utm_|mc_|mkt_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractNoticeLinks(html: string, text: string): NoticeLink[] {
  const results: NoticeLink[] = [];
  for (const match of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
    const normalized = canonicalUrl(match[1]);
    if (!normalized) continue;
    const url = new URL(normalized);
    const portal = portalForUrl(url);
    if (portal === "unknown") continue;
    const index = match.index || 0;
    results.push({
      url: normalized,
      label: plainHtml(match[2]),
      context: plainHtml(html.slice(Math.max(0, index - 500), index + match[0].length + 700)),
      portal,
    });
  }
  for (const match of Array.from(text.matchAll(/https?:\/\/[^\s<>"']+/gi))) {
    const normalized = canonicalUrl(match[0].replace(/[),.;]+$/, ""));
    if (!normalized) continue;
    const url = new URL(normalized);
    const portal = portalForUrl(url);
    if (portal === "unknown") continue;
    const index = match.index || 0;
    results.push({ url: normalized, label: "", context: text.slice(Math.max(0, index - 500), index + match[0].length + 700), portal });
  }
  const byUrl = new Map<string, NoticeLink>();
  for (const link of results) {
    const prior = byUrl.get(link.url);
    if (!prior || (!prior.label && link.label)) byUrl.set(link.url, link);
  }
  return Array.from(byUrl.values());
}

function opportunityLinks(links: NoticeLink[], portal: PortalSource) {
  const matching = links.filter((link) => link.portal === portal);
  const specific = matching.filter((link) =>
    /\/(?:projects?|bids?|solicitations?|opportunities?|procurements?|notices?)(?:\/|\?|$)/i.test(new URL(link.url).pathname + new URL(link.url).search),
  );
  return specific.length ? specific.slice(0, 30) : matching.slice(0, 1);
}

function easternIso(year: number, month: number, day: number, hour: number, minute: number) {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(target)).map((part) => [part.type, part.value]));
  const displayedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(target - (displayedAsUtc - target)).toISOString();
}

function parseDeadline(text: string) {
  const labelled = text.match(/(?:due date|response deadline|submission deadline|bid closing|closes?|responses? due)\s*(?:date)?\s*[:\-]?\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s+(?:et|est|edt))?)?|\d{1,2}\/\d{1,2}\/20\d{2}(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s+(?:et|est|edt))?)?)/i)?.[1];
  if (!labelled) return null;
  const value = labelled.replace(/\bat\b/i, " ").replace(/\b(?:ET|EST|EDT)\b/i, "").replace(/\./g, "").trim();
  const numeric = value.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  const named = value.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  let month: number; let day: number; let year: number; let hour: number; let minute: number; let meridiem: string | undefined;
  if (numeric) {
    month = Number(numeric[1]); day = Number(numeric[2]); year = Number(numeric[3]);
    hour = numeric[4] ? Number(numeric[4]) : 23; minute = numeric[5] ? Number(numeric[5]) : 59; meridiem = numeric[6];
  } else if (named) {
    month = months.findIndex((item) => named[1].toLowerCase().startsWith(item)) + 1;
    day = Number(named[2]); year = Number(named[3]); hour = named[4] ? Number(named[4]) : 23;
    minute = named[5] ? Number(named[5]) : 59; meridiem = named[6];
  } else return null;
  if (!month || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;
  return easternIso(year, month, day, hour, minute);
}

function cleanTitle(value: string) {
  return value
    .replace(/^\s*(?:fwd?:\s*)+/i, "")
    .replace(/^\s*\[(?:opengov|demandstar)\]\s*/i, "")
    .replace(/^\s*(?:new|updated|amended)?\s*(?:bid|solicitation|opportunity|project)\s*(?:notice)?\s*[:\-]\s*/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 500);
}

function usefulLinkLabel(label: string) {
  const clean = cleanTitle(label);
  if (clean.length < 8 || /^(?:view|open|details|learn more|click here|login|portal|respond)$/i.test(clean)) return null;
  return clean;
}

function solicitationNumber(text: string, sourceUrl: string, providerMessageId: string) {
  const match = text.match(/\b((?:ITN|ITB|IFB|RFP|RFQ|RFI|BID|PROJECT|SOLICITATION|QUOTE)\s*(?:NO\.?|NUMBER|#|ID)?\s*[:#\-]?\s*[A-Z0-9][A-Z0-9._\/-]{2,})\b/i);
  if (match) return match[1].replace(/\s+/g, " ").trim().toUpperCase();
  const pathId = new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1);
  if (pathId && /^[a-z0-9_-]{5,}$/i.test(pathId)) return pathId.toUpperCase();
  return `NOTICE-${hash(`${sourceUrl}|${providerMessageId}`).slice(0, 16).toUpperCase()}`;
}

function agencyFrom(text: string, sourceUrl: string) {
  const url = new URL(sourceUrl);
  const portalSlug = url.pathname.match(/\/portal\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (portalSlug && AGENCY_BY_PORTAL_SLUG[portalSlug]) return AGENCY_BY_PORTAL_SLUG[portalSlug];
  const label = text.match(/(?:agency|organization|owner|issuing entity|department)\s*[:\-]\s*([^\n|]{3,100})/i)?.[1]?.trim();
  const lower = text.toLowerCase();
  if (/orange county(?:,|\s)+(?:fl|florida)\b/.test(lower)) return { organization: label || "Orange County, Florida", county: "Orange" };
  if (/osceola county(?:,|\s)+(?:fl|florida)\b/.test(lower)) return { organization: label || "Osceola County, Florida", county: "Osceola" };
  if (/\b(?:city of )?orlando\b/.test(lower)) return { organization: label || "City of Orlando", county: "Orange", city: "Orlando" };
  if (/\b(?:city of )?kissimmee\b/.test(lower)) return { organization: label || "City of Kissimmee", county: "Osceola", city: "Kissimmee" };
  if (/\b(?:city of )?st\.? cloud\b/.test(lower)) return { organization: label || "City of St. Cloud", county: "Osceola", city: "St. Cloud" };
  return { organization: label || "Florida public purchasing agency", county: "", city: undefined };
}

function hasFloridaEvidence(text: string, sourceUrl: string) {
  if (/\bflorida\b|\bFL\s+\d{5}\b|\.fl\.us\b/i.test(text)) return true;
  const slug = new URL(sourceUrl).pathname.match(/\/portal\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (slug && AGENCY_BY_PORTAL_SLUG[slug]) return true;
  return /orange county,?\s+fl|osceola county,?\s+fl|city of orlando|city of kissimmee|city of st\.? cloud/i.test(text);
}

function noticeStatus(text: string, deadline: string | null): ParsedProcurementOpportunity["status"] {
  if (/\b(?:cancelled|canceled|withdrawn|retracted)\b/i.test(text)) return "cancelled";
  if (/\b(?:notice of award|intent to award|awarded to)\b/i.test(text)) return "awarded";
  if (/\b(?:closed|expired)\b/i.test(text)) return "expired";
  if (!deadline) return "needs_review";
  return new Date(deadline).getTime() >= Date.now() ? "active" : "expired";
}

function classifyTrade(text: string) {
  return TRADE_RULES.find(([, rule]) => rule.test(text))?.[0] || "commercial_services";
}

export function parseProcurementNotice(
  input: ProcurementNoticeInput,
  options: { allowedSenders?: string[]; allowedRecipients?: string[] } = {},
): ParsedProcurementNotice {
  const senderAddress = emailAddress(input.from);
  const allowedSenders = options.allowedSenders || ["opengov.com", "demandstar.com"];
  const allowedRecipients = options.allowedRecipients || [];
  const text = (input.text?.trim() || plainHtml(input.html || "")).replace(/\r/g, "");
  const links = extractNoticeLinks(input.html || "", `${input.text || ""}\n${text}`);
  const portalSource = portalForMessage(input.from, input.subject, links);
  if (!recipientAllowed(input.to, allowedRecipients)) {
    return { portalSource, disposition: "ignored", reason: "Message was not addressed to the configured procurement inbox.", senderAddress, opportunities: [] };
  }
  if (!senderAllowed(input.from, allowedSenders)) {
    return { portalSource, disposition: "ignored", reason: "Sender is not on the procurement notification allowlist.", senderAddress, opportunities: [] };
  }
  if (failedAuthentication(input.headers)) {
    return { portalSource, disposition: "ignored", reason: "Email authentication headers reported a failed DMARC or combined SPF/DKIM result.", senderAddress, opportunities: [] };
  }
  if (portalSource === "unknown") {
    return { portalSource, disposition: "needs_review", reason: "No supported procurement portal could be established from the sender and official links.", senderAddress, opportunities: [] };
  }
  const candidates = opportunityLinks(links, portalSource);
  if (!candidates.length) {
    return { portalSource, disposition: "needs_review", reason: "The notice contains no authoritative OpenGov or DemandStar source link.", senderAddress, opportunities: [] };
  }
  const opportunities: ParsedProcurementOpportunity[] = [];
  for (const link of candidates) {
    const scoped = `${input.subject}\n${link.label}\n${link.context}\n${text}`.slice(0, 20_000);
    if (!hasFloridaEvidence(scoped, link.url)) continue;
    const agency = agencyFrom(scoped, link.url);
    const number = solicitationNumber(`${link.context}\n${input.subject}\n${text}`, link.url, input.providerMessageId);
    const title = usefulLinkLabel(link.label) || cleanTitle(input.subject) || number;
    const deadline = parseDeadline(`${link.context}\n${text}`);
    const status = noticeStatus(`${input.subject}\n${link.context}`, deadline);
    const amendments = /\b(?:addendum|amendment|revised|updated solicitation)\b/i.test(`${input.subject} ${link.context}`)
      ? [{ observedAt: input.receivedAt, title: input.subject, sourceUrl: link.url }]
      : [];
    opportunities.push({
      sourceId: SOURCE_IDS[portalSource],
      sourceRecordId: `${portalSource}:${number}`.slice(0, 300),
      title,
      summary: text.slice(0, 4000) || `Vendor notification received for ${number}.`,
      solicitationNumber: number,
      purchasingOrganization: agency.organization,
      sourceUrl: link.url,
      county: agency.county || null,
      city: agency.city || null,
      tradeSlug: classifyTrade(`${title} ${text}`),
      status,
      deadline,
      amendments,
    });
  }
  const unique = Array.from(new Map(opportunities.map((item) => [`${item.sourceId}|${item.sourceRecordId}`, item])).values());
  if (!unique.length) {
    return { portalSource, disposition: "needs_review", reason: "The notice did not contain enough evidence to establish a Florida opportunity.", senderAddress, opportunities: [] };
  }
  return { portalSource, disposition: "accepted", reason: "Allowed portal sender and authoritative Florida opportunity link verified.", senderAddress, opportunities: unique };
}

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is required for procurement inbox processing");
  return new Resend(key);
}

export async function enqueueProcurementEmailEvent(event: EmailReceivedEvent, webhookEventId: string, rawPayload: string) {
  const data = event.data;
  const rows = await queryDb(
    `INSERT INTO oi_inbound_procurement_messages (
      provider, provider_message_id, webhook_event_id, internet_message_id, from_address,
      to_addresses, subject, received_at, attachment_metadata, webhook_payload
    ) VALUES ('resend',$1,$2,$3,$4,$5::text[],$6,$7,$8::jsonb,$9::jsonb)
    ON CONFLICT (provider, provider_message_id) DO UPDATE SET
      webhook_event_id=COALESCE(oi_inbound_procurement_messages.webhook_event_id, EXCLUDED.webhook_event_id),
      internet_message_id=COALESCE(oi_inbound_procurement_messages.internet_message_id, EXCLUDED.internet_message_id),
      attachment_metadata=EXCLUDED.attachment_metadata,
      webhook_payload=EXCLUDED.webhook_payload,
      updated_at=CURRENT_TIMESTAMP
    RETURNING id, status`,
    [data.email_id, webhookEventId || null, data.message_id || null, data.from, data.to || [],
      data.subject || "(no subject)", data.created_at || event.created_at,
      JSON.stringify(data.attachments || []), rawPayload],
  );
  return { id: String(rows[0].id), status: String(rows[0].status) };
}

async function enqueueReceivedEmail(email: GetReceivingEmailResponseSuccess) {
  const rows = await queryDb(
    `INSERT INTO oi_inbound_procurement_messages (
      provider, provider_message_id, internet_message_id, from_address, to_addresses,
      subject, received_at, attachment_metadata, webhook_payload
    ) VALUES ('resend',$1,$2,$3,$4::text[],$5,$6,$7::jsonb,$8::jsonb)
    ON CONFLICT (provider, provider_message_id) DO NOTHING RETURNING id`,
    [email.id, email.message_id || null, email.from, email.to || [], email.subject || "(no subject)",
      email.created_at, JSON.stringify(email.attachments || []), JSON.stringify({ reconciledFromReceivingApi: true })],
  );
  return rows.length > 0;
}

async function claimMessage(id?: string) {
  const rows = await queryDb(
    `UPDATE oi_inbound_procurement_messages SET status='processing', attempt_count=attempt_count+1,
       lease_until=CURRENT_TIMESTAMP + INTERVAL '10 minutes', updated_at=CURRENT_TIMESTAMP
     WHERE id=(
       SELECT id FROM oi_inbound_procurement_messages
       WHERE status IN ('pending','failed') AND attempt_count < 8
         AND next_attempt_at <= CURRENT_TIMESTAMP
         AND (lease_until IS NULL OR lease_until < CURRENT_TIMESTAMP)
         AND ($1::uuid IS NULL OR id=$1::uuid)
       ORDER BY received_at LIMIT 1
     ) RETURNING *`,
    [id || null],
  );
  return rows[0] || null;
}

async function markFailure(message: Row, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  await queryDb(
    `UPDATE oi_inbound_procurement_messages SET status='failed', lease_until=NULL,
     last_error=$2, next_attempt_at=CURRENT_TIMESTAMP +
       (LEAST(1440, 5 * power(2, LEAST(attempt_count, 8)))::text || ' minutes')::interval,
     updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
    [message.id, detail.slice(0, 2000)],
  );
  return detail;
}

async function getOpportunityRows(sourceId: string, sourceRecordIds: string[]) {
  return queryDb(
    `SELECT opportunity.id, opportunity.source_record_id, procurement.id AS procurement_id
     FROM oi_opportunities opportunity
     LEFT JOIN oi_procurement_records procurement
       ON procurement.source_id=opportunity.source_id AND procurement.source_record_id=opportunity.source_record_id
     WHERE opportunity.source_id=$1 AND opportunity.source_record_id=ANY($2::text[])`,
    [sourceId, sourceRecordIds],
  );
}

async function persistReceivedDocuments(
  client: Resend,
  email: GetReceivingEmailResponseSuccess,
  parsed: ParsedProcurementNotice,
  opportunityRows: Row[],
) {
  const attachmentResponse = email.attachments.length
    ? await client.emails.receiving.attachments.list({ emailId: email.id, limit: 100 })
    : { data: { data: [] as Array<{ id: string; filename?: string; content_type: string; content_disposition: "inline" | "attachment"; download_url: string; size: number }> }, error: null };
  if (attachmentResponse.error) throw new Error(`Resend attachment listing failed: ${attachmentResponse.error.message}`);
  const attachments = (attachmentResponse.data?.data || []).filter((attachment) =>
    attachment.content_disposition !== "inline" || /\.(?:pdf|docx?|xlsx?|csv|txt|zip)$/i.test(attachment.filename || ""),
  ).slice(0, 10);
  const downloaded: Array<{ attachment: (typeof attachments)[number]; buffer: Buffer; contentType: string }> = [];
  let downloadedBytes = 0;
  for (const attachment of attachments) {
    const response = await fetch(attachment.download_url, { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`Attachment ${attachment.filename || attachment.id} returned HTTP ${response.status}`);
    const declaredBytes = Number(response.headers.get("content-length") || attachment.size || 0);
    if (declaredBytes > 25 * 1024 * 1024 || downloadedBytes + declaredBytes > 50 * 1024 * 1024) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 25 * 1024 * 1024 || downloadedBytes + buffer.byteLength > 50 * 1024 * 1024) continue;
    downloadedBytes += buffer.byteLength;
    downloaded.push({
      attachment,
      buffer,
      contentType: attachment.content_type || response.headers.get("content-type") || "application/octet-stream",
    });
  }
  const body = email.text?.trim() || plainHtml(email.html || "");
  for (const opportunity of parsed.opportunities) {
    const stored = opportunityRows.find((row) => String(row.source_record_id) === opportunity.sourceRecordId);
    if (!stored) continue;
    const urls: string[] = [];
    const noticeUrl = `${opportunity.sourceUrl}#intent-notice-${email.id}`;
    await storeOpportunityDocumentContent({
      sourceId: opportunity.sourceId,
      opportunityId: String(stored.id),
      procurementRecordId: stored.procurement_id ? String(stored.procurement_id) : null,
      sourceRecordId: opportunity.sourceRecordId,
      documentUrl: noticeUrl,
      title: `Vendor notification: ${email.subject}`,
      documentType: "vendor_notification",
      publishedAt: email.created_at,
      contentType: "text/plain; charset=utf-8",
      content: Buffer.from(body, "utf8"),
      metadata: { provider: "resend", portalSource: parsed.portalSource, emailId: email.id, messageId: email.message_id, from: email.from },
    });
    urls.push(noticeUrl);
    for (const item of downloaded) {
      const { attachment, buffer, contentType } = item;
      const documentUrl = `${opportunity.sourceUrl}#intent-attachment-${attachment.id}`;
      await storeOpportunityDocumentContent({
        sourceId: opportunity.sourceId,
        opportunityId: String(stored.id),
        procurementRecordId: stored.procurement_id ? String(stored.procurement_id) : null,
        sourceRecordId: opportunity.sourceRecordId,
        documentUrl,
        title: attachment.filename || `Email attachment ${attachment.id}`,
        documentType: /addend|amend/i.test(attachment.filename || "") ? "amendment" : "attachment",
        publishedAt: email.created_at,
        contentType,
        content: buffer,
        metadata: { provider: "resend", portalSource: parsed.portalSource, emailId: email.id, attachmentId: attachment.id },
      });
      urls.push(documentUrl);
    }
    if (stored.procurement_id) {
      await queryDb(
        "UPDATE oi_procurement_records SET document_urls=$2::text[], updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [stored.procurement_id, urls],
      );
    }
  }
}

function liveRecords(parsed: ParsedProcurementNotice, email: GetReceivingEmailResponseSuccess): LiveSourceRecord[] {
  return parsed.opportunities.map((opportunity) => ({
    opportunity: {
      sourceRecordId: opportunity.sourceRecordId,
      title: opportunity.title,
      summary: opportunity.summary,
      tradeSlug: opportunity.tradeSlug,
      classification: "confirmed",
      status: opportunity.status,
      geographicScopeType: opportunity.city ? "city" : opportunity.county ? "county" : "unknown",
      city: opportunity.city,
      county: opportunity.county,
      procurementDeadline: opportunity.deadline,
      evidenceConfidence: opportunity.status === "needs_review" ? 80 : 95,
      classificationRationale: "A signature-verified vendor notification from an allowed OpenGov or DemandStar sender documents a public purchasing notice and links to the authoritative portal. Eligibility, amendments, and submission instructions must still be confirmed at that portal.",
      sourceUrl: opportunity.sourceUrl,
      sourcePayload: {
        provider: "resend",
        portalSource: parsed.portalSource,
        providerMessageId: email.id,
        internetMessageId: email.message_id,
        receivedAt: email.created_at,
        sender: email.from,
      },
    },
    publishedAt: email.created_at,
    updatedAt: email.created_at,
    procurement: {
      solicitationNumber: opportunity.solicitationNumber,
      purchasingOrganization: opportunity.purchasingOrganization,
      scopeOfWork: opportunity.summary,
      publicationDate: email.created_at.slice(0, 10),
      amendments: opportunity.amendments,
      contact: { notificationSender: email.from },
    },
  }));
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

async function sendCuratedAlert(message: Row, parsed: ParsedProcurementNotice) {
  const recipients = list(process.env.OPPORTUNITY_ALERT_EMAILS, [
    process.env.INQUIRY_NOTIFY_EMAIL || "",
    process.env.INQUIRY_NOTIFY_EMAIL_2 || "",
  ].filter(Boolean));
  if (!recipients.length) {
    await queryDb("UPDATE oi_inbound_procurement_messages SET alert_status='not_configured', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [message.id]);
    return { status: "not_configured" };
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://intentrev.net").replace(/\/$/, "");
  const rows = parsed.opportunities.map((opportunity) => `
    <div style="border:1px solid #d9dee5;border-radius:8px;padding:16px;margin:12px 0">
      <h3 style="margin:0 0 8px">${escapeHtml(opportunity.title)}</h3>
      <p style="margin:4px 0"><strong>Agency:</strong> ${escapeHtml(opportunity.purchasingOrganization)}</p>
      <p style="margin:4px 0"><strong>Solicitation:</strong> ${escapeHtml(opportunity.solicitationNumber)}</p>
      <p style="margin:4px 0"><strong>Status:</strong> ${escapeHtml(opportunity.status)}</p>
      <p style="margin:4px 0"><strong>Deadline:</strong> ${escapeHtml(opportunity.deadline ? new Date(opportunity.deadline).toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET" : "Not reliably stated in the notice — verify immediately")}</p>
      <p style="margin:4px 0"><strong>Location:</strong> ${escapeHtml([opportunity.city, opportunity.county && `${opportunity.county} County`].filter(Boolean).join(", ") || "Florida; exact location requires review")}</p>
      <p style="margin:10px 0 0"><a href="${escapeHtml(opportunity.sourceUrl)}">Open authoritative portal record</a></p>
    </div>`).join("");
  const resend = resendClient();
  const response = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Intent <onboarding@resend.dev>",
    to: recipients,
    subject: `[Intent Opportunity] ${parsed.opportunities.length === 1 ? parsed.opportunities[0].title : `${parsed.opportunities.length} verified portal notices`}`.slice(0, 240),
    html: `<h2>Opportunity ingested into Intent</h2><p>This alert was sent only after the notice was stored in the canonical opportunity database.</p>${rows}<p><a href="${site}/admin/opportunity-intelligence/all">Open Opportunity Explorer</a> &nbsp;|&nbsp; <a href="${site}/admin/opportunity-intelligence/atlas">Open Intent Atlas</a></p><p style="color:#68727b;font-size:12px">Always verify the current deadline, amendments, eligibility, and submission method at the linked authoritative portal.</p>`,
  }, { idempotencyKey: `procurement-inbox-${String(message.id)}` });
  if (response.error) throw new Error(`Resend alert failed: ${response.error.message}`);
  await queryDb(
    `UPDATE oi_inbound_procurement_messages SET alert_status='sent', alert_provider_id=$2,
     alert_attempt_count=alert_attempt_count+1, alert_last_error=NULL, alerted_at=CURRENT_TIMESTAMP,
     updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
    [message.id, response.data?.id || null],
  );
  return { status: "sent", id: response.data?.id };
}

async function processClaimedMessage(message: Row) {
  const client = resendClient();
  const response = await client.emails.receiving.get(String(message.provider_message_id));
  if (response.error || !response.data) throw new Error(`Resend received-email retrieval failed: ${response.error?.message || "empty response"}`);
  const email = response.data;
  await queryDb(
    `UPDATE oi_inbound_procurement_messages SET internet_message_id=$2, from_address=$3,
     to_addresses=$4::text[], subject=$5, received_at=$6, body_text=$7, body_html=$8,
     headers=$9::jsonb, attachment_metadata=$10::jsonb, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
    [message.id, email.message_id || null, email.from, email.to || [], email.subject || "(no subject)",
      email.created_at, email.text || null, email.html || null, JSON.stringify(email.headers || {}),
      JSON.stringify(email.attachments || [])],
  );
  const parsed = parseProcurementNotice({
    providerMessageId: email.id,
    internetMessageId: email.message_id,
    from: email.from,
    to: email.to || [],
    subject: email.subject || "(no subject)",
    receivedAt: email.created_at,
    text: email.text,
    html: email.html,
    headers: email.headers || {},
  }, {
    allowedSenders: list(process.env.PROCUREMENT_INBOUND_ALLOWED_SENDERS, ["opengov.com", "demandstar.com"]),
    allowedRecipients: list(process.env.PROCUREMENT_INBOUND_RECIPIENTS),
  });
  if (parsed.disposition !== "accepted") {
    await queryDb(
      `UPDATE oi_inbound_procurement_messages SET portal_source=$2, status=$3,
       parsed_payload=$4::jsonb, last_error=$5, lease_until=NULL,
       alert_status='not_applicable', processed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [message.id, parsed.portalSource, parsed.disposition === "ignored" ? "ignored" : "needs_review",
        JSON.stringify(parsed), parsed.reason],
    );
    return { id: String(message.id), status: parsed.disposition, reason: parsed.reason, opportunities: 0 };
  }
  const records = liveRecords(parsed, email);
  const sourceId = parsed.opportunities[0].sourceId;
  const ingestion = await ingestOpportunityBatch(sourceId, records.map((record) => record.opportunity), email.created_at);
  await persistOpportunitySupplemental(sourceId, records);
  const storedRows = await getOpportunityRows(sourceId, parsed.opportunities.map((item) => item.sourceRecordId));
  await persistReceivedDocuments(client, email, parsed, storedRows);
  const opportunityIds = storedRows.map((row) => String(row.id));
  await queryDb(
    `UPDATE oi_inbound_procurement_messages SET portal_source=$2, status='processed',
     parsed_payload=$3::jsonb, opportunity_ids=$4::uuid[], last_error=NULL, lease_until=NULL,
     processed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
    [message.id, parsed.portalSource, JSON.stringify(parsed), opportunityIds],
  );
  let alert: unknown;
  try {
    alert = await sendCuratedAlert(message, parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await queryDb(
      `UPDATE oi_inbound_procurement_messages SET alert_status='failed',
       alert_attempt_count=alert_attempt_count+1, alert_last_error=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [message.id, detail.slice(0, 2000)],
    );
    alert = { status: "failed", error: detail };
  }
  return { id: String(message.id), status: "processed", opportunities: opportunityIds.length, ingestion, alert };
}

async function retryPendingAlerts(limit = 10) {
  const rows = await queryDb(
    `SELECT * FROM oi_inbound_procurement_messages
     WHERE status='processed' AND alert_status IN ('pending','failed') AND alert_attempt_count < 8
     ORDER BY processed_at LIMIT $1`,
    [limit],
  );
  const outcomes = [];
  for (const row of rows) {
    try {
      const parsed = row.parsed_payload as unknown as ParsedProcurementNotice;
      outcomes.push({ id: row.id, ...(await sendCuratedAlert(row, parsed)) });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await queryDb(
        `UPDATE oi_inbound_procurement_messages SET alert_status='failed',
         alert_attempt_count=alert_attempt_count+1, alert_last_error=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [row.id, detail.slice(0, 2000)],
      );
      outcomes.push({ id: row.id, status: "failed", error: detail });
    }
  }
  return outcomes;
}

export async function processProcurementInbox(options: { id?: string; limit?: number } = {}) {
  const outcomes = [];
  const limit = Math.min(50, Math.max(1, options.limit || 10));
  for (let index = 0; index < limit; index += 1) {
    const message = await claimMessage(options.id);
    if (!message) break;
    try {
      outcomes.push(await processClaimedMessage(message));
    } catch (error) {
      outcomes.push({ id: String(message.id), status: "failed", error: await markFailure(message, error) });
    }
    if (options.id) break;
  }
  return { attempted: outcomes.length, outcomes };
}

export async function reconcileRecentProcurementEmails(limit = 50) {
  const client = resendClient();
  const response = await client.emails.receiving.list({ limit: Math.min(100, Math.max(1, limit)) });
  if (response.error || !response.data) throw new Error(`Resend inbox reconciliation failed: ${response.error?.message || "empty response"}`);
  let enqueued = 0;
  for (const email of response.data.data) {
    enqueued += (await enqueueReceivedEmail(email as GetReceivingEmailResponseSuccess)) ? 1 : 0;
  }
  return { seen: response.data.data.length, enqueued, hasMore: response.data.has_more };
}

async function updateProcurementInboxAlerts() {
  const sources = [
    { id: SOURCE_IDS.opengov, portal: "opengov", domain: "%opengov.com%" },
    { id: SOURCE_IDS.demandstar, portal: "demandstar", domain: "%demandstar.com%" },
  ];
  const outcomes = [];
  for (const source of sources) {
    const rows = await queryDb(
      `SELECT count(*) FILTER (WHERE status='failed')::int AS failed,
              count(*) FILTER (WHERE status='pending' AND received_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes')::int AS delayed,
              min(received_at) FILTER (WHERE status IN ('pending','failed')) AS oldest_unprocessed
       FROM oi_inbound_procurement_messages
       WHERE portal_source=$1 OR (portal_source='unknown' AND from_address ILIKE $2)`,
      [source.portal, source.domain],
    );
    const metrics = rows[0] || {};
    const conditions = [
      Number(metrics.failed || 0) > 0 ? {
        code: "inbound_processing_failures",
        severity: "critical",
        message: `${metrics.failed} ${source.portal} procurement notification(s) failed processing.`,
      } : null,
      Number(metrics.delayed || 0) > 0 ? {
        code: "inbound_processing_backlog",
        severity: "warning",
        message: `${metrics.delayed} ${source.portal} procurement notification(s) have waited more than 15 minutes.`,
      } : null,
    ].filter((item): item is { code: string; severity: string; message: string } => Boolean(item));
    const activeCodes = conditions.map((condition) => condition.code);
    await queryDb(
      `UPDATE oi_source_alerts SET resolved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE source_id=$1 AND resolved_at IS NULL
         AND alert_code IN ('inbound_processing_failures','inbound_processing_backlog')
         AND NOT (alert_code=ANY($2::text[]))`,
      [source.id, activeCodes],
    );
    for (const condition of conditions) {
      await queryDb(
        `INSERT INTO oi_source_alerts (source_id, alert_code, severity, message, details)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (source_id, alert_code) WHERE resolved_at IS NULL DO UPDATE SET
           severity=EXCLUDED.severity, message=EXCLUDED.message, details=EXCLUDED.details,
           occurrence_count=oi_source_alerts.occurrence_count+1,
           last_seen_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP`,
        [source.id, condition.code, condition.severity, condition.message, JSON.stringify(metrics)],
      );
    }
    outcomes.push({ sourceId: source.id, metrics, activeAlerts: activeCodes });
  }
  return outcomes;
}

export async function recoverProcurementInbox(options: { reconcile?: boolean; limit?: number } = {}) {
  let reconciliation: unknown = { skipped: true };
  if (process.env.RESEND_API_KEY && options.reconcile !== false) {
    try { reconciliation = await reconcileRecentProcurementEmails(50); }
    catch (error) { reconciliation = { error: error instanceof Error ? error.message : String(error) }; }
  }
  const processing = await processProcurementInbox({ limit: options.limit || 20 });
  const alerts = await retryPendingAlerts(10);
  const sourceAlerts = await updateProcurementInboxAlerts();
  const healthRows = await queryDb(
    `SELECT count(*) FILTER (WHERE status='failed')::int AS failed,
            count(*) FILTER (WHERE status='pending' AND received_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes')::int AS delayed,
            min(received_at) FILTER (WHERE status IN ('pending','failed')) AS oldest_unprocessed
     FROM oi_inbound_procurement_messages`,
  );
  return { reconciliation, processing, alerts, sourceAlerts, health: healthRows[0] || {}, completedAt: new Date().toISOString() };
}

export function procurementInboxSourceUrl(source: PortalSource) {
  return source === "unknown" ? null : PORTAL_URLS[source];
}
