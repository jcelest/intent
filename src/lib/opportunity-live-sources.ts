import { createHash } from "node:crypto";
// @ts-expect-error pdf-parse direct path avoids index.js debug execution
import pdf from "pdf-parse/lib/pdf-parse.js";
import { sql } from "@/lib/db";
import { ingestOpportunityBatch, type CanonicalOpportunityInput } from "@/lib/opportunity-ingestion";
import { syncOrlandoPermits } from "@/lib/trade-demand";

type Row = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<Row[]> };
const queryDb = (query: string, params: unknown[] = []) =>
  (sql as unknown as Queryable).query(query, params);

export interface SourceDocumentInput {
  url: string;
  title: string;
  type?: string;
  version?: string | null;
  publishedAt?: string | null;
  metadata?: Row;
}

export interface ProcurementInput {
  solicitationNumber: string;
  purchasingOrganization: string;
  scopeOfWork?: string | null;
  publicationDate?: string | null;
  requiredLicenses?: string[];
  requiredCertifications?: string[];
  mandatorySiteVisit?: string | null;
  amendments?: Row[];
  contact?: Row;
}

export interface AwardInput {
  sourceRecordId: string;
  purchasingOrganization: string;
  awardedContractor?: string | null;
  title: string;
  awardAmount?: number | null;
  awardDate?: string | null;
  contractStartDate?: string | null;
  contractExpirationDate?: string | null;
  renewalOptions?: string | null;
  sourceUrl: string;
  payload: Row;
}

export interface LiveSourceRecord {
  opportunity: CanonicalOpportunityInput;
  publishedAt?: string | null;
  updatedAt?: string | null;
  procurement?: ProcurementInput;
  documents?: SourceDocumentInput[];
  award?: AwardInput;
}

export interface AdapterResult {
  records: LiveSourceRecord[];
  cursor?: Row;
  sourceCount?: number;
  metadata?: Row;
}

export interface SourceAdapter {
  sourceId: string;
  adapterKey: string;
  fetchRecords(limit: number): Promise<AdapterResult>;
}

const USER_AGENT = "Intent-Opportunity-Intelligence/1.0 (+source-traceable public records)";

async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...init.headers },
      });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateOnly(value: unknown): string | null {
  const iso = cleanDate(value);
  return iso ? iso.slice(0, 10) : null;
}

function dollars(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function htmlCells(row: string) {
  return Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (match) => match[1]);
}

function htmlLinks(fragment: string, baseUrl: string) {
  return Array.from(fragment.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi), (match) => ({
    url: new URL(match[1].replace(/&amp;/gi, "&"), baseUrl).toString(),
    title: decodeHtml(match[2]),
  })).filter((link) => link.title && !link.url.startsWith("mailto:"));
}

function stableRecordId(prefix: string, title: string, fallback: string) {
  const match = title.match(/\b(?:ITN|ITB|RFP|RFQ|BID|SOLE\s+SOURCE)\s*[-#:]?\s*([A-Z0-9][A-Z0-9._-]{2,})/i);
  return `${prefix}:${match?.[1] || fallback}`.replace(/\s+/g, "-").toUpperCase();
}

const TRADE_RULES: Array<[string, RegExp]> = [
  ["automation_controls", /building automation|\bbas\b|\bbms\b|ddc|bacnet|controls? system/i],
  ["monitoring", /remote monitoring|fault detection|diagnostic|sensor|telemetry|nurse call/i],
  ["energy", /energy (?:audit|optimization|efficiency|management)|retro.?commission|demand response/i],
  ["hvac", /hvac|air condition|chiller|boiler|mechanical|cooling tower|refriger/i],
  ["roofing", /roof|waterproof|building envelope/i],
  ["electrical", /electrical|lighting|generator|traffic signal/i],
  ["fire_protection", /fire alarm|fire protection|sprinkler/i],
  ["plumbing", /plumbing|water treatment|wastewater|pump station/i],
  ["security", /security|access control|surveillance/i],
  ["property_maintenance", /maintenance|janitorial|lawn care|landscap|repair service/i],
  ["commercial_construction", /construction|renovation|replacement|improvement|demolition|bridge|resurfacing|drainage/i],
];

function classifyTrade(text: string) {
  return TRADE_RULES.find(([, rule]) => rule.test(text))?.[0] || "commercial_services";
}

function classifyService(text: string, trade: string | null | undefined) {
  if (/remote monitoring|telemetry|fault detection|diagnostic/i.test(text)) return "remote-hvac-monitoring";
  if (/building automation|\bbas\b|\bbms\b|ddc|bacnet|controls? system/i.test(text)) return "bas-management";
  if (/energy (?:audit|optimization|efficiency|management)|retro.?commission/i.test(text)) return "energy-optimization";
  if (/roof.*(?:maintenance|repair)/i.test(text)) return "preventive-roof-maintenance";
  if (/roof.*replacement/i.test(text)) return "roof-replacement";
  if (/hvac|air condition|chiller|boiler|mechanical/i.test(text) && /maintenance|repair|service/i.test(text)) return "commercial-hvac-maintenance";
  if (trade === "electrical" && /maintenance|repair/i.test(text)) return "commercial-electrical-maintenance";
  if (trade === "plumbing" && /maintenance|repair/i.test(text)) return "commercial-plumbing-maintenance";
  if (trade === "commercial_construction") return "building-renovations";
  return null;
}

function authoritativeRationale(source: string) {
  return `Confirmed purchasing demand published by ${source}. Status and deadline were checked against the linked official source during the latest synchronization.`;
}

type MfmpSearchRow = {
  advertisementId: number;
  agencyAdNumber?: string | null;
  uniqueName: string;
  title: string;
  type: string;
  status: string;
  version?: number;
  openDate?: string;
  closeDate?: string;
  publishDate?: string;
  agency: string;
};

type MfmpDetail = MfmpSearchRow & {
  description?: string;
  publishedDate?: string;
  lastUpdateDate?: string;
  docs?: Array<{ attachmentId: number; description?: string; fileName?: string; date?: string; version?: string | null }>;
  responseContact?: Row;
  commodityCodes?: Array<{ id: string; value: string }>;
};

const MFMP_BASE = "https://vendor.myfloridamarketplace.com";
const MFMP_TYPES = [
  { id: "4", value: "Invitation to Bid" },
  { id: "5", value: "Invitation to Negotiate" },
  { id: "6", value: "Request for Proposals" },
  { id: "8", value: "Request for Information" },
  { id: "9", value: "Request for Statement of Qualifications" },
];

function usDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

const mfmpAdapter: SourceAdapter = {
  sourceId: "fl-mfmp",
  adapterKey: "mfmp",
  async fetchRecords(limit) {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 2);
    const to = new Date();
    to.setFullYear(to.getFullYear() + 2);
    const criteria = {
      pageSize: Math.min(100, limit), type: MFMP_TYPES, status: [], agency: [],
      adNumber: "", agencyAdvertisementNumber: "", title: "", publishedDate: "",
      openDate: usDate(from), endDate: usDate(to), commodityCodes: [],
      intendsToParticipate: "", assignee: "",
    };
    const countResponse = await fetchWithRetry(`${MFMP_BASE}/mfmp/pub/search/bids/count`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(criteria),
    });
    const sourceCount = Number(await countResponse.text());
    const summaries: MfmpSearchRow[] = [];
    const pages = Math.min(Math.ceil(sourceCount / criteria.pageSize), Math.ceil(limit / criteria.pageSize));
    for (let page = 1; page <= pages; page += 1) {
      const response = await fetchWithRetry(`${MFMP_BASE}/mfmp/pub/search/bids`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...criteria, page }),
      });
      summaries.push(...await response.json() as MfmpSearchRow[]);
    }
    const records: LiveSourceRecord[] = [];
    for (const summary of summaries.slice(0, limit)) {
      const response = await fetchWithRetry(`${MFMP_BASE}/mfmp/pub/search/bids/detail?id=${summary.advertisementId}`, {
        headers: { Accept: "application/json" },
      });
      const detail = await response.json() as MfmpDetail;
      const sourceUrl = `${MFMP_BASE}/search/bids/detail/${detail.advertisementId}`;
      const scope = decodeHtml(detail.description || "");
      const combined = `${detail.title} ${scope} ${(detail.commodityCodes || []).map((item) => item.value).join(" ")}`;
      const deadline = cleanDate(detail.closeDate);
      const status = String(detail.status).toUpperCase() === "OPEN" && deadline && new Date(deadline) >= new Date()
        ? "active" : String(detail.status).toUpperCase().includes("WITHDRAW") ? "cancelled" : "expired";
      const documents = (detail.docs || []).map((document) => ({
        url: `${MFMP_BASE}/mfmp/bids/detail/attachment/download?attachmentId=${document.attachmentId}`,
        title: document.fileName || document.description || `MFMP attachment ${document.attachmentId}`,
        type: /addendum|amend/i.test(`${document.description} ${document.fileName}`) ? "amendment" : "attachment",
        version: document.version || null,
        publishedAt: cleanDate(document.date),
        metadata: { attachmentId: document.attachmentId, description: document.description || null },
      }));
      const amendments = documents.filter((document) => document.type === "amendment").map((document) => ({
        title: document.title, url: document.url, publishedAt: document.publishedAt,
      }));
      const payload = { ...detail, contentHash: hash(detail) };
      records.push({
        opportunity: {
          sourceRecordId: String(detail.advertisementId), title: detail.title, summary: scope || null,
          tradeSlug: classifyTrade(combined), classification: "confirmed", status,
          geographicScopeType: "statewide", documentedValue: null, procurementDeadline: deadline,
          evidenceConfidence: 100, classificationRationale: authoritativeRationale("MyFloridaMarketPlace"),
          sourceUrl, sourceDocumentUrl: documents[0]?.url || null, sourcePayload: payload,
        },
        publishedAt: cleanDate(detail.publishedDate || detail.publishDate),
        updatedAt: cleanDate(detail.lastUpdateDate),
        procurement: {
          solicitationNumber: detail.agencyAdNumber || detail.uniqueName,
          purchasingOrganization: detail.agency, scopeOfWork: scope || null,
          publicationDate: dateOnly(detail.publishedDate || detail.publishDate),
          amendments, contact: detail.responseContact || {},
        },
        documents,
      });
    }
    return { records, sourceCount, cursor: { checkedAt: new Date().toISOString() } };
  },
};

type SpendingAward = {
  "Award ID": string; "Recipient Name": string; "Start Date": string; "End Date": string;
  "Award Amount": number; "Awarding Agency": string; Description: string;
  "Contract Award Type": string; generated_internal_id: string;
};

const usaspendingAdapter: SourceAdapter = {
  sourceId: "usaspending-fl",
  adapterKey: "usaspending",
  async fetchRecords(limit) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 18);
    const recent = new Date(now);
    recent.setFullYear(recent.getFullYear() - 1);
    const payload = {
      filters: {
        time_period: [{ start_date: recent.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) }],
        place_of_performance_locations: [{ country: "USA", state: "FL" }],
        award_type_codes: ["A", "B", "C", "D"],
      },
      fields: ["Award ID", "Recipient Name", "Start Date", "End Date", "Award Amount", "Awarding Agency", "Description", "Contract Award Type", "generated_unique_award_id"],
      page: 1, limit: 100, subawards: false, sort: "End Date", order: "desc",
    };
    const matching: SpendingAward[] = [];
    let page = 1;
    let inspected = 0;
    let pageMetadata: Row = {};
    while (page <= 60 && matching.length < limit) {
      payload.page = page;
      const response = await fetchWithRetry("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { results: SpendingAward[]; page_metadata?: Row };
      pageMetadata = body.page_metadata || {};
      inspected += body.results.length;
      if (!body.results.length) break;
      for (const award of body.results) {
        const expiration = new Date(award["End Date"]);
        if (expiration >= now && expiration <= end) matching.push(award);
        if (matching.length >= limit) break;
      }
      const lastExpiration = new Date(body.results[body.results.length - 1]["End Date"]);
      if (lastExpiration < now || pageMetadata.hasNext === false) break;
      page += lastExpiration > end ? 10 : 1;
    }
    const records = matching.map((award): LiveSourceRecord => {
      const sourceRecordId = award.generated_internal_id || award["Award ID"];
      const sourceUrl = `https://www.usaspending.gov/award/${encodeURIComponent(sourceRecordId)}/`;
      const summary = `${award.Description || "Federal contract"} Current awardee: ${award["Recipient Name"]}.`;
      return {
        opportunity: {
          sourceRecordId, title: `Upcoming contract expiration: ${award.Description || award["Award ID"]}`,
          summary, tradeSlug: classifyTrade(summary), classification: "timing_based", status: "upcoming",
          geographicScopeType: "statewide", documentedValue: Number(award["Award Amount"]) || null,
          procurementDeadline: null, evidenceConfidence: 95,
          classificationRationale: "USAspending documents an existing federal contract performed in Florida with an approaching end date. This is a renewal timing signal, not a confirmed future solicitation.",
          sourceUrl, sourcePayload: { ...award, contentHash: hash(award) },
        },
        award: {
          sourceRecordId, purchasingOrganization: award["Awarding Agency"],
          awardedContractor: award["Recipient Name"], title: award.Description || award["Award ID"],
          awardAmount: Number(award["Award Amount"]) || null, contractStartDate: dateOnly(award["Start Date"]),
          contractExpirationDate: dateOnly(award["End Date"]), sourceUrl, payload: award as unknown as Row,
        },
      };
    });
    return { records, sourceCount: inspected, cursor: { checkedAt: now.toISOString(), lastPage: page }, metadata: pageMetadata };
  },
};

function parseFdotSections(html: string, limit: number): LiveSourceRecord[] {
  const records: LiveSourceRecord[] = [];
  const sectionPattern = /([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})<\/a>\s*<div class="sf-Long-text"[\s\S]*?<table class="table[^>]*>([\s\S]*?)<\/table>/gi;
  let section: RegExpExecArray | null;
  while ((section = sectionPattern.exec(html)) && records.length < limit) {
    const deadline = cleanDate(`${section[1]} 23:59:59 -05:00`);
    if (!deadline || new Date(deadline) < new Date()) continue;
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowPattern.exec(section[2])) && records.length < limit) {
      const cells = Array.from(row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (match) => match[1]);
      if (cells.length < 3) continue;
      const id = decodeHtml(cells[0]);
      if (!/^[A-Z0-9]{4,10}$/.test(id) || id === "PROPOSAL ID") continue;
      const link = cells[0].match(/href="([^"]+)"/i)?.[1]?.replace(/&amp;/g, "&");
      if (!link) continue;
      const county = decodeHtml(cells[1]);
      const work = decodeHtml(cells[2]);
      const addenda = cells[3] ? Array.from(cells[3].matchAll(/href="([^"]+)"[^>]*>(.*?)<\/a>/gi), (match) => ({
        title: `Addendum ${decodeHtml(match[2])}`, url: match[1].replace(/&amp;/g, "&"), publishedAt: null,
      })) : [];
      const sourceUrl = "https://www.fdot.gov/contracts/lettings";
      const title = `FDOT ${id}: ${work}`;
      records.push({
        opportunity: {
          sourceRecordId: id, title, summary: `${work} letting in ${county} County.`,
          tradeSlug: classifyTrade(work), classification: "confirmed", status: "active",
          geographicScopeType: "county", county, procurementDeadline: deadline,
          evidenceConfidence: 100, classificationRationale: authoritativeRationale("FDOT Central Office Lettings"),
          sourceUrl, sourceDocumentUrl: link, sourcePayload: { proposalId: id, county, work, deadline, addenda, contentHash: hash({ id, county, work, deadline, addenda }) },
        },
        publishedAt: null,
        procurement: {
          solicitationNumber: id, purchasingOrganization: "Florida Department of Transportation",
          scopeOfWork: work, amendments: addenda,
        },
        documents: [
          { url: link, title: `${id} bid solicitation notice`, type: "solicitation" },
          ...addenda.map((item) => ({ ...item, type: "amendment" })),
        ],
      });
    }
  }
  return records;
}

const fdotAdapter: SourceAdapter = {
  sourceId: "fl-fdot-lettings",
  adapterKey: "fdot-lettings",
  async fetchRecords(limit) {
    const response = await fetchWithRetry("https://www.fdot.gov/contracts/lettings", { headers: { Accept: "text/html" } });
    const html = await response.text();
    const records = parseFdotSections(html, limit);
    if (!records.length) throw new Error("FDOT_SCHEMA_CHANGED: no current letting proposal rows were parsed");
    return { records, sourceCount: records.length, cursor: { checkedAt: new Date().toISOString() } };
  },
};

const miamiDadeAdapter: SourceAdapter = {
  sourceId: "miamidade-current-solicitations",
  adapterKey: "miamidade",
  async fetchRecords(limit) {
    const base = "https://wwwx.miamidade.gov/apps/ISD/stratproc/Home/";
    const response = await fetchWithRetry(`${base}CurrentSolicitationsList`, { headers: { Accept: "application/json" } });
    const listing = await response.json() as Array<{ solicitationNumber: string; solicitationType: string; title: string; openingDate: string; postedDate: string }>;
    const records: LiveSourceRecord[] = [];
    for (const item of listing.slice(0, limit)) {
      const deadline = cleanDate(`${item.openingDate} 14:00:00 -05:00`);
      if (!deadline || new Date(deadline) < new Date()) continue;
      const sourceUrl = `${base}SolicitationDetails?solNumber=${encodeURIComponent(item.solicitationNumber)}`;
      const detailResponse = await fetchWithRetry(sourceUrl, { headers: { Accept: "text/html" } });
      const detailHtml = await detailResponse.text();
      const scopeMatch = detailHtml.match(/<strong>Announcement\s+Info:<\/strong>[\s\S]*?<div[^>]*class="col-10[^>]*>([\s\S]*?)<\/div>/i);
      const certificationMatch = detailHtml.match(/<strong>Technical\s+Certification:<\/strong>[\s\S]*?<div[^>]*class="col-10[^>]*>([\s\S]*?)<\/div>/i);
      const scope = decodeHtml(scopeMatch?.[1] || item.title);
      const certifications = decodeHtml(certificationMatch?.[1] || "");
      const documents = Array.from(detailHtml.matchAll(/href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi), (match) => {
        const title = decodeHtml(match[2]);
        return {
          url: new URL(match[1], "https://wwwx.miamidade.gov").toString(),
          title,
          type: /addend/i.test(title) ? "amendment" : "solicitation_document",
          version: /addend(?:um)?\s*([0-9]+)/i.exec(title)?.[1] || null,
        } satisfies SourceDocumentInput;
      });
      const text = `${item.title} ${scope} ${certifications}`;
      records.push({
        opportunity: {
          sourceRecordId: item.solicitationNumber, title: item.title,
          summary: scope.slice(0, 1200), tradeSlug: classifyTrade(text), classification: "confirmed", status: "active",
          geographicScopeType: "county", county: "Miami-Dade", city: "Miami",
          procurementDeadline: deadline, evidenceConfidence: 100,
          classificationRationale: authoritativeRationale("Miami-Dade County Strategic Procurement"),
          sourceUrl, sourcePayload: { ...item, scope, certifications, documentCount: documents.length, contentHash: hash({ item, scope, certifications, documents }) },
        },
        publishedAt: cleanDate(item.postedDate), documents,
        procurement: {
          solicitationNumber: item.solicitationNumber, purchasingOrganization: "Miami-Dade County",
          scopeOfWork: scope, publicationDate: dateOnly(item.postedDate),
          requiredLicenses: certifications ? [certifications] : [],
          amendments: documents.filter((document) => document.type === "amendment").map((document) => ({ title: document.title, url: document.url })),
        },
      });
    }
    if (!records.length) throw new Error("MIAMIDADE_SCHEMA_CHANGED: no active solicitation rows were parsed");
    return { records, sourceCount: listing.length, cursor: { checkedAt: new Date().toISOString() } };
  },
};

function extractHidden(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`name=["']${escaped}["'][^>]*value=["']([^"']*)["']`, "i"))?.[1] || "";
}

function field(text: string, label: string, next: string) {
  const match = text.match(new RegExp(`${label}:\\s*(.*?)\\s*${next}:`, "i"));
  return match?.[1]?.trim() || null;
}

const factsAdapter: SourceAdapter = {
  sourceId: "fl-facts",
  adapterKey: "facts",
  async fetchRecords(limit) {
    const url = "https://facts.fldfs.com/Search/ContractSearch.aspx";
    const initial = await fetchWithRetry(url, { headers: { Accept: "text/html" } });
    const html = await initial.text();
    const cookie = initial.headers.get("set-cookie")?.split(";")[0] || "";
    const now = new Date();
    const to = new Date(now);
    to.setMonth(to.getMonth() + 18);
    const form = new URLSearchParams({
      __EVENTTARGET: "", __EVENTARGUMENT: "", __LASTFOCUS: "",
      __VIEWSTATE: extractHidden(html, "__VIEWSTATE"),
      __VIEWSTATEGENERATOR: extractHidden(html, "__VIEWSTATEGENERATOR"),
      __VIEWSTATEENCRYPTED: "", __EVENTVALIDATION: extractHidden(html, "__EVENTVALIDATION"),
      "ctl00$PC$ddlAgency": "", "ctl00$PC$txtVendorName": "",
      "ctl00$PC$txtConntractValueFrom": "", "ctl00$PC$txtConntractValueTo": "",
      "ctl00$PC$txtBeginDate": usDate(now), "ctl00$PC$txtEndDate": usDate(to),
      "ctl00$PC$rblSrchOption": "C", "ctl00$PC$txtAgencyContractId": "",
      "ctl00$PC$txtGrantId": "", "ctl00$PC$txtPOId": "",
      "ctl00$PC$ddlCommodityGroup": "72000000", "ctl00$PC$btnSearch": "Search",
    });
    const search = await fetchWithRetry(url, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html", Cookie: cookie },
      body: form.toString(),
    });
    const resultsHtml = await search.text();
    const links = Array.from(resultsHtml.matchAll(/ContractDetail\.aspx\?AgencyId=([^&"']+)&amp;ContractId=([^&"']+)/gi))
      .map((match) => ({ agencyId: match[1], contractId: match[2] }))
      .filter((item, index, all) => all.findIndex((other) => other.agencyId === item.agencyId && other.contractId === item.contractId) === index)
      .slice(0, limit);
    if (!links.length) throw new Error("FACTS_SCHEMA_CHANGED: contract search returned no detail links");
    const records: LiveSourceRecord[] = [];
    for (const item of links) {
      const sourceUrl = `https://facts.fldfs.com/Search/ContractDetail.aspx?AgencyId=${encodeURIComponent(item.agencyId)}&ContractId=${encodeURIComponent(item.contractId)}`;
      const response = await fetchWithRetry(sourceUrl, { headers: { Accept: "text/html", Cookie: cookie } });
      const detailHtml = await response.text();
      const text = decodeHtml(detailHtml);
      const status = field(text, "Contract Status", "Date of Execution");
      const expiration = field(text, "New Ending Date", "Agency Service Area") || field(text, "Original End Date", "New Ending Date");
      const expirationDate = dateOnly(expiration);
      if (!expirationDate || new Date(expirationDate) < now || new Date(expirationDate) > to) continue;
      const agency = field(text, "Agency Name", "Agency Contract ID") || "State of Florida";
      const title = field(text, "Long Title", "Contract Type") || field(text, "Long Title", "Vendor Name") || item.contractId;
      const vendor = field(text, "Vendor Name", "Total Contract Amount");
      const amount = dollars(field(text, "Total Contract Amount", "Total Budgetary Amount"));
      const description = field(text, "General Description", "Details") || title;
      const summary = `${description} Current vendor: ${vendor || "not stated"}; contract ends ${expirationDate}.`;
      const sourceRecordId = `${item.agencyId}:${item.contractId}`;
      records.push({
        opportunity: {
          sourceRecordId, title: `Upcoming state contract expiration: ${title}`, summary,
          tradeSlug: classifyTrade(`${title} ${description}`), classification: "timing_based",
          status: String(status).toLowerCase() === "active" ? "upcoming" : "needs_review",
          geographicScopeType: "statewide", documentedValue: amount, evidenceConfidence: 98,
          classificationRationale: "FACTS documents an active State of Florida contract and its ending date. This is a renewal timing signal, not a confirmed future solicitation.",
          sourceUrl, sourcePayload: { agencyId: item.agencyId, contractId: item.contractId, agency, vendor, amount, expirationDate, status, description, contentHash: hash(text) },
        },
        award: {
          sourceRecordId, purchasingOrganization: agency, awardedContractor: vendor,
          title, awardAmount: amount, contractExpirationDate: expirationDate, sourceUrl,
          payload: { agencyId: item.agencyId, contractId: item.contractId, description, status },
        },
      });
    }
    return { records, sourceCount: links.length, cursor: { checkedAt: now.toISOString() } };
  },
};

const samAdapter: SourceAdapter = {
  sourceId: "sam-gov",
  adapterKey: "sam-gov",
  async fetchRecords(limit) {
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) throw new Error("ACCESS_RESTRICTED: SAM_GOV_API_KEY is required by the official SAM.gov Opportunities API");
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    const fmt = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    const params = new URLSearchParams({
      api_key: apiKey, postedFrom: fmt(from), postedTo: fmt(to), state: "FL",
      limit: String(Math.min(limit, 1000)), offset: "0",
    });
    const response = await fetchWithRetry(`https://api.sam.gov/opportunities/v2/search?${params}`, { headers: { Accept: "application/json" } });
    const body = await response.json() as { totalRecords: number; opportunitiesData: Row[] };
    const records = (body.opportunitiesData || []).map((item): LiveSourceRecord => {
      const noticeId = String(item.noticeId);
      const title = String(item.title || item.solicitationNumber || noticeId);
      const performance = item.placeOfPerformance as Row | undefined;
      const city = performance?.city as Row | undefined;
      // SAM's v2 payload uses the unusually-cased `responseDeadLine` field.
      // Retain the historical misspelling as a defensive fallback for stored/test fixtures.
      const deadline = cleanDate(item.responseDeadLine || item.reponseDeadLine);
      const noticeType = String(item.type || item.noticeType || "");
      const actionableSolicitation = /^(?:Solicitation|Combined Synopsis\/Solicitation)$/i.test(noticeType);
      const planningNotice = /^(?:Sources Sought|Presolicitation)$/i.test(noticeType);
      const awardNotice = /^Award Notice$/i.test(noticeType);
      const apiActive = String(item.active).toLowerCase() === "yes";
      const futureDeadline = Boolean(deadline && new Date(deadline) >= new Date());
      const cancelled = String(item.archiveType || "").toLowerCase().includes("cancel");
      const status: CanonicalOpportunityInput["status"] = cancelled ? "cancelled"
        : awardNotice ? "awarded"
        : deadline && !futureDeadline ? "expired"
        : !apiActive ? "archived"
        : actionableSolicitation && futureDeadline ? "active"
        : planningNotice && futureDeadline ? "upcoming"
        : "needs_review";
      const sourceUrl = `https://sam.gov/opp/${noticeId}/view`;
      const resources = Array.isArray(item.resourceLinks) ? item.resourceLinks.map(String) : [];
      return {
        opportunity: {
          sourceRecordId: noticeId, title, summary: String(item.description || item.fullParentPathName || ""),
          tradeSlug: classifyTrade(title + " " + String(item.description || "")),
          classification: actionableSolicitation ? "confirmed" : "timing_based", status,
          geographicScopeType: performance ? "city" : "statewide",
          city: city?.name ? String(city.name) : null, zipCode: performance?.zip ? String(performance.zip) : null,
          procurementDeadline: deadline, evidenceConfidence: 100,
          classificationRationale: actionableSolicitation
            ? "SAM.gov documents a federal solicitation. It is presented as active only when a future response deadline is verified."
            : `${noticeType || "This SAM.gov notice"} is an authoritative federal notice, but not a verified open solicitation; it is retained as a timing signal.`,
          sourceUrl, sourceDocumentUrl: resources[0] || null, sourcePayload: { ...item, contentHash: hash(item) },
        },
        publishedAt: cleanDate(item.postedDate),
        procurement: {
          solicitationNumber: String(item.solicitationNumber || noticeId),
          purchasingOrganization: String(item.fullParentPathName || item.department || "United States Government"),
          scopeOfWork: String(item.description || ""),
        },
        documents: resources.map((url, index) => ({ url, title: `SAM.gov resource ${index + 1}`, type: "attachment" })),
      };
    });
    return { records, sourceCount: body.totalRecords, cursor: { checkedAt: new Date().toISOString() } };
  },
};

const orlandoPermitsAdapter: SourceAdapter = {
  sourceId: "orlando-permits",
  adapterKey: "orlando-permits",
  async fetchRecords(limit) {
    const sync = await syncOrlandoPermits({ windowDays: 90, maxRecords: Math.min(limit, 1000), pageSize: 500 });
    const permits = await queryDb(
      `SELECT * FROM trade_demand_permits WHERE source_system='orlando_socrata'
       ORDER BY COALESCE(processed_at, issued_at) DESC NULLS LAST LIMIT $1`,
      [Math.min(limit, 1000)],
    );
    for (const permit of permits) {
      await queryDb(
        `INSERT INTO oi_permit_records (
          source_id, source_record_id, permit_number, permit_type, permit_status, description,
          issue_date, final_date, job_value, contractor_name, address, city, county,
          latitude, longitude, source_url, source_payload, record_hash, parcel_id, property_type,
          parcel_use_code, parcel_use_description, parcel_evidence_url, parcel_match_method, parcel_matched_at
        ) VALUES ('orlando-permits',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Orlando','Orange',$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (source_id, source_record_id) DO UPDATE SET
          permit_type=EXCLUDED.permit_type, permit_status=EXCLUDED.permit_status,
          description=EXCLUDED.description, issue_date=EXCLUDED.issue_date, final_date=EXCLUDED.final_date,
          job_value=EXCLUDED.job_value, contractor_name=EXCLUDED.contractor_name,
          address=EXCLUDED.address, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
          source_url=EXCLUDED.source_url, source_payload=EXCLUDED.source_payload,
          record_hash=EXCLUDED.record_hash, parcel_id=EXCLUDED.parcel_id,
          property_type=EXCLUDED.property_type, parcel_use_code=EXCLUDED.parcel_use_code,
          parcel_use_description=EXCLUDED.parcel_use_description,
          parcel_evidence_url=EXCLUDED.parcel_evidence_url,
          parcel_match_method=EXCLUDED.parcel_match_method,
          parcel_matched_at=EXCLUDED.parcel_matched_at, updated_at=CURRENT_TIMESTAMP`,
        [permit.source_record_id, permit.permit_number, permit.work_type || permit.application_type || "permit",
          permit.status || null, permit.description || null, dateOnly(permit.issued_at), dateOnly(permit.finaled_at),
          permit.estimated_cost || null, permit.contractor_business_name || permit.contractor_name || null,
          permit.address || null, permit.latitude || null, permit.longitude || null, permit.source_url,
          JSON.stringify(permit.raw_data || {}), permit.content_hash || null,
          permit.parcel_number || null, permit.property_type || "UNKNOWN", permit.parcel_use_code || null,
          permit.parcel_use_description || null, permit.parcel_evidence_url || null,
          permit.parcel_match_method || null, permit.parcel_matched_at || null],
      );
    }
    await queryDb(
      `UPDATE oi_opportunities canonical
       SET status='archived', updated_at=CURRENT_TIMESTAMP
       FROM trade_demand_opportunities opportunity
       JOIN trade_demand_permits permit ON permit.id=opportunity.primary_permit_id
       WHERE canonical.source_id='orlando-permits'
         AND canonical.source_record_id=opportunity.origin_key
         AND permit.property_type <> 'COMMERCIAL'`,
    );
    const inferred = await queryDb(
      `SELECT opportunity.*, permit.latitude, permit.longitude, permit.estimated_cost,
              permit.processed_at, permit.issued_at, permit.raw_data, permit.property_type,
              permit.parcel_use_code, permit.parcel_use_description, permit.parcel_evidence_url
       FROM trade_demand_opportunities opportunity
       JOIN trade_demand_permits permit ON permit.id=opportunity.primary_permit_id
       WHERE opportunity.evidence_type='permit_activity'
         AND opportunity.trade_slug IS NOT NULL
         AND permit.property_type='COMMERCIAL'
       ORDER BY opportunity.updated_at DESC LIMIT $1`,
      [Math.min(limit, 1000)],
    );
    const records = inferred.map((item): LiveSourceRecord => ({
      opportunity: {
        sourceRecordId: String(item.origin_key || item.id),
        title: String(item.project_name || item.permit_number || "Orlando permit activity"),
        summary: String(item.evidence_summary || "Official permit activity"),
        tradeSlug: item.trade_slug ? String(item.trade_slug) : null,
        classification: "inferred", status: "discovered", geographicScopeType: "address",
        address: item.address ? String(item.address) : null, city: "Orlando", county: "Orange",
        parcelId: item.parcel_number ? String(item.parcel_number) : null,
        propertyType: "COMMERCIAL",
        parcelUseCode: item.parcel_use_code ? String(item.parcel_use_code) : null,
        parcelUseDescription: item.parcel_use_description ? String(item.parcel_use_description) : null,
        parcelEvidenceUrl: item.parcel_evidence_url ? String(item.parcel_evidence_url) : null,
        latitude: item.latitude === null ? null : Number(item.latitude),
        longitude: item.longitude === null ? null : Number(item.longitude),
        documentedValue: item.estimated_cost === null ? null : Number(item.estimated_cost),
        evidenceConfidence: 75,
        classificationRationale: "A City of Orlando permit documents project activity and trade relevance. It does not establish an open solicitation, unawarded work, or a present purchasing decision.",
        sourceUrl: String(item.source_url), sourcePayload: {
          ...(item.raw_data as Row || {}),
          propertyType: item.property_type,
          parcelUseCode: item.parcel_use_code,
          parcelEvidenceUrl: item.parcel_evidence_url,
          contentHash: hash({ rawData: item.raw_data || item, propertyType: item.property_type, parcelUseCode: item.parcel_use_code }),
        },
      },
      publishedAt: cleanDate(item.processed_at || item.issued_at),
    }));
    return { records, sourceCount: permits.length, cursor: { checkedAt: new Date().toISOString() }, metadata: sync };
  },
};

const ucfSolicitationsAdapter: SourceAdapter = {
  sourceId: "ucf-solicitations",
  adapterKey: "ucf-solicitations",
  async fetchRecords(limit) {
    const sourceUrl = "https://procurement.ucf.edu/solicitations/";
    const response = await fetchWithRetry(sourceUrl, { headers: { Accept: "text/html" } });
    const html = await response.text();
    const table = html.match(/<table[^>]*id=["']tablepress-1["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!table) throw new Error("UCF_SCHEMA_CHANGED: solicitation table was not found");
    const rows = Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi), (match) => match[1]);
    const records: LiveSourceRecord[] = [];
    for (const row of rows) {
      const cells = htmlCells(row);
      if (cells.length < 4 || records.length >= limit) continue;
      const links = htmlLinks(cells[0], sourceUrl);
      if (!links.length) continue;
      const title = links[0].title;
      const dateText = decodeHtml(cells[3]).replace(/~~/g, "").trim();
      const publishedDates = Array.from(dateText.matchAll(/\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-]20\d{2}\b/g), (match) => match[0]);
      const effectiveDate = publishedDates.at(-1) || dateText;
      const notes = decodeHtml(cells[2]);
      const timedDates = Array.from(notes.matchAll(/\b(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\s+(?:at\s+|@\s*)?\d{1,2}:\d{2}\s*(?:AM|PM)/gi), (match) => match[0]);
      const exactDeadline = timedDates.at(-1)?.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/i, "").replace(/\s+(?:at|@)\s+/i, " ");
      const deadline = cleanDate(exactDeadline ? `${exactDeadline} -05:00` : `${effectiveDate} 23:59:59 -05:00`);
      if (!deadline || new Date(deadline) < new Date() || /\bON HOLD\b/i.test(notes)) continue;
      const contactName = decodeHtml(cells[1]);
      const contactEmail = cells[1].match(/href=["']mailto:([^"']+)/i)?.[1] || null;
      const sourceRecordId = stableRecordId("UCF", title, hash(title).slice(0, 16));
      const documents = links.map((link, index): SourceDocumentInput => ({
        url: link.url,
        title: link.title,
        type: /addend|amend|revis/i.test(link.title) ? "amendment" : index === 0 ? "solicitation" : "attachment",
      }));
      const siteVisit = notes.match(/(?:site visit|pre[- ]?(?:bid|proposal)[^:]*)(?:\s*[-–:]\s*|:\s*)([^.]+?(?:EST|EDT|ET|AM|PM))/i)?.[0] || null;
      const scope = `${title}. ${notes}`.trim();
      records.push({
        opportunity: {
          sourceRecordId, title, summary: scope, tradeSlug: classifyTrade(scope),
          classification: "confirmed", status: "active", geographicScopeType: "city",
          city: "Orlando", county: "Orange", zipCode: "32816", procurementDeadline: deadline,
          evidenceConfidence: 100, classificationRationale: authoritativeRationale("University of Central Florida Procurement Services"),
          sourceUrl, sourceDocumentUrl: documents[0]?.url || null,
          sourcePayload: { title, notes, dateText, contactName, contactEmail, documents, contentHash: hash({ title, notes, dateText, deadline, documents }) },
        },
        procurement: {
          solicitationNumber: sourceRecordId.replace(/^UCF:/, ""), purchasingOrganization: "University of Central Florida",
          scopeOfWork: scope, mandatorySiteVisit: siteVisit,
          contact: { name: contactName || null, email: contactEmail },
          amendments: documents.filter((document) => document.type === "amendment").map((document) => ({ title: document.title, url: document.url })),
        },
        documents,
      });
    }
    if (!records.length) throw new Error("UCF_SCHEMA_CHANGED: no future active solicitation rows were parsed");
    return { records, sourceCount: records.length, cursor: { checkedAt: new Date().toISOString() } };
  },
};

const browardCollegeForecastAdapter: SourceAdapter = {
  sourceId: "broward-college-forecast",
  adapterKey: "broward-college-forecast",
  async fetchRecords(limit) {
    const sourceUrl = "https://www.broward.edu/about/community/vendor/forecast-opportunities.html";
    const response = await fetchWithRetry(sourceUrl, { headers: { Accept: "text/html" } });
    const html = await response.text();
    const table = html.match(/<caption>\s*Forecast of Procurement Opportunities\s*<\/caption>([\s\S]*?)<\/table>/i)?.[1];
    if (!table) throw new Error("BROWARD_COLLEGE_SCHEMA_CHANGED: forecast table was not found");
    const forecastPdf = html.match(/href=["']([^"']*forecast-opportunities\.pdf)["']/i)?.[1];
    const records: LiveSourceRecord[] = [];
    const now = new Date();
    for (const match of Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))) {
      const cells = htmlCells(match[1]).map(decodeHtml);
      if (cells.length < 7 || records.length >= limit) continue;
      const [title, scope, contractNumber, expirationText, officer, currentStatus, estimateText] = cells;
      const estimatedDate = cleanDate(estimateText.replace(/^Due Date\s*/i, ""));
      const expirationDate = cleanDate(expirationText);
      if ((!estimatedDate || new Date(estimatedDate) < now) && (!expirationDate || new Date(expirationDate) < now)) continue;
      const sourceRecordId = stableRecordId("BROWARD-COLLEGE", title, hash(`${title}:${contractNumber}`).slice(0, 16));
      const documents = forecastPdf ? [{
        url: new URL(forecastPdf, sourceUrl).toString(), title: "Broward College Procurement Forecast", type: "forecast",
      }] : [];
      const summary = `${scope} Current status: ${currentStatus}. Estimated release or due date: ${estimateText}.${contractNumber !== "No existing contract" ? ` Current contract ${contractNumber}${expirationDate ? ` expires ${expirationText}` : ""}.` : ""}`;
      records.push({
        opportunity: {
          sourceRecordId, title: `Planned procurement: ${title}`, summary,
          tradeSlug: classifyTrade(`${title} ${scope}`), classification: "timing_based", status: "upcoming",
          geographicScopeType: "county", city: "Fort Lauderdale", county: "Broward",
          evidenceConfidence: 98,
          classificationRationale: "Broward College publishes this item in its official six-month procurement forecast. It is a documented planning or renewal signal, not a confirmed open solicitation.",
          sourceUrl, sourceDocumentUrl: documents[0]?.url || null,
          sourcePayload: { title, scope, contractNumber, expirationText, officer, currentStatus, estimateText, estimatedDate, contentHash: hash(cells) },
        },
        procurement: {
          solicitationNumber: contractNumber === "No existing contract" ? sourceRecordId : contractNumber,
          purchasingOrganization: "Broward College", scopeOfWork: scope,
          contact: { name: officer, email: "procurement@broward.edu" },
        },
        documents,
        award: contractNumber !== "No existing contract" && expirationDate ? {
          sourceRecordId: `${sourceRecordId}:CURRENT-CONTRACT`, purchasingOrganization: "Broward College",
          title, contractExpirationDate: dateOnly(expirationDate), sourceUrl,
          payload: { contractNumber, expirationText, currentStatus },
        } : undefined,
      });
    }
    if (!records.length) throw new Error("BROWARD_COLLEGE_SCHEMA_CHANGED: no current forecast rows were parsed");
    return { records, sourceCount: records.length, cursor: { checkedAt: new Date().toISOString() } };
  },
};

const FLORIDA_CITY_COUNTIES: Array<[RegExp, string, string]> = [
  [/jacksonville|duval/i, "Jacksonville", "Duval"],
  [/st\.?\s*augustine|st\.?\s*johns/i, "St. Augustine", "St. Johns"],
  [/fort lauderdale|broward/i, "Fort Lauderdale", "Broward"],
  [/orlando|orange county/i, "Orlando", "Orange"],
  [/tampa|hillsborough/i, "Tampa", "Hillsborough"],
  [/miami[- ]dade|\bmiami\b/i, "Miami", "Miami-Dade"],
  [/tallahassee|leon county/i, "Tallahassee", "Leon"],
  [/gainesville|alachua/i, "Gainesville", "Alachua"],
  [/west palm beach|palm beach/i, "West Palm Beach", "Palm Beach"],
];

function responseDeadline(text: string) {
  const matches = Array.from(text.matchAll(/\b(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}(?:\s*(?:,|at|@)?\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\s*(?:EST|EDT|ET)?)?/gi));
  const candidates = matches.map((match) => {
    const before = text.slice(Math.max(0, Number(match.index) - 140), Number(match.index)).toLowerCase();
    const relevant = /(?:bids?|responses?|proposals?|submittals?|qualifications?).{0,70}(?:due|received|accepted|deadline|until)|(?:due|deadline).{0,45}$/.test(before);
    const normalized = match[0].replace(/(\d)(?:st|nd|rd|th)/i, "$1").replace(/\b(a|p)\.?m\.?/i, "$1m").replace(/\s+(?:at|@)\s+/i, " ");
    const parsed = cleanDate(`${normalized} -05:00`);
    return { relevant, parsed };
  }).filter((item): item is { relevant: boolean; parsed: string } => Boolean(item.parsed) && new Date(String(item.parsed)) >= new Date());
  return candidates.filter((item) => item.relevant).sort((a, b) => new Date(a.parsed).getTime() - new Date(b.parsed).getTime()).at(-1)?.parsed || null;
}

const floridaAdministrativeRegisterAdapter: SourceAdapter = {
  sourceId: "fl-administrative-register-bids",
  adapterKey: "fl-administrative-register-bids",
  async fetchRecords(limit) {
    const indexUrl = "https://flrules.org/bigDoc/Default.asp";
    const indexResponse = await fetchWithRetry(indexUrl, { headers: { Accept: "text/html" } });
    const indexHtml = await indexResponse.text();
    const issues = Array.from(indexHtml.matchAll(/href=["']([^"']*View_Faw\.asp\?IID=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi), (match) => {
      const label = decodeHtml(match[3]);
      const volume = label.match(/Vol\/No\s*(\d+)\/(\d+)/i);
      const year = label.match(/\b(20\d{2})\b/)?.[1] || String(new Date().getFullYear());
      return { id: Number(match[2]), label, year, volume: volume?.[1], number: volume?.[2] };
    }).filter((issue, index, all) => issue.volume && issue.number && all.findIndex((item) => item.id === issue.id) === index)
      .sort((a, b) => b.id - a.id);
    if (!issues.length) throw new Error("FL_REGISTER_SCHEMA_CHANGED: recent issue links were not found");
    const stateRows = await queryDb("SELECT cursor FROM oi_source_sync_state WHERE source_id=$1", ["fl-administrative-register-bids"]);
    const cursor = stateRows[0]?.cursor as Row | undefined;
    const lastIssueId = Number(cursor?.latestIssueId || 0);
    // Recheck the newest known issue so corrections published under the same issue
    // are detected, while older issues remain behind the incremental cursor.
    const selected = lastIssueId ? issues.filter((issue) => issue.id >= lastIssueId) : issues.slice(0, 15);
    const records: LiveSourceRecord[] = [];
    let noticesSeen = 0;
    for (const issue of selected) {
      if (records.length >= limit) break;
      const sectionUrl = `https://flrules.org/BigDoc/View_Section.asp?Issue=${issue.id}&Section=11`;
      const sectionResponse = await fetchWithRetry(sectionUrl, { headers: { Accept: "text/html" } });
      const sectionHtml = await sectionResponse.text();
      const notices = Array.from(sectionHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi), (row) => {
        const cells = htmlCells(row[1]);
        const noticeLink = row[1].match(/href=["']([^"']*View_notice\.asp\?id=(\d+)[^"']*)["']/i);
        return noticeLink && cells.length >= 4 ? {
          id: noticeLink[2], title: decodeHtml(cells[2]),
          url: new URL(noticeLink[1].replace(/&amp;/gi, "&"), sectionUrl).toString(),
        } : null;
      }).filter((notice): notice is { id: string; title: string; url: string } => Boolean(notice?.id && notice.title));
      if (!notices.length) continue;
      noticesSeen += notices.length;
      const folder = `${issue.volume}${String(issue.number).padStart(3, "0")}`;
      const documentUrl = `https://flrules.org/Faw/FAWDocuments/FAWVOLUMEFOLDERS${issue.year}/${folder}/${folder}doc.pdf`;
      const documentResponse = await fetchWithRetry(documentUrl, { headers: { Accept: "application/pdf" } });
      const buffer = Buffer.from(await documentResponse.arrayBuffer());
      if (buffer.length > 30 * 1024 * 1024) throw new Error(`FL_REGISTER_DOCUMENT_TOO_LARGE: ${documentUrl}`);
      const documentText = (await pdf(buffer)).text.replace(/\s+/g, " ").trim();
      const located = notices.map((notice) => ({ ...notice, offset: documentText.toLowerCase().indexOf(notice.title.toLowerCase()) }))
        .filter((notice) => notice.offset >= 0).sort((a, b) => a.offset - b.offset);
      for (let index = 0; index < located.length && records.length < limit; index += 1) {
        const notice = located[index];
        const segment = documentText.slice(notice.offset, located[index + 1]?.offset || Math.min(documentText.length, notice.offset + 15_000));
        const deadline = responseDeadline(segment);
        if (!deadline) continue;
        const location = FLORIDA_CITY_COUNTIES.find(([pattern]) => pattern.test(segment));
        const combined = `${notice.title} ${segment}`;
        const privateInvitation = /subcontract|trade contractor|construction manager|general contractor/i.test(segment)
          && !/department|authority|county|city of|university|school district/i.test(notice.title);
        records.push({
          opportunity: {
            sourceRecordId: notice.id, title: notice.title, summary: segment.slice(0, 4000),
            tradeSlug: classifyTrade(combined), classification: "confirmed", status: "active",
            geographicScopeType: location ? "city" : "statewide", city: location?.[1] || null,
            county: location?.[2] || null, procurementDeadline: deadline, evidenceConfidence: 100,
            classificationRationale: privateInvitation
              ? "A named contractor published an active subcontractor invitation in Section XI of the official Florida Administrative Register."
              : authoritativeRationale("Florida Administrative Register Section XI"),
            sourceUrl: notice.url, sourceDocumentUrl: documentUrl,
            sourcePayload: { issueId: issue.id, issue: issue.label, noticeId: notice.id, privateInvitation, contentHash: hash({ notice, segment }) },
          },
          publishedAt: cleanDate(issue.label.replace(/\s*-\s*Vol[\s\S]*$/i, "")),
          procurement: {
            solicitationNumber: notice.title.match(/\b(?:ITB|RFP|RFQ|IFB|RFSQ)[-_ ]?[A-Z0-9.-]+/i)?.[0] || notice.id,
            purchasingOrganization: segment.slice(notice.title.length).match(/^\s*([A-Z][A-Z &.,'-]{3,100})/)?.[1]?.trim() || "Organization named in official notice",
            scopeOfWork: segment.slice(0, 12_000),
          },
          documents: [{
            // A register issue contains many unrelated notices. The fragment keeps one
            // source-document row per notice while still resolving to the official PDF.
            url: `${documentUrl}#notice=${notice.id}`,
            title: `${notice.title} — Florida Administrative Register ${issue.label}`,
            type: "official_notice",
            publishedAt: cleanDate(issue.label.replace(/\s*-\s*Vol[\s\S]*$/i, "")),
            metadata: { canonicalDocumentUrl: documentUrl, scopedText: segment, noticeId: notice.id },
          }],
        });
      }
    }
    return {
      records, sourceCount: noticesSeen,
      cursor: { latestIssueId: issues[0].id, latestIssue: issues[0].label, checkedAt: new Date().toISOString() },
      metadata: { issuesExamined: selected.length, noticesSeen },
    };
  },
};

const ADAPTERS: SourceAdapter[] = [
  mfmpAdapter, factsAdapter, samAdapter, usaspendingAdapter, fdotAdapter, miamiDadeAdapter, orlandoPermitsAdapter,
  ucfSolicitationsAdapter, browardCollegeForecastAdapter,
  floridaAdministrativeRegisterAdapter,
];

export function getOpportunitySourceAdapters() {
  return ADAPTERS;
}

export async function persistOpportunitySupplemental(sourceId: string, records: LiveSourceRecord[]) {
  let documentsSeen = 0;
  let amendmentsDetected = 0;
  let awardsDetected = 0;
  for (const record of records) {
    const opportunityRows = await queryDb(
      "SELECT id FROM oi_opportunities WHERE source_id=$1 AND source_record_id=$2 LIMIT 1",
      [sourceId, record.opportunity.sourceRecordId],
    );
    const opportunityId = opportunityRows[0]?.id;
    if (!opportunityId) continue;
    const contentHash = (record.opportunity.sourcePayload as Row | undefined)?.contentHash || hash(record.opportunity.sourcePayload || record.opportunity);
    const serviceSlug = classifyService(
      `${record.opportunity.title} ${record.opportunity.summary || ""}`,
      record.opportunity.tradeSlug,
    );
    await queryDb(
      `UPDATE oi_opportunities SET source_published_at=$3, source_updated_at=$4,
       last_status_checked_at=CURRENT_TIMESTAMP, stale_after=CURRENT_TIMESTAMP + INTERVAL '3 days',
       is_stale=FALSE, amendment_count=$5, content_hash=$6,
       service_category_id=COALESCE((SELECT id FROM oi_taxonomy_categories WHERE slug=$7 LIMIT 1), service_category_id)
       WHERE id=$1 AND source_id=$2`,
      [opportunityId, sourceId, record.publishedAt || null, record.updatedAt || null,
        (record.procurement?.amendments || []).length, String(contentHash), serviceSlug],
    );
    let procurementId: unknown = null;
    if (record.procurement) {
      const p = record.procurement;
      const rows = await queryDb(
        `INSERT INTO oi_procurement_records (
          opportunity_id, source_id, source_record_id, solicitation_number, purchasing_organization,
          title, scope_of_work, publication_date, submission_deadline, status, procurement_contact,
          required_licenses, required_certifications, mandatory_site_visit, geographic_coverage,
          source_url, document_urls, amendments, record_hash, source_payload, source_published_at,
          source_updated_at, last_status_checked_at, content_hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text[],$13::text[],$14,$15::jsonb,$16,$17::text[],$18::jsonb,$19,$20::jsonb,$21,$22,CURRENT_TIMESTAMP,$23)
        ON CONFLICT (source_id, source_record_id) DO UPDATE SET
          opportunity_id=EXCLUDED.opportunity_id, solicitation_number=EXCLUDED.solicitation_number,
          purchasing_organization=EXCLUDED.purchasing_organization, title=EXCLUDED.title,
          scope_of_work=EXCLUDED.scope_of_work, publication_date=EXCLUDED.publication_date,
          submission_deadline=EXCLUDED.submission_deadline, status=EXCLUDED.status,
          procurement_contact=EXCLUDED.procurement_contact, required_licenses=EXCLUDED.required_licenses,
          required_certifications=EXCLUDED.required_certifications, mandatory_site_visit=EXCLUDED.mandatory_site_visit,
          geographic_coverage=EXCLUDED.geographic_coverage, source_url=EXCLUDED.source_url,
          document_urls=EXCLUDED.document_urls, amendments=EXCLUDED.amendments, record_hash=EXCLUDED.record_hash,
          source_payload=EXCLUDED.source_payload, source_published_at=EXCLUDED.source_published_at,
          source_updated_at=EXCLUDED.source_updated_at, last_status_checked_at=CURRENT_TIMESTAMP,
          content_hash=EXCLUDED.content_hash, updated_at=CURRENT_TIMESTAMP RETURNING id`,
        [opportunityId, sourceId, record.opportunity.sourceRecordId, p.solicitationNumber,
          p.purchasingOrganization, record.opportunity.title, p.scopeOfWork || null, p.publicationDate || null,
          record.opportunity.procurementDeadline || null, record.opportunity.status,
          JSON.stringify(p.contact || {}), p.requiredLicenses || [], p.requiredCertifications || [],
          p.mandatorySiteVisit || null, JSON.stringify({ state: "FL", county: record.opportunity.county || null }),
          record.opportunity.sourceUrl, (record.documents || []).map((document) => document.url),
          JSON.stringify(p.amendments || []), String(contentHash), JSON.stringify(record.opportunity.sourcePayload || {}),
          record.publishedAt || null, record.updatedAt || null, String(contentHash)],
      );
      procurementId = rows[0]?.id;
    }
    const sourceDocuments = record.documents || [];
    if (sourceDocuments.length) {
      await queryDb(
        `UPDATE oi_source_documents SET is_current=FALSE, updated_at=CURRENT_TIMESTAMP
         WHERE source_id=$1 AND source_record_id=$2 AND is_current=TRUE
           AND NOT (document_url = ANY($3::text[]))`,
        [sourceId, record.opportunity.sourceRecordId, sourceDocuments.map((document) => document.url)],
      );
    }
    for (let index = 0; index < sourceDocuments.length; index += 1) {
      const document = sourceDocuments[index];
      documentsSeen += 1;
      if (document.type === "amendment") amendmentsDetected += 1;
      await queryDb(
        `INSERT INTO oi_source_documents (
          source_id, opportunity_id, procurement_record_id, source_record_id, document_url,
          title, document_type, version_label, version_number, published_at, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
        ON CONFLICT (source_id, document_url, version_number) DO UPDATE SET
          opportunity_id=EXCLUDED.opportunity_id, procurement_record_id=EXCLUDED.procurement_record_id,
          title=EXCLUDED.title, document_type=EXCLUDED.document_type, version_label=EXCLUDED.version_label,
          published_at=EXCLUDED.published_at, metadata=EXCLUDED.metadata, is_current=TRUE,
          updated_at=CURRENT_TIMESTAMP`,
        [sourceId, opportunityId, procurementId, record.opportunity.sourceRecordId, document.url,
          document.title, document.type || "attachment", document.version || null, index + 1,
          document.publishedAt || null, JSON.stringify(document.metadata || {})],
      );
    }
    if (record.award) {
      awardsDetected += 1;
      const award = record.award;
      await queryDb(
        `INSERT INTO oi_contract_awards (
          source_id, source_record_id, purchasing_organization, awarded_contractor, title,
          award_amount, award_date, contract_start_date, contract_expiration_date,
          renewal_options, source_url, source_payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        ON CONFLICT (source_id, source_record_id) DO UPDATE SET
          purchasing_organization=EXCLUDED.purchasing_organization, awarded_contractor=EXCLUDED.awarded_contractor,
          title=EXCLUDED.title, award_amount=EXCLUDED.award_amount, award_date=EXCLUDED.award_date,
          contract_start_date=EXCLUDED.contract_start_date, contract_expiration_date=EXCLUDED.contract_expiration_date,
          renewal_options=EXCLUDED.renewal_options, source_url=EXCLUDED.source_url,
          source_payload=EXCLUDED.source_payload, updated_at=CURRENT_TIMESTAMP`,
        [sourceId, award.sourceRecordId, award.purchasingOrganization, award.awardedContractor || null,
          award.title, award.awardAmount || null, award.awardDate || null, award.contractStartDate || null,
          award.contractExpirationDate || null, award.renewalOptions || null, award.sourceUrl,
          JSON.stringify(award.payload)],
      );
    }
  }
  return { documentsSeen, amendmentsDetected, awardsDetected };
}

export async function syncOpportunitySource(adapterKey: string, limit = 250) {
  const adapter = ADAPTERS.find((item) => item.adapterKey === adapterKey);
  if (!adapter) throw new Error(`Unknown opportunity source adapter: ${adapterKey}`);
  const lease = await queryDb(
    `UPDATE oi_source_sync_state SET lease_until=CURRENT_TIMESTAMP + INTERVAL '15 minutes',
       last_started_at=CURRENT_TIMESTAMP, last_status='running', updated_at=CURRENT_TIMESTAMP
     WHERE source_id=$1 AND enabled=TRUE AND (lease_until IS NULL OR lease_until < CURRENT_TIMESTAMP)
     RETURNING source_id, schedule_minutes`,
    [adapter.sourceId],
  );
  if (!lease.length) return { sourceId: adapter.sourceId, skipped: true, reason: "leased_or_disabled" };
  await queryDb(
    "UPDATE oi_data_sources SET last_attempted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1",
    [adapter.sourceId],
  );
  try {
    const result = await adapter.fetchRecords(limit);
    const ingestion = await ingestOpportunityBatch(
      adapter.sourceId, result.records.map((record) => record.opportunity),
      result.cursor ? JSON.stringify(result.cursor) : undefined,
    );
    const supplemental = await persistOpportunitySupplemental(adapter.sourceId, result.records);
    const metrics = { ...ingestion, ...supplemental, sourceCount: result.sourceCount ?? result.records.length };
    await queryDb(
      `UPDATE oi_source_sync_history SET documents_seen=$2, documents_changed=$3,
       amendments_detected=$4, awards_detected=$5, metadata=metadata || $6::jsonb
       WHERE id=$1`,
      [ingestion.runId, supplemental.documentsSeen, supplemental.documentsSeen,
        supplemental.amendmentsDetected, supplemental.awardsDetected,
        JSON.stringify({ sourceCount: result.sourceCount ?? result.records.length, adapterMetadata: result.metadata || {} })],
    );
    await queryDb(
      `UPDATE oi_source_sync_state SET lease_until=NULL, last_completed_at=CURRENT_TIMESTAMP,
       last_successful_at=CURRENT_TIMESTAMP, last_status='completed', consecutive_failures=0,
       last_error=NULL, cursor=$2::jsonb, last_metrics=$3::jsonb,
       next_run_at=CURRENT_TIMESTAMP + (schedule_minutes::text || ' minutes')::interval,
       updated_at=CURRENT_TIMESTAMP WHERE source_id=$1`,
      [adapter.sourceId, JSON.stringify(result.cursor || {}), JSON.stringify(metrics)],
    );
    await queryDb(
      `UPDATE oi_data_sources SET status='connected_current', is_operational=TRUE,
       last_attempted_at=CURRENT_TIMESTAMP, last_successful_at=CURRENT_TIMESTAMP,
       limitations=CASE WHEN id='usaspending-fl' THEN 'Award records document existing contracts; renewal timing signals are not confirmed solicitations.' ELSE limitations END,
       updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [adapter.sourceId],
    );
    return { skipped: false, ...metrics, sourceId: adapter.sourceId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const restricted = message.startsWith("ACCESS_RESTRICTED");
    await queryDb(
      `UPDATE oi_source_sync_state SET lease_until=NULL, last_completed_at=CURRENT_TIMESTAMP,
       last_status=$2, consecutive_failures=consecutive_failures+1, last_error=$3,
       next_run_at=CURRENT_TIMESTAMP + (LEAST(1440, schedule_minutes * power(2, LEAST(consecutive_failures + 1, 4)))::text || ' minutes')::interval,
       updated_at=CURRENT_TIMESTAMP WHERE source_id=$1`,
      [adapter.sourceId, restricted ? "access_restricted" : "failed", message],
    );
    await queryDb(
      `UPDATE oi_data_sources SET status=$2, is_operational=FALSE, last_attempted_at=CURRENT_TIMESTAMP,
       error_history=error_history || jsonb_build_array(jsonb_build_object('at', CURRENT_TIMESTAMP, 'message', $3::text)),
       updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [adapter.sourceId, restricted ? "access_restricted" : "error", message],
    );
    return { sourceId: adapter.sourceId, skipped: false, error: message };
  }
}

export async function resetOpportunitySourceCursors(sourceIds: string[]) {
  const requested = sourceIds.filter(Boolean);
  if (!requested.length) return 0;
  const rows = await queryDb(
    `UPDATE oi_source_sync_state
     SET cursor='{}'::jsonb, next_run_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
     WHERE source_id=ANY($1::text[]) RETURNING source_id`,
    [requested],
  );
  return rows.length;
}

export async function syncDueOpportunitySources(options: { force?: boolean; limitPerSource?: number; adapters?: string[] } = {}) {
  const allowed = options.adapters?.length ? new Set(options.adapters) : null;
  const dueRows = await queryDb(
    `SELECT adapter_key FROM oi_source_sync_state
     WHERE enabled=TRUE AND ($1::boolean OR next_run_at <= CURRENT_TIMESTAMP)
     ORDER BY next_run_at ASC`,
    [Boolean(options.force)],
  );
  const outcomes = [];
  for (const row of dueRows) {
    const key = String(row.adapter_key);
    if (allowed && !allowed.has(key)) continue;
    outcomes.push(await syncOpportunitySource(key, options.limitPerSource || 250));
  }
  await queryDb(
    `UPDATE oi_opportunities SET is_stale=TRUE
     WHERE stale_after IS NOT NULL AND stale_after < CURRENT_TIMESTAMP AND is_stale=FALSE`,
  );
  await queryDb(
    `UPDATE oi_data_sources source SET status='connected_stale', updated_at=CURRENT_TIMESTAMP
     FROM oi_source_sync_state state
     WHERE state.source_id=source.id AND state.last_successful_at IS NOT NULL
       AND state.last_successful_at < CURRENT_TIMESTAMP - (state.stale_after_minutes::text || ' minutes')::interval
       AND source.status='connected_current'`,
  );
  const health = await evaluateOpportunitySourceHealth();
  return { attempted: outcomes.length, outcomes, health, completedAt: new Date().toISOString() };
}

export async function evaluateOpportunitySourceHealth() {
  const states = await queryDb(
    `SELECT state.*, source.source_name, source.status AS source_status,
            COALESCE(document.failed_documents, 0)::int AS failed_documents,
            COALESCE(document.unsupported_documents, 0)::int AS unsupported_documents
     FROM oi_source_sync_state state
     JOIN oi_data_sources source ON source.id=state.source_id
     LEFT JOIN (
       SELECT source_id,
              count(*) FILTER (WHERE extraction_status='failed') AS failed_documents,
              count(*) FILTER (WHERE extraction_status='unsupported') AS unsupported_documents
       FROM oi_source_documents WHERE is_current=TRUE GROUP BY source_id
     ) document ON document.source_id=state.source_id
     WHERE state.enabled=TRUE`,
  );
  const opened: Row[] = [];
  let resolved = 0;
  for (const state of states) {
    const conditions: Array<{ code: string; severity: string; message: string; details: Row }> = [];
    const sourceName = String(state.source_name);
    if (["failed", "access_restricted"].includes(String(state.last_status)) || Number(state.consecutive_failures || 0) > 0) {
      conditions.push({
        code: "sync_failure",
        severity: Number(state.consecutive_failures || 0) >= 3 ? "critical" : "warning",
        message: `${sourceName} synchronization is ${String(state.last_status).replace(/_/g, " ")}.`,
        details: { consecutiveFailures: Number(state.consecutive_failures || 0), lastError: state.last_error || null },
      });
    }
    if (state.last_started_at && !state.last_successful_at) {
      conditions.push({
        code: "never_succeeded", severity: "warning",
        message: `${sourceName} has been attempted but has never completed successfully.`,
        details: { lastStartedAt: state.last_started_at, lastStatus: state.last_status },
      });
    }
    if (state.last_successful_at && new Date(String(state.last_successful_at)).getTime() < Date.now() - Number(state.stale_after_minutes) * 60_000) {
      conditions.push({
        code: "source_stale", severity: "critical",
        message: `${sourceName} is beyond its configured freshness window.`,
        details: { lastSuccessfulAt: state.last_successful_at, staleAfterMinutes: Number(state.stale_after_minutes) },
      });
    }
    if (Number(state.failed_documents || 0) > 0 || Number(state.unsupported_documents || 0) > 0) {
      conditions.push({
        code: "document_retrieval", severity: Number(state.failed_documents || 0) > 0 ? "warning" : "info",
        message: `${sourceName} has documents that could not be extracted through the published link.`,
        details: { failed: Number(state.failed_documents || 0), unsupported: Number(state.unsupported_documents || 0) },
      });
    }
    const activeCodes = conditions.map((condition) => condition.code);
    const resolvedRows = await queryDb(
      `UPDATE oi_source_alerts SET resolved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE source_id=$1 AND resolved_at IS NULL AND NOT (alert_code=ANY($2::text[])) RETURNING id`,
      [state.source_id, activeCodes],
    );
    resolved += resolvedRows.length;
    for (const condition of conditions) {
      const rows = await queryDb(
        `INSERT INTO oi_source_alerts (source_id, alert_code, severity, message, details)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (source_id, alert_code) WHERE resolved_at IS NULL DO UPDATE SET
           severity=EXCLUDED.severity, message=EXCLUDED.message, details=EXCLUDED.details,
           occurrence_count=oi_source_alerts.occurrence_count+1, last_seen_at=CURRENT_TIMESTAMP,
           updated_at=CURRENT_TIMESTAMP
         RETURNING *`,
        [state.source_id, condition.code, condition.severity, condition.message, JSON.stringify(condition.details)],
      );
      if (rows[0] && !rows[0].notified_at) opened.push(rows[0]);
    }
  }
  const webhook = process.env.OPPORTUNITY_ALERT_WEBHOOK_URL;
  if (webhook && opened.length) {
    try {
      const response = await fetch(webhook, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "opportunity_source_health", generatedAt: new Date().toISOString(), alerts: opened }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        await queryDb("UPDATE oi_source_alerts SET notified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=ANY($1::uuid[])", [opened.map((alert) => alert.id)]);
      }
    } catch {
      // Alerts remain visible in the source dashboard and unnotified for a later retry.
    }
  }
  const counts = await queryDb(
    `SELECT severity, count(*)::int AS count FROM oi_source_alerts
     WHERE resolved_at IS NULL GROUP BY severity ORDER BY severity`,
  );
  return { active: counts, newlyUnnotified: opened.length, resolved };
}
