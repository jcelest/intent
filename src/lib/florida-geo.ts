/**
 * Florida Geographic Intelligence Reference & Multi-Territory Search Engine
 * Covers all 67 Florida counties, major municipalities, ZCTA/ZIP mappings,
 * metropolitan regions, and coordinate centroids.
 */

export interface FloridaCounty {
  fips: string;
  name: string;
  seat: string;
  region: FloridaRegionId;
  lat: number;
  lng: number;
  sampleZips: string[];
}

export type FloridaRegionId =
  | "central_florida"
  | "tampa_bay"
  | "south_florida"
  | "first_coast"
  | "southwest_florida"
  | "panhandle"
  | "north_central"
  | "heartland_treasure_coast";

export interface FloridaRegion {
  id: FloridaRegionId;
  name: string;
  description: string;
  counties: string[];
}

export const FLORIDA_REGIONS: Record<FloridaRegionId, FloridaRegion> = {
  central_florida: {
    id: "central_florida",
    name: "Central Florida (Orlando Metro & Space Coast)",
    description: "Orange, Seminole, Osceola, Lake, Volusia, Brevard, Sumter",
    counties: ["Orange", "Seminole", "Osceola", "Lake", "Volusia", "Brevard", "Sumter"],
  },
  tampa_bay: {
    id: "tampa_bay",
    name: "Tampa Bay & Suncoast",
    description: "Hillsborough, Pinellas, Pasco, Hernando, Manatee, Sarasota",
    counties: ["Hillsborough", "Pinellas", "Pasco", "Hernando", "Manatee", "Sarasota"],
  },
  south_florida: {
    id: "south_florida",
    name: "South Florida (Tri-County & Keys)",
    description: "Miami-Dade, Broward, Palm Beach, Monroe",
    counties: ["Miami-Dade", "Broward", "Palm Beach", "Monroe"],
  },
  first_coast: {
    id: "first_coast",
    name: "First Coast & Northeast Florida",
    description: "Duval, St. Johns, Clay, Nassau, Baker, Flagler, Putnam",
    counties: ["Duval", "St. Johns", "Clay", "Nassau", "Baker", "Flagler", "Putnam"],
  },
  southwest_florida: {
    id: "southwest_florida",
    name: "Southwest Florida",
    description: "Lee, Collier, Charlotte, Hendry, Glades",
    counties: ["Lee", "Collier", "Charlotte", "Hendry", "Glades"],
  },
  panhandle: {
    id: "panhandle",
    name: "Panhandle & Emerald Coast",
    description: "Escambia, Santa Rosa, Okaloosa, Walton, Bay, Washington, Holmes, Jackson, Calhoun, Gulf, Franklin, Liberty, Gadsden, Leon, Wakulla",
    counties: [
      "Escambia", "Santa Rosa", "Okaloosa", "Walton", "Bay", "Washington", "Holmes",
      "Jackson", "Calhoun", "Gulf", "Franklin", "Liberty", "Gadsden", "Leon", "Wakulla",
    ],
  },
  north_central: {
    id: "north_central",
    name: "North Central Florida",
    description: "Alachua, Marion, Columbia, Bradford, Union, Gilchrist, Levy, Dixie, Suwannee, Hamilton, Lafayette, Madison, Taylor, Jefferson",
    counties: [
      "Alachua", "Marion", "Columbia", "Bradford", "Union", "Gilchrist", "Levy",
      "Dixie", "Suwannee", "Hamilton", "Lafayette", "Madison", "Taylor", "Jefferson",
    ],
  },
  heartland_treasure_coast: {
    id: "heartland_treasure_coast",
    name: "Heartland & Treasure Coast",
    description: "Polk, Highlands, Hardee, DeSoto, Okeechobee, St. Lucie, Martin, Indian River",
    counties: ["Polk", "Highlands", "Hardee", "DeSoto", "Okeechobee", "St. Lucie", "Martin", "Indian River"],
  },
};

/** All 67 Florida Counties */
export const FLORIDA_COUNTIES: FloridaCounty[] = [
  { fips: "12001", name: "Alachua", seat: "Gainesville", region: "north_central", lat: 29.6747, lng: -82.3577, sampleZips: ["32601", "32605", "32607", "32608", "32615", "32653"] },
  { fips: "12003", name: "Baker", seat: "Macclenny", region: "first_coast", lat: 30.3312, lng: -82.2847, sampleZips: ["32063", "32072", "32087"] },
  { fips: "12005", name: "Bay", seat: "Panama City", region: "panhandle", lat: 30.2649, lng: -85.6321, sampleZips: ["32401", "32404", "32405", "32407", "32408", "32413"] },
  { fips: "12007", name: "Bradford", seat: "Starke", region: "north_central", lat: 29.9515, lng: -82.1691, sampleZips: ["32042", "32058", "32091"] },
  { fips: "12009", name: "Brevard", seat: "Titusville", region: "central_florida", lat: 28.2939, lng: -80.7047, sampleZips: ["32780", "32901", "32904", "32922", "32935", "32953"] },
  { fips: "12011", name: "Broward", seat: "Fort Lauderdale", region: "south_florida", lat: 26.1244, lng: -80.2495, sampleZips: ["33301", "33020", "33024", "33064", "33311", "33324"] },
  { fips: "12013", name: "Calhoun", seat: "Blountstown", region: "panhandle", lat: 30.4358, lng: -85.2014, sampleZips: ["32421", "32424", "32430"] },
  { fips: "12015", name: "Charlotte", seat: "Punta Gorda", region: "southwest_florida", lat: 26.9011, lng: -81.9328, sampleZips: ["33950", "33952", "33980", "33981"] },
  { fips: "12017", name: "Citrus", seat: "Inverness", region: "tampa_bay", lat: 28.8471, lng: -82.4777, sampleZips: ["34442", "34450", "34452", "34465"] },
  { fips: "12019", name: "Clay", seat: "Green Cove Springs", region: "first_coast", lat: 29.9859, lng: -81.8596, sampleZips: ["32003", "32043", "32065", "32073"] },
  { fips: "12021", name: "Collier", seat: "East Naples", region: "southwest_florida", lat: 26.1319, lng: -81.5644, sampleZips: ["34102", "34108", "34112", "34119", "34142"] },
  { fips: "12023", name: "Columbia", seat: "Lake City", region: "north_central", lat: 30.2227, lng: -82.6284, sampleZips: ["32024", "32025", "32038", "32055"] },
  { fips: "12025", name: "Miami-Dade", seat: "Miami", region: "south_florida", lat: 25.7617, lng: -80.1918, sampleZips: ["33101", "33125", "33130", "33139", "33166", "33178"] },
  { fips: "12027", name: "DeSoto", seat: "Arcadia", region: "heartland_treasure_coast", lat: 27.1895, lng: -81.8044, sampleZips: ["34266", "34269"] },
  { fips: "12029", name: "Dixie", seat: "Cross City", region: "north_central", lat: 29.6053, lng: -83.1611, sampleZips: ["32628", "32648", "32680"] },
  { fips: "12031", name: "Duval", seat: "Jacksonville", region: "first_coast", lat: 30.3322, lng: -81.6557, sampleZips: ["32202", "32207", "32216", "32224", "32244", "32256"] },
  { fips: "12033", name: "Escambia", seat: "Pensacola", region: "panhandle", lat: 30.6384, lng: -87.3414, sampleZips: ["32501", "32503", "32505", "32514", "32526"] },
  { fips: "12035", name: "Flagler", seat: "Bunnell", region: "first_coast", lat: 29.4754, lng: -81.3093, sampleZips: ["32110", "32136", "32137", "32164"] },
  { fips: "12037", name: "Franklin", seat: "Apalachicola", region: "panhandle", lat: 29.8058, lng: -84.8877, sampleZips: ["32320", "32322", "32328"] },
  { fips: "12039", name: "Gadsden", seat: "Quincy", region: "panhandle", lat: 30.5794, lng: -84.6158, sampleZips: ["32324", "32333", "32343", "32351"] },
  { fips: "12041", name: "Gilchrist", seat: "Trenton", region: "north_central", lat: 29.7289, lng: -82.8028, sampleZips: ["32621", "32643", "32693"] },
  { fips: "12043", name: "Glades", seat: "Moore Haven", region: "southwest_florida", lat: 26.9698, lng: -81.1895, sampleZips: ["33471", "33930", "33935"] },
  { fips: "12045", name: "Gulf", seat: "Port St. Joe", region: "panhandle", lat: 29.9328, lng: -85.2536, sampleZips: ["32456", "32465"] },
  { fips: "12047", name: "Hamilton", seat: "Jasper", region: "north_central", lat: 30.5089, lng: -82.9554, sampleZips: ["32052", "32053", "32096"] },
  { fips: "12049", name: "Hardee", seat: "Wauchula", region: "heartland_treasure_coast", lat: 27.4873, lng: -81.8087, sampleZips: ["33834", "33865", "33873"] },
  { fips: "12051", name: "Hendry", seat: "LaBelle", region: "southwest_florida", lat: 26.5518, lng: -81.1648, sampleZips: ["33440", "33935", "33975"] },
  { fips: "12053", name: "Hernando", seat: "Brooksville", region: "tampa_bay", lat: 28.5553, lng: -82.4644, sampleZips: ["34601", "34604", "34606", "34613"] },
  { fips: "12055", name: "Highlands", seat: "Sebring", region: "heartland_treasure_coast", lat: 27.3486, lng: -81.3537, sampleZips: ["33825", "33852", "33870", "33872"] },
  { fips: "12057", name: "Hillsborough", seat: "Tampa", region: "tampa_bay", lat: 27.9904, lng: -82.3018, sampleZips: ["33602", "33607", "33610", "33619", "33511", "33578"] },
  { fips: "12059", name: "Holmes", seat: "Bonifay", region: "panhandle", lat: 30.8687, lng: -85.8142, sampleZips: ["32425", "32448", "32455", "32464"] },
  { fips: "12061", name: "Indian River", seat: "Vero Beach", region: "heartland_treasure_coast", lat: 27.7011, lng: -80.5739, sampleZips: ["32960", "32962", "32966", "32967"] },
  { fips: "12063", name: "Jackson", seat: "Marianna", region: "panhandle", lat: 30.7964, lng: -85.2289, sampleZips: ["32442", "32446", "32447", "32448"] },
  { fips: "12065", name: "Jefferson", seat: "Monticello", region: "north_central", lat: 30.4206, lng: -83.9008, sampleZips: ["32344", "32345"] },
  { fips: "12067", name: "Lafayette", seat: "Mayo", region: "north_central", lat: 30.0573, lng: -83.1793, sampleZips: ["32066"] },
  { fips: "12069", name: "Lake", seat: "Tavares", region: "central_florida", lat: 28.7719, lng: -81.7142, sampleZips: ["32778", "34711", "34731", "34748", "34788"] },
  { fips: "12071", name: "Lee", seat: "Fort Myers", region: "southwest_florida", lat: 26.6638, lng: -81.8081, sampleZips: ["33901", "33907", "33912", "33914", "33990"] },
  { fips: "12073", name: "Leon", seat: "Tallahassee", region: "panhandle", lat: 30.4383, lng: -84.2807, sampleZips: ["32301", "32303", "32304", "32308", "32312"] },
  { fips: "12075", name: "Levy", seat: "Bronson", region: "north_central", lat: 29.2974, lng: -82.6167, sampleZips: ["32621", "32625", "32626", "32696"] },
  { fips: "12077", name: "Liberty", seat: "Bristol", region: "panhandle", lat: 30.2443, lng: -84.9774, sampleZips: ["32321", "32334"] },
  { fips: "12079", name: "Madison", seat: "Madison", region: "north_central", lat: 30.4503, lng: -83.4862, sampleZips: ["32340", "32331"] },
  { fips: "12081", name: "Manatee", seat: "Bradenton", region: "tampa_bay", lat: 27.4799, lng: -82.3452, sampleZips: ["34201", "34203", "34205", "34208", "34211"] },
  { fips: "12083", name: "Marion", seat: "Ocala", region: "north_central", lat: 29.2091, lng: -82.0734, sampleZips: ["34470", "34471", "34474", "34476", "34480"] },
  { fips: "12085", name: "Martin", seat: "Stuart", region: "heartland_treasure_coast", lat: 27.0805, lng: -80.4042, sampleZips: ["34990", "34994", "34996", "34997"] },
  { fips: "12086", name: "Monroe", seat: "Key West", region: "south_florida", lat: 24.5551, lng: -81.7800, sampleZips: ["33040", "33050", "33070"] },
  { fips: "12087", name: "Nassau", seat: "Fernandina Beach", region: "first_coast", lat: 30.6128, lng: -81.6703, sampleZips: ["32034", "32097", "32009", "32011"] },
  { fips: "12089", name: "Okaloosa", seat: "Crestview", region: "panhandle", lat: 30.6865, lng: -86.5824, sampleZips: ["32536", "32541", "32547", "32578"] },
  { fips: "12091", name: "Okeechobee", seat: "Okeechobee", region: "heartland_treasure_coast", lat: 27.3828, lng: -80.8931, sampleZips: ["34972", "34974"] },
  { fips: "12093", name: "Orange", seat: "Orlando", region: "central_florida", lat: 28.5143, lng: -81.3653, sampleZips: ["32801", "32803", "32809", "32819", "32822", "32828", "32839"] },
  { fips: "12095", name: "Osceola", seat: "Kissimmee", region: "central_florida", lat: 28.1884, lng: -81.1448, sampleZips: ["34741", "34743", "34744", "34746", "34771", "34772"] },
  { fips: "12097", name: "Palm Beach", seat: "West Palm Beach", region: "south_florida", lat: 26.6465, lng: -80.4578, sampleZips: ["33401", "33407", "33411", "33431", "33445", "33480"] },
  { fips: "12099", name: "Pasco", seat: "Dade City", region: "tampa_bay", lat: 28.3232, lng: -82.4314, sampleZips: ["33523", "33543", "34652", "34655", "34668"] },
  { fips: "12101", name: "Pinellas", seat: "Clearwater", region: "tampa_bay", lat: 27.9048, lng: -82.7396, sampleZips: ["33701", "33705", "33755", "33760", "33770", "33781"] },
  { fips: "12103", name: "Polk", seat: "Bartow", region: "heartland_treasure_coast", lat: 27.9613, lng: -81.7997, sampleZips: ["33801", "33805", "33810", "33813", "33830", "33880"] },
  { fips: "12105", name: "Putnam", seat: "Palatka", region: "first_coast", lat: 29.6305, lng: -81.7456, sampleZips: ["32177", "32131", "32112"] },
  { fips: "12107", name: "St. Johns", seat: "St. Augustine", region: "first_coast", lat: 29.9142, lng: -81.4144, sampleZips: ["32080", "32084", "32086", "32092", "32095"] },
  { fips: "12109", name: "St. Lucie", seat: "Fort Pierce", region: "heartland_treasure_coast", lat: 27.3813, lng: -80.4436, sampleZips: ["34950", "34952", "34953", "34983", "34986"] },
  { fips: "12111", name: "Santa Rosa", seat: "Milton", region: "panhandle", lat: 30.6997, lng: -87.0195, sampleZips: ["32561", "32566", "32570", "32583"] },
  { fips: "12113", name: "Sarasota", seat: "Sarasota", region: "tampa_bay", lat: 27.2415, lng: -82.3789, sampleZips: ["34231", "34232", "34236", "34238", "34285"] },
  { fips: "12115", name: "Seminole", seat: "Sanford", region: "central_florida", lat: 28.7208, lng: -81.2361, sampleZips: ["32701", "32707", "32714", "32746", "32771", "32773"] },
  { fips: "12117", name: "Sumter", seat: "Bushnell", region: "central_florida", lat: 28.7061, lng: -82.0809, sampleZips: ["32162", "33513", "33538", "33585"] },
  { fips: "12119", name: "Suwannee", seat: "Live Oak", region: "north_central", lat: 30.2974, lng: -82.9904, sampleZips: ["32060", "32064"] },
  { fips: "12121", name: "Taylor", seat: "Perry", region: "north_central", lat: 30.0381, lng: -83.6192, sampleZips: ["32347", "32348"] },
  { fips: "12123", name: "Union", seat: "Lake Butler", region: "north_central", lat: 30.0619, lng: -82.3551, sampleZips: ["32054", "32083"] },
  { fips: "12125", name: "Volusia", seat: "DeLand", region: "central_florida", lat: 29.0658, lng: -81.1558, sampleZips: ["32114", "32117", "32127", "32174", "32720", "32725"] },
  { fips: "12127", name: "Wakulla", seat: "Crawfordville", region: "panhandle", lat: 30.1601, lng: -84.3828, sampleZips: ["32327", "32355"] },
  { fips: "12129", name: "Walton", seat: "DeFuniak Springs", region: "panhandle", lat: 30.6121, lng: -86.1718, sampleZips: ["32433", "32435", "32459"] },
  { fips: "12131", name: "Washington", seat: "Chipley", region: "panhandle", lat: 30.6094, lng: -85.6669, sampleZips: ["32427", "32428", "32462"] },
];

/** 120+ Key Florida Municipalities mapped to county and coordinates */
export interface FloridaCity {
  name: string;
  county: string;
  lat: number;
  lng: number;
  primaryZip: string;
}

export const FLORIDA_CITIES: FloridaCity[] = [
  { name: "Orlando", county: "Orange", lat: 28.5383, lng: -81.3792, primaryZip: "32801" },
  { name: "Tampa", county: "Hillsborough", lat: 27.9506, lng: -82.4572, primaryZip: "33602" },
  { name: "Miami", county: "Miami-Dade", lat: 25.7617, lng: -80.1918, primaryZip: "33130" },
  { name: "Jacksonville", county: "Duval", lat: 30.3322, lng: -81.6557, primaryZip: "32202" },
  { name: "St. Petersburg", county: "Pinellas", lat: 27.7676, lng: -82.6403, primaryZip: "33701" },
  { name: "Fort Lauderdale", county: "Broward", lat: 26.1224, lng: -80.1373, primaryZip: "33301" },
  { name: "Hialeah", county: "Miami-Dade", lat: 25.8576, lng: -80.2781, primaryZip: "33012" },
  { name: "Tallahassee", county: "Leon", lat: 30.4383, lng: -84.2807, primaryZip: "32301" },
  { name: "Cape Coral", county: "Lee", lat: 26.5629, lng: -81.9495, primaryZip: "33904" },
  { name: "Pembroke Pines", county: "Broward", lat: 26.0078, lng: -80.2259, primaryZip: "33028" },
  { name: "Hollywood", county: "Broward", lat: 26.0112, lng: -80.1495, primaryZip: "33020" },
  { name: "Gainesville", county: "Alachua", lat: 29.6516, lng: -82.3248, primaryZip: "32601" },
  { name: "Miramar", county: "Broward", lat: 25.9860, lng: -80.3036, primaryZip: "33025" },
  { name: "Coral Springs", county: "Broward", lat: 26.2712, lng: -80.2706, primaryZip: "33065" },
  { name: "Clearwater", county: "Pinellas", lat: 27.9659, lng: -82.8001, primaryZip: "33755" },
  { name: "Palm Bay", county: "Brevard", lat: 28.0345, lng: -80.5887, primaryZip: "32907" },
  { name: "Pompano Beach", county: "Broward", lat: 26.2379, lng: -80.1248, primaryZip: "33060" },
  { name: "West Palm Beach", county: "Palm Beach", lat: 26.7153, lng: -80.0534, primaryZip: "33401" },
  { name: "Lakeland", county: "Polk", lat: 28.0395, lng: -81.9498, primaryZip: "33801" },
  { name: "Port St. Lucie", county: "St. Lucie", lat: 27.2730, lng: -80.3582, primaryZip: "34952" },
  { name: "Miami Gardens", county: "Miami-Dade", lat: 25.9420, lng: -80.2456, primaryZip: "33056" },
  { name: "Davie", county: "Broward", lat: 26.0629, lng: -80.2331, primaryZip: "33314" },
  { name: "Boca Raton", county: "Palm Beach", lat: 26.3683, lng: -80.1289, primaryZip: "33431" },
  { name: "Sunrise", county: "Broward", lat: 26.1554, lng: -80.2644, primaryZip: "33322" },
  { name: "Plantation", county: "Broward", lat: 26.1276, lng: -80.2331, primaryZip: "33324" },
  { name: "Deltona", county: "Volusia", lat: 28.9005, lng: -81.2637, primaryZip: "32725" },
  { name: "Fort Myers", county: "Lee", lat: 26.6406, lng: -81.8723, primaryZip: "33901" },
  { name: "Kissimmee", county: "Osceola", lat: 28.2920, lng: -81.4076, primaryZip: "34741" },
  { name: "Sanford", county: "Seminole", lat: 28.8029, lng: -81.2695, primaryZip: "32771" },
  { name: "Palm Coast", county: "Flagler", lat: 29.5844, lng: -81.2079, primaryZip: "32137" },
  { name: "Sarasota", county: "Sarasota", lat: 27.3364, lng: -82.5307, primaryZip: "34236" },
  { name: "Pensacola", county: "Escambia", lat: 30.4213, lng: -87.2169, primaryZip: "32501" },
  { name: "Daytona Beach", county: "Volusia", lat: 29.2108, lng: -81.0228, primaryZip: "32114" },
  { name: "Bradenton", county: "Manatee", lat: 27.4989, lng: -82.5748, primaryZip: "34205" },
  { name: "Ocala", county: "Marion", lat: 29.1872, lng: -82.1401, primaryZip: "34471" },
  { name: "Boynton Beach", county: "Palm Beach", lat: 26.5253, lng: -80.0664, primaryZip: "33435" },
  { name: "Melbourne", county: "Brevard", lat: 28.0836, lng: -80.6081, primaryZip: "32901" },
  { name: "Deerfield Beach", county: "Broward", lat: 26.3184, lng: -80.0998, primaryZip: "33441" },
  { name: "Largo", county: "Pinellas", lat: 27.9095, lng: -82.7873, primaryZip: "33770" },
  { name: "Homestead", county: "Miami-Dade", lat: 25.4687, lng: -80.4776, primaryZip: "33030" },
  { name: "Apopka", county: "Orange", lat: 28.6779, lng: -81.5115, primaryZip: "32703" },
  { name: "Altamonte Springs", county: "Seminole", lat: 28.6611, lng: -81.3656, primaryZip: "32701" },
  { name: "Winter Park", county: "Orange", lat: 28.5997, lng: -81.3392, primaryZip: "32789" },
  { name: "Winter Garden", county: "Orange", lat: 28.5653, lng: -81.5862, primaryZip: "34787" },
  { name: "Oviedo", county: "Seminole", lat: 28.6700, lng: -81.2081, primaryZip: "32765" },
  { name: "Lake Mary", county: "Seminole", lat: 28.7589, lng: -81.3178, primaryZip: "32746" },
  { name: "Clermont", county: "Lake", lat: 28.5494, lng: -81.7729, primaryZip: "34711" },
  { name: "St. Cloud", county: "Osceola", lat: 28.2489, lng: -81.2812, primaryZip: "34769" },
  { name: "Titusville", county: "Brevard", lat: 28.6122, lng: -80.8076, primaryZip: "32780" },
  { name: "Naples", county: "Collier", lat: 26.1420, lng: -81.7948, primaryZip: "34102" },
  { name: "Panama City", county: "Bay", lat: 30.1588, lng: -85.6602, primaryZip: "32401" },
  { name: "Fort Pierce", county: "St. Lucie", lat: 27.4467, lng: -80.3256, primaryZip: "34950" },
  { name: "Vero Beach", county: "Indian River", lat: 27.6386, lng: -80.3973, primaryZip: "32960" },
  { name: "Stuart", county: "Martin", lat: 27.1975, lng: -80.2528, primaryZip: "34994" },
  { name: "Winter Haven", county: "Polk", lat: 28.0222, lng: -81.7329, primaryZip: "33880" },
  { name: "Brandon", county: "Hillsborough", lat: 27.9378, lng: -82.2859, primaryZip: "33511" },
  { name: "Riverview", county: "Hillsborough", lat: 27.8661, lng: -82.3265, primaryZip: "33578" },
  { name: "Spring Hill", county: "Hernando", lat: 28.4764, lng: -82.5254, primaryZip: "34606" },
  { name: "Wesley Chapel", county: "Pasco", lat: 28.2414, lng: -82.3262, primaryZip: "33543" },
  { name: "Doral", county: "Miami-Dade", lat: 25.8195, lng: -80.3553, primaryZip: "33178" },
  { name: "Coral Gables", county: "Miami-Dade", lat: 25.7215, lng: -80.2684, primaryZip: "33134" },
  { name: "North Miami", county: "Miami-Dade", lat: 25.8901, lng: -80.1867, primaryZip: "33161" },
  { name: "Jupiter", county: "Palm Beach", lat: 26.9342, lng: -80.0942, primaryZip: "33458" },
  { name: "Delray Beach", county: "Palm Beach", lat: 26.4615, lng: -80.0728, primaryZip: "33444" },
  { name: "Wellington", county: "Palm Beach", lat: 26.6587, lng: -80.2414, primaryZip: "33414" },
  { name: "St. Augustine", county: "St. Johns", lat: 29.8947, lng: -81.3145, primaryZip: "32084" },
  { name: "Orange Park", county: "Clay", lat: 30.1666, lng: -81.7065, primaryZip: "32073" },
  { name: "Key West", county: "Monroe", lat: 24.5551, lng: -81.7800, primaryZip: "33040" },
];

/** Quick County Map */
export const COUNTY_BY_NAME: Map<string, FloridaCounty> = new Map(
  FLORIDA_COUNTIES.map((c) => [c.name.toLowerCase(), c])
);

/** Quick City Map */
export const CITY_BY_NAME: Map<string, FloridaCity> = new Map(
  FLORIDA_CITIES.map((c) => [c.name.toLowerCase(), c])
);

/**
 * Validates whether a 5-digit string is in Florida's ZIP code range:
 * 32000 - 34999 (Florida Postal Prefix)
 */
export function isFloridaZip(zip: string): boolean {
  const num = parseInt(zip.trim(), 10);
  return !isNaN(num) && num >= 32000 && num <= 34999;
}

/**
 * Infer county from Florida ZIP code heuristic prefix
 */
export function inferCountyFromZip(zip: string): string | null {
  const clean = zip.trim().slice(0, 5);
  if (!isFloridaZip(clean)) return null;

  // Direct check against sampleZips
  for (const c of FLORIDA_COUNTIES) {
    if (c.sampleZips.includes(clean)) return c.name;
  }

  const prefix3 = parseInt(clean.slice(0, 3), 10);
  if (prefix3 >= 328 && prefix3 <= 328) return "Orange";
  if (prefix3 === 327) {
    const p5 = parseInt(clean, 10);
    if (p5 >= 32701 && p5 <= 32719) return "Seminole";
    if (p5 >= 32720 && p5 <= 32739) return "Volusia";
    if (p5 >= 32746 && p5 <= 32779) return "Seminole";
    return "Orange";
  }
  if (prefix3 === 336) return "Hillsborough";
  if (prefix3 === 337) return "Pinellas";
  if (prefix3 === 331) return "Miami-Dade";
  if (prefix3 === 330) {
    const p5 = parseInt(clean, 10);
    if (p5 >= 33040 && p5 <= 33052) return "Monroe";
    return "Broward";
  }
  if (prefix3 === 333) return "Broward";
  if (prefix3 === 334) return "Palm Beach";
  if (prefix3 === 322) return "Duval";
  if (prefix3 === 320) return "St. Johns";
  if (prefix3 === 321) return "Volusia";
  if (prefix3 === 323) return "Leon";
  if (prefix3 === 324) return "Bay";
  if (prefix3 === 325) return "Escambia";
  if (prefix3 === 326) return "Alachua";
  if (prefix3 === 335) return "Hillsborough";
  if (prefix3 === 338) return "Polk";
  if (prefix3 === 339) return "Lee";
  if (prefix3 === 341) return "Collier";
  if (prefix3 === 342) return "Sarasota";
  if (prefix3 === 344) return "Marion";
  if (prefix3 === 346) return "Pasco";
  if (prefix3 === 347) return "Osceola";
  if (prefix3 === 349) return "St. Lucie";

  return null;
}

/**
 * Great-circle distance between two coordinates in miles (Haversine Formula)
 */
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface ParsedGeoScope {
  rawInputs: string[];
  resolvedCounties: string[];
  resolvedCities: string[];
  resolvedZips: string[];
  resolvedRegions: string[];
  isStatewide: boolean;
  warnings: string[];
}

/**
 * Multi-territory parser that automatically recognizes, normalizes, and resolves
 * any combination of Florida ZIP codes, counties, cities, regions, ranges, or bulk pasting.
 */
export function parseFloridaGeoSearch(input: string): ParsedGeoScope {
  const warnings: string[] = [];
  const resolvedCounties = new Set<string>();
  const resolvedCities = new Set<string>();
  const resolvedZips = new Set<string>();
  const resolvedRegions = new Set<string>();
  let isStatewide = false;

  if (!input || !input.trim()) {
    return {
      rawInputs: [],
      resolvedCounties: [],
      resolvedCities: [],
      resolvedZips: [],
      resolvedRegions: [],
      isStatewide: false,
      warnings: ["No search criteria specified."],
    };
  }

  // Split on commas, newlines, semicolons, tabs, or pipes
  const rawTokens = input
    .split(/[\r\n,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of rawTokens) {
    const lower = token.toLowerCase();

    // Check for Florida statewide indicators
    if (
      lower === "florida" ||
      lower === "fl" ||
      lower === "statewide" ||
      lower === "all florida" ||
      lower === "all 67 counties" ||
      lower === "florida statewide" ||
      lower === "statewide florida" ||
      lower.includes("statewide")
    ) {
      isStatewide = true;
      FLORIDA_COUNTIES.forEach((c) => resolvedCounties.add(c.name));
      continue;
    }

    // Check for ZIP ranges (e.g. 32801-32810 or 32801 to 32810)
    const rangeMatch = token.match(/^(\d{5})\s*(?:-|to)\s*(\d{5})$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start <= end && end - start <= 100) {
        for (let z = start; z <= end; z++) {
          const zipStr = String(z);
          if (isFloridaZip(zipStr)) {
            resolvedZips.add(zipStr);
            const c = inferCountyFromZip(zipStr);
            if (c) resolvedCounties.add(c);
          } else {
            warnings.push(`ZIP ${zipStr} in range is outside Florida.`);
          }
        }
        continue;
      }
    }

    // Check for standalone 5-digit ZIP code
    if (/^\d{5}$/.test(token)) {
      if (isFloridaZip(token)) {
        resolvedZips.add(token);
        const c = inferCountyFromZip(token);
        if (c) resolvedCounties.add(c);
      } else {
        warnings.push(`ZIP ${token} is not a Florida postal code (32000-34999).`);
      }
      continue;
    }

    // Check for Region names
    let matchedRegion = false;
    for (const [regId, reg] of Object.entries(FLORIDA_REGIONS)) {
      if (
        lower === reg.name.toLowerCase() ||
        lower === regId.replace(/_/g, " ") ||
        lower.includes(regId.replace(/_/g, " "))
      ) {
        resolvedRegions.add(reg.name);
        reg.counties.forEach((c) => resolvedCounties.add(c));
        matchedRegion = true;
        break;
      }
    }
    if (matchedRegion) continue;

    // Check for County names (with or without 'County')
    const cleanCountyName = lower
      .replace(/\s+county$/i, "")
      .replace(/^co\.\s*/i, "")
      .trim();

    const countyObj = COUNTY_BY_NAME.get(cleanCountyName);
    if (countyObj) {
      resolvedCounties.add(countyObj.name);
      countyObj.sampleZips.forEach((z) => resolvedZips.add(z));
      continue;
    }

    // Check for City names
    const cityObj = CITY_BY_NAME.get(lower);
    if (cityObj) {
      resolvedCities.add(cityObj.name);
      resolvedCounties.add(cityObj.county);
      resolvedZips.add(cityObj.primaryZip);
      continue;
    }

    // Fuzzy check for cities containing token
    const fuzzyCity = FLORIDA_CITIES.find(
      (c) => c.name.toLowerCase() === lower || lower.includes(c.name.toLowerCase())
    );
    if (fuzzyCity && fuzzyCity.name.length > 3) {
      resolvedCities.add(fuzzyCity.name);
      resolvedCounties.add(fuzzyCity.county);
      resolvedZips.add(fuzzyCity.primaryZip);
      continue;
    }

    warnings.push(`Unrecognized location: "${token}". Please enter a Florida ZIP, county, or city.`);
  }

  return {
    rawInputs: rawTokens,
    resolvedCounties: Array.from(resolvedCounties).sort(),
    resolvedCities: Array.from(resolvedCities).sort(),
    resolvedZips: Array.from(resolvedZips).sort(),
    resolvedRegions: Array.from(resolvedRegions).sort(),
    isStatewide: isStatewide || resolvedCounties.size === 67,
    warnings,
  };
}

/**
 * Returns all Florida counties within a given radius in miles of a target center
 */
export function findCountiesWithinRadius(centerLat: number, centerLng: number, radiusMiles: number): FloridaCounty[] {
  return FLORIDA_COUNTIES.filter((c) => calculateDistanceMiles(centerLat, centerLng, c.lat, c.lng) <= radiusMiles);
}
