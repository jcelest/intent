import { createHash } from "node:crypto";

export interface CanonicalOpportunityInput {
  sourceRecordId: string;
  title: string;
  summary?: string | null;
  tradeSlug?: string | null;
  classification: "confirmed" | "timing_based" | "asset_based" | "relationship" | "inferred";
  status: "discovered" | "active" | "upcoming" | "awarded" | "expired" | "cancelled" | "archived" | "needs_review";
  geographicScopeType: "property" | "address" | "city" | "county" | "multi_county" | "statewide" | "regional" | "unknown";
  address?: string | null;
  city?: string | null;
  county?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  parcelId?: string | null;
  propertyType?: "COMMERCIAL" | "RESIDENTIAL" | "UNKNOWN" | null;
  parcelUseCode?: string | null;
  parcelUseDescription?: string | null;
  parcelEvidenceUrl?: string | null;
  documentedValue?: number | null;
  estimatedValue?: number | null;
  valueEstimationMethodology?: string | null;
  procurementDeadline?: string | null;
  evidenceConfidence?: number | null;
  classificationRationale: string;
  sourceUrl: string;
  sourceDocumentUrl?: string | null;
  sourcePayload?: unknown;
}

export function opportunityFingerprint(sourceId: string, record: CanonicalOpportunityInput) {
  return createHash("sha256").update([sourceId, record.sourceRecordId, record.title.trim().toLowerCase()].join("|")).digest("hex");
}

export function validateCanonicalOpportunity(record: CanonicalOpportunityInput) {
  const errors: string[] = [];
  if (!record.sourceRecordId) errors.push("sourceRecordId is required");
  if (!record.title.trim()) errors.push("title is required");
  if (!record.sourceUrl) errors.push("sourceUrl is required");
  if (!record.classificationRationale.trim()) errors.push("classificationRationale is required");
  if (record.estimatedValue !== null && record.estimatedValue !== undefined && !record.valueEstimationMethodology) errors.push("estimated values require a methodology");
  if ((record.latitude === null || record.latitude === undefined) !== (record.longitude === null || record.longitude === undefined)) errors.push("latitude and longitude must be supplied together");
  if (record.latitude !== null && record.latitude !== undefined && (record.latitude < 24 || record.latitude > 32 || Number(record.longitude) < -88 || Number(record.longitude) > -79)) errors.push("coordinates are outside the Florida validation envelope");
  if (record.classification === "confirmed" && record.evidenceConfidence !== null && record.evidenceConfidence !== undefined && record.evidenceConfidence < 75) errors.push("confirmed records below 75 confidence require manual review instead");
  return errors;
}
