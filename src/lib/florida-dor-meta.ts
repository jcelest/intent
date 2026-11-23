import { FLORIDA_COUNTIES } from "./florida-geo";

export type OutreachChannel =
  | "association_cam"
  | "rental_residential"
  | "church"
  | "school"
  | "medical_clinic"
  | "retail"
  | "office"
  | "warehouse_industrial"
  | "hospitality"
  | "municipal"
  | "other";

export type TonnageRiskEstimate = "UNDER_10T_LIKELY" | "OVER_10T_POSSIBLE" | "CHILLER_LIKELY";

/**
 * Derives screening sqft band and tonnage risk estimate:
 * - UNDER_10T_LIKELY: under ~15,000 sq ft
 * - OVER_10T_POSSIBLE: 15,000 to ~100,000 sq ft
 * - CHILLER_LIKELY: 100,000+ sq ft
 */
export function deriveTonnageRisk(buildingSqft: number | null | undefined): TonnageRiskEstimate {
  if (!buildingSqft || buildingSqft < 15000) {
    return "UNDER_10T_LIKELY";
  }
  if (buildingSqft >= 100000) {
    return "CHILLER_LIKELY";
  }
  return "OVER_10T_POSSIBLE";
}

export interface DORCountyMeta {
  dorCode: number;
  name: string;
  seat: string;
  region: string;
  startOid: number;
}

/**
 * Clustered index OBJECTID start coordinates across the 10.95M Florida statewide cadastral layer.
 * Using indexed OBJECTID slice bounds prevents full table scans on 10.8M rows.
 */
export const DOR_COUNTY_OID_START: Record<number, number> = {
  11: 1,         // Alachua
  12: 120001,    // Baker
  13: 200001,    // Bay
  14: 280001,    // Bradford
  15: 300001,    // Brevard
  16: 700001,    // Broward
  17: 1425001,   // Calhoun
  18: 1500001,   // Charlotte
  19: 1700001,   // Citrus
  20: 1900001,   // Clay
  21: 2000001,   // Collier
  22: 2300001,   // Columbia
  23: 5800001,   // Miami-Dade (Dade)
  24: 2340001,   // DeSoto
  25: 2360001,   // Dixie
  26: 2400001,   // Duval
  27: 2800001,   // Escambia
  28: 3000001,   // Flagler
  29: 3025001,   // Franklin
  30: 3045001,   // Gadsden
  31: 3080001,   // Gilchrist
  32: 3090001,   // Glades
  33: 3100001,   // Gulf
  34: 3125001,   // Hamilton
  35: 3140001,   // Hardee
  36: 3160001,   // Hendry
  37: 3200001,   // Hernando
  38: 3400001,   // Highlands
  39: 3500001,   // Hillsborough
  40: 3960001,   // Holmes
  41: 4000001,   // Indian River
  42: 4100001,   // Jackson
  43: 4120001,   // Jefferson
  44: 4124001,   // Lafayette
  45: 4200001,   // Lake
  46: 4400001,   // Lee
  47: 5000001,   // Leon
  48: 5040001,   // Levy
  49: 5074001,   // Liberty
  50: 5080001,   // Madison
  51: 5100001,   // Manatee
  52: 5400001,   // Marion
  53: 5700001,   // Martin
  54: 6400001,   // Monroe
  55: 6420001,   // Nassau
  56: 6500001,   // Okaloosa
  57: 6600001,   // Okeechobee
  58: 6700001,   // Orange
  59: 7200001,   // Osceola
  60: 7400001,   // Palm Beach
  61: 8100001,   // Pasco
  62: 8400001,   // Pinellas
  63: 8800001,   // Polk
  64: 9300001,   // Putnam
  65: 10000001,  // St. Johns
  66: 10200001,  // St. Lucie
  67: 9400001,   // Santa Rosa
  68: 9500001,   // Sarasota
  69: 9800001,   // Seminole
  70: 10400001,  // Sumter
  71: 10420001,  // Suwannee
  72: 10460001,  // Taylor
  73: 10466001,  // Union
  74: 10500001,  // Volusia
  75: 10790001,  // Wakulla
  76: 10820001,  // Walton
  77: 10900001,  // Washington
};

export const FLORIDA_DOR_COUNTIES: DORCountyMeta[] = FLORIDA_COUNTIES.map((c, idx) => {
  const dorCode = idx + 11;
  return {
    dorCode,
    name: c.name,
    seat: c.seat,
    region: c.region,
    startOid: DOR_COUNTY_OID_START[dorCode] || 1,
  };
});

export const DOR_CODE_TO_COUNTY = new Map<number, DORCountyMeta>(
  FLORIDA_DOR_COUNTIES.map((c) => [c.dorCode, c])
);

export const COUNTY_NAME_TO_DOR = new Map<string, DORCountyMeta>(
  FLORIDA_DOR_COUNTIES.map((c) => [c.name.toLowerCase(), c])
);

/**
 * Standard Florida DOR 3-digit land use codes mapped to channel, category, and description.
 */
export function mapDorUseCode(codeRaw: string): {
  channel: OutreachChannel;
  category: string;
  description: string;
} {
  const code = (codeRaw || "").trim().padStart(3, "0");

  // 010-019: Commercial Retail / Office
  if (code === "011") return { channel: "retail", category: "Commercial Retail", description: "Retail Stores & Commercial Outlets" };
  if (code === "012") return { channel: "retail", category: "Commercial Mixed Use", description: "Mixed Commercial & Retail / Residential" };
  if (code === "013") return { channel: "retail", category: "Commercial Retail", description: "Department Store" };
  if (code === "014") return { channel: "retail", category: "Commercial Retail", description: "Supermarket & Grocery Center" };
  if (code === "015") return { channel: "retail", category: "Commercial Retail", description: "Regional Shopping Center" };
  if (code === "016") return { channel: "retail", category: "Commercial Retail", description: "Community Shopping Center" };
  if (code === "017") return { channel: "office", category: "Commercial Office", description: "Commercial Office Building (Single Story)" };
  if (code === "018") return { channel: "office", category: "Commercial Office", description: "Commercial Multi-Story Office Building" };
  if (code === "019") return { channel: "office", category: "Commercial Office", description: "Professional Services & Medical Suites" };

  // 020-029: Commercial Dining / Services / Auto
  if (code === "021" || code === "022") return { channel: "retail", category: "Commercial Hospitality", description: "Commercial Restaurant & Food Service" };
  if (code === "023" || code === "024") return { channel: "office", category: "Commercial Financial", description: "Financial Institution & Bank Branch" };
  if (code === "025" || code === "026" || code === "027") return { channel: "retail", category: "Commercial Automotive", description: "Commercial Auto Sales & Service Facility" };

  // 030-039: Hospitality & Recreation
  if (code === "039") return { channel: "hospitality", category: "Commercial Hospitality", description: "Hotel / Motel Lodging Complex" };
  if (code.startsWith("03")) return { channel: "hospitality", category: "Commercial Recreation", description: "Commercial Entertainment & Hospitality" };

  // 040-049: Industrial & Warehousing
  if (code === "041") return { channel: "warehouse_industrial", category: "Industrial", description: "Light Industrial & Manufacturing Facility" };
  if (code === "042") return { channel: "warehouse_industrial", category: "Industrial", description: "Heavy Industrial Plant" };
  if (code === "043") return { channel: "warehouse_industrial", category: "Industrial", description: "Lumber & Building Materials Yard" };
  if (code === "048") return { channel: "warehouse_industrial", category: "Industrial Logistics", description: "Warehousing, Distribution & Logistics Terminal" };
  if (code.startsWith("04")) return { channel: "warehouse_industrial", category: "Industrial", description: "Industrial Facility & Operations" };

  // 070-079: Institutional
  if (code === "071") return { channel: "church", category: "Institutional", description: "House of Worship / Religious Facility" };
  if (code === "072") return { channel: "school", category: "Institutional", description: "Private School / Academy / Daycare Facility" };
  if (code === "073") return { channel: "medical_clinic", category: "Institutional Medical", description: "Private Hospital & Healthcare Center" };
  if (code === "074" || code === "078") return { channel: "medical_clinic", category: "Institutional Care", description: "Convalescent Care & Senior Living Facility" };

  // 080-089: Government / Municipal
  if (code === "083" || code === "084") return { channel: "school", category: "Public Educational", description: "Public School / College / University Campus" };
  if (code === "085") return { channel: "medical_clinic", category: "Public Healthcare", description: "County / Municipal Public Hospital" };
  if (code === "086" || code === "089") return { channel: "municipal", category: "Government Facilities", description: "County / Municipal Government Facilities" };
  if (code.startsWith("08")) return { channel: "municipal", category: "Government Facilities", description: "Public Civic & Government Infrastructure" };

  // 008 Condominium / Association
  if (code.startsWith("008") || code.startsWith("08")) return { channel: "association_cam", category: "Commercial Association", description: "Commercial Condominium / Association" };

  return { channel: "other", category: "Commercial Other", description: `Commercial Facility (DOR ${code})` };
}
