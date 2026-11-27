import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { normalizeFirmName } from "@/lib/management-firm-portfolios";

const DBPR_NORTH_CONDOS_URL = "https://www2.myfloridalicense.com/sto/file_download/extracts/Condo_NF.csv";
const DBPR_CONDO_DIRECTORY_URL = "https://www2.myfloridalicense.com/condos-timeshares-mobile-homes/public-records/";
const ETHERIDGE_PORTFOLIO_URL = "https://www.epmfl.net/associations";
const NFI_PORTFOLIO_URL = "https://www.nfipms.com/managed-hoas";

type SourceDefinition = {
  key: string;
  name: string;
  type: string;
  url: string;
  jurisdiction: string;
  refreshHours: number;
};

type SourceState = {
  etag: string | null;
  last_modified: string | null;
  content_hash: string | null;
  next_refresh_at: string | Date | null;
};

type FetchResult = {
  text: string | null;
  hash: string | null;
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
  skipped: boolean;
  asOfDate: string;
};

type FirmIndexItem = {
  id: string;
  name: string;
  dba: string | null;
  aliases: Set<string>;
};

type RelationshipInput = {
  firm_id: string;
  source_key: string;
  source_record_id: string;
  discovery_direction: "firm_to_property" | "property_to_firm";
  relationship_kind: string;
  verification_level: string;
  is_verified_management: boolean;
  property_kind: string;
  canonical_property_key: string;
  property_name: string | null;
  property_address: string | null;
  city: string | null;
  county: string | null;
  state: string;
  zip_code: string | null;
  parcel_id: string | null;
  association_project_number: string | null;
  unit_count: number | null;
  published_portfolio_size: number | null;
  commercial_classification: string;
  management_responsibility: boolean;
  maintenance_responsibility: boolean;
  vendor_accessible: boolean;
  source_url: string;
  corroborating_source_url: string | null;
  evidence_summary: string;
  source_as_of_date: string;
  source_updated_at: string | null;
  content_hash: string;
  metadata: Record<string, unknown>;
};

type CollectorResult = {
  sourceKey: string;
  status: "succeeded" | "not_modified" | "skipped" | "failed";
  fetchedRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  details?: Record<string, unknown>;
  error?: string;
};

const SOURCES: SourceDefinition[] = [
  {
    key: "dbpr-north-condominiums",
    name: "Florida DBPR North Florida condominium directory",
    type: "official_government_extract",
    url: DBPR_NORTH_CONDOS_URL,
    jurisdiction: "North Florida",
    refreshHours: 168,
  },
  {
    key: "etheridge-published-associations",
    name: "Etheridge Property Management published associations",
    type: "official_firm_portfolio",
    url: ETHERIDGE_PORTFOLIO_URL,
    jurisdiction: "Northwest Florida",
    refreshHours: 168,
  },
  {
    key: "nfi-managed-hoas",
    name: "NFI Property Management Solutions managed HOA directory",
    type: "managed_community_directory",
    url: NFI_PORTFOLIO_URL,
    jurisdiction: "Escambia, Santa Rosa and nearby counties",
    refreshHours: 168,
  },
];

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function dateOnly(value: string | null | undefined) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "'", ndash: "-", mdash: "-",
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function htmlText(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePropertyName(value: string) {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(THE|INC|LLC|ASSOCIATION|ASSOC|ASSN|OWNERS|OWNER|HOMEOWNERS|PROPERTY|POA|HOA|COA|CONDOMINIUMS|CONDOMINIUM|CONDO|A|OF|AT|FLORIDA|FL)\b/g, " ")
    .replace(/\b(PHASE|TOWER|BUILDING)\s+[IVX0-9]+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function propertySimilarity(left: string, right: string) {
  const a = normalizePropertyName(left);
  const b = normalizePropertyName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 8 && (a.includes(b) || b.includes(a))) return 0.92;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = Array.from(aTokens).filter((token) => bTokens.has(token)).length;
  const union = new Set([...Array.from(aTokens), ...Array.from(bTokens)]).size;
  return union ? intersection / union : 0;
}

function propertyClassification(name: string) {
  if (/\b(COMMERCIAL|OFFICE|RETAIL|INDUSTRIAL)\b/i.test(name)) return "commercial";
  if (/\b(HOMEOWNERS?|CONDOMINIUMS?|CONDOS?|TOWNHOMES?|RESIDENCES?|APARTMENTS?)\b/i.test(name)) return "residential";
  return "unknown";
}

function canonicalKey(name: string, county: string | null) {
  return `community:${(county || "unknown").toLowerCase()}:${normalizePropertyName(name).toLowerCase().replace(/\s+/g, "-")}`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

async function registerSources() {
  for (const source of SOURCES) {
    await sql`
      INSERT INTO fl_management_portfolio_sources(
        source_key, source_name, source_type, source_url, jurisdiction, refresh_interval_hours
      ) VALUES (${source.key}, ${source.name}, ${source.type}, ${source.url}, ${source.jurisdiction}, ${source.refreshHours})
      ON CONFLICT (source_key) DO UPDATE SET
        source_name = EXCLUDED.source_name,
        source_type = EXCLUDED.source_type,
        source_url = EXCLUDED.source_url,
        jurisdiction = EXCLUDED.jurisdiction,
        refresh_interval_hours = EXCLUDED.refresh_interval_hours,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}

async function fetchSource(source: SourceDefinition, force: boolean): Promise<FetchResult> {
  const states = await sql`
    SELECT etag, last_modified, content_hash, next_refresh_at
    FROM fl_management_portfolio_sources WHERE source_key = ${source.key}
  ` as SourceState[];
  const state = states[0];
  if (!force && state?.next_refresh_at && new Date(state.next_refresh_at).getTime() > Date.now()) {
    return { text: null, hash: state.content_hash, etag: state.etag, lastModified: state.last_modified, notModified: false, skipped: true, asOfDate: dateOnly(state.last_modified) };
  }

  await sql`UPDATE fl_management_portfolio_sources SET last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_key = ${source.key}`;
  const headers: Record<string, string> = { "user-agent": "IntentOpportunityIntelligence/1.0 (+https://intentrev.net)" };
  if (!force && state?.etag) headers["if-none-match"] = state.etag;
  if (!force && state?.last_modified) headers["if-modified-since"] = state.last_modified;
  const response = await fetch(source.url, { headers, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (response.status === 304) {
    return { text: null, hash: state?.content_hash || null, etag: state?.etag || null, lastModified: state?.last_modified || null, notModified: true, skipped: false, asOfDate: dateOnly(state?.last_modified) };
  }
  if (!response.ok) throw new Error(`${source.key} returned HTTP ${response.status}`);
  const text = await response.text();
  const contentHash = hash(text);
  return {
    text,
    hash: contentHash,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    notModified: contentHash === state?.content_hash,
    skipped: false,
    asOfDate: dateOnly(response.headers.get("last-modified")),
  };
}

async function finishSource(source: SourceDefinition, fetched: FetchResult, count: number, error?: string) {
  if (error) {
    await sql`
      UPDATE fl_management_portfolio_sources
      SET consecutive_failures = consecutive_failures + 1,
          last_error = ${error.slice(0, 2000)},
          next_refresh_at = CURRENT_TIMESTAMP + INTERVAL '6 hours',
          updated_at = CURRENT_TIMESTAMP
      WHERE source_key = ${source.key}
    `;
    return;
  }
  await sql`
    UPDATE fl_management_portfolio_sources
    SET etag = COALESCE(${fetched.etag}, etag),
        last_modified = COALESCE(${fetched.lastModified}, last_modified),
        content_hash = COALESCE(${fetched.hash}, content_hash),
        last_success_at = CURRENT_TIMESTAMP,
        next_refresh_at = CURRENT_TIMESTAMP + (${source.refreshHours} * INTERVAL '1 hour'),
        last_record_count = ${count},
        consecutive_failures = 0,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE source_key = ${source.key}
  `;
}

async function ensureFirms() {
  await sql`
    INSERT INTO fl_management_firms(
      name, dba, firm_type, license_number, license_type, status, address, city, state,
      zip_code, county, phone, website, source, evidence_url, metadata, updated_at
    ) VALUES (
      'ETHERIDGE PROPERTY MANAGEMENT, INC.', 'Etheridge Property Management',
      'community_association_management', 'CAB121', 'CAM Firm',
      'Involuntary Inactive,Active',
      '908 GARDENGATE CIRCLE', 'PENSACOLA', 'FL', '32504', 'Escambia', '850-484-2611',
      ${ETHERIDGE_PORTFOLIO_URL}, 'FL_DBPR_AND_FIRST_PARTY',
      'https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=156183AF2BE7FF9F89322A17D1EDF93D',
      ${JSON.stringify({ dbpr_license_status: "Involuntary Inactive,Active", first_party_portfolio_source: ETHERIDGE_PORTFOLIO_URL })}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (license_number) WHERE license_number IS NOT NULL DO UPDATE SET
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      evidence_url = EXCLUDED.evidence_url,
      metadata = fl_management_firms.metadata || EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP
  `;
  await sql`
    UPDATE fl_management_firms
    SET website = ${NFI_PORTFOLIO_URL}, updated_at = CURRENT_TIMESTAMP
    WHERE license_number = 'CAB5586'
  `;

  const aliases = [
    { license: "CAB121", alias: "ETHERIDGE PROPERTY MANAGEMENT", kind: "published_name", status: "first_party", url: ETHERIDGE_PORTFOLIO_URL },
    { license: "CAB121", alias: "KEVIN ETHERIDGE", kind: "manager_name", status: "corroborated", url: ETHERIDGE_PORTFOLIO_URL },
    { license: "CAB5586", alias: "NFI PROPERTY MANAGEMENT SOLUTIONS", kind: "published_name", status: "first_party", url: NFI_PORTFOLIO_URL },
  ];
  for (const alias of aliases) {
    await sql`
      INSERT INTO fl_management_firm_aliases(firm_id, alias, normalized_alias, alias_kind, verification_status, source_url)
      SELECT id, ${alias.alias}, ${normalizeFirmName(alias.alias)}, ${alias.kind}, ${alias.status}, ${alias.url}
      FROM fl_management_firms WHERE license_number = ${alias.license}
      ON CONFLICT (firm_id, normalized_alias) DO UPDATE SET
        alias = EXCLUDED.alias,
        alias_kind = EXCLUDED.alias_kind,
        verification_status = EXCLUDED.verification_status,
        source_url = EXCLUDED.source_url,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}

async function firmIndex(): Promise<FirmIndexItem[]> {
  const firms = await sql`
    SELECT id, name, dba FROM fl_management_firms ORDER BY id
  ` as Array<{ id: string; name: string; dba: string | null }>;
  const aliases = await sql`SELECT firm_id, normalized_alias FROM fl_management_firm_aliases` as Array<{ firm_id: string; normalized_alias: string }>;
  const byFirm = new Map<string, Set<string>>();
  for (const alias of aliases) {
    const set = byFirm.get(alias.firm_id) || new Set<string>();
    set.add(alias.normalized_alias);
    byFirm.set(alias.firm_id, set);
  }
  return firms.map((firm) => ({
    ...firm,
    aliases: new Set([normalizeFirmName(firm.name), ...(firm.dba ? [normalizeFirmName(firm.dba)] : []), ...Array.from(byFirm.get(firm.id) || [])]),
  }));
}

function findFirm(index: FirmIndexItem[], candidate: string) {
  const normalized = normalizeFirmName(candidate.replace(/^C\/?O\s+/i, "").replace(/^ATTN:?\s+/i, ""));
  if (!normalized || normalized.length < 4) return null;
  return index.find((firm) => firm.aliases.has(normalized)) || null;
}

async function upsertRelationships(rows: RelationshipInput[]) {
  const batchSize = 250;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await sql`
      INSERT INTO fl_management_portfolio_relationships(
        firm_id, source_key, source_record_id, discovery_direction, relationship_kind,
        verification_level, is_verified_management, property_kind, canonical_property_key,
        property_name, property_address, city, county, state, zip_code, parcel_id,
        association_project_number, unit_count, published_portfolio_size,
        commercial_classification, management_responsibility, maintenance_responsibility,
        vendor_accessible, source_url, corroborating_source_url, evidence_summary,
        source_as_of_date, source_updated_at, content_hash, metadata, last_seen_at, is_current
      )
      SELECT firm_id, source_key, source_record_id, discovery_direction, relationship_kind,
             verification_level, is_verified_management, property_kind, canonical_property_key,
             property_name, property_address, city, county, state, zip_code, parcel_id,
             association_project_number, unit_count, published_portfolio_size,
             commercial_classification, management_responsibility, maintenance_responsibility,
             vendor_accessible, source_url, corroborating_source_url, evidence_summary,
             source_as_of_date, source_updated_at, content_hash, metadata, CURRENT_TIMESTAMP, TRUE
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS incoming(
        firm_id uuid, source_key varchar, source_record_id text, discovery_direction varchar,
        relationship_kind varchar, verification_level varchar, is_verified_management boolean,
        property_kind varchar, canonical_property_key text, property_name text,
        property_address text, city text, county text, state varchar, zip_code varchar,
        parcel_id text, association_project_number text, unit_count integer,
        published_portfolio_size integer, commercial_classification varchar,
        management_responsibility boolean, maintenance_responsibility boolean,
        vendor_accessible boolean, source_url text, corroborating_source_url text,
        evidence_summary text, source_as_of_date date, source_updated_at timestamptz,
        content_hash varchar, metadata jsonb
      )
      ON CONFLICT (source_key, source_record_id, firm_id, relationship_kind) DO UPDATE SET
        verification_level = EXCLUDED.verification_level,
        is_verified_management = EXCLUDED.is_verified_management,
        property_kind = EXCLUDED.property_kind,
        canonical_property_key = EXCLUDED.canonical_property_key,
        property_name = EXCLUDED.property_name,
        property_address = EXCLUDED.property_address,
        city = EXCLUDED.city,
        county = EXCLUDED.county,
        zip_code = EXCLUDED.zip_code,
        parcel_id = EXCLUDED.parcel_id,
        association_project_number = EXCLUDED.association_project_number,
        unit_count = EXCLUDED.unit_count,
        published_portfolio_size = EXCLUDED.published_portfolio_size,
        commercial_classification = EXCLUDED.commercial_classification,
        management_responsibility = EXCLUDED.management_responsibility,
        maintenance_responsibility = EXCLUDED.maintenance_responsibility,
        vendor_accessible = EXCLUDED.vendor_accessible,
        source_url = EXCLUDED.source_url,
        corroborating_source_url = EXCLUDED.corroborating_source_url,
        evidence_summary = EXCLUDED.evidence_summary,
        source_as_of_date = EXCLUDED.source_as_of_date,
        source_updated_at = EXCLUDED.source_updated_at,
        content_hash = EXCLUDED.content_hash,
        metadata = EXCLUDED.metadata,
        last_seen_at = CURRENT_TIMESTAMP,
        is_current = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}

async function markMissingRelationships(sourceKey: string, rows: RelationshipInput[]) {
  const recordKeys = Array.from(new Set(rows.map((row) => `${row.source_record_id}|${row.firm_id}|${row.relationship_kind}`)));
  await sql`
    UPDATE fl_management_portfolio_relationships
    SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE source_key = ${sourceKey}
      AND (source_record_id || '|' || firm_id::text || '|' || relationship_kind) NOT IN (
        SELECT jsonb_array_elements_text(${JSON.stringify(recordKeys)}::jsonb)
      )
  `;
}

function parseEtheridgeAssociations(html: string) {
  const headings: Array<{ text: string; index: number; end: number }> = [];
  const pattern = /<h4\b[^>]*>([\s\S]*?)<\/h4>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) headings.push({ text: htmlText(match[1]), index: match.index, end: pattern.lastIndex });
  const records: Array<{ name: string; county: string; accountingOnly: boolean }> = [];
  for (let index = 0; index < headings.length - 1; index += 1) {
    const name = headings[index].text;
    const countyHeading = headings[index + 1].text.match(/^(Escambia|Santa Rosa|Okaloosa|Walton) County\b/i);
    if (!countyHeading || !name || /^(Managed by|Documents|Our Associations)$/i.test(name)) continue;
    const segment = htmlText(html.slice(headings[index].end, Math.min(html.length, headings[index + 1].end + 2500)));
    if (!/Managed by:|For more information, please contact|Accounting Only/i.test(`${headings[index + 1].text} ${segment}`)) continue;
    const accountingOnly = /acct\s*only|accounting only/i.test(name)
      || (!/Managed by:/i.test(`${headings[index + 1].text} ${segment}`) && /accounting only/i.test(segment));
    records.push({ name, county: countyHeading[1].replace(/^./, (value) => value.toUpperCase()), accountingOnly });
  }
  const unique = new Map(records.map((record) => [`${record.county}:${normalizePropertyName(record.name)}`, record]));
  return Array.from(unique.values());
}

function parseNfiAssociations(html: string) {
  const start = html.search(/<h1\b[^>]*>[\s\S]*?Managed HOAs[\s\S]*?<\/h1>/i);
  const end = html.search(/NFI Property Management Solutions[\s\S]{0,500}7139 N 9th/i);
  const section = html.slice(Math.max(0, start), end > start ? end : html.length);
  const records: Array<{ name: string; url: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(section))) {
    const name = htmlText(match[2]);
    if (!/(Association|Homeowners|HOA|Owners|Townhouse)/i.test(name) || name.length < 8) continue;
    let url: string;
    try { url = new URL(decodeHtml(match[1]), NFI_PORTFOLIO_URL).toString(); } catch { continue; }
    records.push({ name, url });
  }
  return Array.from(new Map(records.map((record) => [normalizePropertyName(record.name), record])).values());
}

async function collectPublishedPortfolio(
  source: SourceDefinition,
  firmLicense: string,
  parser: (html: string) => Array<{ name: string; county?: string; accountingOnly?: boolean; url?: string }>,
  force: boolean,
): Promise<CollectorResult> {
  try {
    const fetched = await fetchSource(source, force);
    if (fetched.skipped) return { sourceKey: source.key, status: "skipped", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    if (fetched.notModified && !fetched.text) {
      await finishSource(source, fetched, Number((await sql`SELECT last_record_count FROM fl_management_portfolio_sources WHERE source_key = ${source.key}`)[0]?.last_record_count || 0));
      return { sourceKey: source.key, status: "not_modified", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    }
    const firms = await sql`SELECT id FROM fl_management_firms WHERE license_number = ${firmLicense} LIMIT 1` as Array<{ id: string }>;
    if (!firms[0] || !fetched.text || !fetched.hash) throw new Error(`Canonical firm ${firmLicense} is unavailable`);
    const parsed = parser(fetched.text);
    if (!parsed.length) throw new Error(`${source.key} parser returned zero records`);
    const accepted = parsed.filter((record) => !record.accountingOnly);
    const rows: RelationshipInput[] = accepted.map((record) => {
      const county = record.county || null;
      const name = record.name.replace(/\s+\(acct(?:ounting)?\s+only\)$/i, "").trim();
      return {
        firm_id: firms[0].id,
        source_key: source.key,
        source_record_id: hash(`${name}|${county || "unknown"}`).slice(0, 32),
        discovery_direction: "firm_to_property",
        relationship_kind: "verified_management",
        verification_level: "first_party",
        is_verified_management: true,
        property_kind: "community",
        canonical_property_key: canonicalKey(name, county),
        property_name: name,
        property_address: null,
        city: null,
        county,
        state: "FL",
        zip_code: null,
        parcel_id: null,
        association_project_number: null,
        unit_count: null,
        published_portfolio_size: null,
        commercial_classification: propertyClassification(name),
        management_responsibility: true,
        maintenance_responsibility: false,
        vendor_accessible: false,
        source_url: record.url || source.url,
        corroborating_source_url: null,
        evidence_summary: `${source.name} identifies ${name} as a managed association or community.`,
        source_as_of_date: fetched.asOfDate,
        source_updated_at: fetched.lastModified,
        content_hash: hash(`${fetched.hash}|${name}|${county || ""}`),
        metadata: { published_by_firm: true, accounting_only: false },
      };
    });
    if (firmLicense === "CAB121") {
      rows.push({
        firm_id: firms[0].id,
        source_key: source.key,
        source_record_id: "published-maintenance-department",
        discovery_direction: "firm_to_property",
        relationship_kind: "maintenance_responsibility",
        verification_level: "first_party",
        is_verified_management: false,
        property_kind: "unknown",
        canonical_property_key: "firm-service:etheridge:maintenance",
        property_name: null,
        property_address: null,
        city: "Pensacola",
        county: "Escambia",
        state: "FL",
        zip_code: "32504",
        parcel_id: null,
        association_project_number: null,
        unit_count: null,
        published_portfolio_size: null,
        commercial_classification: "unknown",
        management_responsibility: false,
        maintenance_responsibility: true,
        vendor_accessible: false,
        source_url: "https://www.epmfl.net/staff",
        corroborating_source_url: null,
        evidence_summary: "The firm's public staff directory documents a maintenance supervisor, maintenance technician, and maintenance contact channel.",
        source_as_of_date: fetched.asOfDate,
        source_updated_at: fetched.lastModified,
        content_hash: hash(`${fetched.hash}|maintenance-department`),
        metadata: { portfolio_scope_not_established: true, excluded_from_verified_floor: true },
      });
    }
    await upsertRelationships(rows);
    await markMissingRelationships(source.key, rows);
    await finishSource(source, fetched, parsed.length);
    return { sourceKey: source.key, status: "succeeded", fetchedRecords: parsed.length, acceptedRecords: rows.length, rejectedRecords: parsed.length - rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSource(source, { text: null, hash: null, etag: null, lastModified: null, notModified: false, skipped: false, asOfDate: dateOnly(null) }, 0, message);
    return { sourceKey: source.key, status: "failed", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0, error: message };
  }
}

async function collectDbprCondominiums(source: SourceDefinition, counties: string[], force: boolean): Promise<CollectorResult> {
  try {
    const fetched = await fetchSource(source, force);
    if (fetched.skipped) return { sourceKey: source.key, status: "skipped", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    if (fetched.notModified && !fetched.text) {
      await finishSource(source, fetched, Number((await sql`SELECT last_record_count FROM fl_management_portfolio_sources WHERE source_key = ${source.key}`)[0]?.last_record_count || 0));
      return { sourceKey: source.key, status: "not_modified", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    }
    if (!fetched.text || !fetched.hash) throw new Error("DBPR condominium extract returned no content");
    const countySet = new Set(counties.map((county) => county.toLowerCase()));
    const allRows = parseCsv(fetched.text);
    const targetRows = allRows.filter((row) => countySet.has(String(row.County || "").toLowerCase()));
    const firms = await firmIndex();
    const published = await sql`
      SELECT firm_id, canonical_property_key, property_name, county, source_url
      FROM fl_management_portfolio_relationships
      WHERE is_current = TRUE AND is_verified_management = TRUE
        AND source_key IN ('etheridge-published-associations', 'nfi-managed-hoas')
    ` as Array<{ firm_id: string; canonical_property_key: string; property_name: string; county: string | null; source_url: string }>;
    const relationships: RelationshipInput[] = [];
    let corroborated = 0;
    let contacts = 0;
    for (const row of targetRows) {
      const projectName = String(row["Condo Name"] || "").trim();
      const county = String(row.County || "").trim();
      const publishedMatch = published
        .filter((item) => !item.county || item.county.toLowerCase() === county.toLowerCase())
        .map((item) => ({ item, score: propertySimilarity(projectName, item.property_name) }))
        .filter((candidate) => candidate.score >= 0.82)
        .sort((left, right) => right.score - left.score)[0];
      const managingName = String(row["Managing Entity Name"] || "").trim();
      const route = String(row["Managing Entity Route"] || "").trim();
      const directFirm = findFirm(firms, managingName);
      const routeFirm = findFirm(firms, route);
      const firm = publishedMatch ? firms.find((item) => item.id === publishedMatch.item.firm_id) : directFirm;
      const units = Number.parseInt(String(row.Units || ""), 10);
      const address = String(row["Street City State Zip"] || "").trim() || null;
      const zipMatches = address ? Array.from(address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)) : [];
      const zip = zipMatches.length ? zipMatches[zipMatches.length - 1][1] : null;
      const projectNumber = String(row["Project Number"] || row["File Number"] || "").trim();
      if (firm) {
        const websiteEvidence = publishedMatch?.item.source_url || null;
        relationships.push({
          firm_id: firm.id,
          source_key: source.key,
          source_record_id: projectNumber,
          discovery_direction: "property_to_firm",
          relationship_kind: "verified_management",
          verification_level: publishedMatch ? "corroborated" : "authoritative",
          is_verified_management: true,
          property_kind: "community",
          canonical_property_key: publishedMatch?.item.canonical_property_key || canonicalKey(projectName, county),
          property_name: projectName,
          property_address: address,
          city: null,
          county,
          state: "FL",
          zip_code: zip,
          parcel_id: null,
          association_project_number: projectNumber,
          unit_count: Number.isInteger(units) && units > 0 ? units : null,
          published_portfolio_size: null,
          commercial_classification: propertyClassification(projectName),
          management_responsibility: true,
          maintenance_responsibility: false,
          vendor_accessible: false,
          source_url: DBPR_CONDO_DIRECTORY_URL,
          corroborating_source_url: websiteEvidence,
          evidence_summary: publishedMatch
            ? `DBPR identifies ${projectName} with ${units || "an unspecified number of"} units; the firm's published portfolio independently identifies the community as managed.`
            : `DBPR names ${managingName} as the managing entity for ${projectName}.`,
          source_as_of_date: fetched.asOfDate,
          source_updated_at: fetched.lastModified,
          content_hash: hash(JSON.stringify(row)),
          metadata: { dbpr_row: row, match_score: publishedMatch?.score || 1 },
        });
        corroborated += 1;
      } else if (routeFirm) {
        relationships.push({
          firm_id: routeFirm.id,
          source_key: source.key,
          source_record_id: projectNumber,
          discovery_direction: "property_to_firm",
          relationship_kind: "management_contact",
          verification_level: "supplementary",
          is_verified_management: false,
          property_kind: "community",
          canonical_property_key: canonicalKey(projectName, county),
          property_name: projectName,
          property_address: address,
          city: null,
          county,
          state: "FL",
          zip_code: zip,
          parcel_id: null,
          association_project_number: projectNumber,
          unit_count: Number.isInteger(units) && units > 0 ? units : null,
          published_portfolio_size: null,
          commercial_classification: propertyClassification(projectName),
          management_responsibility: false,
          maintenance_responsibility: false,
          vendor_accessible: false,
          source_url: DBPR_CONDO_DIRECTORY_URL,
          corroborating_source_url: null,
          evidence_summary: `DBPR lists ${route} only in the managing entity route field for ${projectName}; this is retained as a contact signal and does not establish management.`,
          source_as_of_date: fetched.asOfDate,
          source_updated_at: fetched.lastModified,
          content_hash: hash(JSON.stringify(row)),
          metadata: { dbpr_row: row, excluded_from_verified_floor: true },
        });
        contacts += 1;
      }
    }
    await upsertRelationships(relationships);
    await markMissingRelationships(source.key, relationships);
    await finishSource(source, fetched, targetRows.length);
    return {
      sourceKey: source.key,
      status: "succeeded",
      fetchedRecords: targetRows.length,
      acceptedRecords: relationships.length,
      rejectedRecords: targetRows.length - relationships.length,
      details: { corroboratedManagementRecords: corroborated, supplementaryContactRecords: contacts, counties },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSource(source, { text: null, hash: null, etag: null, lastModified: null, notModified: false, skipped: false, asOfDate: dateOnly(null) }, 0, message);
    return { sourceKey: source.key, status: "failed", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0, error: message };
  }
}

export async function syncManagementPortfolioSources(options?: { force?: boolean; counties?: string[] }) {
  const force = options?.force ?? false;
  const counties = options?.counties?.length ? options.counties : ["Escambia", "Santa Rosa"];
  await registerSources();
  await ensureFirms();
  const etheridge = SOURCES.find((source) => source.key === "etheridge-published-associations")!;
  const nfi = SOURCES.find((source) => source.key === "nfi-managed-hoas")!;
  const dbpr = SOURCES.find((source) => source.key === "dbpr-north-condominiums")!;
  const results = [];
  results.push(await collectPublishedPortfolio(etheridge, "CAB121", parseEtheridgeAssociations, force));
  results.push(await collectPublishedPortfolio(nfi, "CAB5586", parseNfiAssociations, force));
  results.push(await collectDbprCondominiums(dbpr, counties, force));
  return { counties, results };
}

export {
  DBPR_NORTH_CONDOS_URL,
  ETHERIDGE_PORTFOLIO_URL,
  NFI_PORTFOLIO_URL,
  normalizePropertyName,
  parseCsv,
  parseEtheridgeAssociations,
  parseNfiAssociations,
  propertySimilarity,
};
