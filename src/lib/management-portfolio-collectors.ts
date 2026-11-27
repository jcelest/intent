import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { normalizeFirmName } from "@/lib/management-firm-portfolios";

const DBPR_NORTH_CONDOS_URL = "https://www2.myfloridalicense.com/sto/file_download/extracts/Condo_NF.csv";
const DBPR_CONDO_DIRECTORY_URL = "https://www2.myfloridalicense.com/condos-timeshares-mobile-homes/public-records/";
const DBPR_LODGING_DIRECTORY_URL = "https://www2.myfloridalicense.com/hotels-restaurants/lodging-public-records/";
const HUD_MULTIFAMILY_LAYER_URL = "https://egis.hud.gov/arcgis/rest/services/cart/CARTMapService/MapServer/18";
const ETHERIDGE_PORTFOLIO_URL = "https://www.epmfl.net/associations";
const NFI_PORTFOLIO_URL = "https://www.nfipms.com/managed-hoas";

export const FLORIDA_COUNTIES = [
  "Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte",
  "Citrus", "Clay", "Collier", "Columbia", "DeSoto", "Dixie", "Duval", "Escambia",
  "Flagler", "Franklin", "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee",
  "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes", "Indian River", "Jackson",
  "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison", "Manatee",
  "Marion", "Martin", "Miami-Dade", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange",
  "Osceola", "Palm Beach", "Pasco", "Pinellas", "Polk", "Putnam", "Santa Rosa", "Sarasota",
  "Seminole", "St. Johns", "St. Lucie", "Sumter", "Suwannee", "Taylor", "Union", "Volusia",
  "Wakulla", "Walton", "Washington",
] as const;

const DBPR_COUNTY_CODES: Record<string, string> = {
  "11": "Alachua", "12": "Baker", "13": "Bay", "14": "Bradford", "15": "Brevard",
  "16": "Broward", "17": "Calhoun", "18": "Charlotte", "19": "Citrus", "20": "Clay",
  "21": "Collier", "22": "Columbia", "23": "Miami-Dade", "24": "DeSoto", "25": "Dixie",
  "26": "Duval", "27": "Escambia", "28": "Flagler", "29": "Franklin", "30": "Gadsden",
  "31": "Gilchrist", "32": "Glades", "33": "Gulf", "34": "Hamilton", "35": "Hardee",
  "36": "Hendry", "37": "Hernando", "38": "Highlands", "39": "Hillsborough", "40": "Holmes",
  "41": "Indian River", "42": "Jackson", "43": "Jefferson", "44": "Lafayette", "45": "Lake",
  "46": "Lee", "47": "Leon", "48": "Levy", "49": "Liberty", "50": "Madison",
  "51": "Manatee", "52": "Marion", "53": "Martin", "54": "Monroe", "55": "Nassau",
  "56": "Okaloosa", "57": "Okeechobee", "58": "Orange", "59": "Osceola", "60": "Palm Beach",
  "61": "Pasco", "62": "Pinellas", "63": "Polk", "64": "Putnam", "65": "St. Johns",
  "66": "St. Lucie", "67": "Santa Rosa", "68": "Sarasota", "69": "Seminole", "70": "Sumter",
  "71": "Suwannee", "72": "Taylor", "73": "Union", "74": "Volusia", "75": "Wakulla",
  "76": "Walton", "77": "Washington",
};

const DBPR_CONDO_REGIONS = [
  ["north", DBPR_NORTH_CONDOS_URL, "North Florida"],
  ["central-east", "https://www2.myfloridalicense.com/sto/file_download/extracts/condo_CE.csv", "Central Florida East"],
  ["central-west", "https://www2.myfloridalicense.com/sto/file_download/extracts/Condo_CW.csv", "Central Florida West"],
  ["miami-dade-monroe", "https://www2.myfloridalicense.com/sto/file_download/extracts/Condo_MD.csv", "Miami-Dade and Monroe"],
  ["broward-palm-beach", "https://www2.myfloridalicense.com/sto/file_download/extracts/condo_PB.csv", "Broward and Palm Beach"],
] as const;

const DBPR_LODGING_DISTRICTS = [6, 4, 1, 2, 3, 5, 7].map((district) => {
  return {
    key: `dbpr-lodging-district-${district}`,
    name: `Florida DBPR active lodging licenses, district ${district}`,
    type: "official_government_extract",
    url: `https://www2.myfloridalicense.com/sto/file_download/extracts/hrlodge${district}.csv`,
    jurisdiction: `Florida lodging district ${district}`,
    refreshHours: 168,
  } satisfies SourceDefinition;
});

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
  is_verified_portfolio: boolean;
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
  location_count: number | null;
  building_count: number | null;
  unit_count: number | null;
  square_feet: number | null;
  published_portfolio_size: number | null;
  commercial_classification: string;
  management_responsibility: boolean;
  maintenance_responsibility: boolean;
  service_relevant: boolean;
  maintenance_scope: Record<string, boolean>;
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
  ...DBPR_CONDO_REGIONS.map(([region, url, jurisdiction]) => ({
    key: region === "north" ? "dbpr-north-condominiums" : `dbpr-condominiums-${region}`,
    name: `Florida DBPR ${jurisdiction} condominium directory`,
    type: "official_government_extract",
    url,
    jurisdiction,
    refreshHours: 168,
  })),
  {
    key: "hud-assisted-multifamily-florida",
    name: "HUD assisted multifamily properties with management agents",
    type: "official_government_extract",
    url: HUD_MULTIFAMILY_LAYER_URL,
    jurisdiction: "Florida statewide",
    refreshHours: 168,
  },
  ...DBPR_LODGING_DISTRICTS,
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

type FirmCandidate = {
  externalKey: string;
  name: string;
  dba: string | null;
  firmType: string;
  address: string | null;
  city: string | null;
  state: string;
  zipCode: string | null;
  county: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  evidenceUrl: string;
  status: string;
  metadata: Record<string, unknown>;
};

function normalizeCounty(value: string | null | undefined) {
  const clean = String(value || "").replace(/\s+COUNTY$/i, "").trim();
  if (!clean) return null;
  if (/^(DADE|MIAMI DADE)$/i.test(clean)) return "Miami-Dade";
  if (/^DESOTO$/i.test(clean)) return "DeSoto";
  return clean.toLowerCase().replace(/(^|\s|-)\w/g, (letter) => letter.toUpperCase());
}

function canonicalAddressKey(address: string | null, city: string | null, zip: string | null, fallback: string) {
  const normalizedAddress = String(address || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!normalizedAddress) return fallback;
  const normalizedCity = String(city || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  return `address:${normalizedAddress}|${normalizedCity}|${String(zip || "").slice(0, 5)}`;
}

function looksLikeOrganization(value: string) {
  return /\b(LLC|L\.?L\.?C\.?|INC|INCORPORATED|CORP|CORPORATION|LTD|LIMITED|LP|L\.P\.|PARTNERSHIP|TRUST|AUTHORITY|FOUNDATION|MINISTRIES|ASSOCIATION|COMPANY|CO\.?|MANAGEMENT|PROPERTIES|PROPERTY|REALTY|GROUP|HOLDINGS|APARTMENTS|COMMUNITIES|RESORT|VACATION|RENTALS|HOUSING)\b/i.test(value);
}

function looksLikeManagementCompany(value: string) {
  if (/\b(HOMEOWNERS?|CONDOMINIUM|CONDO|OWNERS?|MASTER)\s+(ASSOCIATION|ASSN|ASSOC)\b/i.test(value)) return false;
  return /\b(MANAGEMENT|MANAGERS?|PROPERTY|PROPERTIES|REALTY|RESIDENTIAL|COMMUNITIES|HOUSING|PARTNERS|SERVICES|GROUP)\b/i.test(value)
    && looksLikeOrganization(value);
}

async function ensurePortfolioFirms(candidates: FirmCandidate[]) {
  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.externalKey, candidate])).values());
  if (!unique.length) return new Map<string, string>();
  const index = await firmIndex();
  const resolved = new Map<string, string>();
  const missing: FirmCandidate[] = [];
  for (const candidate of unique) {
    const existing = findFirm(index, candidate.name);
    if (existing) resolved.set(candidate.externalKey, existing.id);
    else missing.push(candidate);
  }

  const batchSize = 250;
  for (let offset = 0; offset < missing.length; offset += batchSize) {
    const batch = missing.slice(offset, offset + batchSize);
    await sql`
      INSERT INTO fl_management_firms(
        portfolio_external_key, name, dba, firm_type, status, address, city, state,
        zip_code, county, phone, email, source, evidence_url, metadata,
        managed_properties_count, updated_at
      )
      SELECT external_key, name, dba, firm_type, status, address, city, state,
             zip_code, county, phone, email, source, evidence_url, metadata,
             NULL, CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(batch.map((candidate) => ({
        external_key: candidate.externalKey,
        name: candidate.name,
        dba: candidate.dba,
        firm_type: candidate.firmType,
        status: candidate.status,
        address: candidate.address,
        city: candidate.city,
        state: candidate.state,
        zip_code: candidate.zipCode,
        county: candidate.county,
        phone: candidate.phone,
        email: candidate.email,
        source: candidate.source,
        evidence_url: candidate.evidenceUrl,
        metadata: candidate.metadata,
      })))}::jsonb) AS incoming(
        external_key text, name text, dba text, firm_type text, status text,
        address text, city text, state text, zip_code text, county text,
        phone text, email text, source text, evidence_url text, metadata jsonb
      )
      ON CONFLICT DO NOTHING
    `;
  }

  if (missing.length) {
    const keys = missing.map((candidate) => candidate.externalKey);
    const rows = await sql`
      SELECT id, portfolio_external_key
      FROM fl_management_firms
      WHERE portfolio_external_key IN (
        SELECT jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb)
      )
    ` as Array<{ id: string; portfolio_external_key: string }>;
    for (const row of rows) resolved.set(row.portfolio_external_key, row.id);
  }
  const refreshed = await firmIndex();
  for (const candidate of unique) {
    if (resolved.has(candidate.externalKey)) continue;
    const existing = findFirm(refreshed, candidate.name);
    if (existing) resolved.set(candidate.externalKey, existing.id);
  }
  return resolved;
}

function dedupeRelationships(rows: RelationshipInput[]) {
  return Array.from(new Map(rows.map((row) => [
    `${row.source_key}|${row.source_record_id}|${row.firm_id}|${row.relationship_kind}`,
    row,
  ])).values());
}

async function upsertRelationships(rows: RelationshipInput[]) {
  const uniqueRows = dedupeRelationships(rows);
  const batchSize = 250;
  for (let index = 0; index < uniqueRows.length; index += batchSize) {
    const batch = uniqueRows.slice(index, index + batchSize);
    await sql`
      INSERT INTO fl_management_portfolio_relationships(
        firm_id, source_key, source_record_id, discovery_direction, relationship_kind,
        verification_level, is_verified_management, is_verified_portfolio,
        property_kind, canonical_property_key,
        property_name, property_address, city, county, state, zip_code, parcel_id,
        association_project_number, location_count, building_count, unit_count, square_feet,
        published_portfolio_size,
        commercial_classification, management_responsibility, maintenance_responsibility,
        service_relevant, maintenance_scope, vendor_accessible,
        source_url, corroborating_source_url, evidence_summary,
        source_as_of_date, source_updated_at, content_hash, metadata, last_seen_at, is_current
      )
      SELECT firm_id, source_key, source_record_id, discovery_direction, relationship_kind,
             verification_level, is_verified_management, is_verified_portfolio,
             property_kind, canonical_property_key,
             property_name, property_address, city, county, state, zip_code, parcel_id,
             association_project_number, location_count, building_count, unit_count, square_feet,
             published_portfolio_size,
             commercial_classification, management_responsibility, maintenance_responsibility,
             service_relevant, maintenance_scope, vendor_accessible,
             source_url, corroborating_source_url, evidence_summary,
             source_as_of_date, source_updated_at, content_hash, metadata, CURRENT_TIMESTAMP, TRUE
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS incoming(
        firm_id uuid, source_key varchar, source_record_id text, discovery_direction varchar,
        relationship_kind varchar, verification_level varchar, is_verified_management boolean,
        is_verified_portfolio boolean,
        property_kind varchar, canonical_property_key text, property_name text,
        property_address text, city text, county text, state varchar, zip_code varchar,
        parcel_id text, association_project_number text, location_count integer,
        building_count integer, unit_count integer, square_feet bigint,
        published_portfolio_size integer, commercial_classification varchar,
        management_responsibility boolean, maintenance_responsibility boolean,
        service_relevant boolean, maintenance_scope jsonb,
        vendor_accessible boolean, source_url text, corroborating_source_url text,
        evidence_summary text, source_as_of_date date, source_updated_at timestamptz,
        content_hash varchar, metadata jsonb
      )
      ON CONFLICT (source_key, source_record_id, firm_id, relationship_kind) DO UPDATE SET
        verification_level = EXCLUDED.verification_level,
        is_verified_management = EXCLUDED.is_verified_management,
        is_verified_portfolio = EXCLUDED.is_verified_portfolio,
        property_kind = EXCLUDED.property_kind,
        canonical_property_key = EXCLUDED.canonical_property_key,
        property_name = EXCLUDED.property_name,
        property_address = EXCLUDED.property_address,
        city = EXCLUDED.city,
        county = EXCLUDED.county,
        zip_code = EXCLUDED.zip_code,
        parcel_id = EXCLUDED.parcel_id,
        association_project_number = EXCLUDED.association_project_number,
        location_count = EXCLUDED.location_count,
        building_count = EXCLUDED.building_count,
        unit_count = EXCLUDED.unit_count,
        square_feet = EXCLUDED.square_feet,
        published_portfolio_size = EXCLUDED.published_portfolio_size,
        commercial_classification = EXCLUDED.commercial_classification,
        management_responsibility = EXCLUDED.management_responsibility,
        maintenance_responsibility = EXCLUDED.maintenance_responsibility,
        service_relevant = EXCLUDED.service_relevant,
        maintenance_scope = EXCLUDED.maintenance_scope,
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
        is_verified_portfolio: true,
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
        location_count: 1,
        building_count: null,
        unit_count: null,
        square_feet: null,
        published_portfolio_size: null,
        commercial_classification: propertyClassification(name),
        management_responsibility: true,
        maintenance_responsibility: false,
        service_relevant: true,
        maintenance_scope: {},
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
        is_verified_portfolio: false,
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
        location_count: null,
        building_count: null,
        unit_count: null,
        square_feet: null,
        published_portfolio_size: null,
        commercial_classification: "unknown",
        management_responsibility: false,
        maintenance_responsibility: true,
        service_relevant: false,
        maintenance_scope: { individual_unit_repairs: true, common_area_maintenance: true },
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
    const discoveredCandidates: FirmCandidate[] = [];
    for (const row of targetRows) {
      const managingName = String(row["Managing Entity Name"] || "").trim();
      if (!managingName || !looksLikeManagementCompany(managingName)) continue;
      const normalized = normalizeFirmName(managingName);
      discoveredCandidates.push({
        externalKey: `dbpr-condo-manager:${hash(normalized).slice(0, 32)}`,
        name: managingName,
        dba: null,
        firmType: "community_association_management",
        address: String(row["Managing Entity Street"] || "").trim() || null,
        city: String(row["Managing Entity City"] || "").trim() || null,
        state: String(row["Managing Entity State"] || "FL").trim() || "FL",
        zipCode: String(row["Managing Entity Zip"] || "").slice(0, 5) || null,
        county: null,
        phone: null,
        email: null,
        source: "FL_DBPR_CONDOMINIUM_MANAGING_ENTITY",
        evidenceUrl: DBPR_CONDO_DIRECTORY_URL,
        status: "Current DBPR condominium managing entity",
        metadata: { official_record_type: "Florida condominium managing entity" },
      });
    }
    await ensurePortfolioFirms(discoveredCandidates);
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
          is_verified_portfolio: true,
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
          location_count: 1,
          building_count: null,
          unit_count: Number.isInteger(units) && units > 0 ? units : null,
          square_feet: null,
          published_portfolio_size: null,
          commercial_classification: propertyClassification(projectName),
          management_responsibility: true,
          maintenance_responsibility: false,
          service_relevant: true,
          maintenance_scope: {},
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
          is_verified_portfolio: false,
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
          location_count: 1,
          building_count: null,
          unit_count: Number.isInteger(units) && units > 0 ? units : null,
          square_feet: null,
          published_portfolio_size: null,
          commercial_classification: propertyClassification(projectName),
          management_responsibility: false,
          maintenance_responsibility: false,
          service_relevant: true,
          maintenance_scope: {},
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
    const uniqueRelationships = dedupeRelationships(relationships);
    await upsertRelationships(uniqueRelationships);
    await markMissingRelationships(source.key, uniqueRelationships);
    await updateCountyCoverage(source, counties, targetRows.map((row) => ({ county: normalizeCounty(String(row.County || "")) })), uniqueRelationships);
    await finishSource(source, fetched, targetRows.length);
    return {
      sourceKey: source.key,
      status: "succeeded",
      fetchedRecords: targetRows.length,
      acceptedRecords: uniqueRelationships.length,
      rejectedRecords: targetRows.length - uniqueRelationships.length,
      details: { corroboratedManagementRecords: corroborated, supplementaryContactRecords: contacts, counties },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSource(source, { text: null, hash: null, etag: null, lastModified: null, notModified: false, skipped: false, asOfDate: dateOnly(null) }, 0, message);
    return { sourceKey: source.key, status: "failed", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0, error: message };
  }
}

async function updateCountyCoverage(
  source: SourceDefinition,
  counties: readonly string[],
  sourceRows: Array<{ county: string | null }>,
  acceptedRows: RelationshipInput[],
) {
  const payload = counties.map((county) => {
    const sourceRecords = sourceRows.filter((row) => normalizeCounty(row.county)?.toLowerCase() === county.toLowerCase()).length;
    const accepted = acceptedRows.filter((row) => normalizeCounty(row.county)?.toLowerCase() === county.toLowerCase());
    return {
      source_key: source.key,
      county,
      source_records: sourceRecords,
      accepted_records: accepted.length,
      verified_firms: new Set(accepted.filter((row) => row.is_verified_portfolio).map((row) => row.firm_id)).size,
      verified_properties: accepted.filter((row) => row.is_verified_portfolio).reduce((sum, row) => sum + (row.location_count || 1), 0),
      verified_units: accepted.filter((row) => row.is_verified_portfolio).reduce((sum, row) => sum + (row.unit_count || 0), 0),
      status: sourceRecords > 0 ? "covered" : "no_records",
      limitation: sourceRecords > 0 ? null : "The source returned no current records for this county.",
    };
  });
  await sql`
    INSERT INTO fl_management_portfolio_county_coverage(
      source_key, county, source_records, accepted_records, verified_firms,
      verified_properties, verified_units, last_success_at, status, limitation, updated_at
    )
    SELECT source_key, county, source_records, accepted_records, verified_firms,
           verified_properties, verified_units, CURRENT_TIMESTAMP, status, limitation, CURRENT_TIMESTAMP
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS incoming(
      source_key varchar, county varchar, source_records integer, accepted_records integer,
      verified_firms integer, verified_properties integer, verified_units integer,
      status varchar, limitation text
    )
    ON CONFLICT (source_key, county) DO UPDATE SET
      source_records = EXCLUDED.source_records,
      accepted_records = EXCLUDED.accepted_records,
      verified_firms = EXCLUDED.verified_firms,
      verified_properties = EXCLUDED.verified_properties,
      verified_units = EXCLUDED.verified_units,
      last_success_at = EXCLUDED.last_success_at,
      status = EXCLUDED.status,
      limitation = EXCLUDED.limitation,
      updated_at = CURRENT_TIMESTAMP
  `;
}

type HudFeature = { attributes: Record<string, unknown> };

async function fetchHudFlorida(source: SourceDefinition, force: boolean) {
  const states = await sql`
    SELECT content_hash, next_refresh_at FROM fl_management_portfolio_sources WHERE source_key = ${source.key}
  ` as Array<{ content_hash: string | null; next_refresh_at: string | Date | null }>;
  const state = states[0];
  if (!force && state?.next_refresh_at && new Date(state.next_refresh_at).getTime() > Date.now()) {
    return { skipped: true, features: [] as HudFeature[], contentHash: state.content_hash, notModified: false };
  }
  await sql`UPDATE fl_management_portfolio_sources SET last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_key = ${source.key}`;
  const fields = [
    "OBJECTID", "PROPERTY_ID", "PROPERTY_NAME_TEXT", "STD_ADDR", "STD_CITY", "STD_ST", "STD_ZIP5",
    "CURCNTY_NM", "CNTY_NM2KX", "TOTAL_UNIT_COUNT", "MAXIMUM_CONTRACT_UNIT_COUNT",
    "MGMT_AGENT_ORG_NAME", "MGMT_CONTACT_FULL_NAME", "MGMT_CONTACT_INDV_TITLE_TEXT",
    "MGMT_CONTACT_ADDRESS_LINE1", "MGMT_CONTACT_ADDRESS_LINE2", "MGMT_CONTACT_CITY_NAME",
    "MGMT_CONTACT_STATE_CODE", "MGMT_CONTACT_ZIP_CODE", "MGMT_CONTACT_MAIN_PHN_NBR",
    "MGMT_CONTACT_EMAIL_TEXT", "IS_UNDER_MANAGEMENT_IND", "PROPERTY_CATEGORY_NAME",
    "PROGRAM_TYPE1", "PROGRAM_TYPE2", "LAT", "LON",
  ];
  const features: HudFeature[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URL(`${HUD_MULTIFAMILY_LAYER_URL}/query`);
    query.search = new URLSearchParams({
      f: "json",
      where: "STD_ST='FL' AND MGMT_AGENT_ORG_NAME IS NOT NULL",
      outFields: fields.join(","),
      returnGeometry: "false",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: "1000",
    }).toString();
    const response = await fetch(query, {
      headers: { "user-agent": "IntentOpportunityIntelligence/1.0 (+https://intentrev.net)" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`${source.key} returned HTTP ${response.status}`);
    const body = await response.json() as { features?: HudFeature[]; exceededTransferLimit?: boolean; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message || "HUD ArcGIS query failed");
    const page = body.features || [];
    features.push(...page);
    if (!body.exceededTransferLimit || page.length < 1000) break;
  }
  const contentHash = hash(JSON.stringify(features.map((feature) => feature.attributes)));
  return { skipped: false, features, contentHash, notModified: contentHash === state?.content_hash };
}

function positiveCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

async function collectHudMultifamily(source: SourceDefinition, counties: string[], force: boolean): Promise<CollectorResult> {
  try {
    const fetched = await fetchHudFlorida(source, force);
    if (fetched.skipped) return { sourceKey: source.key, status: "skipped", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    const countySet = new Set(counties.map((county) => county.toLowerCase()));
    const target = fetched.features.filter((feature) => {
      const attrs = feature.attributes;
      const county = normalizeCounty(String(attrs.CURCNTY_NM || attrs.CNTY_NM2KX || ""));
      return county && countySet.has(county.toLowerCase());
    });
    const candidates = new Map<string, FirmCandidate>();
    for (const feature of target) {
      const attrs = feature.attributes;
      const name = String(attrs.MGMT_AGENT_ORG_NAME || "").trim();
      if (!name) continue;
      const address = [attrs.MGMT_CONTACT_ADDRESS_LINE1, attrs.MGMT_CONTACT_ADDRESS_LINE2].filter(Boolean).join(" ").trim() || null;
      const zip = String(attrs.MGMT_CONTACT_ZIP_CODE || "").slice(0, 5) || null;
      const externalKey = `hud-management-agent:${hash(`${normalizeFirmName(name)}|${address || ""}|${zip || ""}`).slice(0, 32)}`;
      candidates.set(externalKey, {
        externalKey,
        name,
        dba: null,
        firmType: "multifamily_property_management",
        address,
        city: String(attrs.MGMT_CONTACT_CITY_NAME || "").trim() || null,
        state: String(attrs.MGMT_CONTACT_STATE_CODE || "FL").trim() || "FL",
        zipCode: zip,
        county: null,
        phone: String(attrs.MGMT_CONTACT_MAIN_PHN_NBR || "").trim() || null,
        email: String(attrs.MGMT_CONTACT_EMAIL_TEXT || "").trim() || null,
        source: "HUD_MULTIFAMILY_MANAGEMENT_AGENT",
        evidenceUrl: HUD_MULTIFAMILY_LAYER_URL,
        status: "Current HUD management agent",
        metadata: { federal_source: "HUD iREMS public multifamily layer", relationship_role: "management_agent" },
      });
    }
    const firmIds = await ensurePortfolioFirms(Array.from(candidates.values()));
    const currentIndex = await firmIndex();
    const relationships: RelationshipInput[] = [];
    for (const feature of target) {
      const attrs = feature.attributes;
      const managerName = String(attrs.MGMT_AGENT_ORG_NAME || "").trim();
      if (!managerName) continue;
      const managerAddress = [attrs.MGMT_CONTACT_ADDRESS_LINE1, attrs.MGMT_CONTACT_ADDRESS_LINE2].filter(Boolean).join(" ").trim() || null;
      const managerZip = String(attrs.MGMT_CONTACT_ZIP_CODE || "").slice(0, 5) || null;
      const externalKey = `hud-management-agent:${hash(`${normalizeFirmName(managerName)}|${managerAddress || ""}|${managerZip || ""}`).slice(0, 32)}`;
      const firmId = firmIds.get(externalKey) || findFirm(currentIndex, managerName)?.id;
      if (!firmId) continue;
      const propertyId = String(attrs.PROPERTY_ID || attrs.OBJECTID || "").trim();
      const propertyName = String(attrs.PROPERTY_NAME_TEXT || "").trim() || null;
      const address = String(attrs.STD_ADDR || "").trim() || null;
      const city = String(attrs.STD_CITY || "").trim() || null;
      const zip = String(attrs.STD_ZIP5 || "").slice(0, 5) || null;
      const county = normalizeCounty(String(attrs.CURCNTY_NM || attrs.CNTY_NM2KX || ""));
      const units = positiveCount(attrs.TOTAL_UNIT_COUNT) || positiveCount(attrs.MAXIMUM_CONTRACT_UNIT_COUNT);
      const recordUrl = `${HUD_MULTIFAMILY_LAYER_URL}/query?where=${encodeURIComponent(`PROPERTY_ID='${propertyId}'`)}&outFields=*&returnGeometry=false&f=html`;
      relationships.push({
        firm_id: firmId,
        source_key: source.key,
        source_record_id: propertyId,
        discovery_direction: "property_to_firm",
        relationship_kind: "verified_management",
        verification_level: "authoritative",
        is_verified_management: true,
        is_verified_portfolio: true,
        property_kind: "multifamily_property",
        canonical_property_key: canonicalAddressKey(address, city, zip, `hud-property:${propertyId}`),
        property_name: propertyName,
        property_address: address,
        city,
        county,
        state: "FL",
        zip_code: zip,
        parcel_id: null,
        association_project_number: propertyId,
        location_count: 1,
        building_count: null,
        unit_count: units,
        square_feet: null,
        published_portfolio_size: null,
        commercial_classification: "residential",
        management_responsibility: true,
        maintenance_responsibility: false,
        service_relevant: true,
        maintenance_scope: {},
        vendor_accessible: false,
        source_url: recordUrl,
        corroborating_source_url: null,
        evidence_summary: `HUD identifies ${managerName} as the management agent for ${propertyName || propertyId}${units ? `, with ${units} documented units` : ""}.`,
        source_as_of_date: new Date().toISOString().slice(0, 10),
        source_updated_at: null,
        content_hash: hash(JSON.stringify(attrs)),
        metadata: {
          hud_property_id: propertyId,
          property_category: attrs.PROPERTY_CATEGORY_NAME || null,
          program_type_1: attrs.PROGRAM_TYPE1 || null,
          program_type_2: attrs.PROGRAM_TYPE2 || null,
          under_management: attrs.IS_UNDER_MANAGEMENT_IND || null,
          latitude: attrs.LAT || null,
          longitude: attrs.LON || null,
          measurement_basis: "HUD total unit count",
        },
      });
    }
    const uniqueRelationships = dedupeRelationships(relationships);
    await upsertRelationships(uniqueRelationships);
    await markMissingRelationships(source.key, uniqueRelationships);
    await updateCountyCoverage(source, counties, target.map((feature) => ({ county: normalizeCounty(String(feature.attributes.CURCNTY_NM || feature.attributes.CNTY_NM2KX || "")) })), uniqueRelationships);
    await finishSource(source, {
      text: null, hash: fetched.contentHash, etag: null, lastModified: null,
      notModified: fetched.notModified, skipped: false, asOfDate: new Date().toISOString().slice(0, 10),
    }, target.length);
    return {
      sourceKey: source.key,
      status: fetched.notModified ? "not_modified" : "succeeded",
      fetchedRecords: target.length,
      acceptedRecords: uniqueRelationships.length,
      rejectedRecords: target.length - uniqueRelationships.length,
      details: { firms: new Set(uniqueRelationships.map((row) => row.firm_id)).size, authoritativeManagementAgentRecords: uniqueRelationships.length },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSource(source, { text: null, hash: null, etag: null, lastModified: null, notModified: false, skipped: false, asOfDate: dateOnly(null) }, 0, message);
    return { sourceKey: source.key, status: "failed", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0, error: message };
  }
}

function rowValue(row: Record<string, string>, ...aliases: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]+/g, ""), value]));
  for (const alias of aliases) {
    const value = normalized.get(alias.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    if (value !== undefined) return String(value).trim();
  }
  return "";
}

function dbprRowCounty(row: Record<string, string>, scope: "location" | "mailing" = "location") {
  const value = scope === "location"
    ? rowValue(row, "Location County", "Location County Name", "Location County Code", "County")
    : rowValue(row, "Mailing County", "Mailing County Name", "Mailing County Code");
  return DBPR_COUNTY_CODES[value.replace(/^0+/, "")] || normalizeCounty(value);
}

async function collectDbprLodging(source: SourceDefinition, counties: string[], force: boolean): Promise<CollectorResult> {
  try {
    const fetched = await fetchSource(source, force);
    if (fetched.skipped) return { sourceKey: source.key, status: "skipped", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    if (fetched.notModified && !fetched.text) {
      await finishSource(source, fetched, Number((await sql`SELECT last_record_count FROM fl_management_portfolio_sources WHERE source_key = ${source.key}`)[0]?.last_record_count || 0));
      return { sourceKey: source.key, status: "not_modified", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0 };
    }
    if (!fetched.text || !fetched.hash) throw new Error(`${source.key} returned no content`);
    const countySet = new Set(counties.map((county) => county.toLowerCase()));
    const allRows = parseCsv(fetched.text);
    const eligible = allRows.filter((row) => {
      const county = dbprRowCounty(row);
      if (!county || !countySet.has(county.toLowerCase())) return false;
      const type = rowValue(row, "License Type Code", "License Type");
      const modifier = rowValue(row, "Modifier Code", "Modifier").toUpperCase();
      const rank = rowValue(row, "Rank Code", "Rank").toUpperCase();
      return type === "2003" || ((type === "2006" || type === "2007") && (modifier === "GRP" || modifier === "CLCT"))
        || rank === "NAPT" || rank === "TAPT";
    });
    const candidates = new Map<string, FirmCandidate>();
    const rowKeys = new Map<Record<string, string>, string>();
    for (const row of eligible) {
      const name = rowValue(row, "Licensee Name", "Licensee/Applicant Name");
      if (!name || !looksLikeOrganization(name)) continue;
      const address = [rowValue(row, "Mailing Street Address Line 1", "Mailing Address 1"), rowValue(row, "Mailing Address Line 2", "Mailing Address 2")].filter(Boolean).join(" ") || null;
      const zip = rowValue(row, "Mailing Zip Code", "Mailing Zip").slice(0, 5) || null;
      const externalKey = `dbpr-lodging-operator:${hash(`${normalizeFirmName(name)}|${address || ""}|${zip || ""}`).slice(0, 32)}`;
      rowKeys.set(row, externalKey);
      const type = rowValue(row, "License Type Code", "License Type");
      candidates.set(externalKey, {
        externalKey,
        name,
        dba: rowValue(row, "Mailing Name", "Business Name", "Business Name (Location)") || null,
        firmType: type === "2003" ? "multifamily_operator" : "vacation_rental_operator",
        address,
        city: rowValue(row, "Mailing City") || null,
        state: rowValue(row, "Mailing State") || "FL",
        zipCode: zip,
        county: dbprRowCounty(row, "mailing"),
        phone: rowValue(row, "Primary Telephone Number", "Primary Telephone") || null,
        email: rowValue(row, "Email Address", "Licensee/Applicant E-Mail Address") || null,
        source: "FL_DBPR_LODGING_OPERATOR",
        evidenceUrl: DBPR_LODGING_DIRECTORY_URL,
        status: [rowValue(row, "Primary Status Code"), rowValue(row, "Secondary Status Code")].filter(Boolean).join(",") || "Active",
        metadata: { official_record_type: "Florida active public lodging license", operator_not_necessarily_third_party_manager: true },
      });
    }
    const firmIds = await ensurePortfolioFirms(Array.from(candidates.values()));
    const currentIndex = await firmIndex();
    const relationships: RelationshipInput[] = [];
    for (const row of eligible) {
      const name = rowValue(row, "Licensee Name", "Licensee/Applicant Name");
      const externalKey = rowKeys.get(row);
      const firmId = (externalKey && firmIds.get(externalKey)) || findFirm(currentIndex, name)?.id;
      if (!firmId || !externalKey) continue;
      const type = rowValue(row, "License Type Code", "License Type");
      const modifier = rowValue(row, "Modifier Code", "Modifier").toUpperCase();
      const rank = rowValue(row, "Rank Code", "Rank").toUpperCase();
      const licenseNumber = rowValue(row, "License Number");
      const propertyName = rowValue(row, "Business Name", "Business Name (Location)") || null;
      const address = [rowValue(row, "Location Street Address Line 1", "Location Address 1"), rowValue(row, "Location Address Line 2", "Location Address 2")].filter(Boolean).join(" ") || null;
      const city = rowValue(row, "Location City") || null;
      const zip = rowValue(row, "Location Zip Code", "Location Zip").slice(0, 5) || null;
      const county = dbprRowCounty(row);
      const units = positiveCount(rowValue(row, "Number of Rental Units", "Number of Seats or Rental Units", "Number of Seats (food service) or Rental Units (lodging)", "Seats/Rental Units"));
      const vacation = type === "2006" || type === "2007";
      const locationCount = vacation && modifier === "CLCT" ? units : 1;
      relationships.push({
        firm_id: firmId,
        source_key: source.key,
        source_record_id: licenseNumber,
        discovery_direction: "property_to_firm",
        relationship_kind: "licensed_operator",
        verification_level: "authoritative",
        is_verified_management: false,
        is_verified_portfolio: true,
        property_kind: vacation ? "vacation_rental_portfolio" : "multifamily_property",
        canonical_property_key: canonicalAddressKey(address, city, zip, `dbpr-lodging:${licenseNumber}`),
        property_name: propertyName,
        property_address: address,
        city,
        county,
        state: "FL",
        zip_code: zip,
        parcel_id: null,
        association_project_number: null,
        location_count: locationCount,
        building_count: null,
        unit_count: units,
        square_feet: null,
        published_portfolio_size: null,
        commercial_classification: "residential",
        management_responsibility: false,
        maintenance_responsibility: false,
        service_relevant: true,
        maintenance_scope: {},
        vendor_accessible: false,
        source_url: DBPR_LODGING_DIRECTORY_URL,
        corroborating_source_url: null,
        evidence_summary: `Florida DBPR identifies ${name} as the licensed operator for ${propertyName || licenseNumber}${units ? `, covering ${units} rental units` : ""}. This establishes an operator portfolio, not a third-party management contract.`,
        source_as_of_date: fetched.asOfDate,
        source_updated_at: fetched.lastModified,
        content_hash: hash(JSON.stringify(row)),
        metadata: {
          dbpr_license_number: licenseNumber,
          license_type_code: type,
          rank_code: rank,
          modifier_code: modifier,
          operator_not_necessarily_owner: true,
          operator_not_verified_third_party_manager: true,
          location_measurement: modifier === "CLCT" ? "rental location addresses" : "licensed establishment",
        },
      });
    }
    const uniqueRelationships = dedupeRelationships(relationships);
    await upsertRelationships(uniqueRelationships);
    await markMissingRelationships(source.key, uniqueRelationships);
    const sourceCountRows = allRows.map((row) => ({ county: dbprRowCounty(row) }));
    await updateCountyCoverage(source, counties, sourceCountRows, uniqueRelationships);
    await finishSource(source, fetched, allRows.length);
    return {
      sourceKey: source.key,
      status: "succeeded",
      fetchedRecords: allRows.length,
      acceptedRecords: uniqueRelationships.length,
      rejectedRecords: eligible.length - uniqueRelationships.length,
      details: {
        eligibleOperatorRecords: eligible.length,
        organizationOperatorRecords: uniqueRelationships.length,
        firms: new Set(uniqueRelationships.map((row) => row.firm_id)).size,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSource(source, { text: null, hash: null, etag: null, lastModified: null, notModified: false, skipped: false, asOfDate: dateOnly(null) }, 0, message);
    return { sourceKey: source.key, status: "failed", fetchedRecords: 0, acceptedRecords: 0, rejectedRecords: 0, error: message };
  }
}

export async function syncManagementPortfolioSources(options?: { force?: boolean; counties?: string[]; sourceKeys?: string[] }) {
  const force = options?.force ?? false;
  const counties = options?.counties?.length ? options.counties : [...FLORIDA_COUNTIES];
  await registerSources();
  await ensureFirms();
  const etheridge = SOURCES.find((source) => source.key === "etheridge-published-associations")!;
  const nfi = SOURCES.find((source) => source.key === "nfi-managed-hoas")!;
  const hud = SOURCES.find((source) => source.key === "hud-assisted-multifamily-florida")!;
  const condominiumSources = SOURCES.filter((source) => source.key === "dbpr-north-condominiums" || source.key.startsWith("dbpr-condominiums-"));
  const lodgingSources = SOURCES.filter((source) => source.key.startsWith("dbpr-lodging-district-"));
  const selected = options?.sourceKeys?.length ? new Set(options.sourceKeys) : null;
  const shouldRun = (source: SourceDefinition) => !selected || selected.has(source.key);
  const results = [];
  if (shouldRun(etheridge)) results.push(await collectPublishedPortfolio(etheridge, "CAB121", parseEtheridgeAssociations, force));
  if (shouldRun(nfi)) results.push(await collectPublishedPortfolio(nfi, "CAB5586", parseNfiAssociations, force));
  if (shouldRun(hud)) results.push(await collectHudMultifamily(hud, counties, force));
  for (const source of condominiumSources.filter(shouldRun)) results.push(await collectDbprCondominiums(source, counties, force));
  for (const source of lodgingSources.filter(shouldRun)) results.push(await collectDbprLodging(source, counties, force));
  return { counties, statewide: counties.length === FLORIDA_COUNTIES.length, results };
}

export {
  DBPR_NORTH_CONDOS_URL,
  DBPR_LODGING_DIRECTORY_URL,
  HUD_MULTIFAMILY_LAYER_URL,
  ETHERIDGE_PORTFOLIO_URL,
  NFI_PORTFOLIO_URL,
  normalizePropertyName,
  parseCsv,
  parseEtheridgeAssociations,
  parseNfiAssociations,
  propertySimilarity,
  rowValue,
};
