import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { FLORIDA_COUNTIES } from "@/lib/management-portfolio-collectors";
import { normalizeFirmName } from "@/lib/management-firm-portfolios";

export const PORTFOLIO_TYPES = [
  "multifamily", "single_family_rental", "commercial", "hoa", "condominium",
  "hospitality", "vacation_rental", "other",
] as const;

export const MAINTENANCE_TRADES = [
  "general_maintenance", "hvac", "building_automation", "controls", "remote_monitoring",
  "refrigeration", "energy_optimization", "electrical", "plumbing", "mechanical",
  "roofing", "landscaping", "janitorial", "fire_protection", "security", "elevators",
  "pest_control", "pool", "fencing", "restoration", "construction", "other",
] as const;

type PortfolioType = typeof PORTFOLIO_TYPES[number];
type VerificationClass = "authoritative" | "first_party_self_reported" | "indirect" | "manual_confirmed";
type IntelligenceType =
  | "portfolio_type" | "maintenance_responsibility" | "maintenance_delivery_model"
  | "vendor_onboarding" | "vendor_requirement" | "purchasing_contact"
  | "maintenance_contract" | "purchasing_activity" | "contractor_relationship"
  | "service_volume" | "geographic_portfolio";

type IntelligenceInput = {
  firm_id: string;
  source_key: string;
  source_record_id: string;
  intelligence_type: IntelligenceType;
  verification_class: VerificationClass;
  fact_status: "verified" | "self_reported" | "indirect" | "unknown";
  portfolio_type?: PortfolioType | null;
  trade_category?: string | null;
  service_category?: string | null;
  county?: string | null;
  zip_code?: string | null;
  delivery_model?: "in_house" | "outsourced" | "mixed" | "unknown" | null;
  responsibility_scope?: string | null;
  title: string;
  summary: string;
  purchasing_contact_name?: string | null;
  purchasing_contact_email?: string | null;
  purchasing_contact_phone?: string | null;
  vendor_registration_url?: string | null;
  documented_volume?: number | null;
  structured_data?: Record<string, unknown>;
  source_url: string;
  source_as_of_date: string;
  permanent?: boolean;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
};

type SourceDefinition = {
  key: string;
  name: string;
  type: "authoritative_government" | "official_company_website" | "official_vendor_portal" | "facility_document" | "manual_confirmation";
  url: string;
  scope: "statewide" | "national" | "firm" | "property" | "county";
  refreshHours: number;
};

const SOURCES: SourceDefinition[] = [
  { key: "portfolio-relationships-derived", name: "Authoritative portfolio relationship classifications", type: "authoritative_government", url: "https://intentrev.net/admin/opportunity-intelligence/sources", scope: "statewide", refreshHours: 168 },
  { key: "etheridge-maintenance-proposal", name: "Etheridge published management and maintenance scope", type: "official_company_website", url: "https://www.epmfl.net/proposal", scope: "firm", refreshHours: 168 },
  { key: "etheridge-published-vendor-relationship", name: "Etheridge published vendor and purchasing newsletter", type: "facility_document", url: "https://www.epmfl.net/_files/ugd/4ba896_ad1555ae164542fba750a6010b895603.pdf", scope: "firm", refreshHours: 720 },
  { key: "nfi-maintenance-services", name: "NFI published maintenance and vendor responsibilities", type: "official_company_website", url: "https://www.nfipms.com/", scope: "firm", refreshHours: 168 },
  { key: "greystar-us-supplier-program", name: "Greystar U.S. Supplier Partnerships", type: "official_vendor_portal", url: "https://www.greystar.com/contact-us/supplier-and-vendor-opportunities/us-supplier-partnerships", scope: "national", refreshHours: 168 },
  { key: "cbre-us-supplier-shield", name: "CBRE U.S. Supplier Shield", type: "official_vendor_portal", url: "https://www.cbre.com/about-us/supply-chain/supplier-shield-training-portal", scope: "national", refreshHours: 168 },
  { key: "associa-published-services", name: "Associa published management, maintenance, and vendor services", type: "official_company_website", url: "https://www.associaonline.com/ai-info-page", scope: "national", refreshHours: 168 },
  { key: "verified-official-firm-websites", name: "Verified official management firm websites", type: "official_company_website", url: "https://intentrev.net/admin/opportunity-intelligence/management-firms", scope: "statewide", refreshHours: 720 },
  { key: "manual-confirmed-maintenance-intelligence", name: "Administrator-confirmed source-attributed intelligence", type: "manual_confirmation", url: "https://intentrev.net/admin/opportunity-intelligence/management-firms", scope: "statewide", refreshHours: 8760 },
];

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (value: unknown) => {
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? today() : parsed.toISOString().slice(0, 10);
};

export function classifyPortfolioRelationship(input: {
  sourceKey?: string | null;
  propertyKind?: string | null;
  commercialClassification?: string | null;
  metadata?: Record<string, unknown> | null;
}): PortfolioType[] {
  const result = new Set<PortfolioType>();
  const source = String(input.sourceKey || "").toLowerCase();
  const kind = String(input.propertyKind || "").toLowerCase();
  const classification = String(input.commercialClassification || "").toLowerCase();
  const metadata = input.metadata || {};
  const licenseType = String(metadata.license_type || metadata.rank || metadata.modifier || "").toLowerCase();
  if (kind === "multifamily_property") result.add("multifamily");
  if (kind === "vacation_rental_portfolio" || /vacation|grp|clct/.test(licenseType)) result.add("vacation_rental");
  if (kind === "commercial_location" || classification === "commercial") result.add("commercial");
  if (kind === "condominium_unit" || source.includes("condominium")) result.add("condominium");
  if (kind === "association" || source.includes("managed-hoas") || source.includes("published-associations")) result.add("hoa");
  if (/hotel|motel|hospitality/.test(licenseType)) result.add("hospitality");
  return Array.from(result);
}

async function registerSources() {
  for (const source of SOURCES) {
    await sql`
      INSERT INTO fl_maintenance_intelligence_sources(
        source_key, source_name, source_type, source_url, geographic_scope,
        refresh_interval_hours, next_refresh_at, metadata
      ) VALUES (
        ${source.key}, ${source.name}, ${source.type}, ${source.url}, ${source.scope},
        ${source.refreshHours}, CURRENT_TIMESTAMP, ${JSON.stringify({ uniform_statewide_schedule: true })}::jsonb
      )
      ON CONFLICT(source_key) DO UPDATE SET
        source_name=EXCLUDED.source_name, source_type=EXCLUDED.source_type,
        source_url=EXCLUDED.source_url, geographic_scope=EXCLUDED.geographic_scope,
        refresh_interval_hours=EXCLUDED.refresh_interval_hours, updated_at=CURRENT_TIMESTAMP
    `;
  }
}

async function upsertEvidence(rows: IntelligenceInput[]) {
  if (!rows.length) return 0;
  const payload = rows.map((row) => ({
    ...row,
    structured_data: row.structured_data || {},
    permanent: Boolean(row.permanent),
    content_hash: hash(JSON.stringify(row)),
  }));
  for (let index = 0; index < payload.length; index += 500) {
    const batch = payload.slice(index, index + 500);
    await sql`
      INSERT INTO fl_maintenance_purchasing_intelligence(
        firm_id, source_key, source_record_id, intelligence_type, verification_class,
        fact_status, portfolio_type, trade_category, service_category, county, zip_code,
        delivery_model, responsibility_scope, title, summary, purchasing_contact_name,
        purchasing_contact_email, purchasing_contact_phone, vendor_registration_url,
        documented_volume, structured_data, source_url, source_as_of_date, permanent,
        confirmed_by, confirmed_at, content_hash
      )
      SELECT firm_id, source_key, source_record_id, intelligence_type, verification_class,
        fact_status, portfolio_type, trade_category, service_category, county, zip_code,
        delivery_model, responsibility_scope, title, summary, purchasing_contact_name,
        purchasing_contact_email, purchasing_contact_phone, vendor_registration_url,
        documented_volume, structured_data, source_url, source_as_of_date, permanent,
        confirmed_by, confirmed_at, content_hash
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS incoming(
        firm_id uuid, source_key varchar, source_record_id text, intelligence_type varchar,
        verification_class varchar, fact_status varchar, portfolio_type varchar,
        trade_category varchar, service_category varchar, county varchar, zip_code varchar,
        delivery_model varchar, responsibility_scope varchar, title text, summary text,
        purchasing_contact_name text, purchasing_contact_email text, purchasing_contact_phone text,
        vendor_registration_url text, documented_volume integer, structured_data jsonb,
        source_url text, source_as_of_date date, permanent boolean, confirmed_by text,
        confirmed_at timestamptz, content_hash varchar
      )
      ON CONFLICT(firm_id, source_key, source_record_id, intelligence_type) DO UPDATE SET
        verification_class=EXCLUDED.verification_class, fact_status=EXCLUDED.fact_status,
        portfolio_type=EXCLUDED.portfolio_type, trade_category=EXCLUDED.trade_category,
        service_category=EXCLUDED.service_category, county=EXCLUDED.county,
        zip_code=EXCLUDED.zip_code, delivery_model=EXCLUDED.delivery_model,
        responsibility_scope=EXCLUDED.responsibility_scope, title=EXCLUDED.title,
        summary=EXCLUDED.summary, purchasing_contact_name=EXCLUDED.purchasing_contact_name,
        purchasing_contact_email=EXCLUDED.purchasing_contact_email,
        purchasing_contact_phone=EXCLUDED.purchasing_contact_phone,
        vendor_registration_url=EXCLUDED.vendor_registration_url,
        documented_volume=EXCLUDED.documented_volume, structured_data=EXCLUDED.structured_data,
        source_url=EXCLUDED.source_url, source_as_of_date=EXCLUDED.source_as_of_date,
        last_seen_at=CURRENT_TIMESTAMP, is_current=TRUE,
        permanent=fl_maintenance_purchasing_intelligence.permanent OR EXCLUDED.permanent,
        confirmed_by=COALESCE(EXCLUDED.confirmed_by, fl_maintenance_purchasing_intelligence.confirmed_by),
        confirmed_at=COALESCE(EXCLUDED.confirmed_at, fl_maintenance_purchasing_intelligence.confirmed_at),
        content_hash=EXCLUDED.content_hash, updated_at=CURRENT_TIMESTAMP
    `;
  }
  return payload.length;
}

async function syncDerivedPortfolioEvidence() {
  const relationships = await sql`
    SELECT id::text, firm_id::text, source_key, property_kind, commercial_classification,
           county, zip_code, source_url, source_as_of_date, metadata
    FROM fl_management_portfolio_relationships
    WHERE is_current=TRUE AND is_verified_portfolio=TRUE
  ` as Array<Record<string, unknown>>;
  const rows: IntelligenceInput[] = [];
  for (const relationship of relationships) {
    const types = classifyPortfolioRelationship({
      sourceKey: String(relationship.source_key || ""),
      propertyKind: String(relationship.property_kind || ""),
      commercialClassification: String(relationship.commercial_classification || ""),
      metadata: relationship.metadata as Record<string, unknown> | null,
    });
    for (const portfolioType of types) {
      rows.push({
        firm_id: String(relationship.firm_id), source_key: "portfolio-relationships-derived",
        source_record_id: `${relationship.id}:${portfolioType}`, intelligence_type: "portfolio_type",
        verification_class: "authoritative", fact_status: "verified", portfolio_type: portfolioType,
        county: relationship.county ? String(relationship.county) : null,
        zip_code: relationship.zip_code ? String(relationship.zip_code) : null,
        title: `${portfolioType.replaceAll("_", " ")} portfolio`,
        summary: `Portfolio type is derived from an active authoritative relationship whose documented property kind is ${String(relationship.property_kind).replaceAll("_", " ")}.`,
        structured_data: { relationship_id: relationship.id, source_key: relationship.source_key },
        source_url: String(relationship.source_url),
        source_as_of_date: dateOnly(relationship.source_as_of_date),
      });
    }
  }
  await sql`UPDATE fl_maintenance_purchasing_intelligence SET is_current=FALSE, updated_at=CURRENT_TIMESTAMP WHERE source_key='portfolio-relationships-derived' AND permanent=FALSE`;
  await upsertEvidence(rows);
  await sql`
    UPDATE fl_maintenance_intelligence_sources
    SET last_attempt_at=CURRENT_TIMESTAMP, last_success_at=CURRENT_TIMESTAMP,
        next_refresh_at=CURRENT_TIMESTAMP + INTERVAL '168 hours', last_record_count=${rows.length},
        consecutive_failures=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE source_key='portfolio-relationships-derived'
  `;
  return { fetched: relationships.length, accepted: rows.length };
}

type CuratedFact = Omit<IntelligenceInput, "firm_id" | "source_as_of_date">;
type CuratedProgram = { sourceKey: string; aliases: string[]; facts: CuratedFact[] };

const CURATED_PROGRAMS: CuratedProgram[] = [
  {
    sourceKey: "etheridge-maintenance-proposal", aliases: ["ETHERIDGE PROPERTY MANAGEMENT"], facts: [
      { source_key: "etheridge-maintenance-proposal", source_record_id: "common-systems-maintenance", intelligence_type: "maintenance_responsibility", verification_class: "first_party_self_reported", fact_status: "self_reported", trade_category: "general_maintenance", service_category: "common_area_maintenance", responsibility_scope: "common_areas", title: "Common-area and building-system maintenance supervision", summary: "Etheridge states that it supervises common-area and lawn maintenance, inspects common areas, and ensures maintenance for common mechanical and plumbing systems and buildings.", structured_data: { documented_trades: ["mechanical", "plumbing", "landscaping", "general_maintenance"] }, source_url: "https://www.epmfl.net/proposal" },
      { source_key: "etheridge-maintenance-proposal", source_record_id: "contracts-rebid", intelligence_type: "purchasing_activity", verification_class: "first_party_self_reported", fact_status: "self_reported", service_category: "service_contract_management", title: "Existing contracts reviewed and rebid", summary: "Etheridge states that it reviews and enforces existing contracts and rebids them as necessary.", structured_data: { activity: "contract_review_and_rebid" }, source_url: "https://www.epmfl.net/proposal" },
      { source_key: "etheridge-maintenance-proposal", source_record_id: "maintenance-contact", intelligence_type: "purchasing_contact", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Published maintenance department contact", summary: "Etheridge publishes a maintenance department contact for normal and after-hours maintenance requests.", purchasing_contact_name: "Adam Simon", purchasing_contact_email: "maintenance@epmfl.net", purchasing_contact_phone: "850-484-2611", source_url: "https://www.epmfl.net/maintenance" },
    ],
  },
  {
    sourceKey: "etheridge-published-vendor-relationship", aliases: ["ETHERIDGE PROPERTY MANAGEMENT"], facts: [
      { source_key: "etheridge-published-vendor-relationship", source_record_id: "all-south-fencing", intelligence_type: "contractor_relationship", verification_class: "first_party_self_reported", fact_status: "self_reported", trade_category: "fencing", service_category: "fencing_repair_replacement_installation", title: "Published contractor relationship with All South Fencing", summary: "Etheridge identifies All South Fencing as a featured vendor and documents an existing working relationship with third-party contractors.", structured_data: { contractor_name: "All South Fencing", relationship_wording: "featured vendor" }, source_url: "https://www.epmfl.net/_files/ugd/4ba896_ad1555ae164542fba750a6010b895603.pdf" },
      { source_key: "etheridge-published-vendor-relationship", source_record_id: "paya-vendor-payments", intelligence_type: "purchasing_activity", verification_class: "first_party_self_reported", fact_status: "self_reported", service_category: "vendor_payment_operations", title: "Published vendor payment process", summary: "Etheridge states that its Paya implementation is intended to process payments and pay vendors faster.", structured_data: { platform: "Paya" }, source_url: "https://www.epmfl.net/_files/ugd/4ba896_ad1555ae164542fba750a6010b895603.pdf" },
    ],
  },
  {
    sourceKey: "nfi-maintenance-services", aliases: ["NFI PROPERTY MANAGEMENT SOLUTIONS", "NFI PROPERTY MANAGEMENT"], facts: [
      { source_key: "nfi-maintenance-services", source_record_id: "hoa-maintenance-vendors", intelligence_type: "maintenance_responsibility", verification_class: "first_party_self_reported", fact_status: "self_reported", trade_category: "general_maintenance", service_category: "hoa_common_area_maintenance", responsibility_scope: "common_areas", title: "HOA maintenance and vendor coordination", summary: "NFI states that it processes HOA maintenance requests, maintains outdoor common areas, and maintains vendor relationships.", structured_data: { documented_trades: ["general_maintenance", "landscaping"] }, source_url: "https://www.nfipms.com/" },
      { source_key: "nfi-maintenance-services", source_record_id: "mixed-maintenance-team", intelligence_type: "maintenance_delivery_model", verification_class: "first_party_self_reported", fact_status: "self_reported", delivery_model: "mixed", title: "Maintenance team and outsourced vendor network", summary: "NFI states that it has an HOA maintenance team and uses reputable licensed and insured vendors.", structured_data: { in_house_component: true, outsourced_component: true }, source_url: "https://www.nfipms.com/pensacola-hoa-management" },
      { source_key: "nfi-maintenance-services", source_record_id: "vendor-qualification", intelligence_type: "vendor_requirement", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Published vendor qualification characteristics", summary: "NFI describes its maintenance vendors as reputable, licensed, and insured.", structured_data: { requirements: ["trade_license", "insurance"] }, source_url: "https://www.nfipms.com/pensacola-hoa-management" },
    ],
  },
  {
    sourceKey: "greystar-us-supplier-program", aliases: ["GREYSTAR", "GREYSTAR REAL ESTATE PARTNERS", "GREYSTAR MANAGEMENT"], facts: [
      { source_key: "greystar-us-supplier-program", source_record_id: "supplier-enrollment", intelligence_type: "vendor_onboarding", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Public U.S. supplier consideration and enrollment", summary: "Greystar publishes a U.S. supplier program and a consideration form for vendors interested in upcoming RFPs.", vendor_registration_url: "https://www.greystar.com/contact-us/supplier-and-vendor-opportunities/us-supplier-partnerships", structured_data: { onboarding_platform: "NetVendor", access: "public_consideration_form" }, source_url: "https://www.greystar.com/contact-us/supplier-and-vendor-opportunities/us-supplier-partnerships" },
      { source_key: "greystar-us-supplier-program", source_record_id: "supplier-compliance", intelligence_type: "vendor_requirement", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Supplier compliance requirements", summary: "Greystar documents background checks, insurance verification, and trade-license verification through NetVendor before suppliers begin work at managed properties.", structured_data: { requirements: ["background_check", "insurance", "trade_license", "approved_status"] }, source_url: "https://www.greystar.com/contact-us/supplier-and-vendor-opportunities/us-supplier-partnerships" },
      { source_key: "greystar-us-supplier-program", source_record_id: "spend-management", intelligence_type: "purchasing_activity", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Portfolio procurement and RFP activity", summary: "Greystar states that it uses RealPage Spend Management across much of its managed portfolio and selects preferred suppliers through an RFP process.", structured_data: { procurement_platform: "RealPage Spend Management", rfp_program: true }, source_url: "https://www.greystar.com/contact-us/supplier-and-vendor-opportunities/us-supplier-partnerships" },
    ],
  },
  {
    sourceKey: "cbre-us-supplier-shield", aliases: ["CBRE", "CBRE GROUP", "CBRE MANAGEMENT"], facts: [
      { source_key: "cbre-us-supplier-shield", source_record_id: "supplier-interest-and-invite", intelligence_type: "vendor_onboarding", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Public supplier-interest path with opportunity-specific onboarding", summary: "CBRE publishes a supplier-interest portal. Supplier Shield onboarding itself requires an invitation tied to a specific business opportunity.", vendor_registration_url: "https://www.cbre.com/about-us/supply-chain", structured_data: { onboarding_platform: "Supplier Shield and Coupa", onboarding_access: "public_interest_then_invitation" }, source_url: "https://www.cbre.com/about-us/supply-chain/supplier-shield-training-portal" },
      { source_key: "cbre-us-supplier-shield", source_record_id: "us-onboarding-requirements", intelligence_type: "vendor_requirement", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "U.S. supplier onboarding requirements", summary: "CBRE documents W-9, identity and banking verification, insurance and risk assessment requirements for U.S. suppliers.", structured_data: { requirements: ["W-9", "bank_verification", "identity_verification", "insurance", "risk_assessment"] }, source_url: "https://www.cbre.com/about-us/supply-chain/supplier-shield-training-portal" },
      { source_key: "cbre-us-supplier-shield", source_record_id: "work-order-system", intelligence_type: "purchasing_activity", verification_class: "first_party_self_reported", fact_status: "self_reported", service_category: "work_order_operations", title: "Supplier creation in finance and work-order systems", summary: "CBRE states that successful onboarding establishes a supplier as a vendor in its finance and work-order system.", source_url: "https://www.cbre.com/about-us/supply-chain/supplier-shield-training-portal" },
    ],
  },
  {
    sourceKey: "associa-published-services", aliases: ["ASSOCIA", "ASSOCIA GULF COAST", "ASSOCIA FLORIDA"], facts: [
      { source_key: "associa-published-services", source_record_id: "portfolio-types", intelligence_type: "portfolio_type", verification_class: "first_party_self_reported", fact_status: "self_reported", portfolio_type: "hoa", title: "Published HOA portfolio service", summary: "Associa publishes HOA management as a core service.", source_url: "https://www.associaonline.com/ai-info-page" },
      { source_key: "associa-published-services", source_record_id: "condo-portfolio", intelligence_type: "portfolio_type", verification_class: "first_party_self_reported", fact_status: "self_reported", portfolio_type: "condominium", title: "Published condominium portfolio service", summary: "Associa publishes condominium management as a core service.", source_url: "https://www.associaonline.com/ai-info-page" },
      { source_key: "associa-published-services", source_record_id: "maintenance-and-contracts", intelligence_type: "maintenance_responsibility", verification_class: "first_party_self_reported", fact_status: "self_reported", trade_category: "general_maintenance", service_category: "common_area_and_contract_management", responsibility_scope: "common_areas", title: "Maintenance and service-contract administration", summary: "Associa states that it coordinates common-area and preventive maintenance and supports vendor sourcing, proposal requests, bid comparisons, contract negotiation, renewals, and performance reviews.", structured_data: { documented_trades: ["general_maintenance", "restoration", "construction"] }, source_url: "https://www.associaonline.com/ai-info-page" },
      { source_key: "associa-published-services", source_record_id: "partner-channel", intelligence_type: "vendor_onboarding", verification_class: "first_party_self_reported", fact_status: "self_reported", title: "Published vendor partnership channel", summary: "Associa directs vendors and service providers to its Partner With Us channel.", vendor_registration_url: "https://www.associaonline.com/partner-with-us", source_url: "https://www.associaonline.com/ai-info-page" },
    ],
  },
];

async function fetchSourceText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "IntentOpportunityIntelligence/1.0 (+https://intentrev.net)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if ((response.headers.get("content-type") || "").includes("pdf")) return Buffer.from(await response.arrayBuffer()).toString("latin1");
  return await response.text();
}

async function syncCuratedPrograms(force: boolean) {
  const firms = await sql`SELECT id::text, name, dba FROM fl_management_firms` as Array<{ id: string; name: string; dba: string | null }>;
  const results: Array<Record<string, unknown>> = [];
  for (const program of CURATED_PROGRAMS) {
    const source = SOURCES.find((item) => item.key === program.sourceKey)!;
    const state = (await sql`SELECT next_refresh_at FROM fl_maintenance_intelligence_sources WHERE source_key=${source.key}`)[0];
    if (!force && state?.next_refresh_at && new Date(String(state.next_refresh_at)).getTime() > Date.now()) {
      results.push({ sourceKey: source.key, status: "skipped", accepted: 0 });
      continue;
    }
    const run = (await sql`INSERT INTO fl_maintenance_intelligence_source_runs(source_key) VALUES (${source.key}) RETURNING id`)[0];
    try {
      const content = await fetchSourceText(source.url);
      if (content.length < 100) throw new Error("Source returned insufficient content");
      const aliases = program.aliases.map(normalizeFirmName);
      const matches = firms.filter((firm) => aliases.includes(normalizeFirmName(firm.name)));
      const asOf = today();
      const rows = matches.flatMap((firm) => program.facts.map((fact) => ({ ...fact, firm_id: firm.id, source_as_of_date: asOf })));
      await sql`UPDATE fl_maintenance_purchasing_intelligence SET is_current=FALSE, updated_at=CURRENT_TIMESTAMP WHERE source_key=${source.key} AND permanent=FALSE`;
      await upsertEvidence(rows);
      await sql`
        UPDATE fl_maintenance_intelligence_sources SET last_attempt_at=CURRENT_TIMESTAMP,
          last_success_at=CURRENT_TIMESTAMP, next_refresh_at=CURRENT_TIMESTAMP + (${source.refreshHours}::text || ' hours')::interval,
          last_record_count=${rows.length}, content_hash=${hash(content)}, consecutive_failures=0,
          last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE source_key=${source.key}
      `;
      await sql`UPDATE fl_maintenance_intelligence_source_runs SET finished_at=CURRENT_TIMESTAMP, status='succeeded', fetched_records=${matches.length}, accepted_records=${rows.length} WHERE id=${run.id}`;
      results.push({ sourceKey: source.key, status: "succeeded", matchedFirms: matches.length, accepted: rows.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sql`UPDATE fl_maintenance_intelligence_sources SET last_attempt_at=CURRENT_TIMESTAMP, consecutive_failures=consecutive_failures+1, last_error=${message}, next_refresh_at=CURRENT_TIMESTAMP + INTERVAL '24 hours', updated_at=CURRENT_TIMESTAMP WHERE source_key=${source.key}`;
      await sql`UPDATE fl_maintenance_intelligence_source_runs SET finished_at=CURRENT_TIMESTAMP, status='failed', error=${message} WHERE id=${run.id}`;
      results.push({ sourceKey: source.key, status: "failed", error: message, accepted: 0 });
    }
  }
  return results;
}

function plainText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

function discoverSameOriginPages(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const results = new Set<string>([base.href]);
  const relevant = /maintenance|vendor|supplier|partner|service|property-management|community-management/i;
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    if (!relevant.test(`${match[1]} ${plainText(match[2])}`)) continue;
    try {
      const candidate = new URL(match[1], base);
      if (candidate.protocol.startsWith("http") && candidate.hostname === base.hostname) {
        candidate.hash = "";
        results.add(candidate.href);
      }
    } catch {
      // Ignore malformed links published by the source site.
    }
    if (results.size >= 5) break;
  }
  return Array.from(results);
}

function factsFromOfficialPage(params: { firmId: string; url: string; text: string }): IntelligenceInput[] {
  const lower = params.text.toLowerCase();
  const rows: IntelligenceInput[] = [];
  const add = (fact: Omit<IntelligenceInput, "firm_id" | "source_key" | "source_as_of_date" | "verification_class" | "fact_status" | "source_url">) => rows.push({
    ...fact, firm_id: params.firmId, source_key: "verified-official-firm-websites",
    verification_class: "first_party_self_reported", fact_status: "self_reported",
    source_url: params.url, source_as_of_date: today(),
  });
  const managementAction = /(?:we|our (?:team|company|managers?))\s+(?:coordinate|manage|handle|provide|oversee|perform)[^.]{0,100}maintenance/i.test(params.text)
    || /maintenance (?:coordination|management|services|requests|program)/i.test(params.text);
  if (managementAction) {
    const tradePatterns: Array<[string, RegExp]> = [
      ["hvac", /\bhvac\b|air conditioning|heating and cooling/i], ["electrical", /\belectrical\b/i],
      ["plumbing", /\bplumbing\b/i], ["roofing", /\broof(?:ing| repair)\b/i],
      ["landscaping", /landscap|lawn maintenance/i], ["janitorial", /janitorial|cleaning services/i],
      ["fire_protection", /fire protection|fire alarm|sprinkler system/i], ["security", /security system|access control/i],
      ["elevators", /\belevator/i], ["pest_control", /pest control/i], ["pool", /pool maintenance|pool service/i],
      ["building_automation", /building automation/i], ["controls", /building controls|hvac controls/i],
      ["remote_monitoring", /remote monitoring/i], ["refrigeration", /refrigeration/i],
      ["energy_optimization", /energy optimization|energy management/i], ["construction", /construction management/i],
    ];
    const trades = tradePatterns.filter(([, pattern]) => pattern.test(params.text)).map(([trade]) => trade);
    for (const trade of trades.length ? trades : ["general_maintenance"]) {
      add({ source_record_id: hash(`${params.url}|maintenance|${trade}`).slice(0, 40), intelligence_type: "maintenance_responsibility", trade_category: trade, service_category: `${trade}_maintenance`, title: `Published ${trade.replaceAll("_", " ")} maintenance responsibility`, summary: `The firm's verified official website publishes a management or coordination responsibility that explicitly includes ${trade.replaceAll("_", " ")} maintenance.`, structured_data: { extraction: "rule_based_official_page", matched_trade: trade } });
    }
  }
  const onboarding = /vendor registration|supplier registration|become (?:a|our) vendor|vendor application|partner with us/i.test(params.text);
  if (onboarding) add({ source_record_id: hash(`${params.url}|vendor-onboarding`).slice(0, 40), intelligence_type: "vendor_onboarding", title: "Published vendor or supplier onboarding path", summary: "The firm's verified official website publishes a vendor, supplier, or service-partner onboarding path.", vendor_registration_url: params.url, structured_data: { onboarding_access: "public_official_page", extraction: "rule_based_official_page" } });
  const requirements = [
    ["insurance", /certificate of insurance|proof of insurance|licensed and insured/i],
    ["trade_license", /trade licen[cs]e|licensed contractor/i],
    ["background_check", /background check/i],
    ["W-9", /\bw-?9\b/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(params.text)).map(([requirement]) => requirement as string);
  if (onboarding && requirements.length) add({ source_record_id: hash(`${params.url}|vendor-requirements`).slice(0, 40), intelligence_type: "vendor_requirement", title: "Published vendor requirements", summary: `The firm's verified official website documents these vendor requirements: ${requirements.join(", ")}.`, structured_data: { requirements, extraction: "rule_based_official_page" } });
  const inHouse = /in-house maintenance|our maintenance (?:team|staff|technicians)/i.test(params.text);
  const outsourced = /(?:network|team|list) of (?:licensed |insured |preferred )*vendors|third-party (?:vendors|contractors)/i.test(params.text);
  if (inHouse || outsourced) add({ source_record_id: hash(`${params.url}|delivery-model`).slice(0, 40), intelligence_type: "maintenance_delivery_model", delivery_model: inHouse && outsourced ? "mixed" : inHouse ? "in_house" : "outsourced", title: "Published maintenance delivery model", summary: inHouse && outsourced ? "The firm's verified official website documents both an internal maintenance team and third-party vendors." : inHouse ? "The firm's verified official website documents an internal maintenance team." : "The firm's verified official website documents use of third-party vendors or contractors.", structured_data: { in_house: inHouse, outsourced, extraction: "rule_based_official_page" } });
  const portfolioPatterns: Array<[PortfolioType, RegExp]> = [
    ["multifamily", /multifamily|apartment communit/i], ["single_family_rental", /single.family rental/i],
    ["commercial", /commercial propert/i], ["hoa", /homeowners association|\bhoa\b/i],
    ["condominium", /condominium|\bcondo association/i], ["hospitality", /hotel|hospitality propert/i],
    ["vacation_rental", /vacation rental|short.term rental/i],
  ];
  for (const [portfolioType, pattern] of portfolioPatterns) {
    if (pattern.test(lower)) add({ source_record_id: hash(`${params.url}|portfolio|${portfolioType}`).slice(0, 40), intelligence_type: "portfolio_type", portfolio_type: portfolioType, title: `Published ${portfolioType.replaceAll("_", " ")} service`, summary: `The firm's verified official website explicitly publishes ${portfolioType.replaceAll("_", " ")} management or portfolio services.`, structured_data: { extraction: "rule_based_official_page" } });
  }
  return rows;
}

async function syncVerifiedOfficialWebsites(limit = 25) {
  await sql`
    INSERT INTO fl_maintenance_website_scan_state(firm_id, official_website_url, verification_id)
    SELECT DISTINCT ON (firm.id) firm.id, verification.official_website_url, verification.id
    FROM fl_management_firms firm
    JOIN oi_channel_entities entity ON entity.license_number=firm.license_number AND entity.entity_type='cam_firm'
    JOIN fl_search_verifications verification ON verification.target_type='channel_entity'
      AND verification.target_id=entity.id::text AND verification.verification_status='VERIFIED_ACTIVE'
      AND verification.official_website_url IS NOT NULL
    WHERE firm.license_number IS NOT NULL
    ORDER BY firm.id, verification.verified_at DESC
    ON CONFLICT(firm_id) DO UPDATE SET
      official_website_url=EXCLUDED.official_website_url, verification_id=EXCLUDED.verification_id,
      next_scan_at=CASE WHEN fl_maintenance_website_scan_state.official_website_url IS DISTINCT FROM EXCLUDED.official_website_url THEN CURRENT_TIMESTAMP ELSE fl_maintenance_website_scan_state.next_scan_at END,
      updated_at=CURRENT_TIMESTAMP
  `;
  const candidates = await sql`
    SELECT state.firm_id::text, state.official_website_url
    FROM fl_maintenance_website_scan_state state
    WHERE state.next_scan_at <= CURRENT_TIMESTAMP
    ORDER BY state.next_scan_at, state.firm_id
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  ` as Array<{ firm_id: string; official_website_url: string }>;
  let pagesChecked = 0;
  let accepted = 0;
  let succeeded = 0;
  for (const candidate of candidates) {
    try {
      const homepage = await fetchSourceText(candidate.official_website_url);
      const pageUrls = discoverSameOriginPages(homepage, candidate.official_website_url);
      const pageBodies = new Map<string, string>([[pageUrls[0], homepage]]);
      for (const url of pageUrls.slice(1)) {
        try { pageBodies.set(url, await fetchSourceText(url)); } catch { /* retain auditable partial scan */ }
      }
      const facts = Array.from(pageBodies, ([url, body]) => factsFromOfficialPage({ firmId: candidate.firm_id, url, text: plainText(body) })).flat();
      await upsertEvidence(facts);
      pagesChecked += pageBodies.size;
      accepted += facts.length;
      succeeded += 1;
      await sql`UPDATE fl_maintenance_website_scan_state SET status=${facts.length ? "succeeded" : "no_facts"}, pages_checked=${pageBodies.size}, facts_accepted=${facts.length}, last_attempt_at=CURRENT_TIMESTAMP, last_success_at=CURRENT_TIMESTAMP, next_scan_at=CURRENT_TIMESTAMP + INTERVAL '30 days', last_error=NULL, content_hash=${hash(Array.from(pageBodies.values()).join("\n"))}, updated_at=CURRENT_TIMESTAMP WHERE firm_id=${candidate.firm_id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sql`UPDATE fl_maintenance_website_scan_state SET status='failed', last_attempt_at=CURRENT_TIMESTAMP, next_scan_at=CURRENT_TIMESTAMP + INTERVAL '7 days', last_error=${message}, updated_at=CURRENT_TIMESTAMP WHERE firm_id=${candidate.firm_id}`;
    }
  }
  await sql`UPDATE fl_maintenance_intelligence_sources SET last_attempt_at=CURRENT_TIMESTAMP, last_success_at=CURRENT_TIMESTAMP, next_refresh_at=CURRENT_TIMESTAMP + INTERVAL '24 hours', last_record_count=${accepted}, consecutive_failures=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE source_key='verified-official-firm-websites'`;
  return { candidates: candidates.length, succeeded, pagesChecked, accepted };
}

export async function reconcileMaintenancePurchasingIntelligence() {
  await sql`
    WITH summaries AS (
      SELECT firm.id,
        COALESCE(array_agg(DISTINCT intelligence.portfolio_type) FILTER (WHERE intelligence.portfolio_type IS NOT NULL AND intelligence.is_current), '{}'::text[]) AS portfolio_types,
        COALESCE(array_agg(DISTINCT intelligence.trade_category) FILTER (WHERE intelligence.trade_category IS NOT NULL AND intelligence.is_current), '{}'::text[]) AS maintenance_trades,
        CASE
          WHEN bool_or(intelligence.delivery_model='mixed' AND intelligence.is_current) THEN 'mixed'
          WHEN bool_or(intelligence.delivery_model='in_house' AND intelligence.is_current) AND bool_or(intelligence.delivery_model='outsourced' AND intelligence.is_current) THEN 'mixed'
          WHEN bool_or(intelligence.delivery_model='in_house' AND intelligence.is_current) THEN 'in_house'
          WHEN bool_or(intelligence.delivery_model='outsourced' AND intelligence.is_current) THEN 'outsourced'
          ELSE 'unknown'
        END AS delivery_model,
        CASE
          WHEN bool_or(intelligence.intelligence_type='vendor_onboarding' AND intelligence.vendor_registration_url IS NOT NULL AND intelligence.is_current AND COALESCE(intelligence.structured_data->>'onboarding_access','') NOT LIKE '%invitation%') THEN 'public'
          WHEN bool_or(intelligence.intelligence_type='vendor_onboarding' AND intelligence.is_current AND COALESCE(intelligence.structured_data->>'onboarding_access','') LIKE '%invitation%') THEN 'invitation_required'
          ELSE 'unknown'
        END AS onboarding_status,
        (array_agg(intelligence.vendor_registration_url ORDER BY intelligence.source_as_of_date DESC) FILTER (WHERE intelligence.vendor_registration_url IS NOT NULL AND intelligence.is_current))[1] AS registration_url,
        (array_agg(intelligence.purchasing_contact_name ORDER BY intelligence.source_as_of_date DESC) FILTER (WHERE intelligence.purchasing_contact_name IS NOT NULL AND intelligence.is_current))[1] AS contact_name,
        (array_agg(intelligence.purchasing_contact_email ORDER BY intelligence.source_as_of_date DESC) FILTER (WHERE intelligence.purchasing_contact_email IS NOT NULL AND intelligence.is_current))[1] AS contact_email,
        (array_agg(intelligence.purchasing_contact_phone ORDER BY intelligence.source_as_of_date DESC) FILTER (WHERE intelligence.purchasing_contact_phone IS NOT NULL AND intelligence.is_current))[1] AS contact_phone,
        COUNT(*) FILTER (WHERE intelligence.intelligence_type='maintenance_contract' AND intelligence.is_current)::int AS maintenance_contracts,
        COUNT(*) FILTER (WHERE intelligence.intelligence_type='purchasing_activity' AND intelligence.is_current)::int AS purchasing_activities,
        COUNT(*) FILTER (WHERE intelligence.intelligence_type='contractor_relationship' AND intelligence.is_current)::int AS contractor_relationships,
        MAX(intelligence.documented_volume) FILTER (WHERE intelligence.intelligence_type='service_volume' AND intelligence.is_current) AS service_volume
      FROM fl_management_firms firm
      LEFT JOIN fl_maintenance_purchasing_intelligence intelligence ON intelligence.firm_id=firm.id
      GROUP BY firm.id
    )
    UPDATE fl_management_firms firm SET
      portfolio_types=summaries.portfolio_types,
      maintenance_trades=summaries.maintenance_trades,
      maintenance_delivery_model=summaries.delivery_model,
      vendor_onboarding_status=summaries.onboarding_status,
      vendor_registration_url=summaries.registration_url,
      purchasing_contact_name=summaries.contact_name,
      purchasing_contact_email=summaries.contact_email,
      purchasing_contact_phone=summaries.contact_phone,
      documented_maintenance_contracts=summaries.maintenance_contracts,
      documented_purchasing_activities=summaries.purchasing_activities,
      documented_contractor_relationships=summaries.contractor_relationships,
      documented_service_volume=summaries.service_volume,
      portfolio_by_service_category=COALESCE((
        SELECT jsonb_object_agg(service_category, jsonb_build_object('documented_records', records, 'verified_properties', verified_properties))
        FROM (
          SELECT evidence.service_category, COUNT(DISTINCT evidence.id)::int records,
            COUNT(DISTINCT relationship.canonical_property_key) FILTER (WHERE relationship.is_verified_portfolio)::int verified_properties
          FROM fl_maintenance_purchasing_intelligence evidence
          LEFT JOIN fl_management_portfolio_relationships relationship
            ON relationship.firm_id=evidence.firm_id AND relationship.county IS NOT DISTINCT FROM evidence.county
          WHERE evidence.firm_id=firm.id AND evidence.is_current AND evidence.service_category IS NOT NULL
          GROUP BY evidence.service_category
        ) category_counts
      ), '{}'::jsonb),
      maintenance_intelligence_updated_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
    FROM summaries WHERE summaries.id=firm.id
  `;

  const evidenceRows = await sql`
    SELECT COUNT(*)::int AS evidence_records,
      COUNT(DISTINCT firm_id)::int AS enriched_firms,
      COUNT(*) FILTER (WHERE verification_class='authoritative')::int AS authoritative,
      COUNT(*) FILTER (WHERE verification_class='first_party_self_reported')::int AS self_reported,
      COUNT(*) FILTER (WHERE verification_class='manual_confirmed')::int AS manual_confirmed
    FROM fl_maintenance_purchasing_intelligence WHERE is_current=TRUE
  `;
  return evidenceRows[0];
}

async function updateCountyCoverage() {
  for (const source of SOURCES) {
    await sql`
      INSERT INTO fl_maintenance_intelligence_county_coverage(
        source_key, county, source_records, accepted_records, firms_with_evidence,
        status, limitation, last_success_at, updated_at
      )
      SELECT ${source.key}, county.name,
        COUNT(intelligence.id)::int,
        COUNT(intelligence.id) FILTER (WHERE intelligence.is_current)::int,
        COUNT(DISTINCT intelligence.firm_id) FILTER (WHERE intelligence.is_current)::int,
        CASE WHEN COUNT(intelligence.id) FILTER (WHERE intelligence.is_current)>0 THEN 'covered' ELSE 'no_records' END,
        CASE WHEN COUNT(intelligence.id) FILTER (WHERE intelligence.is_current)>0 THEN NULL ELSE 'No source-attributed records were available for this county; no facts were inferred to equalize coverage.' END,
        MAX(source_state.last_success_at), CURRENT_TIMESTAMP
      FROM unnest(${Array.from(FLORIDA_COUNTIES)}::text[]) AS county(name)
      CROSS JOIN fl_maintenance_intelligence_sources source_state
      LEFT JOIN fl_maintenance_purchasing_intelligence intelligence
        ON intelligence.source_key=source_state.source_key AND LOWER(intelligence.county)=LOWER(county.name)
      WHERE source_state.source_key=${source.key}
      GROUP BY county.name
      ON CONFLICT(source_key, county) DO UPDATE SET
        source_records=EXCLUDED.source_records, accepted_records=EXCLUDED.accepted_records,
        firms_with_evidence=EXCLUDED.firms_with_evidence, status=EXCLUDED.status,
        limitation=EXCLUDED.limitation, last_success_at=EXCLUDED.last_success_at,
        updated_at=CURRENT_TIMESTAMP
    `;
  }
}

export async function syncStatewideMaintenancePurchasingIntelligence(options: { force?: boolean } = {}) {
  await registerSources();
  const derived = await syncDerivedPortfolioEvidence();
  const curated = await syncCuratedPrograms(Boolean(options.force));
  const officialWebsites = await syncVerifiedOfficialWebsites(25);
  const reconciliation = await reconcileMaintenancePurchasingIntelligence();
  await updateCountyCoverage();
  return { derived, curated, officialWebsites, reconciliation, countiesEvaluated: FLORIDA_COUNTIES.length };
}

export async function getFirmMaintenancePurchasingIntelligence(firmId: string) {
  return sql`
    SELECT intelligence.*, source.source_name, source.source_type
    FROM fl_maintenance_purchasing_intelligence intelligence
    JOIN fl_maintenance_intelligence_sources source ON source.source_key=intelligence.source_key
    WHERE intelligence.firm_id=${firmId} AND intelligence.is_current=TRUE
    ORDER BY CASE intelligence.verification_class
      WHEN 'manual_confirmed' THEN 1 WHEN 'authoritative' THEN 2
      WHEN 'first_party_self_reported' THEN 3 ELSE 4 END,
      intelligence.source_as_of_date DESC, intelligence.title
  `;
}

export async function createManualMaintenanceIntelligence(input: {
  firmId: string;
  intelligenceType: IntelligenceType;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceAsOfDate: string;
  portfolioType?: PortfolioType | null;
  tradeCategory?: string | null;
  serviceCategory?: string | null;
  county?: string | null;
  zipCode?: string | null;
  deliveryModel?: "in_house" | "outsourced" | "mixed" | "unknown" | null;
  vendorRegistrationUrl?: string | null;
  confirmedBy?: string | null;
}) {
  if (!input.sourceUrl.startsWith("http://") && !input.sourceUrl.startsWith("https://")) throw new Error("A public source URL is required");
  if (!input.title.trim() || !input.summary.trim() || !input.sourceName.trim()) throw new Error("Title, summary, and source name are required");
  await registerSources();
  const confirmedAt = new Date().toISOString();
  await upsertEvidence([{
    firm_id: input.firmId,
    source_key: "manual-confirmed-maintenance-intelligence",
    source_record_id: hash(`${input.firmId}|${input.sourceUrl}|${input.title}`).slice(0, 32),
    intelligence_type: input.intelligenceType,
    verification_class: "manual_confirmed",
    fact_status: "verified",
    portfolio_type: input.portfolioType || null,
    trade_category: input.tradeCategory || null,
    service_category: input.serviceCategory || null,
    county: input.county || null,
    zip_code: input.zipCode || null,
    delivery_model: input.deliveryModel || null,
    title: input.title.trim(),
    summary: input.summary.trim(),
    vendor_registration_url: input.vendorRegistrationUrl || null,
    structured_data: { source_name: input.sourceName.trim(), entered_by_administrator: true },
    source_url: input.sourceUrl,
    source_as_of_date: input.sourceAsOfDate,
    permanent: true,
    confirmed_by: input.confirmedBy || "Intent administrator",
    confirmed_at: confirmedAt,
  }]);
  await reconcileMaintenancePurchasingIntelligence();
  return { ok: true, permanent: true, confirmedAt };
}
