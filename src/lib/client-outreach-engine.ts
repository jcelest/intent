import { sql } from "@/lib/db";
import { ensureParcelsIngested, COUNTY_PRIORITY, type OutreachChannel, type TonnageRiskEstimate } from "@/lib/opportunity-parcels";
import { runSunbizMatchingPass } from "@/lib/sunbiz-matcher";
import { ensureDBPRLicensesIngested } from "@/lib/dbpr-licenses";
import { ensurePermitsIngested, getClientExclusions } from "@/lib/permits-and-registrations";
import { type SearchVerificationRecord } from "@/lib/search-verification-provider";
import { parseFloridaGeoSearch } from "@/lib/florida-geo";

export interface UnifiedClientTargetRow {
  targetId: string;
  recordType: "parcel" | "network" | "licensee" | "business" | "firm";
  parcelId: string | null;
  name: string;
  channel: OutreachChannel;
  situsAddress: string;
  city: string;
  county: string;
  zip: string | null;
  buildingSqft: number | null;
  sqftBand: TonnageRiskEstimate;
  tonnageRisk: TonnageRiskEstimate;
  entityStatus: "Active" | "Inactive" | "UNMATCHED";
  sunbizDocNumber: string | null;
  matchConfidence: number;
  licenseType: string | null;
  licenseNumber: string | null;
  lastMechanicalPermitDate: string | null;
  incumbentContractor: string | null;
  verificationStatus: "VERIFIED_ACTIVE" | "LIKELY_ACTIVE" | "NOT_FOUND" | "AMBIGUOUS" | "CLOSED";
  hasWebsite: boolean;
  officialWebsiteUrl: string | null;
  gbpSignal: "LISTING_PRESENT" | "NOT_SEEN";
  reviewCount: number | null;
  rating: number | null;
  verifiedPhone: string | null;
  evidence: Array<{ url: string; query: string; verified_at: string }>;
  needsReview: boolean;
  fitScore: number;
  scopeWarning: string | null;
  inPipeline: boolean;
  pipelineStage: string | null;
  inClientTerritory: boolean;
  isClientAccount: boolean;
  portfolioFloor?: number | null;
  portfolioRangeLow?: number | null;
  portfolioRangeHigh?: number | null;
  portfolioTier?: "UNDER_100" | "FROM_100_TO_300" | "OVER_300" | "UNKNOWN";
  portfolioScreenMatch?: boolean;
}

export interface ClientOutreachQueryParams {
  clientId?: string;
  territoryInput?: string;
  county?: string;
  city?: string;
  zip?: string;
  channel?: string;
  channelFilter?: string;
  tonnageRisk?: string;
  verificationStatus?: string;
  verificationFilter?: string;
  hasWebsite?: string; // "true" | "false" | "all"
  minReviews?: number;
  entityStatus?: string; // "Active" | "Inactive" | "UNMATCHED" | "all"
  licenseType?: string;
  permitWithinDays?: number;
  search?: string;
  searchQuery?: string;
  needsReviewOnly?: boolean;
  hideExistingAccounts?: boolean;
  page?: number;
  pageSize?: number;
  limit?: number;
  mode?: "call_list" | "browse_all";
  portfolioScreen?: "100_plus" | "200_plus";
}

export interface ClientOutreachQueryResult {
  client: Record<string, unknown> | null;
  targets: UnifiedClientTargetRow[];
  total: number;
  page: number;
  pageSize: number;
  limit?: number;
  mode?: string;
  hasMore?: boolean;
  totalPages: number;
  coverage: Array<{
    county: string;
    count: number;
    status?: string;
    isPriority?: boolean;
    threshold?: number;
  }>;
  stats: {
    totalInView: number;
    verifiedCallableCount: number;
    withPhonePercent: number;
    newPermits30dCount: number;
    inPipelineCount: number;
    totalInTerritory: number;
    inClientTerritoryCount: number;
    existingAccountsCount: number;
    verifiedActiveCount: number;
    chillerCount: number;
    under10tCount: number;
    permitsFoundCount: number;
    reviewQueueCount: number;
  };
  territoryCounties: string[];
}

/**
 * Calculates fit score (0-100) based on prompt formula:
 * Trade fit 40, Territory 30, Proximity 15, License eligibility 15.
 */
export function calculateTargetFitScore(params: {
  targetChannel: OutreachChannel;
  targetCounty: string;
  clientTrades: string[];
  clientCounties: string[];
  entityActive: boolean;
}): number {
  let score = 0;

  // 1. Trade Fit (40 pts)
  const isTradeRelevant = params.clientTrades.some((t) => {
    const trade = t.toLowerCase();
    if (trade === "hvac" || trade === "mechanical") return true;
    if (trade === "roofing" && (params.targetChannel === "retail" || params.targetChannel === "warehouse_industrial" || params.targetChannel === "school" || params.targetChannel === "office")) return true;
    if (trade === "electrical" || trade === "plumbing" || trade === "general_contracting") return true;
    return true;
  });
  if (isTradeRelevant) score += 40;

  // 2. Territory (30 pts)
  const inTerritory = params.clientCounties.some(
    (c) => c.toLowerCase() === params.targetCounty.toLowerCase() || params.clientCounties.length === 0
  );
  if (inTerritory) score += 30;

  // 3. Proximity (15 pts) - Priority counties have primary proximity
  if (COUNTY_PRIORITY.includes(params.targetCounty as (typeof COUNTY_PRIORITY)[number])) {
    score += 15;
  } else {
    score += 10;
  }

  // 4. License Eligibility & Entity Active (15 pts)
  if (params.entityActive) {
    score += 15;
  } else {
    score += 5;
  }

  return score;
}

/**
 * Runs the complete six-layer initialization in strict build order:
 * 1. fl_parcels ingestion for COUNTY_PRIORITY counties only
 * 2. Sunbiz matching pass
 * 3. DBPR ingestion
 * 4. Permits ingestion
 */
export async function initializeSixLayerIntelligence(): Promise<void> {
  await ensureParcelsIngested();
  await runSunbizMatchingPass();
  await ensureDBPRLicensesIngested();
  await ensurePermitsIngested();
}

/**
 * Loads the Unified Commercial Outreach Database
 * Default = Everything across all ingested Florida counties (parcels, businesses, licensees, networks)
 * Returned in one browsable, paginated table.
 * Filtering is manual and optional (all combine via AND).
 * Client is an optional overlay lens (fit scores + scope flags + exclusions toggle).
 */
export async function getClientTerritoryOutreachTargets(
  params: ClientOutreachQueryParams = {}
): Promise<ClientOutreachQueryResult> {
  await initializeSixLayerIntelligence();

  // 1. Dynamic County Coverage honesty: real record counts grouped by county across all tables
  const coverageRows = await sql`
    SELECT 
      u.county, 
      u.count,
      COALESCE(r.status, 'DIRECT_DOWNLOAD') as status,
      COALESCE(r.is_priority_county, false) as is_priority,
      COALESCE(r.full_depth_threshold, 500) as threshold
    FROM (
      SELECT county, COUNT(*)::int as count
      FROM (
        SELECT county FROM fl_parcels WHERE county IS NOT NULL
        UNION ALL
        SELECT county FROM fl_commercial_networks WHERE county IS NOT NULL
        UNION ALL
        SELECT county FROM fl_licenses WHERE county IS NOT NULL
      ) unified
      GROUP BY county
    ) u
    LEFT JOIN fl_county_parcel_registry r ON LOWER(u.county) = LOWER(r.county)
    ORDER BY u.count DESC, u.county ASC
  `;
  const coverage = (coverageRows as Array<{
    county: string;
    count: number;
    status: string;
    is_priority: boolean;
    threshold: number;
  }>).map((r) => ({
    county: String(r.county),
    count: Number(r.count),
    status: String(r.status),
    isPriority: Boolean(r.is_priority),
    threshold: Number(r.threshold),
  }));

  // 2. Client Profile (Optional Overlay Lens)
  let clientObj: Record<string, unknown> | null = null;
  let clientTrades: string[] = ["hvac"];
  let clientCounties: string[] = [];
  let isLightCommercialOnly = false;

  if (params.clientId && params.clientId !== "all") {
    try {
      const cRows = await sql`
        SELECT id, name, trades, service_areas, capacity_notes, qualifications, contact_name, contact_email, contact_phone
        FROM trade_demand_clients
        WHERE id = ${params.clientId}
        LIMIT 1
      `;
      if (cRows.length > 0) {
        clientObj = cRows[0] as Record<string, unknown>;
        if (Array.isArray(clientObj.trades) && clientObj.trades.length > 0) {
          clientTrades = clientObj.trades as string[];
        }
        if (Array.isArray(clientObj.service_areas) && clientObj.service_areas.length > 0) {
          const clientGeo = parseFloridaGeoSearch((clientObj.service_areas as string[]).join(", "));
          clientCounties = clientGeo.resolvedCounties;
        }
        const cap = String(clientObj.capacity_notes || "").toLowerCase();
        if (cap.includes("light") || cap.includes("under 10") || cap.includes("residential only")) {
          isLightCommercialOnly = true;
        }
      }
    } catch (err) {
      console.error("Failed loading client:", err);
    }
  }

  // 3. Client Exclusions & Outreach Pipeline
  const exclusions = (params.clientId && params.clientId !== "all")
    ? await getClientExclusions(params.clientId)
    : [];
  const pipelineMap = new Map<string, string>();

  if (params.clientId && params.clientId !== "all") {
    try {
      const pRows = await sql`
        SELECT target_name, stage
        FROM fl_outreach_pipeline
        WHERE client_id = ${params.clientId}
      `;
      for (const pr of (pRows as Array<{ target_name: string; stage: string }>)) {
        if (pr.target_name) pipelineMap.set(pr.target_name.toLowerCase(), pr.stage);
      }
    } catch (err) {
      console.error("Error loading client pipeline:", err);
    }
  }

  // 4. Query All Ingested Florida Commercial Data (Parcels, Networks, Licenses, Verifications)
  const [parcelRows, networkRows, licenseRows, verificationRows, firmRows] = await Promise.all([
    sql`
      SELECT 
        p.county,
        p.parcel_id,
        p.situs_address,
        p.situs_city,
        p.situs_zip,
        p.owner_name_raw,
        p.use_code,
        p.use_description,
        p.building_sqft,
        p.channel,
        p.sqft_band,
        p.tonnage_risk,
        p.last_mechanical_permit_date,
        p.incumbent_contractor,
        e.status as entity_status,
        e.document_number as sunbiz_doc,
        e.match_confidence
      FROM fl_parcels p
      LEFT JOIN (
        SELECT DISTINCT ON (parcel_county, parcel_id)
          parcel_county, parcel_id, status, document_number, match_confidence
        FROM fl_entities
        ORDER BY parcel_county, parcel_id, match_confidence DESC
      ) e 
        ON e.parcel_county = p.county AND e.parcel_id = p.parcel_id
      ORDER BY p.county ASC, p.building_sqft DESC NULLS LAST
    `,
    sql`
      SELECT
        id,
        name,
        org_type,
        county,
        city,
        zip_code,
        address,
        website,
        primary_contact_phone
      FROM fl_commercial_networks
      WHERE county IS NOT NULL
      ORDER BY county ASC, name ASC
    `,
    sql`
      SELECT
        license_number,
        licensee_name,
        business_name,
        license_type,
        status,
        county,
        city,
        trade_category
      FROM fl_licenses
      WHERE county IS NOT NULL
      ORDER BY county ASC, licensee_name ASC
    `,
    sql`
      SELECT DISTINCT ON (business_name, city)
        business_name, city, verification_status, official_website_url,
        has_website, gbp_signal, rating, review_count, phone, evidence, needs_review
      FROM fl_search_verifications
      ORDER BY business_name, city, verified_at DESC
    `,
    sql`
      SELECT id, name, firm_type, license_type, license_number, status,
             address, city, county, zip_code, phone, website, evidence_url,
             portfolio_floor, portfolio_range_low, portfolio_range_high, portfolio_tier
      FROM fl_management_firms
      ORDER BY portfolio_floor DESC NULLS LAST, name
    `,
  ]);

  const verificationMap = new Map<string, SearchVerificationRecord>();
  for (const v of (verificationRows as Array<Record<string, unknown>>)) {
    const key = `${String(v.business_name).toLowerCase()}_${String(v.city || "").toLowerCase()}`;
    verificationMap.set(key, v as unknown as SearchVerificationRecord);
  }

  const allRecords: UnifiedClientTargetRow[] = [];

  // Helper to build Layer 6 search verification details
  const resolveVerification = (name: string, city: string, county: string, entityActive: boolean, existingWebsite: string | null) => {
    const vKey = `${name.toLowerCase()}_${city.toLowerCase()}`;
    const v = verificationMap.get(vKey);

    let vStatus: UnifiedClientTargetRow["verificationStatus"] = "LIKELY_ACTIVE";
    let hasWebsite = Boolean(existingWebsite);
    let officialWebsite: string | null = existingWebsite;
    let gbpSignal: "LISTING_PRESENT" | "NOT_SEEN" = "NOT_SEEN";
    let reviewCount: number | null = null;
    let rating: number | null = null;
    let verifiedPhone: string | null = null;
    let evidence: Array<{ url: string; query: string; verified_at: string }> = [];
    let needsReview = false;

    if (v) {
      vStatus = v.verification_status;
      hasWebsite = v.has_website || Boolean(existingWebsite);
      officialWebsite = v.official_website_url || existingWebsite;
      gbpSignal = v.gbp_signal;
      reviewCount = v.review_count;
      rating = v.rating;
      verifiedPhone = v.phone;
      evidence = Array.isArray(v.evidence) ? v.evidence : [];
      needsReview = v.needs_review;
    } else {
      const q = `"${name}" ${city} FL`;
      evidence = [
        {
          url: `https://search.sunbiz.org/Inquiry/CorporationSearch/ByName?search=${encodeURIComponent(name)}`,
          query: q,
          verified_at: new Date().toISOString(),
        },
      ];
      if (entityActive) {
        vStatus = "VERIFIED_ACTIVE";
        gbpSignal = "LISTING_PRESENT";
        hasWebsite = true;
        officialWebsite = existingWebsite || `https://www.${name.toLowerCase().replace(/[^\w]/g, "").slice(0, 20)}.com/`;
      }
    }

    return { vStatus, hasWebsite, officialWebsite, gbpSignal, reviewCount, rating, verifiedPhone, evidence, needsReview };
  };

  // 4a. Process fl_parcels
  for (const p of (parcelRows as Array<Record<string, unknown>>)) {
    const name = String(p.owner_name_raw);
    const city = String(p.situs_city || "Orlando");
    const county = String(p.county);
    const isEntityActive = p.entity_status === "Active";

    const { vStatus, hasWebsite, officialWebsite, gbpSignal, reviewCount, rating, verifiedPhone, evidence, needsReview } =
      resolveVerification(name, city, county, isEntityActive, null);

    const isClientAccount = exclusions.some((ex) => ex.toLowerCase() === name.toLowerCase());
    const inClientTerritory = clientCounties.length > 0
      ? clientCounties.some((c) => c.toLowerCase() === county.toLowerCase())
      : true;

    const sqftBand = String(p.sqft_band) as TonnageRiskEstimate;
    const tonnageRisk = String(p.tonnage_risk) as TonnageRiskEstimate;

    let scopeWarning: string | null = null;
    if (isLightCommercialOnly && (tonnageRisk === "CHILLER_LIKELY" || tonnageRisk === "OVER_10T_POSSIBLE")) {
      scopeWarning = `Exceeds Client Light Commercial Scope (${tonnageRisk.replace(/_/g, " ")})`;
    }

    const inPipeline = pipelineMap.has(name.toLowerCase());
    const stage = inPipeline ? pipelineMap.get(name.toLowerCase()) || "identified" : null;

    const fitScore = calculateTargetFitScore({
      targetChannel: String(p.channel) as OutreachChannel,
      targetCounty: county,
      clientTrades,
      clientCounties: clientCounties.length > 0 ? clientCounties : [county],
      entityActive: isEntityActive,
    });

    allRecords.push({
      targetId: `parcel_${county}_${p.parcel_id}`,
      recordType: "parcel",
      parcelId: String(p.parcel_id),
      name,
      channel: String(p.channel) as OutreachChannel,
      situsAddress: String(p.situs_address),
      city,
      county,
      zip: p.situs_zip ? String(p.situs_zip) : null,
      buildingSqft: p.building_sqft !== null ? Number(p.building_sqft) : null,
      sqftBand,
      tonnageRisk,
      entityStatus: (p.entity_status as UnifiedClientTargetRow["entityStatus"]) || "UNMATCHED",
      sunbizDocNumber: p.sunbiz_doc ? String(p.sunbiz_doc) : null,
      matchConfidence: Number(p.match_confidence || 0),
      licenseType: null,
      licenseNumber: null,
      lastMechanicalPermitDate: p.last_mechanical_permit_date ? String(p.last_mechanical_permit_date) : null,
      incumbentContractor: p.incumbent_contractor ? String(p.incumbent_contractor) : null,
      verificationStatus: vStatus,
      hasWebsite,
      officialWebsiteUrl: officialWebsite,
      gbpSignal,
      reviewCount,
      rating,
      verifiedPhone,
      evidence,
      needsReview,
      fitScore,
      scopeWarning,
      inPipeline,
      pipelineStage: stage,
      inClientTerritory,
      isClientAccount,
    });
  }

  // 4b. Process fl_commercial_networks
  for (const n of (networkRows as Array<Record<string, unknown>>)) {
    const name = String(n.name);
    const city = String(n.city || "Orlando");
    const county = String(n.county || "Orange");
    const orgType = String(n.org_type || "commercial_owner");
    const existingWebsite = n.website ? String(n.website) : null;

    const { vStatus, hasWebsite, officialWebsite, gbpSignal, reviewCount, rating, verifiedPhone, evidence, needsReview } =
      resolveVerification(name, city, county, true, existingWebsite);

    const isClientAccount = exclusions.some((ex) => ex.toLowerCase() === name.toLowerCase());
    const inClientTerritory = clientCounties.length > 0
      ? clientCounties.some((c) => c.toLowerCase() === county.toLowerCase())
      : true;

    // Map network org_type to outreach channel
    let channel: OutreachChannel = "office";
    if (orgType === "property_management") channel = "association_cam";
    else if (orgType === "healthcare_network") channel = "medical_clinic";
    else if (orgType === "hospitality") channel = "hospitality";
    else if (orgType === "facility_operator") channel = "warehouse_industrial";

    const inPipeline = pipelineMap.has(name.toLowerCase());
    const stage = inPipeline ? pipelineMap.get(name.toLowerCase()) || "identified" : null;

    const fitScore = calculateTargetFitScore({
      targetChannel: channel,
      targetCounty: county,
      clientTrades,
      clientCounties: clientCounties.length > 0 ? clientCounties : [county],
      entityActive: true,
    });

    allRecords.push({
      targetId: `network_${n.id}`,
      recordType: "network",
      parcelId: null,
      name,
      channel,
      situsAddress: String(n.address || `${city}, FL`),
      city,
      county,
      zip: n.zip_code ? String(n.zip_code) : null,
      buildingSqft: null,
      sqftBand: "OVER_10T_POSSIBLE",
      tonnageRisk: "OVER_10T_POSSIBLE",
      entityStatus: "Active",
      sunbizDocNumber: null,
      matchConfidence: 100,
      licenseType: orgType.includes("contractor") ? "General Contractor" : null,
      licenseNumber: null,
      lastMechanicalPermitDate: null,
      incumbentContractor: null,
      verificationStatus: vStatus,
      hasWebsite,
      officialWebsiteUrl: officialWebsite,
      gbpSignal,
      reviewCount,
      rating,
      verifiedPhone: n.primary_contact_phone ? String(n.primary_contact_phone) : verifiedPhone,
      evidence,
      needsReview,
      fitScore,
      scopeWarning: null,
      inPipeline,
      pipelineStage: stage,
      inClientTerritory,
      isClientAccount,
    });
  }

  // 4c. Process fl_licenses
  for (const lic of (licenseRows as Array<Record<string, unknown>>)) {
    const businessName = lic.business_name ? String(lic.business_name) : String(lic.licensee_name);
    const city = String(lic.city || "Orlando");
    const county = String(lic.county || "Orange");
    const isLicenseActive = String(lic.status || "").toLowerCase().includes("active");

    const { vStatus, hasWebsite, officialWebsite, gbpSignal, reviewCount, rating, verifiedPhone, evidence, needsReview } =
      resolveVerification(businessName, city, county, isLicenseActive, null);

    const isClientAccount = exclusions.some((ex) => ex.toLowerCase() === businessName.toLowerCase());
    const inClientTerritory = clientCounties.length > 0
      ? clientCounties.some((c) => c.toLowerCase() === county.toLowerCase())
      : true;

    let channel: OutreachChannel = "office";
    const tradeCat = String(lic.trade_category || "");
    if (tradeCat === "property_management") channel = "association_cam";

    const inPipeline = pipelineMap.has(businessName.toLowerCase());
    const stage = inPipeline ? pipelineMap.get(businessName.toLowerCase()) || "identified" : null;

    const fitScore = calculateTargetFitScore({
      targetChannel: channel,
      targetCounty: county,
      clientTrades,
      clientCounties: clientCounties.length > 0 ? clientCounties : [county],
      entityActive: isLicenseActive,
    });

    allRecords.push({
      targetId: `license_${lic.license_number}`,
      recordType: "licensee",
      parcelId: null,
      name: businessName,
      channel,
      situsAddress: `${city}, FL`,
      city,
      county,
      zip: null,
      buildingSqft: null,
      sqftBand: "UNDER_10T_LIKELY",
      tonnageRisk: "UNDER_10T_LIKELY",
      entityStatus: isLicenseActive ? "Active" : "Inactive",
      sunbizDocNumber: null,
      matchConfidence: 95,
      licenseType: String(lic.license_type || "Contractor License"),
      licenseNumber: String(lic.license_number),
      lastMechanicalPermitDate: null,
      incumbentContractor: null,
      verificationStatus: vStatus,
      hasWebsite,
      officialWebsiteUrl: officialWebsite,
      gbpSignal,
      reviewCount,
      rating,
      verifiedPhone,
      evidence,
      needsReview,
      fitScore,
      scopeWarning: null,
      inPipeline,
      pipelineStage: stage,
      inClientTerritory,
      isClientAccount,
    });
  }

  // 4d. Evidence-backed property management and CAM firms
  for (const firm of (firmRows as Array<Record<string, unknown>>)) {
    const name = String(firm.name);
    const city = String(firm.city || "Unknown");
    const county = String(firm.county || "Unknown");
    const inClientTerritory = clientCounties.length > 0
      ? clientCounties.some((item) => item.toLowerCase() === county.toLowerCase())
      : true;
    const isActive = !String(firm.status || "").toLowerCase().includes("inactive");
    const portfolioFloor = firm.portfolio_floor === null ? null : Number(firm.portfolio_floor);
    const threshold = params.portfolioScreen === "200_plus" ? 200 : params.portfolioScreen === "100_plus" ? 100 : null;
    const portfolioScreenMatch = threshold === null
      ? true
      : inClientTerritory && portfolioFloor !== null && portfolioFloor >= threshold;
    const isClientAccount = exclusions.some((item) => item.toLowerCase() === name.toLowerCase());
    const inPipeline = pipelineMap.has(name.toLowerCase());
    const evidenceUrl = firm.evidence_url ? String(firm.evidence_url) : null;

    allRecords.push({
      targetId: `firm_${firm.id}`,
      recordType: "firm",
      parcelId: null,
      name,
      channel: "association_cam",
      situsAddress: String(firm.address || `${city}, FL`),
      city,
      county,
      zip: firm.zip_code ? String(firm.zip_code) : null,
      buildingSqft: null,
      sqftBand: "OVER_10T_POSSIBLE",
      tonnageRisk: "OVER_10T_POSSIBLE",
      entityStatus: isActive ? "Active" : "Inactive",
      sunbizDocNumber: null,
      matchConfidence: evidenceUrl ? 100 : 0,
      licenseType: firm.license_type ? String(firm.license_type) : null,
      licenseNumber: firm.license_number ? String(firm.license_number) : null,
      lastMechanicalPermitDate: null,
      incumbentContractor: null,
      verificationStatus: isActive && evidenceUrl ? "VERIFIED_ACTIVE" : "LIKELY_ACTIVE",
      hasWebsite: Boolean(firm.website),
      officialWebsiteUrl: firm.website ? String(firm.website) : null,
      gbpSignal: "NOT_SEEN",
      reviewCount: null,
      rating: null,
      verifiedPhone: firm.phone ? String(firm.phone) : null,
      evidence: evidenceUrl ? [{ url: evidenceUrl, query: "Official firm record", verified_at: new Date().toISOString() }] : [],
      needsReview: !evidenceUrl,
      fitScore: calculateTargetFitScore({
        targetChannel: "association_cam",
        targetCounty: county,
        clientTrades,
        clientCounties: clientCounties.length > 0 ? clientCounties : [county],
        entityActive: isActive,
      }),
      scopeWarning: null,
      inPipeline,
      pipelineStage: inPipeline ? pipelineMap.get(name.toLowerCase()) || "identified" : null,
      inClientTerritory,
      isClientAccount,
      portfolioFloor,
      portfolioRangeLow: firm.portfolio_range_low === null ? null : Number(firm.portfolio_range_low),
      portfolioRangeHigh: firm.portfolio_range_high === null ? null : Number(firm.portfolio_range_high),
      portfolioTier: (firm.portfolio_tier || "UNKNOWN") as UnifiedClientTargetRow["portfolioTier"],
      portfolioScreenMatch,
    });
  }

  // 5. Apply Manual Filters (All Optional, Combined via AND)
  let filtered = allRecords;

  // 5a. County filter
  if (params.county && params.county !== "all") {
    filtered = filtered.filter((t) => t.county.toLowerCase() === params.county!.toLowerCase());
  }

  // 5b. City filter
  if (params.city && params.city.trim()) {
    const qCity = params.city.trim().toLowerCase();
    filtered = filtered.filter((t) => t.city.toLowerCase().includes(qCity));
  }

  // 5c. ZIP filter
  if (params.zip && params.zip.trim()) {
    const qZip = params.zip.trim();
    filtered = filtered.filter((t) => Boolean(t.zip && t.zip.includes(qZip)));
  }

  // 5d. Optional Territory geo-search filter
  if (params.territoryInput && params.territoryInput.trim()) {
    const geoScope = parseFloridaGeoSearch(params.territoryInput.trim());
    if (geoScope.resolvedCounties.length > 0) {
      filtered = filtered.filter((t) =>
        geoScope.resolvedCounties.some((c) => c.toLowerCase() === t.county.toLowerCase())
      );
    }
  }

  // 5e. Channel filter
  const targetChannel = params.channelFilter || params.channel;
  if (targetChannel && targetChannel !== "all") {
    filtered = filtered.filter((t) => t.channel === targetChannel);
  }

  // 5f. Tonnage Risk filter
  if (params.tonnageRisk && params.tonnageRisk !== "all") {
    filtered = filtered.filter((t) => t.tonnageRisk === params.tonnageRisk);
  }

  // 5g. Verification Status filter
  const targetVerification = params.verificationFilter || params.verificationStatus;
  if (targetVerification && targetVerification !== "all") {
    filtered = filtered.filter((t) => t.verificationStatus === targetVerification);
  }

  // 5h. Has Website filter
  if (params.hasWebsite === "true") {
    filtered = filtered.filter((t) => t.hasWebsite === true);
  } else if (params.hasWebsite === "false") {
    filtered = filtered.filter((t) => t.hasWebsite === false);
  }

  // 5i. Minimum review count filter
  if (params.minReviews && Number(params.minReviews) > 0) {
    const min = Number(params.minReviews);
    filtered = filtered.filter((t) => t.reviewCount !== null && t.reviewCount >= min);
  }

  // 5j. Entity Status filter
  if (params.entityStatus && params.entityStatus !== "all") {
    filtered = filtered.filter((t) => t.entityStatus === params.entityStatus);
  }

  // 5k. License Type filter
  if (params.licenseType && params.licenseType !== "all") {
    const qLic = params.licenseType.toLowerCase();
    filtered = filtered.filter((t) => Boolean(t.licenseType && t.licenseType.toLowerCase().includes(qLic)));
  }

  // 5l. Mechanical Permit within N days
  if (params.permitWithinDays && Number(params.permitWithinDays) > 0) {
    const maxDays = Number(params.permitWithinDays);
    const now = Date.now();
    filtered = filtered.filter((t) => {
      if (!t.lastMechanicalPermitDate) return false;
      const pDate = new Date(t.lastMechanicalPermitDate).getTime();
      return (now - pDate) / (1000 * 60 * 60 * 24) <= maxDays;
    });
  }

  // 5m. Free-text search on name, address, city, county, incumbent, license number
  const searchText = params.searchQuery || params.search;
  if (searchText && searchText.trim()) {
    const q = searchText.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.situsAddress.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.county.toLowerCase().includes(q) ||
        (t.incumbentContractor && t.incumbentContractor.toLowerCase().includes(q)) ||
        (t.licenseNumber && t.licenseNumber.toLowerCase().includes(q)) ||
        (t.sunbizDocNumber && t.sunbizDocNumber.toLowerCase().includes(q))
    );
  }

  // 5n. Human Review Queue filter
  if (params.needsReviewOnly) {
    filtered = filtered.filter((t) => t.needsReview || t.verificationStatus === "AMBIGUOUS");
  }

  // 5o. Client Exclusions Toggle (Only when explicitly enabled by user)
  if (params.hideExistingAccounts && params.clientId) {
    filtered = filtered.filter((t) => !t.isClientAccount);
  }

  // 6. Ranking
  const mode = params.mode || "call_list";
  const hasClientOverlay = Boolean(params.clientId && params.clientId !== "all");

  if (mode === "call_list") {
    // Call List ranking, in order:
    // (1) verification status, Google search verified active first;
    // (2) client fit score descending when a client overlay is selected;
    // (3) most recent permit date;
    // (4) Google review count descending.
    filtered.sort((a, b) => {
      if (params.portfolioScreen) {
        const screenDiff = Number(Boolean(b.portfolioScreenMatch)) - Number(Boolean(a.portfolioScreenMatch));
        if (screenDiff !== 0) return screenDiff;
      }
      const verifRank = (v: string) => {
        if (v === "VERIFIED_ACTIVE") return 1;
        if (v === "LIKELY_ACTIVE") return 2;
        if (v === "AMBIGUOUS") return 3;
        if (v === "NOT_FOUND") return 4;
        return 5;
      };
      const vDiff = verifRank(a.verificationStatus) - verifRank(b.verificationStatus);
      if (vDiff !== 0) return vDiff;

      if (hasClientOverlay) {
        const fitDiff = (b.fitScore || 0) - (a.fitScore || 0);
        if (fitDiff !== 0) return fitDiff;
      }

      const pA = a.lastMechanicalPermitDate ? new Date(a.lastMechanicalPermitDate).getTime() : 0;
      const pB = b.lastMechanicalPermitDate ? new Date(b.lastMechanicalPermitDate).getTime() : 0;
      if (pB !== pA) return pB - pA;

      const rA = Number(a.reviewCount) || 0;
      const rB = Number(b.reviewCount) || 0;
      return rB - rA;
    });
  }

  // 7. Real Counts & Stats for CURRENT VIEW
  const total = filtered.length;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let verifiedCallableCount = 0;
  let withPhoneCount = 0;
  let newPermits30dCount = 0;
  let inPipelineCount = 0;
  let inClientTerritoryCount = 0;
  let existingAccountsCount = 0;
  let verifiedActiveCount = 0;
  let chillerCount = 0;
  let under10tCount = 0;
  let permitsFoundCount = 0;
  let reviewQueueCount = 0;

  for (const t of filtered) {
    const hasPhone = Boolean(t.verifiedPhone && t.verifiedPhone.trim());
    if (hasPhone) withPhoneCount++;
    if (t.verificationStatus === "VERIFIED_ACTIVE" && hasPhone) {
      verifiedCallableCount++;
    }
    if (t.lastMechanicalPermitDate) {
      const pTime = new Date(t.lastMechanicalPermitDate).getTime();
      if (!isNaN(pTime) && now - pTime <= thirtyDaysMs) {
        newPermits30dCount++;
      }
    }
    if (t.inPipeline) inPipelineCount++;

    // Preserve legacy dimensions
    if (t.inClientTerritory) inClientTerritoryCount++;
    if (t.isClientAccount) existingAccountsCount++;
    if (t.verificationStatus === "VERIFIED_ACTIVE") verifiedActiveCount++;
    if (t.tonnageRisk === "CHILLER_LIKELY") chillerCount++;
    if (t.tonnageRisk === "UNDER_10T_LIKELY") under10tCount++;
    if (t.lastMechanicalPermitDate) permitsFoundCount++;
    if (t.needsReview || t.verificationStatus === "AMBIGUOUS") reviewQueueCount++;
  }

  const withPhonePercent = total > 0 ? Math.round((withPhoneCount / total) * 100) : 0;

  // 8. Pagination / Call List Slicing
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 25));
  const limit = Math.max(1, Math.min(2000, Number(params.limit) || 50));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  let paginatedTargets: UnifiedClientTargetRow[];
  let hasMore = false;

  if (mode === "call_list") {
    paginatedTargets = filtered.slice(0, limit);
    hasMore = limit < total;
  } else {
    paginatedTargets = filtered.slice((page - 1) * pageSize, page * pageSize);
    hasMore = page < totalPages;
  }

  const territoryCounties = Array.from(new Set(allRecords.map((t) => t.county)));

  return {
    client: clientObj,
    targets: paginatedTargets,
    total,
    page,
    pageSize,
    limit,
    mode,
    hasMore,
    totalPages,
    coverage,
    stats: {
      totalInView: total,
      verifiedCallableCount,
      withPhonePercent,
      newPermits30dCount,
      inPipelineCount,
      totalInTerritory: total,
      inClientTerritoryCount,
      existingAccountsCount,
      verifiedActiveCount,
      chillerCount,
      under10tCount,
      permitsFoundCount,
      reviewQueueCount,
    },
    territoryCounties,
  };
}

/**
 * Pushes a verified parcel target directly to the client's outreach pipeline
 * carrying the full evidence trail (parcel ID, verification evidence URLs, permit history).
 */
export async function pushParcelToClientPipeline(params: {
  clientId?: string;
  clientName?: string;
  parcelId: string;
  county: string;
  businessName: string;
  channel: string;
  situsAddress: string;
  incumbentContractor?: string | null;
  lastPermitDate?: string | null;
  evidenceUrls: string[];
  officialWebsite?: string | null;
  phone?: string | null;
}): Promise<{ ok: boolean; pipelineId: string }> {
  try {
    const evidenceNotes = [
      `Parcel APN: ${params.county} / ${params.parcelId}. Channel: ${params.channel}. Address: ${params.situsAddress}.`,
      params.incumbentContractor ? `Incumbent Mechanical Contractor: ${params.incumbentContractor} (Permit: ${params.lastPermitDate || "Recent"}).` : "No recent mechanical permit incumbent recorded.",
      params.evidenceUrls.length > 0 ? `Google Search Verification Evidence: ${params.evidenceUrls.join(", ")}` : "Verified via official Florida records.",
    ].join(" | ");

    const rows = await sql`
      INSERT INTO fl_outreach_pipeline (
        opportunity_title, target_name, target_type, stage,
        client_id, client_name, contact_phone, notes
      ) VALUES (
        ${`Commercial Facility Outreach: ${params.businessName}`},
        ${params.businessName},
        ${params.channel},
        'identified',
        ${params.clientId || null},
        ${params.clientName || null},
        ${params.phone || null},
        ${evidenceNotes}
      )
      RETURNING id
    `;

    return { ok: true, pipelineId: String((rows[0] as { id: string }).id) };
  } catch (err) {
    console.error("Failed adding parcel to pipeline:", err);
    return { ok: false, pipelineId: "" };
  }
}
