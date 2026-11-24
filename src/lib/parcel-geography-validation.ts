export const FLORIDA_CADASTRAL_LAYER_URL =
  "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0";

export interface ParcelCentroid {
  parcelId: string;
  latitude: number;
  longitude: number;
  sourceObjectId: number;
  sourceUrl: string;
}

export interface ArcGisCentroidFeature {
  attributes?: {
    OBJECTID?: number;
    PARCEL_ID?: string;
    PARCELNO?: string;
  };
  centroid?: { x?: number; y?: number };
}

export function isFloridaCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= 24
    && latitude <= 32
    && longitude >= -88
    && longitude <= -79;
}

export function parseParcelCentroid(feature: ArcGisCentroidFeature): ParcelCentroid | null {
  const parcelId = String(feature.attributes?.PARCEL_ID || feature.attributes?.PARCELNO || "").trim();
  const sourceObjectId = Number(feature.attributes?.OBJECTID);
  const latitude = Number(feature.centroid?.y);
  const longitude = Number(feature.centroid?.x);
  if (!parcelId || !Number.isInteger(sourceObjectId) || !isFloridaCoordinate(latitude, longitude)) return null;
  return {
    parcelId,
    latitude,
    longitude,
    sourceObjectId,
    sourceUrl: `${FLORIDA_CADASTRAL_LAYER_URL}/${sourceObjectId}`,
  };
}
