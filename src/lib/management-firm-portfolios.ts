import { sql } from "@/lib/db";

export type PortfolioTier = "UNDER_100" | "FROM_100_TO_300" | "OVER_300" | "UNKNOWN";

export type PortfolioEvidenceCounts = {
  parcelsMatchedByMailingAddress: number | null;
  evictionFilingsTrailing12mo: number | null;
  permitPropertiesTrailing12mo: number | null;
  sunbizAssociationsManaged: number | null;
  associationUnitsTotal: number | null;
  claimedDoors: number | null;
  verifiedManagedProperties?: number | null;
  verifiedAssociationUnits?: number | null;
  verifiedRentalUnits?: number | null;
  verifiedCondominiumUnits?: number | null;
  verifiedCommercialLocations?: number | null;
};

export type PortfolioSummary = {
  portfolioFloor: number | null;
  portfolioRangeLow: number | null;
  portfolioRangeHigh: number | null;
  portfolioTier: PortfolioTier;
};

type FirmRow = {
  id: string;
  name: string;
  address: string | null;
  zip_code: string | null;
  license_number: string | null;
  claimed_doors: number | null;
  eviction_filings_trailing_12mo: number | null;
};

type ParcelRow = {
  county: string;
  parcel_id: string;
  owner_mailing_address: string | null;
  location_source_url: string | null;
  updated_at: string | Date | null;
};

type PermitRow = {
  id: string;
  address: string | null;
  source_url: string | null;
  raw_data: Record<string, unknown> | null;
  issued_at: string | Date | null;
  processed_at: string | Date | null;
  last_seen_at: string | Date | null;
};

type AssociationRelationshipRow = {
  firm_license_number: string | null;
  firm_name: string;
  association_id: string;
  evidence_url: string;
  source_snapshot_date: string | Date;
  association_metadata: Record<string, unknown> | null;
};

type CollectedRelationshipRow = {
  firm_id: string;
  canonical_property_key: string;
  property_kind: string;
  property_name: string | null;
  county: string | null;
  zip_code: string | null;
  unit_count: number | null;
  published_portfolio_size: number | null;
  commercial_classification: string;
  management_responsibility: boolean;
  maintenance_responsibility: boolean;
  vendor_accessible: boolean;
  source_key: string;
  source_name: string;
  source_url: string;
  source_as_of_date: string | Date;
  relationship_kind: string;
  is_verified_management: boolean;
};

const FL_DOR_SOURCE = "https://floridarevenue.com/property/Pages/DataPortal.aspx";
const DBPR_CAM_SOURCE = "https://www2.myfloridalicense.com/community-association-managers-and-firms/public-records/";

const ACCEPTANCE_FIRMS = [
  {
    name: "CONDO METROPOLIS LLC",
    dba: "Winter Garden Realty Execs.",
    licenseNumber: "CQ1028137",
    address: "2510 ROBERT TRENT JONES DRIVE",
    city: "Orlando",
    county: "Orange",
    zipCode: "32835",
    source: "FL_DBPR_REAL_ESTATE",
    evidenceUrl: "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=3500700",
    metadata: { official_record_type: "Florida real estate corporation license" },
  },
  {
    name: "VERANDAH PROPERTIES, LLC",
    dba: "Verandah Properties",
    licenseNumber: "SUNBIZ-L09000035369",
    address: "4767 NEW BROAD STREET",
    city: "Orlando",
    county: "Orange",
    zipCode: "32814",
    source: "FL_SUNBIZ",
    evidenceUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l09000035369-c917c8f0-7f5d-4f6a-a722-18859982cb75&formatType=PDF&transactionId=l09000035369-33c26480-c1df-4294-b4f5-db09bea610ae",
    metadata: { document_number: "L09000035369", official_record_type: "Florida limited liability company annual report" },
  },
] as const;

export function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function calculatePortfolioSummary(counts: PortfolioEvidenceCounts): PortfolioSummary {
  const verifiedCounts = [
    counts.sunbizAssociationsManaged,
    counts.associationUnitsTotal,
    counts.verifiedManagedProperties,
    counts.verifiedAssociationUnits,
    counts.verifiedRentalUnits,
    counts.verifiedCondominiumUnits,
    counts.verifiedCommercialLocations,
  ].map(positiveInteger).filter((value): value is number => value !== null);

  const portfolioFloor = verifiedCounts.length ? Math.max(...verifiedCounts) : null;
  const portfolioRangeLow = portfolioFloor;
  const portfolioRangeHigh = null;

  let portfolioTier: PortfolioTier = "UNKNOWN";
  if (portfolioFloor !== null) {
    if (portfolioFloor < 100) portfolioTier = "UNDER_100";
    else if (portfolioFloor <= 300) portfolioTier = "FROM_100_TO_300";
    else portfolioTier = "OVER_300";
  }

  return { portfolioFloor, portfolioRangeLow, portfolioRangeHigh, portfolioTier };
}

export function portfolioTierLabel(tier: PortfolioTier): string {
  if (tier === "UNDER_100") return "Under 100";
  if (tier === "FROM_100_TO_300") return "100 to 300";
  if (tier === "OVER_300") return "300+";
  return "No data";
}

export function formatPortfolioRange(summary: PortfolioSummary): string {
  if (summary.portfolioTier === "UNKNOWN" || summary.portfolioRangeLow === null) return "No data";
  if (summary.portfolioRangeHigh !== null) {
    return `${portfolioTierLabel(summary.portfolioTier)} · est. ${summary.portfolioRangeLow.toLocaleString()} to ${summary.portfolioRangeHigh.toLocaleString()}`;
  }
  return `${portfolioTierLabel(summary.portfolioTier)} · at least ${summary.portfolioRangeLow.toLocaleString()}`;
}

export function normalizeFirmName(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|LTD)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStreetAddress(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bSUITE\b/g, "STE")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mailingAddressMatchesFirm(
  mailingAddress: string | null,
  firmAddress: string | null,
  firmZip: string | null,
): boolean {
  if (!mailingAddress || !firmAddress || !firmZip) return false;
  const mailing = normalizeStreetAddress(mailingAddress);
  const street = normalizeStreetAddress(firmAddress);
  const zip = firmZip.replace(/\D/g, "").slice(0, 5);
  if (!street || zip.length !== 5 || !new RegExp(`(?:^| )${zip}(?: |$)`).test(mailing)) return false;
  return mailing === street || mailing.startsWith(`${street} `);
}

function collectPermitContactNames(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const names: string[] = [];
  const visit = (value: unknown, key: string) => {
    const normalizedKey = key.toLowerCase();
    const allowed = /applicant|contact|property.?manager|management.?agent/.test(normalizedKey);
    if (allowed && typeof value === "string" && value.trim()) names.push(value.trim());
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(childValue, `${key}.${childKey}`);
      }
    }
  };
  for (const [key, value] of Object.entries(raw)) visit(value, key);
  return names;
}

export function permitNamesMatchFirm(raw: Record<string, unknown> | null, firmName: string): boolean {
  const target = normalizeFirmName(firmName);
  if (target.length < 5) return false;
  return collectPermitContactNames(raw).some((name) => normalizeFirmName(name) === target);
}

async function importCanonicalFirms(): Promise<{ camFirms: number; acceptanceFirms: number }> {
  await sql`
    UPDATE fl_management_firms firm
    SET dba = entity.dba_name,
        firm_type = 'community_association_management',
        license_number = entity.license_number,
        license_type = 'Community Association Management Firm',
        status = COALESCE(entity.source_status, 'CURRENT'),
        phone = COALESCE(entity.phone, firm.phone),
        website = COALESCE(entity.website_url, firm.website),
        source = 'FL_DBPR_CAB',
        evidence_url = entity.evidence_url,
        metadata = firm.metadata || entity.metadata || jsonb_build_object('channel_entity_id', entity.id, 'source_snapshot_date', entity.source_snapshot_date),
        managed_properties_count = NULL,
        updated_at = CURRENT_TIMESTAMP
    FROM oi_channel_entities entity
    WHERE entity.source_key = 'dbpr-cam'
      AND entity.entity_type = 'cam_firm'
      AND entity.is_source_active = TRUE
      AND entity.license_number IS NOT NULL
      AND LOWER(firm.name) = LOWER(entity.entity_name)
      AND LOWER(COALESCE(firm.county, '')) = LOWER(COALESCE(entity.county, ''))
      AND LOWER(COALESCE(firm.address, '')) = LOWER(COALESCE(entity.address, ''))
      AND (firm.license_number IS NULL OR firm.license_number = entity.license_number)
  `;

  await sql`
    INSERT INTO fl_management_firms(
      name, dba, firm_type, license_number, license_type, status,
      address, city, state, zip_code, county, phone, website,
      latitude, longitude, source, evidence_url, metadata,
      managed_properties_count, updated_at
    )
    SELECT
      entity_name, dba_name, 'community_association_management', license_number,
      'Community Association Management Firm', COALESCE(source_status, 'CURRENT'),
      address, city, COALESCE(state, 'FL'), zip_code, county, phone, website_url,
      latitude, longitude, 'FL_DBPR_CAB', evidence_url,
      metadata || jsonb_build_object('channel_entity_id', id, 'source_snapshot_date', source_snapshot_date),
      NULL, CURRENT_TIMESTAMP
    FROM oi_channel_entities
    WHERE source_key = 'dbpr-cam'
      AND entity_type = 'cam_firm'
      AND is_source_active = TRUE
      AND license_number IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM fl_management_firms firm
        WHERE firm.license_number = oi_channel_entities.license_number
      )
    ON CONFLICT (name, county, address) DO UPDATE SET
      license_number = EXCLUDED.license_number,
      name = EXCLUDED.name,
      dba = EXCLUDED.dba,
      status = EXCLUDED.status,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip_code = EXCLUDED.zip_code,
      county = EXCLUDED.county,
      phone = COALESCE(EXCLUDED.phone, fl_management_firms.phone),
      website = COALESCE(EXCLUDED.website, fl_management_firms.website),
      source = EXCLUDED.source,
      evidence_url = EXCLUDED.evidence_url,
      metadata = fl_management_firms.metadata || EXCLUDED.metadata,
      managed_properties_count = NULL,
      updated_at = CURRENT_TIMESTAMP
  `;

  const camRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM fl_management_firms
    WHERE source = 'FL_DBPR_CAB' AND license_number LIKE 'CAB%'
  `;

  let acceptanceFirms = 0;
  for (const firm of ACCEPTANCE_FIRMS) {
    await sql`
      INSERT INTO fl_management_firms(
        name, dba, firm_type, license_number, license_type, status,
        address, city, state, zip_code, county, latitude, longitude,
        source, evidence_url, metadata, managed_properties_count, updated_at
      ) VALUES (
        ${firm.name}, ${firm.dba}, 'commercial_property_management', ${firm.licenseNumber},
        'Property Management Firm', 'Current,Active', ${firm.address}, ${firm.city}, 'FL',
        ${firm.zipCode}, ${firm.county}, NULL, NULL, ${firm.source}, ${firm.evidenceUrl},
        ${JSON.stringify(firm.metadata)}::jsonb, NULL, CURRENT_TIMESTAMP
      )
      ON CONFLICT (license_number) WHERE license_number IS NOT NULL DO UPDATE SET
        name = EXCLUDED.name,
        dba = EXCLUDED.dba,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        county = EXCLUDED.county,
        zip_code = EXCLUDED.zip_code,
        status = EXCLUDED.status,
        evidence_url = EXCLUDED.evidence_url,
        metadata = fl_management_firms.metadata || EXCLUDED.metadata,
        managed_properties_count = NULL,
        updated_at = CURRENT_TIMESTAMP
    `;
    acceptanceFirms += 1;
  }
  return { camFirms: Number(camRows[0]?.count || 0), acceptanceFirms };
}

function dateOnly(value: string | Date | null | undefined): string {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function metadataUnitCount(metadata: Record<string, unknown> | null): number | null {
  if (!metadata) return null;
  for (const key of ["association_units_total", "unit_count", "units", "parcel_unit_count"]) {
    const count = positiveInteger(metadata[key]);
    if (count !== null) return count;
  }
  return null;
}

export async function reconcileManagementFirmPortfolios(): Promise<{
  firms: number;
  importedCamFirms: number;
  importedAcceptanceFirms: number;
  tierCounts: Record<PortfolioTier, number>;
  layerCounts: Record<string, number>;
}> {
  const imported = await importCanonicalFirms();
  const [firms, parcels, permits, relationships, collectedRelationships] = await Promise.all([
    sql`SELECT id, name, address, zip_code, license_number, claimed_doors, eviction_filings_trailing_12mo FROM fl_management_firms ORDER BY id`,
    sql`
      SELECT county, parcel_id, owner_mailing_address, location_source_url, updated_at
      FROM fl_parcels
      WHERE owner_mailing_address IS NOT NULL
    `,
    sql`
      SELECT id, address, source_url, raw_data, issued_at, processed_at, last_seen_at
      FROM trade_demand_permits
      WHERE COALESCE(issued_at, processed_at, last_seen_at) >= CURRENT_TIMESTAMP - INTERVAL '12 months'
    `,
    sql`
      SELECT from_entity.license_number AS firm_license_number,
             from_entity.entity_name AS firm_name,
             relationship.to_entity_id::text AS association_id,
             relationship.evidence_url,
             relationship.source_snapshot_date,
             to_entity.metadata AS association_metadata
      FROM oi_channel_relationships relationship
      JOIN oi_channel_entities from_entity ON from_entity.id = relationship.from_entity_id
      JOIN oi_channel_entities to_entity ON to_entity.id = relationship.to_entity_id
      WHERE relationship.relationship_type IN ('manager_of_record', 'manages_association')
    `,
    sql`
      SELECT relationship.firm_id, relationship.canonical_property_key,
             relationship.property_kind, relationship.property_name,
             relationship.county, relationship.zip_code, relationship.unit_count,
             relationship.published_portfolio_size, relationship.commercial_classification,
             relationship.management_responsibility, relationship.maintenance_responsibility,
             relationship.vendor_accessible, relationship.source_key,
             source.source_name, relationship.source_url, relationship.source_as_of_date,
             relationship.relationship_kind, relationship.is_verified_management
      FROM fl_management_portfolio_relationships relationship
      JOIN fl_management_portfolio_sources source ON source.source_key = relationship.source_key
      WHERE relationship.is_current = TRUE
    `,
  ]) as [FirmRow[], ParcelRow[], PermitRow[], AssociationRelationshipRow[], CollectedRelationshipRow[]];

  const tierCounts: Record<PortfolioTier, number> = { UNDER_100: 0, FROM_100_TO_300: 0, OVER_300: 0, UNKNOWN: 0 };
  const layerCounts: Record<string, number> = { taxMailing: 0, permits: 0, associations: 0, associationUnits: 0, verifiedManagement: 0, publishedPortfolio: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const summaries: Array<Record<string, unknown>> = [];
  const evidenceRows: Array<Record<string, unknown>> = [];

  const firmsByZip = new Map<string, FirmRow[]>();
  for (const firm of firms) {
    const zip = firm.zip_code?.replace(/\D/g, "").slice(0, 5);
    if (!zip || zip.length !== 5 || !firm.address) continue;
    const candidates = firmsByZip.get(zip) || [];
    candidates.push(firm);
    firmsByZip.set(zip, candidates);
  }
  const parcelMatchesByFirm = new Map<string, ParcelRow[]>();
  for (const parcel of parcels) {
    const zipMatches = parcel.owner_mailing_address
      ? Array.from(parcel.owner_mailing_address.matchAll(/\b(3[2-4]\d{3})(?:-\d{4})?\b/g))
      : [];
    const zip = zipMatches.length ? zipMatches[zipMatches.length - 1][1] : null;
    if (!zip) continue;
    for (const firm of firmsByZip.get(zip) || []) {
      if (!mailingAddressMatchesFirm(parcel.owner_mailing_address, firm.address, firm.zip_code)) continue;
      const matches = parcelMatchesByFirm.get(firm.id) || [];
      matches.push(parcel);
      parcelMatchesByFirm.set(firm.id, matches);
    }
  }
  const relationshipsByLicense = new Map<string, AssociationRelationshipRow[]>();
  const relationshipsByName = new Map<string, AssociationRelationshipRow[]>();
  for (const relationship of relationships) {
    if (relationship.firm_license_number) {
      const rows = relationshipsByLicense.get(relationship.firm_license_number) || [];
      rows.push(relationship);
      relationshipsByLicense.set(relationship.firm_license_number, rows);
    }
    const name = normalizeFirmName(relationship.firm_name);
    const rows = relationshipsByName.get(name) || [];
    rows.push(relationship);
    relationshipsByName.set(name, rows);
  }
  const collectedByFirm = new Map<string, CollectedRelationshipRow[]>();
  for (const relationship of collectedRelationships) {
    const rows = collectedByFirm.get(relationship.firm_id) || [];
    rows.push(relationship);
    collectedByFirm.set(relationship.firm_id, rows);
  }

  for (const firm of firms) {
    const parcelMatches = parcelMatchesByFirm.get(firm.id) || [];
    const parcelKeys = new Set(parcelMatches.map((parcel) => `${parcel.county}:${parcel.parcel_id}`));
    const permitMatches = permits.filter((permit) => permitNamesMatchFirm(permit.raw_data, firm.name));
    const permitAddresses = new Set(
      permitMatches.map((permit) => normalizeStreetAddress(permit.address || "")).filter(Boolean),
    );
    const normalizedName = normalizeFirmName(firm.name);
    const associationMatches = firm.license_number && relationshipsByLicense.has(firm.license_number)
      ? relationshipsByLicense.get(firm.license_number) || []
      : relationshipsByName.get(normalizedName) || [];
    const associationIds = new Set(associationMatches.map((relationship) => relationship.association_id));
    let associationUnits = 0;
    let hasAssociationUnits = false;
    for (const relationship of associationMatches) {
      const units = metadataUnitCount(relationship.association_metadata);
      if (units !== null) {
        associationUnits += units;
        hasAssociationUnits = true;
      }
    }

    const parcelCount = parcelKeys.size || null;
    const permitCount = permitAddresses.size || null;
    const associationCount = associationIds.size || null;
    const collectedForFirm = collectedByFirm.get(firm.id) || [];
    const verifiedForFirm = collectedForFirm.filter((relationship) => relationship.is_verified_management);
    const verifiedProperties = new Map<string, CollectedRelationshipRow[]>();
    for (const relationship of verifiedForFirm) {
      const rows = verifiedProperties.get(relationship.canonical_property_key) || [];
      rows.push(relationship);
      verifiedProperties.set(relationship.canonical_property_key, rows);
    }
    let collectedAssociationUnits = 0;
    let verifiedRentalUnits = 0;
    let verifiedCondominiumUnits = 0;
    let verifiedCommercialLocations = 0;
    let verifiedCommunities = 0;
    let verifiedBuildings = 0;
    let verifiedResidentialProperties = 0;
    let verifiedCommercialProperties = 0;
    let managementResponsibilities = 0;
    let maintenanceResponsibilities = 0;
    let vendorAccessibleProperties = 0;
    const byCounty: Record<string, { managedProperties: number; associationUnits: number; commercial: number; residential: number }> = {};
    const byZip: Record<string, { managedProperties: number; associationUnits: number }> = {};
    for (const rows of Array.from(verifiedProperties.values())) {
      const representative = rows.find((row) => row.unit_count) || rows[0];
      const units = Math.max(0, ...rows.map((row) => positiveInteger(row.unit_count) || 0));
      collectedAssociationUnits += units;
      if (representative.property_kind === "rental_unit") verifiedRentalUnits += Math.max(1, units);
      if (representative.property_kind === "condominium_unit") verifiedCondominiumUnits += Math.max(1, units);
      if (representative.property_kind === "commercial_location") verifiedCommercialLocations += Math.max(1, units);
      if (["community", "association"].includes(representative.property_kind)) verifiedCommunities += 1;
      if (representative.property_kind === "building") verifiedBuildings += 1;
      if (representative.commercial_classification === "residential") verifiedResidentialProperties += 1;
      if (representative.commercial_classification === "commercial") verifiedCommercialProperties += 1;
      if (rows.some((row) => row.management_responsibility)) managementResponsibilities += 1;
      if (rows.some((row) => row.maintenance_responsibility)) maintenanceResponsibilities += 1;
      if (rows.some((row) => row.vendor_accessible)) vendorAccessibleProperties += Math.max(1, units);
      if (representative.county) {
        const metric = byCounty[representative.county] || { managedProperties: 0, associationUnits: 0, commercial: 0, residential: 0 };
        metric.managedProperties += 1;
        metric.associationUnits += units;
        if (representative.commercial_classification === "commercial") metric.commercial += 1;
        if (representative.commercial_classification === "residential") metric.residential += 1;
        byCounty[representative.county] = metric;
      }
      if (representative.zip_code) {
        const metric = byZip[representative.zip_code] || { managedProperties: 0, associationUnits: 0 };
        metric.managedProperties += 1;
        metric.associationUnits += units;
        byZip[representative.zip_code] = metric;
      }
    }
    const verifiedManagedPropertyCount = verifiedProperties.size || null;
    const publishedPortfolioSize = collectedForFirm.reduce((maximum, relationship) => Math.max(maximum, positiveInteger(relationship.published_portfolio_size) || 0), 0) || null;
    maintenanceResponsibilities = Math.max(
      maintenanceResponsibilities,
      new Set(collectedForFirm.filter((row) => row.maintenance_responsibility).map((row) => row.canonical_property_key)).size,
    );
    vendorAccessibleProperties = Math.max(
      vendorAccessibleProperties,
      new Set(collectedForFirm.filter((row) => row.vendor_accessible).map((row) => row.canonical_property_key)).size,
    );
    const associationUnitsTotal = Math.max(hasAssociationUnits ? associationUnits : 0, collectedAssociationUnits) || null;

    const counts: PortfolioEvidenceCounts = {
      parcelsMatchedByMailingAddress: parcelCount,
      evictionFilingsTrailing12mo: positiveInteger(firm.eviction_filings_trailing_12mo),
      permitPropertiesTrailing12mo: permitCount,
      sunbizAssociationsManaged: associationCount,
      associationUnitsTotal,
      claimedDoors: positiveInteger(firm.claimed_doors),
      verifiedManagedProperties: Math.max(verifiedManagedPropertyCount || 0, associationCount || 0) || null,
      verifiedAssociationUnits: associationUnitsTotal,
      verifiedRentalUnits: verifiedRentalUnits || null,
      verifiedCondominiumUnits: verifiedCondominiumUnits || null,
      verifiedCommercialLocations: verifiedCommercialLocations || null,
    };
    const summary = calculatePortfolioSummary(counts);
    tierCounts[summary.portfolioTier] += 1;
    if (parcelCount) layerCounts.taxMailing += 1;
    if (permitCount) layerCounts.permits += 1;
    if (associationCount) layerCounts.associations += 1;
    if (associationUnitsTotal) layerCounts.associationUnits += 1;
    if (verifiedManagedPropertyCount) layerCounts.verifiedManagement += 1;
    if (publishedPortfolioSize) layerCounts.publishedPortfolio += 1;

    summaries.push({
      id: firm.id,
      portfolio_floor: summary.portfolioFloor,
      portfolio_range_low: summary.portfolioRangeLow,
      portfolio_range_high: summary.portfolioRangeHigh,
      portfolio_tier: summary.portfolioTier,
      parcels_matched_by_mailing_address: parcelCount,
      permit_properties_trailing_12mo: permitCount,
      sunbiz_associations_managed: associationCount,
      association_units_total: associationUnitsTotal,
      published_portfolio_size: publishedPortfolioSize,
      individually_verified_managed_properties: verifiedManagedPropertyCount,
      verified_association_units: collectedAssociationUnits || null,
      verified_communities: verifiedCommunities || null,
      verified_buildings: verifiedBuildings || null,
      verified_rental_units: verifiedRentalUnits || null,
      verified_condominium_units: verifiedCondominiumUnits || null,
      verified_commercial_locations: verifiedCommercialLocations || null,
      verified_residential_properties: verifiedResidentialProperties || null,
      verified_commercial_properties: verifiedCommercialProperties || null,
      documented_management_responsibilities: managementResponsibilities || null,
      documented_maintenance_responsibilities: maintenanceResponsibilities || null,
      vendor_accessible_portfolio_size: vendorAccessibleProperties || null,
      portfolio_by_county: byCounty,
      portfolio_by_zip: byZip,
    });

    if (parcelCount) {
      const sourceUrl = parcelMatches.find((parcel) => parcel.location_source_url)?.location_source_url || FL_DOR_SOURCE;
      const asOf = parcelMatches.reduce((latest, parcel) => {
        const current = dateOnly(parcel.updated_at);
        return current > latest ? current : latest;
      }, today);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "tax_mailing_address",
        evidence_count: parcelCount,
        range_low: null,
        range_high: null,
        source_name: "Florida county parcel records",
        source_url: sourceUrl,
        as_of_date: asOf,
        methodology: "Distinct parcels whose normalized owner mailing address matches the firm office street address and ZIP code.",
        metadata: { parcel_keys: Array.from(parcelKeys).slice(0, 100) },
      });
    }
    if (permitCount) {
      const asOf = permitMatches.reduce((latest, permit) => {
        const current = dateOnly(permit.last_seen_at || permit.processed_at || permit.issued_at);
        return current > latest ? current : latest;
      }, today);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "permit_contact",
        evidence_count: permitCount,
        range_low: null,
        range_high: null,
        source_name: "Florida permit records",
        source_url: permitMatches.find((permit) => permit.source_url)?.source_url || null,
        as_of_date: asOf,
        methodology: "Distinct permit property addresses in the trailing 12 months where an applicant or contact field exactly matches the normalized firm name.",
        metadata: { permit_ids: permitMatches.map((permit) => permit.id).slice(0, 100) },
      });
    }
    if (associationCount) {
      const relationship = associationMatches[0];
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "sunbiz_associations",
        evidence_count: associationCount,
        range_low: null,
        range_high: null,
        source_name: "Florida Division of Corporations",
        source_url: relationship.evidence_url,
        as_of_date: dateOnly(relationship.source_snapshot_date),
        methodology: "Distinct associations with a documented registered-agent or manager-of-record relationship to the firm.",
        metadata: { association_ids: Array.from(associationIds).slice(0, 100) },
      });
    }
    if (hasAssociationUnits && associationUnits > 0) {
      const relationship = associationMatches[0];
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "association_units",
        evidence_count: associationUnits,
        range_low: null,
        range_high: null,
        source_name: "Association parcel unit records",
        source_url: relationship.evidence_url,
        as_of_date: dateOnly(relationship.source_snapshot_date),
        methodology: "Sum of documented parcel unit counts for associations connected to the CAM firm.",
        metadata: { association_ids: Array.from(associationIds).slice(0, 100) },
      });
    }
    if (verifiedManagedPropertyCount) {
      const latest = verifiedForFirm.reduce((value, row) => Math.max(value, new Date(row.source_as_of_date).getTime()), 0);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "verified_managed_properties",
        evidence_count: verifiedManagedPropertyCount,
        range_low: null,
        range_high: null,
        source_name: "Explicit published management relationships",
        source_url: verifiedForFirm[0]?.source_url || null,
        as_of_date: dateOnly(latest ? new Date(latest) : today),
        methodology: "Distinct properties or communities explicitly identified as managed by the firm. Duplicate source records share one canonical property key.",
        metadata: { property_keys: Array.from(verifiedProperties.keys()).slice(0, 250), sources: Array.from(new Set(verifiedForFirm.map((row) => row.source_key))) },
      });
    }
    if (collectedAssociationUnits) {
      const unitRows = verifiedForFirm.filter((row) => positiveInteger(row.unit_count));
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "verified_association_units",
        evidence_count: collectedAssociationUnits,
        range_low: null,
        range_high: null,
        source_name: "Florida DBPR condominium directory with management corroboration",
        source_url: unitRows[0]?.source_url || DBPR_CAM_SOURCE,
        as_of_date: dateOnly(unitRows[0]?.source_as_of_date || today),
        methodology: "Sum of the highest official unit count for each deduplicated association with an explicit or independently corroborated management relationship.",
        metadata: { property_keys: Array.from(verifiedProperties.entries()).filter(([, rows]) => rows.some((row) => positiveInteger(row.unit_count))).map(([key]) => key).slice(0, 250) },
      });
    }
    if (publishedPortfolioSize) {
      const published = collectedForFirm.find((row) => positiveInteger(row.published_portfolio_size));
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "published_portfolio",
        evidence_count: publishedPortfolioSize,
        range_low: null,
        range_high: null,
        source_name: published?.source_name || "Firm-published portfolio statement",
        source_url: published?.source_url || null,
        as_of_date: dateOnly(published?.source_as_of_date || today),
        methodology: "Published or self-reported portfolio size, displayed separately and excluded from the verified floor.",
        metadata: { excluded_from_verified_floor: true },
      });
    }
    if (managementResponsibilities) {
      const documented = collectedForFirm.filter((row) => row.management_responsibility);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "management_responsibilities",
        evidence_count: managementResponsibilities,
        range_low: null,
        range_high: null,
        source_name: "Documented management responsibilities",
        source_url: documented[0]?.source_url || null,
        as_of_date: dateOnly(documented[0]?.source_as_of_date || today),
        methodology: "Deduplicated managed properties with an explicit source statement assigning management responsibility.",
        metadata: { property_keys: Array.from(new Set(documented.map((row) => row.canonical_property_key))).slice(0, 250) },
      });
    }
    if (maintenanceResponsibilities) {
      const documented = collectedForFirm.filter((row) => row.maintenance_responsibility);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "maintenance_responsibilities",
        evidence_count: maintenanceResponsibilities,
        range_low: null,
        range_high: null,
        source_name: "Documented maintenance responsibilities",
        source_url: documented[0]?.source_url || null,
        as_of_date: dateOnly(documented[0]?.source_as_of_date || today),
        methodology: "Distinct source records documenting maintenance responsibility. Firm-level capability does not imply every managed property is covered.",
        metadata: { property_keys: Array.from(new Set(documented.map((row) => row.canonical_property_key))).slice(0, 250) },
      });
    }
    if (vendorAccessibleProperties) {
      const documented = collectedForFirm.filter((row) => row.vendor_accessible);
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "vendor_accessible_portfolio",
        evidence_count: vendorAccessibleProperties,
        range_low: null,
        range_high: null,
        source_name: "Confirmed vendor-accessible portfolio",
        source_url: documented[0]?.source_url || null,
        as_of_date: dateOnly(documented[0]?.source_as_of_date || today),
        methodology: "Deduplicated properties for which the source explicitly documents vendor access or vendor onboarding.",
        metadata: { property_keys: Array.from(new Set(documented.map((row) => row.canonical_property_key))).slice(0, 250) },
      });
    }
  }

  const batchSize = 500;
  for (let index = 0; index < summaries.length; index += batchSize) {
    const batch = summaries.slice(index, index + batchSize);
    await sql`
      UPDATE fl_management_firms firm
      SET portfolio_floor = incoming.portfolio_floor,
          portfolio_range_low = incoming.portfolio_range_low,
          portfolio_range_high = incoming.portfolio_range_high,
          portfolio_tier = incoming.portfolio_tier,
          parcels_matched_by_mailing_address = incoming.parcels_matched_by_mailing_address,
          permit_properties_trailing_12mo = incoming.permit_properties_trailing_12mo,
          sunbiz_associations_managed = incoming.sunbiz_associations_managed,
          association_units_total = incoming.association_units_total,
          published_portfolio_size = incoming.published_portfolio_size,
          individually_verified_managed_properties = incoming.individually_verified_managed_properties,
          verified_association_units = incoming.verified_association_units,
          verified_communities = incoming.verified_communities,
          verified_buildings = incoming.verified_buildings,
          verified_rental_units = incoming.verified_rental_units,
          verified_condominium_units = incoming.verified_condominium_units,
          verified_commercial_locations = incoming.verified_commercial_locations,
          verified_residential_properties = incoming.verified_residential_properties,
          verified_commercial_properties = incoming.verified_commercial_properties,
          documented_management_responsibilities = incoming.documented_management_responsibilities,
          documented_maintenance_responsibilities = incoming.documented_maintenance_responsibilities,
          vendor_accessible_portfolio_size = incoming.vendor_accessible_portfolio_size,
          portfolio_by_county = incoming.portfolio_by_county,
          portfolio_by_zip = incoming.portfolio_by_zip,
          managed_properties_count = NULL,
          portfolio_calculated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS incoming(
        id uuid,
        portfolio_floor integer,
        portfolio_range_low integer,
        portfolio_range_high integer,
        portfolio_tier varchar,
        parcels_matched_by_mailing_address integer,
        permit_properties_trailing_12mo integer,
        sunbiz_associations_managed integer,
        association_units_total integer
        ,published_portfolio_size integer
        ,individually_verified_managed_properties integer
        ,verified_association_units integer
        ,verified_communities integer
        ,verified_buildings integer
        ,verified_rental_units integer
        ,verified_condominium_units integer
        ,verified_commercial_locations integer
        ,verified_residential_properties integer
        ,verified_commercial_properties integer
        ,documented_management_responsibilities integer
        ,documented_maintenance_responsibilities integer
        ,vendor_accessible_portfolio_size integer
        ,portfolio_by_county jsonb
        ,portfolio_by_zip jsonb
      )
      WHERE firm.id = incoming.id
    `;
  }

  await sql`
    DELETE FROM fl_management_firm_portfolio_evidence
    WHERE evidence_layer IN (
      'tax_mailing_address', 'permit_contact', 'sunbiz_associations', 'association_units',
      'verified_managed_properties', 'verified_association_units', 'published_portfolio',
      'verified_communities', 'management_responsibilities', 'maintenance_responsibilities',
      'vendor_accessible_portfolio'
    )
  `;
  for (let index = 0; index < evidenceRows.length; index += batchSize) {
    const batch = evidenceRows.slice(index, index + batchSize);
    await sql`
      INSERT INTO fl_management_firm_portfolio_evidence(
        firm_id, evidence_layer, evidence_count, range_low, range_high,
        source_name, source_url, as_of_date, methodology, metadata
      )
      SELECT firm_id, evidence_layer, evidence_count, range_low, range_high,
             source_name, source_url, as_of_date, methodology, metadata
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS incoming(
        firm_id uuid,
        evidence_layer varchar,
        evidence_count integer,
        range_low integer,
        range_high integer,
        source_name text,
        source_url text,
        as_of_date date,
        methodology text,
        metadata jsonb
      )
      ON CONFLICT (firm_id, evidence_layer) DO UPDATE SET
        evidence_count = EXCLUDED.evidence_count,
        range_low = EXCLUDED.range_low,
        range_high = EXCLUDED.range_high,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        as_of_date = EXCLUDED.as_of_date,
        methodology = EXCLUDED.methodology,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  return {
    firms: firms.length,
    importedCamFirms: imported.camFirms,
    importedAcceptanceFirms: imported.acceptanceFirms,
    tierCounts,
    layerCounts,
  };
}

export async function getManagementFirmPortfolioEvidence(firmId: string) {
  return sql`
    SELECT evidence_layer, evidence_count, range_low, range_high, source_name,
           source_url, as_of_date, methodology, metadata
    FROM fl_management_firm_portfolio_evidence
    WHERE firm_id = ${firmId}
    ORDER BY CASE evidence_layer
      WHEN 'tax_mailing_address' THEN 1
      WHEN 'eviction_filings' THEN 2
      WHEN 'permit_contact' THEN 3
      WHEN 'sunbiz_associations' THEN 4
      WHEN 'association_units' THEN 5
      WHEN 'claimed_doors' THEN 6
      WHEN 'verified_managed_properties' THEN 7
      WHEN 'verified_association_units' THEN 8
      WHEN 'published_portfolio' THEN 9
      ELSE 7 END
  `;
}

export { DBPR_CAM_SOURCE };
