import { sql } from "@/lib/db";

export type PortfolioTier = "UNDER_100" | "FROM_100_TO_300" | "OVER_300" | "UNKNOWN";

export type PortfolioEvidenceCounts = {
  parcelsMatchedByMailingAddress: number | null;
  evictionFilingsTrailing12mo: number | null;
  permitPropertiesTrailing12mo: number | null;
  sunbizAssociationsManaged: number | null;
  associationUnitsTotal: number | null;
  claimedDoors: number | null;
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
    counts.parcelsMatchedByMailingAddress,
    counts.permitPropertiesTrailing12mo,
    counts.sunbizAssociationsManaged,
    counts.associationUnitsTotal,
  ].map(positiveInteger).filter((value): value is number => value !== null);

  const portfolioFloor = verifiedCounts.length ? Math.max(...verifiedCounts) : null;
  const filings = positiveInteger(counts.evictionFilingsTrailing12mo);
  const evictionRangeLow = filings === null ? null : Math.ceil(filings / 0.08);
  const evictionRangeHigh = filings === null ? null : Math.ceil(filings / 0.03);
  const portfolioRangeLow = portfolioFloor === null && evictionRangeLow === null
    ? null
    : Math.max(portfolioFloor || 0, evictionRangeLow || 0);
  const portfolioRangeHigh = evictionRangeHigh === null || portfolioRangeLow === null
    ? null
    : Math.max(portfolioRangeLow, evictionRangeHigh);

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
  const [firms, parcels, permits, relationships] = await Promise.all([
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
      WHERE relationship.relationship_type IN ('registered_agent', 'manager_of_record', 'manages_association')
    `,
  ]) as [FirmRow[], ParcelRow[], PermitRow[], AssociationRelationshipRow[]];

  const tierCounts: Record<PortfolioTier, number> = { UNDER_100: 0, FROM_100_TO_300: 0, OVER_300: 0, UNKNOWN: 0 };
  const layerCounts: Record<string, number> = { taxMailing: 0, permits: 0, associations: 0, associationUnits: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const summaries: Array<Record<string, unknown>> = [];
  const evidenceRows: Array<Record<string, unknown>> = [];

  for (const firm of firms) {
    const parcelMatches = parcels.filter((parcel) =>
      mailingAddressMatchesFirm(parcel.owner_mailing_address, firm.address, firm.zip_code),
    );
    const parcelKeys = new Set(parcelMatches.map((parcel) => `${parcel.county}:${parcel.parcel_id}`));
    const permitMatches = permits.filter((permit) => permitNamesMatchFirm(permit.raw_data, firm.name));
    const permitAddresses = new Set(
      permitMatches.map((permit) => normalizeStreetAddress(permit.address || "")).filter(Boolean),
    );
    const normalizedName = normalizeFirmName(firm.name);
    const associationMatches = relationships.filter((relationship) =>
      (firm.license_number && relationship.firm_license_number === firm.license_number)
      || normalizeFirmName(relationship.firm_name) === normalizedName,
    );
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
    const associationUnitsTotal = hasAssociationUnits ? associationUnits : null;

    const counts: PortfolioEvidenceCounts = {
      parcelsMatchedByMailingAddress: parcelCount,
      evictionFilingsTrailing12mo: positiveInteger(firm.eviction_filings_trailing_12mo),
      permitPropertiesTrailing12mo: permitCount,
      sunbizAssociationsManaged: associationCount,
      associationUnitsTotal,
      claimedDoors: positiveInteger(firm.claimed_doors),
    };
    const summary = calculatePortfolioSummary(counts);
    tierCounts[summary.portfolioTier] += 1;
    if (parcelCount) layerCounts.taxMailing += 1;
    if (permitCount) layerCounts.permits += 1;
    if (associationCount) layerCounts.associations += 1;
    if (associationUnitsTotal) layerCounts.associationUnits += 1;

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
    if (associationUnitsTotal) {
      const relationship = associationMatches[0];
      evidenceRows.push({
        firm_id: firm.id,
        evidence_layer: "association_units",
        evidence_count: associationUnitsTotal,
        range_low: null,
        range_high: null,
        source_name: "Association parcel unit records",
        source_url: relationship.evidence_url,
        as_of_date: dateOnly(relationship.source_snapshot_date),
        methodology: "Sum of documented parcel unit counts for associations connected to the CAM firm.",
        metadata: { association_ids: Array.from(associationIds).slice(0, 100) },
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
      )
      WHERE firm.id = incoming.id
    `;
  }

  await sql`
    DELETE FROM fl_management_firm_portfolio_evidence
    WHERE evidence_layer IN ('tax_mailing_address', 'permit_contact', 'sunbiz_associations', 'association_units')
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
      ELSE 7 END
  `;
}

export { DBPR_CAM_SOURCE };
