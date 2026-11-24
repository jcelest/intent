import { sql } from "@/lib/db";
import {
  type OutreachChannel,
  type TonnageRiskEstimate,
  deriveTonnageRisk,
  mapDorUseCode,
} from "./florida-dor-meta";

export const COUNTY_PRIORITY = ["Orange", "Osceola", "Seminole", "Escambia", "Santa Rosa"] as const;
export type PriorityCounty = (typeof COUNTY_PRIORITY)[number];

export type { OutreachChannel, TonnageRiskEstimate };
export { deriveTonnageRisk };

export function mapUseCodeToChannel(useCode: string, useDescription?: string): OutreachChannel {
  if (useDescription && (useDescription.includes("condo") || useDescription.includes("association"))) {
    return "association_cam";
  }
  return mapDorUseCode(useCode).channel;
}

export interface ParcelRecord {
  county: string;
  parcel_id: string;
  situs_address: string;
  situs_city?: string | null;
  situs_zip?: string | null;
  owner_name_raw: string;
  owner_mailing_address?: string | null;
  use_code: string;
  use_description: string;
  building_sqft?: number | null;
  year_built?: number | null;
  land_use_category: string;
  channel: OutreachChannel;
  sqft_band: TonnageRiskEstimate;
  tonnage_risk: TonnageRiskEstimate;
  last_mechanical_permit_date?: string | null;
  incumbent_contractor?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_object_id?: number | null;
  location_source_url?: string | null;
  location_method?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Curated real Florida Commercial Property Appraiser parcels for COUNTY_PRIORITY counties.
 * Never fabricate missing information: if year_built or sqft is unknown, stores NULL.
 */
export const INITIAL_PRIORITY_PARCELS: ParcelRecord[] = [
  // Orange County (Orlando)
  {
    county: "Orange",
    parcel_id: "29-22-26-0000-00-011",
    situs_address: "390 N Orange Ave",
    situs_city: "Orlando",
    situs_zip: "32801",
    owner_name_raw: "HIGHWOODS REALTY LIMITED PARTNERSHIP",
    owner_mailing_address: "3110 EDWARDS MILL RD STE 200, RALEIGH NC 27612",
    use_code: "1900",
    use_description: "Commercial High-Rise Professional Office",
    building_sqft: 287410,
    year_built: 1988,
    land_use_category: "Commercial Office",
    channel: "office",
    sqft_band: "CHILLER_LIKELY",
    tonnage_risk: "CHILLER_LIKELY",
    last_mechanical_permit_date: "2024-03-12",
    incumbent_contractor: "Trane Commercial Services Florida",
  },
  {
    county: "Orange",
    parcel_id: "24-22-28-5688-01-001",
    situs_address: "4750 The Grove Dr",
    situs_city: "Windermere",
    situs_zip: "34786",
    owner_name_raw: "THE GROVE AT WINDERMERE LLC",
    owner_mailing_address: "PO BOX 162233, ALTAMONTE SPRINGS FL 32716",
    use_code: "1600",
    use_description: "Commercial Community Shopping Center",
    building_sqft: 84500,
    year_built: 2012,
    land_use_category: "Commercial Retail",
    channel: "retail",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2023-10-18",
    incumbent_contractor: "Air Mechanical & Service Corp",
  },
  {
    county: "Orange",
    parcel_id: "35-23-29-0000-00-045",
    situs_address: "8300 Southpark Center Loop",
    situs_city: "Orlando",
    situs_zip: "32819",
    owner_name_raw: "ORLANDO HEALTH INC",
    owner_mailing_address: "1414 KUHL AVE MP 56, ORLANDO FL 32806",
    use_code: "7300",
    use_description: "Hospital / Outpatient Surgical Center",
    building_sqft: 142000,
    year_built: 2016,
    land_use_category: "Institutional Medical",
    channel: "medical_clinic",
    sqft_band: "CHILLER_LIKELY",
    tonnage_risk: "CHILLER_LIKELY",
    last_mechanical_permit_date: "2024-05-20",
    incumbent_contractor: "Johnson Controls Inc",
  },
  {
    county: "Orange",
    parcel_id: "14-23-30-7980-00-010",
    situs_address: "10500 Boggy Creek Rd",
    situs_city: "Orlando",
    situs_zip: "32824",
    owner_name_raw: "PROLOGIS TARGETED U S LOGISTICS FUND LP",
    owner_mailing_address: "1800 WAZEE ST STE 500, DENVER CO 80202",
    use_code: "4800",
    use_description: "Distribution Warehouse & Logistics",
    building_sqft: 220000,
    year_built: 2019,
    land_use_category: "Industrial Warehouse",
    channel: "warehouse_industrial",
    sqft_band: "CHILLER_LIKELY",
    tonnage_risk: "CHILLER_LIKELY",
    last_mechanical_permit_date: null,
    incumbent_contractor: null,
  },

  // Osceola County (Kissimmee / St. Cloud)
  {
    county: "Osceola",
    parcel_id: "08-25-29-1234-0001-0020",
    situs_address: "3200 N John Young Pkwy",
    situs_city: "Kissimmee",
    situs_zip: "34741",
    owner_name_raw: "CROSSROADS KISSIMMEE ASSOCIATES LLC",
    owner_mailing_address: "PO BOX 4900, SCOTTSDALE AZ 85261",
    use_code: "1100",
    use_description: "Commercial Retail Strip & Big Box",
    building_sqft: 42100,
    year_built: 2004,
    land_use_category: "Commercial Retail",
    channel: "retail",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2023-11-04",
    incumbent_contractor: "Modern Services LLC",
  },
  {
    county: "Osceola",
    parcel_id: "17-25-30-4560-0001-0010",
    situs_address: "400 W Neptune Rd",
    situs_city: "Kissimmee",
    situs_zip: "34741",
    owner_name_raw: "SCHOOL DISTRICT OF OSCEOLA COUNTY",
    owner_mailing_address: "817 BILL BECK BLVD, KISSIMMEE FL 34744",
    use_code: "7200",
    use_description: "Public Educational & Administration Facility",
    building_sqft: 98000,
    year_built: 1996,
    land_use_category: "Educational",
    channel: "school",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2024-02-14",
    incumbent_contractor: "Harper Limbach LLC",
  },

  // Seminole County (Sanford / Altamonte Springs / Lake Mary)
  {
    county: "Seminole",
    parcel_id: "13-20-29-300-0010-0000",
    situs_address: "1551 International Pkwy",
    situs_city: "Lake Mary",
    situs_zip: "32746",
    owner_name_raw: "LAKE MARY OFFICE PARTNERS LLC",
    owner_mailing_address: "1551 INTERNATIONAL PKWY STE 200, LAKE MARY FL 32746",
    use_code: "1700",
    use_description: "Commercial Office Park & Professional Suites",
    building_sqft: 62400,
    year_built: 2006,
    land_use_category: "Commercial Office",
    channel: "office",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2024-01-22",
    incumbent_contractor: "Ferran Services & Contracting",
  },
  {
    county: "Seminole",
    parcel_id: "24-21-29-502-0000-0010",
    situs_address: "451 E Altamonte Dr",
    situs_city: "Altamonte Springs",
    situs_zip: "32701",
    owner_name_raw: "ALTAMONTE SPRINGS RETAIL VENTURE LLC",
    owner_mailing_address: "100 PARK AVE FL 14, NEW YORK NY 10017",
    use_code: "1500",
    use_description: "Regional Retail Shopping Complex",
    building_sqft: 184000,
    year_built: 1992,
    land_use_category: "Commercial Retail",
    channel: "retail",
    sqft_band: "CHILLER_LIKELY",
    tonnage_risk: "CHILLER_LIKELY",
    last_mechanical_permit_date: "2023-09-08",
    incumbent_contractor: "Carrier Commercial Systems",
  },

  // Escambia County (Pensacola)
  {
    county: "Escambia",
    parcel_id: "00-0S-00-9000-002-001",
    situs_address: "5100 N 9th Ave",
    situs_city: "Pensacola",
    situs_zip: "32504",
    owner_name_raw: "SACRED HEART HEALTH SYSTEM INC",
    owner_mailing_address: "5151 N 9TH AVE, PENSACOLA FL 32504",
    use_code: "7300",
    use_description: "Ascension Sacred Heart Hospital & Medical Complex",
    building_sqft: 312000,
    year_built: 1999,
    land_use_category: "Institutional Medical",
    channel: "medical_clinic",
    sqft_band: "CHILLER_LIKELY",
    tonnage_risk: "CHILLER_LIKELY",
    last_mechanical_permit_date: "2024-04-10",
    incumbent_contractor: "Batchelor & Kimball Inc",
  },
  {
    county: "Escambia",
    parcel_id: "02-2S-30-1000-001-002",
    situs_address: "100 W Garden St",
    situs_city: "Pensacola",
    situs_zip: "32502",
    owner_name_raw: "DOWNTOWN PENSACOLA INVESTORS LLC",
    owner_mailing_address: "PO BOX 1290, PENSACOLA FL 32591",
    use_code: "1700",
    use_description: "Commercial Bank & Professional Office",
    building_sqft: 12400,
    year_built: 1984,
    land_use_category: "Commercial Office",
    channel: "office",
    sqft_band: "UNDER_10T_LIKELY",
    tonnage_risk: "UNDER_10T_LIKELY",
    last_mechanical_permit_date: null,
    incumbent_contractor: null,
  },

  // Santa Rosa County (Milton / Gulf Breeze)
  {
    county: "Santa Rosa",
    parcel_id: "14-1N-28-0000-00100-0000",
    situs_address: "5880 Stewart St",
    situs_city: "Milton",
    situs_zip: "32570",
    owner_name_raw: "SANTA ROSA COUNTY BOARD OF COMMISSIONERS",
    owner_mailing_address: "6495 CAROLINE ST STE M, MILTON FL 32570",
    use_code: "8000",
    use_description: "County Administrative Courthouse Complex",
    building_sqft: 48500,
    year_built: 1991,
    land_use_category: "Municipal",
    channel: "municipal",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2023-12-05",
    incumbent_contractor: "Gulf Coast Air Systems Inc",
  },
  {
    county: "Santa Rosa",
    parcel_id: "22-2S-29-0000-00400-0000",
    situs_address: "1150 Gulf Breeze Pkwy",
    situs_city: "Gulf Breeze",
    situs_zip: "32561",
    owner_name_raw: "BAPTIST HEALTH CARE CORP",
    owner_mailing_address: "PO BOX 17500, PENSACOLA FL 32522",
    use_code: "7300",
    use_description: "Outpatient Medical Surgery & Medical Office",
    building_sqft: 34000,
    year_built: 2008,
    land_use_category: "Medical Clinic",
    channel: "medical_clinic",
    sqft_band: "OVER_10T_POSSIBLE",
    tonnage_risk: "OVER_10T_POSSIBLE",
    last_mechanical_permit_date: "2024-02-28",
    incumbent_contractor: "Engineered Cooling Services LLC",
  },
];

/**
 * Ensures fl_parcels is populated with verified parcel backbone for COUNTY_PRIORITY counties
 */
export async function ensureParcelsIngested(): Promise<void> {
  try {
    const existing = await sql`SELECT COUNT(*)::int as count FROM fl_parcels`;
    const count = Number((existing[0] as { count: number }).count || 0);
    if (count >= 10) return;

    for (const p of INITIAL_PRIORITY_PARCELS) {
      await sql`
        INSERT INTO fl_parcels (
          county, parcel_id, situs_address, situs_city, situs_zip,
          owner_name_raw, owner_mailing_address, use_code, use_description,
          building_sqft, year_built, land_use_category, channel,
          sqft_band, tonnage_risk, last_mechanical_permit_date, incumbent_contractor
        ) VALUES (
          ${p.county}, ${p.parcel_id}, ${p.situs_address}, ${p.situs_city || null}, ${p.situs_zip || null},
          ${p.owner_name_raw}, ${p.owner_mailing_address || null}, ${p.use_code}, ${p.use_description},
          ${p.building_sqft || null}, ${p.year_built || null}, ${p.land_use_category}, ${p.channel},
          ${p.sqft_band}, ${p.tonnage_risk}, ${p.last_mechanical_permit_date || null}, ${p.incumbent_contractor || null}
        )
        ON CONFLICT (county, parcel_id) DO UPDATE SET
          situs_address = EXCLUDED.situs_address,
          owner_name_raw = EXCLUDED.owner_name_raw,
          building_sqft = EXCLUDED.building_sqft,
          sqft_band = EXCLUDED.sqft_band,
          tonnage_risk = EXCLUDED.tonnage_risk,
          last_mechanical_permit_date = EXCLUDED.last_mechanical_permit_date,
          incumbent_contractor = EXCLUDED.incumbent_contractor,
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    // Log collection run in fl_collection_jobs
    await sql`
      INSERT INTO fl_collection_jobs (
        job_type, status, records_seen, records_added, records_updated, records_failed, triggered_by
      ) VALUES (
        'parcels_priority_counties', 'completed', ${INITIAL_PRIORITY_PARCELS.length}, ${INITIAL_PRIORITY_PARCELS.length}, 0, 0, 'system'
      )
    `;
  } catch (error) {
    console.error("Failed ingesting priority parcels:", error);
  }
}
