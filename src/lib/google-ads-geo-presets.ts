/**
 * Google Ads geo target constants (Criteria ID).
 * Florida state = 21142. (21167 is New York state — do not use for Florida.)
 * @see https://developers.google.com/google-ads/api/data/geotargets
 */
export const GEO_PRESETS = {
  us: { label: "United States", constants: ["geoTargetConstants/2840"] },
  fl: { label: "Florida (state)", constants: ["geoTargetConstants/21142"] },
  metros: {
    label: "Florida — Miami-Dade, Orlando, Tampa (combined)",
    constants: [
      "geoTargetConstants/9057286",
      "geoTargetConstants/1015150",
      "geoTargetConstants/1015214",
    ],
  },
  "fl-miami": { label: "Miami (city)", constants: ["geoTargetConstants/1015116"] },
  "fl-miami-dade": { label: "Miami-Dade County", constants: ["geoTargetConstants/9057286"] },
  "fl-orlando": { label: "Orlando (city)", constants: ["geoTargetConstants/1015150"] },
  "fl-tampa": { label: "Tampa (city)", constants: ["geoTargetConstants/1015214"] },
  "fl-jacksonville": { label: "Jacksonville (city)", constants: ["geoTargetConstants/1015067"] },
  "fl-st-petersburg": { label: "St. Petersburg (city)", constants: ["geoTargetConstants/1015206"] },
  "fl-fort-lauderdale": {
    label: "Fort Lauderdale (city)",
    constants: ["geoTargetConstants/1015027"],
  },
  "fl-cape-coral": { label: "Cape Coral (city)", constants: ["geoTargetConstants/1014976"] },
  "fl-tallahassee": { label: "Tallahassee (city)", constants: ["geoTargetConstants/1015213"] },
  "fl-broward": { label: "Broward County", constants: ["geoTargetConstants/1014969"] },
  "fl-palm-beach": { label: "Palm Beach County", constants: ["geoTargetConstants/9057293"] },
} as const;

export type GeoPresetKey = keyof typeof GEO_PRESETS;

export const GEO_PRESET_ORDER: GeoPresetKey[] = [
  "us",
  "fl",
  "metros",
  "fl-miami",
  "fl-miami-dade",
  "fl-orlando",
  "fl-tampa",
  "fl-jacksonville",
  "fl-st-petersburg",
  "fl-fort-lauderdale",
  "fl-cape-coral",
  "fl-tallahassee",
  "fl-broward",
  "fl-palm-beach",
];
