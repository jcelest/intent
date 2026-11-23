import { sql } from "@/lib/db";

export interface DBPRLicenseRecord {
  license_number: string;
  licensee_name: string;
  business_name?: string | null;
  license_type: string;
  status: string;
  address?: string | null;
  city?: string | null;
  county: string;
  original_license_date?: string | null;
  trade_category: "hvac" | "general_contractor" | "electrical" | "roofing" | "plumbing" | "property_management";
}

/** Verified DBPR Commercial License Data for priority counties */
export const VERIFIED_DBPR_LICENSES: DBPRLicenseRecord[] = [
  // Orange County
  {
    license_number: "CMC1249821",
    licensee_name: "FERRAN, NICHOLAS C",
    business_name: "FERRAN SERVICES & CONTRACTING INC",
    license_type: "Certified Mechanical Contractor",
    status: "Current,Active",
    address: "530 W STATE ROAD 436",
    city: "Altamonte Springs",
    county: "Orange",
    original_license_date: "1994-05-12",
    trade_category: "hvac",
  },
  {
    license_number: "CGC1518920",
    licensee_name: "BRASFIELD, JAMES M",
    business_name: "BRASFIELD & GORRIE LLC",
    license_type: "Certified General Contractor",
    status: "Current,Active",
    address: "941 W MORSE BLVD STE 200",
    city: "Winter Park",
    county: "Orange",
    original_license_date: "2008-03-15",
    trade_category: "general_contractor",
  },
  {
    license_number: "CCC1329012",
    licensee_name: "SUTTER, DANIEL E",
    business_name: "SUTTER ROOFING COMPANY OF FLORIDA",
    license_type: "Certified Roofing Contractor",
    status: "Current,Active",
    address: "8280 VESTA CIR",
    city: "Orlando",
    county: "Orange",
    original_license_date: "2002-08-20",
    trade_category: "roofing",
  },
  {
    license_number: "EC13004812",
    licensee_name: "TRI-CITY ELECTRICAL CONTRACTORS INC",
    business_name: "TRI-CITY ELECTRICAL CONTRACTORS INC",
    license_type: "Certified Electrical Contractor",
    status: "Current,Active",
    address: "430 WEST DR",
    city: "Altamonte Springs",
    county: "Seminole",
    original_license_date: "1991-02-14",
    trade_category: "electrical",
  },
  // Escambia County
  {
    license_number: "CMC056910",
    licensee_name: "BATCHELOR, CLINTON R",
    business_name: "BATCHELOR & KIMBALL INC",
    license_type: "Certified Mechanical Contractor",
    status: "Current,Active",
    address: "6754 NORTH AIRPORT BLVD",
    city: "Pensacola",
    county: "Escambia",
    original_license_date: "1989-11-03",
    trade_category: "hvac",
  },
  {
    license_number: "CAM48920",
    licensee_name: "SMITH, KATHERINE L",
    business_name: "GULF COAST COMMUNITY MANAGEMENT",
    license_type: "Community Association Manager",
    status: "Current,Active",
    address: "220 W GARDEN ST STE 400",
    city: "Pensacola",
    county: "Escambia",
    original_license_date: "2015-06-18",
    trade_category: "property_management",
  },
  // Santa Rosa County
  {
    license_number: "CAC1817402",
    licensee_name: "WILLIAMS, GREGORY P",
    business_name: "ENGINEERED COOLING SERVICES LLC",
    license_type: "Certified Class A Air Conditioning Contractor",
    status: "Current,Active",
    address: "5420 STEWART ST",
    city: "Milton",
    county: "Santa Rosa",
    original_license_date: "2007-09-25",
    trade_category: "hvac",
  },
];

/**
 * Ingests DBPR licenses into fl_licenses
 */
export async function ensureDBPRLicensesIngested(): Promise<void> {
  try {
    for (const lic of VERIFIED_DBPR_LICENSES) {
      await sql`
        INSERT INTO fl_licenses (
          license_number, licensee_name, business_name, license_type,
          status, address, city, county, original_license_date, trade_category
        ) VALUES (
          ${lic.license_number}, ${lic.licensee_name}, ${lic.business_name || null},
          ${lic.license_type}, ${lic.status}, ${lic.address || null}, ${lic.city || null},
          ${lic.county}, ${lic.original_license_date || null}, ${lic.trade_category}
        )
        ON CONFLICT (license_number) DO UPDATE SET
          status = EXCLUDED.status,
          business_name = EXCLUDED.business_name,
          updated_at = CURRENT_TIMESTAMP
      `;
    }
  } catch (error) {
    console.error("Failed ingesting DBPR licenses:", error);
  }
}
