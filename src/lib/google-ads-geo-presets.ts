/**
 * Google Ads geo target constants (Criteria ID).
 * Florida state = 21142. (21167 is New York state — do not use for Florida.)
 * IDs from Google geotargets CSV (e.g. geotargets-2026-03-31).
 * @see https://developers.google.com/google-ads/api/data/geotargets
 */

const g = (id: number) => `geoTargetConstants/${id}` as const;

/** Central Florida — I-4 / Osceola / Polk focus (max 10 combined per GenerateKeywordIdeas). */
export const CENTRAL_FLORIDA_10 = [
  { key: "fl-orlando", label: "Orlando", id: 1015150 },
  { key: "fl-sanford", label: "Sanford", id: 1015190 },
  { key: "fl-kissimmee", label: "Kissimmee", id: 1015078 },
  { key: "fl-st-cloud", label: "St. Cloud", id: 1015204 },
  { key: "fl-poinciana", label: "Poinciana", id: 9052694 },
  { key: "fl-haines-city", label: "Haines City", id: 1015044 },
  { key: "fl-winter-haven", label: "Winter Haven", id: 1015236 },
  { key: "fl-lakeland", label: "Lakeland", id: 1015088 },
  { key: "fl-clermont", label: "Clermont", id: 1014986 },
  { key: "fl-four-corners", label: "Four Corners", id: 9051981 },
] as const;

/** Extra Central / nearby cities for single-geo runs (not in the combined 10). */
export const CENTRAL_FLORIDA_EXTRA = [
  { key: "fl-altamonte-springs", label: "Altamonte Springs", id: 1014943 },
  { key: "fl-apopka", label: "Apopka", id: 1014948 },
  { key: "fl-auburndale", label: "Auburndale", id: 1014951 },
  { key: "fl-celebration", label: "Celebration", id: 9051707 },
  { key: "fl-davenport", label: "Davenport", id: 1015000 },
  { key: "fl-deltona", label: "Deltona", id: 1015008 },
  { key: "fl-de-land", label: "DeLand", id: 1015006 },
  { key: "fl-lake-wales", label: "Lake Wales", id: 1015086 },
  { key: "fl-leesburg", label: "Leesburg", id: 1015094 },
  { key: "fl-mount-dora", label: "Mount Dora", id: 1015125 },
  { key: "fl-ocoee", label: "Ocoee", id: 1015142 },
  { key: "fl-ocala", label: "Ocala", id: 1015141 },
  { key: "fl-oviedo", label: "Oviedo", id: 1015153 },
  { key: "fl-south-apopka", label: "South Apopka", id: 9190790 },
  { key: "fl-winter-park", label: "Winter Park", id: 1015237 },
  { key: "fl-lakeland-highlands", label: "Lakeland Highlands", id: 9052277 },
] as const;

export type GeoPresetSimple = {
  label: string;
  constants: readonly string[] | string[];
};

/** Combined targeting + one API call per city for demand-by-location table. */
export type GeoPresetWithBreakdown = GeoPresetSimple & {
  breakdownCities: readonly { label: string; constants: readonly string[] }[];
};

export type GeoPresetEntry = GeoPresetSimple | GeoPresetWithBreakdown;

export function isBreakdownPreset(
  p: GeoPresetEntry
): p is GeoPresetWithBreakdown {
  return (
    "breakdownCities" in p &&
    Array.isArray((p as GeoPresetWithBreakdown).breakdownCities) &&
    (p as GeoPresetWithBreakdown).breakdownCities.length > 0
  );
}

function simpleFromList(
  list: readonly { key: string; label: string; id: number }[]
): Record<string, GeoPresetSimple> {
  const out: Record<string, GeoPresetSimple> = {};
  for (const row of list) {
    out[row.key] = { label: `${row.label} (city)`, constants: [g(row.id)] };
  }
  return out;
}

const centralFloridaSingles = {
  ...simpleFromList(CENTRAL_FLORIDA_10),
  ...simpleFromList(CENTRAL_FLORIDA_EXTRA),
};

export const GEO_PRESETS = {
  fl: { label: "Florida (state)", constants: [g(21142)] },

  /** Combined ideas (10 geos) + sequential per-city volume for the demand table. */
  cf: {
    label: "Central Florida — 10 cities (combined ideas + per-city demand)",
    constants: CENTRAL_FLORIDA_10.map((c) => g(c.id)),
    breakdownCities: CENTRAL_FLORIDA_10.map((c) => ({
      label: c.label,
      constants: [g(c.id)] as const,
    })),
  } satisfies GeoPresetWithBreakdown,

  /** Legacy tri-metro preset (kept for old links). */
  metros: {
    label: "Florida — Miami, Orlando, Tampa (combined)",
    constants: [g(9057286), g(1015150), g(1015214)],
  },

  ...centralFloridaSingles,

  "fl-miami": { label: "Miami (city)", constants: [g(1015116)] },
  "fl-miami-dade": { label: "Miami-Dade County", constants: [g(9057286)] },
  "fl-tampa": { label: "Tampa (city)", constants: [g(1015214)] },
  "fl-jacksonville": { label: "Jacksonville (city)", constants: [g(1015067)] },
  "fl-st-petersburg": { label: "St. Petersburg (city)", constants: [g(1015206)] },
  "fl-fort-lauderdale": {
    label: "Fort Lauderdale (city)",
    constants: [g(1015027)],
  },
  "fl-cape-coral": { label: "Cape Coral (city)", constants: [g(1014976)] },
  "fl-tallahassee": { label: "Tallahassee (city)", constants: [g(1015213)] },
  "fl-broward": { label: "Broward County", constants: [g(1014969)] },
  "fl-palm-beach": { label: "Palm Beach County", constants: [g(9057293)] },
} as const satisfies Record<string, GeoPresetEntry>;

export type GeoPresetKey = keyof typeof GEO_PRESETS;

/** UI order: broad → central bundle → central cities (10 first) → extra CF → legacy metros → south/north FL */
export const GEO_PRESET_ORDER: GeoPresetKey[] = [
  "fl",
  "cf",
  ...CENTRAL_FLORIDA_10.map((c) => c.key as GeoPresetKey),
  ...CENTRAL_FLORIDA_EXTRA.map((c) => c.key as GeoPresetKey),
  "metros",
  "fl-miami",
  "fl-miami-dade",
  "fl-tampa",
  "fl-jacksonville",
  "fl-st-petersburg",
  "fl-fort-lauderdale",
  "fl-cape-coral",
  "fl-tallahassee",
  "fl-broward",
  "fl-palm-beach",
];
