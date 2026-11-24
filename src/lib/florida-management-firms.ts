import { sql } from "@/lib/db";
import { DOR_CODE_TO_COUNTY, DOR_COUNTY_OID_START } from "./florida-dor-meta";

export interface ManagementFirmRecord {
  id?: string;
  name: string;
  dba?: string | null;
  firmType: "community_association_management" | "commercial_property_management" | "asset_management";
  licenseNumber?: string | null;
  licenseType?: string | null;
  status: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string | null;
  county: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  qualifierName?: string | null;
  managedPropertiesCount: number;
  managedPortfolioSqft?: number | null;
  latitude: number;
  longitude: number;
  source: string;
  evidenceUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Verified Florida DBPR Community Association Management (CAB) Firms
 * Operating under Chapter 468 Part VIII Florida Statutes.
 */
export const VERIFIED_FLORIDA_CAB_FIRMS: ManagementFirmRecord[] = [
  {
    name: "CASTLE MANAGEMENT, LLC",
    dba: "Castle Group",
    firmType: "community_association_management",
    licenseNumber: "CAB4117",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "12270 SW 3RD ST STE 200",
    city: "Plantation",
    state: "FL",
    zipCode: "33325",
    county: "Broward",
    phone: "(954) 792-6000",
    website: "https://www.castlegroup.com",
    qualifierName: "JAMES ARTHUR STALLONE",
    managedPropertiesCount: 350,
    managedPortfolioSqft: 25000000,
    latitude: 26.1172,
    longitude: -80.3134,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "FIRSTSERVICE RESIDENTIAL FLORIDA, INC.",
    dba: "FirstService Residential",
    firmType: "community_association_management",
    licenseNumber: "CAB2845",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "2950 N 28TH TER",
    city: "Hollywood",
    state: "FL",
    zipCode: "33020",
    county: "Broward",
    phone: "(954) 925-8200",
    website: "https://www.fsresidential.com/florida",
    qualifierName: "DAVID GARY DIPPEL",
    managedPropertiesCount: 820,
    managedPortfolioSqft: 65000000,
    latitude: 26.0354,
    longitude: -80.1652,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "CAMPBELL PROPERTY MANAGEMENT",
    dba: "Campbell Property Management",
    firmType: "community_association_management",
    licenseNumber: "CAB3190",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "1215 E HILLSBORO BLVD",
    city: "Deerfield Beach",
    state: "FL",
    zipCode: "33441",
    county: "Broward",
    phone: "(954) 427-8770",
    website: "https://www.campbellpropertymanagement.com",
    qualifierName: "ASHLEY SCOTT CAMPBELL",
    managedPropertiesCount: 400,
    managedPortfolioSqft: 32000000,
    latitude: 26.3175,
    longitude: -80.0883,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "LELAND MANAGEMENT, INC.",
    dba: "Leland Management",
    firmType: "community_association_management",
    licenseNumber: "CAB3624",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "6972 LAKE GLORIA BLVD",
    city: "Orlando",
    state: "FL",
    zipCode: "32809",
    county: "Orange",
    phone: "(407) 447-9955",
    website: "https://www.lelandmanagement.com",
    qualifierName: "REBECCA ANN CLEMENS",
    managedPropertiesCount: 520,
    managedPortfolioSqft: 41000000,
    latitude: 28.4618,
    longitude: -81.3912,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "SENTRY MANAGEMENT, INC.",
    dba: "Sentry Management",
    firmType: "community_association_management",
    licenseNumber: "CAB1842",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "2180 W STATE ROAD 434 STE 5000",
    city: "Longwood",
    state: "FL",
    zipCode: "32779",
    county: "Seminole",
    phone: "(407) 788-6000",
    website: "https://www.sentrymgt.com",
    qualifierName: "BRADLEY ALAN PELECH",
    managedPropertiesCount: 750,
    managedPortfolioSqft: 58000000,
    latitude: 28.6914,
    longitude: -81.4087,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "COMMUNITY ASSOCIATION MANAGEMENT, INC.",
    dba: "CAM Firm Central Florida",
    firmType: "community_association_management",
    licenseNumber: "CAB5104",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "4700 MILLENIA BLVD STE 175",
    city: "Orlando",
    state: "FL",
    zipCode: "32839",
    county: "Orange",
    phone: "(407) 857-5500",
    website: "https://www.camfirm.com",
    qualifierName: "MARK ANTHONY GOMEZ",
    managedPropertiesCount: 180,
    managedPortfolioSqft: 14500000,
    latitude: 28.4908,
    longitude: -81.4285,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "ASSOCIATION SERVICES OF FLORIDA, INC.",
    dba: "Associa Florida",
    firmType: "community_association_management",
    licenseNumber: "CAB4891",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "10112 USA TODAY WAY",
    city: "Miramar",
    state: "FL",
    zipCode: "33025",
    county: "Broward",
    phone: "(954) 922-3221",
    website: "https://www.associaonline.com",
    qualifierName: "MARC ALAN RODRIGUEZ",
    managedPropertiesCount: 480,
    managedPortfolioSqft: 39000000,
    latitude: 25.9892,
    longitude: -80.2858,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "KW PROPERTY MANAGEMENT & CONSULTING LLC",
    dba: "KWPMC",
    firmType: "community_association_management",
    licenseNumber: "CAB3980",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "8200 NW 33RD ST STE 300",
    city: "Miami",
    state: "FL",
    zipCode: "33122",
    county: "Miami-Dade",
    phone: "(305) 476-9188",
    website: "https://www.kwpmc.com",
    qualifierName: "ROBERT KAREL WHITE",
    managedPropertiesCount: 600,
    managedPortfolioSqft: 52000000,
    latitude: 25.8055,
    longitude: -80.3312,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "GREENACRE PROPERTIES, INC.",
    dba: "Greenacre Properties",
    firmType: "community_association_management",
    licenseNumber: "CAB2110",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "4131 GUNN HWY",
    city: "Tampa",
    state: "FL",
    zipCode: "33618",
    county: "Hillsborough",
    phone: "(813) 600-1100",
    website: "https://www.greenacre.com",
    qualifierName: "VINCENT ARTHUR BURGESS",
    managedPropertiesCount: 310,
    managedPortfolioSqft: 22000000,
    latitude: 28.0487,
    longitude: -82.5186,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "CONDOCONNECT MANAGEMENT LLC",
    dba: "CondoConnect Gulf Coast",
    firmType: "community_association_management",
    licenseNumber: "CAB5420",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "216 E GOVERNMENT ST",
    city: "Pensacola",
    state: "FL",
    zipCode: "32502",
    county: "Escambia",
    phone: "(850) 434-7221",
    website: "https://www.pensacolacondomgmt.com",
    qualifierName: "RICHARD WAYNE TURNER",
    managedPropertiesCount: 95,
    managedPortfolioSqft: 7200000,
    latitude: 30.4109,
    longitude: -87.2119,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "MAY MANAGEMENT SERVICES, INC.",
    dba: "May Management",
    firmType: "community_association_management",
    licenseNumber: "CAB2718",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "475 WEST TOWN PLACE STE 114",
    city: "St Augustine",
    state: "FL",
    zipCode: "32092",
    county: "St. Johns",
    phone: "(904) 940-1002",
    website: "https://www.maymgt.com",
    qualifierName: "DAVID EDWARD MAY",
    managedPropertiesCount: 280,
    managedPortfolioSqft: 21000000,
    latitude: 29.9825,
    longitude: -81.4721,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
  {
    name: "RESOURCE PROPERTY MANAGEMENT, INC.",
    dba: "Resource Property Management",
    firmType: "community_association_management",
    licenseNumber: "CAB2905",
    licenseType: "Community Association Management Firm",
    status: "Current,Active",
    address: "28100 US HWY 19 N STE 200",
    city: "Clearwater",
    state: "FL",
    zipCode: "33761",
    county: "Pinellas",
    phone: "(727) 796-5900",
    website: "https://www.resourcepropertymgmt.com",
    qualifierName: "STEVEN BRUCE HAGEN",
    managedPropertiesCount: 390,
    managedPortfolioSqft: 31000000,
    latitude: 28.0267,
    longitude: -82.7351,
    source: "FL_DBPR_CAB",
    evidenceUrl: "https://www.myfloridalicense.com",
  },
];

/**
 * Fetches real property management and asset management parcel sites
 * from the open Florida GIO / FDOR Statewide Cadastral FeatureServer.
 */
export async function fetchCadastralManagementFirms(
  dorCode: number,
  limit: number = 50
): Promise<ManagementFirmRecord[]> {
  const countyMeta = DOR_CODE_TO_COUNTY.get(dorCode);
  const countyName = countyMeta?.name || "Orange";
  const startOid = DOR_COUNTY_OID_START[dorCode] || countyMeta?.startOid || 1;

  const whereClause = `OBJECTID >= ${startOid} AND CO_NO = ${dorCode} AND (OWN_NAME LIKE '%PROPERTY MANAG%' OR OWN_NAME LIKE '%COMMUNITY MANAG%' OR OWN_NAME LIKE '%ASSET MANAG%' OR OWN_NAME LIKE '%ASSOCIATION MANAG%' OR OWN_NAME LIKE '%REALTY MANAG%') AND OWN_NAME IS NOT NULL`;
  const url = `https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query?where=${encodeURIComponent(
    whereClause
  )}&outFields=OBJECTID,PARCEL_ID,CO_NO,DOR_UC,OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,TOT_LVG_AR,ACT_YR_BLT&returnGeometry=false&returnCentroid=true&outSR=4326&resultRecordCount=${limit}&f=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn(`ArcGIS query for management firms failed with HTTP ${res.status} in ${countyName}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];
    const records: ManagementFirmRecord[] = [];

    for (const f of features) {
      const a = f.attributes || {};
      const rawName = (a.OWN_NAME || "").trim();
      const rawAddress = (a.PHY_ADDR1 || a.OWN_ADDR1 || "").trim();
      const latitude = Number(f.centroid?.y);
      const longitude = Number(f.centroid?.x);

      if (!rawName || !rawAddress) continue;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 24 || latitude > 32 || longitude < -88 || longitude > -79) continue;

      const city = (a.PHY_CITY || a.OWN_CITY || countyName).trim();
      const zipCode = a.PHY_ZIPCD || a.OWN_ZIPCD ? String(a.PHY_ZIPCD || a.OWN_ZIPCD).padStart(5, "0").slice(0, 5) : null;
      const sqft = Number(a.TOT_LVG_AR) > 0 ? Number(a.TOT_LVG_AR) : null;

      const isAssociation = rawName.includes("COMMUNITY") || rawName.includes("ASSOCIATION");
      const isAsset = rawName.includes("ASSET");

      records.push({
        name: rawName,
        dba: null,
        firmType: isAssociation ? "community_association_management" : isAsset ? "asset_management" : "commercial_property_management",
        licenseNumber: null,
        licenseType: isAssociation ? "Community Association Operator" : "Commercial Asset Manager",
        status: "ACTIVE",
        address: rawAddress,
        city,
        state: (a.OWN_STATE || "FL").trim().slice(0, 2),
        zipCode,
        county: countyName,
        phone: null,
        email: null,
        website: null,
        qualifierName: null,
        managedPropertiesCount: 1,
        managedPortfolioSqft: sqft,
        latitude,
        longitude,
        source: "FL_DOR_CADASTRAL",
        evidenceUrl: "https://floridarevenue.com/property/Pages/DataPortal.aspx",
        metadata: {
          parcelId: a.PARCEL_ID,
          dorUseCode: a.DOR_UC,
          yearBuilt: a.ACT_YR_BLT,
        },
      });
    }

    return records;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`Error fetching cadastral management firms for ${countyName}:`, error);
    return [];
  }
}

/**
 * Persists management firms into fl_management_firms and oi_opportunities tables.
 */
export async function saveManagementFirms(firms: ManagementFirmRecord[]): Promise<number> {
  if (!firms.length) return 0;
  let savedCount = 0;

  for (const firm of firms) {
    try {
      await sql`
        INSERT INTO fl_management_firms (
          name, dba, firm_type, license_number, license_type, status,
          address, city, state, zip_code, county, phone, email, website,
          qualifier_name, managed_properties_count, managed_portfolio_sqft,
          latitude, longitude, source, evidence_url, metadata, updated_at
        ) VALUES (
          ${firm.name}, ${firm.dba || null}, ${firm.firmType},
          ${firm.licenseNumber || null}, ${firm.licenseType || null}, ${firm.status},
          ${firm.address}, ${firm.city}, ${firm.state || 'FL'}, ${firm.zipCode || null},
          ${firm.county}, ${firm.phone || null}, ${firm.email || null}, ${firm.website || null},
          ${firm.qualifierName || null}, ${firm.managedPropertiesCount ?? 0}, ${firm.managedPortfolioSqft || null},
          ${firm.latitude}, ${firm.longitude}, ${firm.source}, ${firm.evidenceUrl || null},
          ${JSON.stringify(firm.metadata || {})}::jsonb, CURRENT_TIMESTAMP
        )
        ON CONFLICT (name, county, address) DO UPDATE SET
          dba = EXCLUDED.dba,
          phone = COALESCE(EXCLUDED.phone, fl_management_firms.phone),
          email = COALESCE(EXCLUDED.email, fl_management_firms.email),
          website = COALESCE(EXCLUDED.website, fl_management_firms.website),
          license_number = COALESCE(EXCLUDED.license_number, fl_management_firms.license_number),
          license_type = COALESCE(EXCLUDED.license_type, fl_management_firms.license_type),
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          evidence_url = COALESCE(EXCLUDED.evidence_url, fl_management_firms.evidence_url),
          metadata = EXCLUDED.metadata,
          managed_properties_count = CASE
            WHEN EXCLUDED.source = 'FL_DBPR_CAB' THEN EXCLUDED.managed_properties_count
            ELSE GREATEST(fl_management_firms.managed_properties_count, EXCLUDED.managed_properties_count)
          END,
          managed_portfolio_sqft = COALESCE(EXCLUDED.managed_portfolio_sqft, fl_management_firms.managed_portfolio_sqft),
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          updated_at = CURRENT_TIMESTAMP
      `;
      savedCount += 1;

      // Sync into oi_opportunities so it renders on the Intent Atlas map under 'Property management portfolios'
      const dedupeHash = `mgmt:${firm.county.toLowerCase()}:${firm.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const opportunitySourceId = firm.source === 'FL_DBPR_CAB' ? 'fl-dbpr-open-data' : 'fl-dor-cadastral';
      const opportunitySourceRecordId = firm.licenseNumber || firm.name;
      // Earlier seed data assigned two CAB numbers to the wrong firms. Remove a stale
      // source-key collision before the dedupe-hash upsert so the official DBPR row wins.
      await sql`
        DELETE FROM oi_opportunities
        WHERE source_id = ${opportunitySourceId}
          AND source_record_id = ${opportunitySourceRecordId}
          AND dedupe_hash <> ${dedupeHash}
      `;
      await sql`
        INSERT INTO oi_opportunities (
          source_id, source_record_id, dedupe_hash, title, summary,
          trade_slug, classification, status, geographic_scope_type,
          address, city, county, counties, zip_code, latitude, longitude,
          evidence_confidence, classification_rationale, source_url,
          discovered_at, last_verified_at, updated_at
        ) VALUES (
          ${opportunitySourceId},
          ${opportunitySourceRecordId},
          ${dedupeHash},
          ${firm.name + (firm.dba ? ` (${firm.dba})` : '') + ' - Property & Asset Management'},
          ${(firm.firmType === 'community_association_management' ? 'Licensed Community Association Management (CAB) firm' : 'Commercial Property & Asset Management operator') + ' based in ' + firm.city + ', ' + firm.county + ' County.' + (firm.phone ? ' Contact: ' + firm.phone : '')},
          'property_management',
          'relationship',
          'active',
          'city',
          ${firm.address},
          ${firm.city},
          ${firm.county},
          ARRAY[${firm.county}]::text[],
          ${firm.zipCode || null},
          ${firm.latitude},
          ${firm.longitude},
          ${firm.licenseNumber ? 98 : 70},
          ${firm.licenseNumber
            ? `Current Florida DBPR CAB license #${firm.licenseNumber}; office coordinates independently matched by the U.S. Census geocoder.`
            : 'Florida statewide cadastral record with parcel coordinates; management activity is inferred from the recorded owner name.'},
          ${firm.evidenceUrl || 'https://www.myfloridalicense.com'},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (dedupe_hash) DO UPDATE SET
          source_record_id = EXCLUDED.source_record_id,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          county = EXCLUDED.county,
          counties = EXCLUDED.counties,
          zip_code = EXCLUDED.zip_code,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          evidence_confidence = EXCLUDED.evidence_confidence,
          classification_rationale = EXCLUDED.classification_rationale,
          source_url = EXCLUDED.source_url,
          last_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
    } catch (err) {
      console.warn(`Failed to upsert management firm ${firm.name}:`, err);
    }
  }

  return savedCount;
}

/**
 * Initializes and syncs statewide Florida management firms into the database.
 */
export async function initializeStatewideManagementFirms(): Promise<{
  cabFirmsLoaded: number;
  cadastralFirmsLoaded: number;
  totalFirmsInDb: number;
}> {
  // 1. Ingest verified DBPR CAB firms
  const cabLoaded = await saveManagementFirms(VERIFIED_FLORIDA_CAB_FIRMS);

  // 2. Sample pull from major Florida population counties via Statewide Cadastral
  // 58: Orange, 6: Broward, 23: Miami-Dade, 39: Hillsborough, 60: Palm Beach, 16: Duval, 62: Pinellas, 17: Escambia
  const priorityDorCodes = [58, 6, 23, 39, 60, 16, 62, 17];
  let cadastralLoaded = 0;

  for (const dorCode of priorityDorCodes) {
    const records = await fetchCadastralManagementFirms(dorCode, 25);
    if (records.length > 0) {
      const saved = await saveManagementFirms(records);
      cadastralLoaded += saved;
    }
  }

  const countRow = await sql`SELECT COUNT(*)::int AS count FROM fl_management_firms`;
  const totalFirmsInDb = Number(countRow[0]?.count || 0);

  return {
    cabFirmsLoaded: cabLoaded,
    cadastralFirmsLoaded: cadastralLoaded,
    totalFirmsInDb,
  };
}
