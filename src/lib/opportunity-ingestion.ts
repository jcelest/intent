import { sql } from "@/lib/db";
import { createHash } from "node:crypto";
import {
  opportunityFingerprint,
  validateCanonicalOpportunity,
  type CanonicalOpportunityInput,
} from "@/lib/opportunity-validation";

export { opportunityFingerprint, validateCanonicalOpportunity, type CanonicalOpportunityInput } from "@/lib/opportunity-validation";

type Row = Record<string, unknown>;
type Queryable = { query: (query: string, params?: unknown[]) => Promise<Row[]> };
const queryDb = (query: string, params: unknown[] = []) => (sql as unknown as Queryable).query(query, params);

export async function ingestOpportunityBatch(sourceId: string, records: CanonicalOpportunityInput[], cursor?: string) {
  const started = await queryDb(`INSERT INTO oi_source_sync_history (source_id, status, records_seen, cursor_value) VALUES ($1, 'running', $2, $3) RETURNING id`, [sourceId, records.length, cursor || null]);
  const runId = String(started[0].id);
  let inserted = 0; let updated = 0; let unchanged = 0; let failed = 0; let duplicates = 0;
  try {
    for (const record of records) {
      const errors = validateCanonicalOpportunity(record);
      if (errors.length) { failed++; continue; }
      const hash = opportunityFingerprint(sourceId, record);
      const { sourcePayload, ...canonicalRecord } = record;
      const canonicalHash = createHash("sha256").update(JSON.stringify(canonicalRecord)).digest("hex");
      const existingRows = await queryDb(
        `SELECT id, status, source_payload FROM oi_opportunities WHERE source_id=$1 AND source_record_id=$2 LIMIT 1`,
        [sourceId, record.sourceRecordId],
      );
      const existing = existingRows[0];
      const existingPayload = existing?.source_payload as Row | undefined;
      const incomingPayload = { ...((sourcePayload || {}) as Row), canonicalHash };
      if (existing && existingPayload?.canonicalHash === canonicalHash) {
        unchanged++;
        duplicates++;
        await queryDb(
          `UPDATE oi_opportunities SET last_verified_at=CURRENT_TIMESTAMP, last_status_checked_at=CURRENT_TIMESTAMP,
           is_stale=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [existing.id],
        );
        continue;
      }
      const rows = await queryDb(
        `INSERT INTO oi_opportunities (
          source_id, source_record_id, dedupe_hash, title, summary, trade_slug, classification, status,
          geographic_scope_type, address, city, county, counties, zip_code, latitude, longitude,
          parcel_id, property_type, parcel_use_code, parcel_use_description, parcel_evidence_url,
          documented_value, estimated_value, value_estimation_methodology, procurement_deadline,
          evidence_confidence, classification_rationale, source_url, source_document_url, source_payload, last_verified_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30::jsonb,CURRENT_TIMESTAMP)
        ON CONFLICT (source_id, source_record_id) DO UPDATE SET
          title=EXCLUDED.title, summary=EXCLUDED.summary, trade_slug=EXCLUDED.trade_slug,
          classification=EXCLUDED.classification, status=EXCLUDED.status, geographic_scope_type=EXCLUDED.geographic_scope_type,
          address=EXCLUDED.address, city=EXCLUDED.city, county=EXCLUDED.county, counties=EXCLUDED.counties,
          zip_code=EXCLUDED.zip_code, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
          parcel_id=EXCLUDED.parcel_id, property_type=EXCLUDED.property_type,
          parcel_use_code=EXCLUDED.parcel_use_code, parcel_use_description=EXCLUDED.parcel_use_description,
          parcel_evidence_url=EXCLUDED.parcel_evidence_url,
          documented_value=EXCLUDED.documented_value, estimated_value=EXCLUDED.estimated_value,
          value_estimation_methodology=EXCLUDED.value_estimation_methodology, procurement_deadline=EXCLUDED.procurement_deadline,
          evidence_confidence=EXCLUDED.evidence_confidence, classification_rationale=EXCLUDED.classification_rationale,
          source_url=EXCLUDED.source_url, source_document_url=EXCLUDED.source_document_url,
          source_payload=EXCLUDED.source_payload, last_verified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        RETURNING id, (xmax = 0) AS was_inserted`,
        [sourceId, record.sourceRecordId, hash, record.title, record.summary || null, record.tradeSlug || null, record.classification, record.status, record.geographicScopeType, record.address || null, record.city || null, record.county || null, record.county ? [record.county] : [], record.zipCode || null, record.latitude ?? null, record.longitude ?? null, record.parcelId || null, record.propertyType || null, record.parcelUseCode || null, record.parcelUseDescription || null, record.parcelEvidenceUrl || null, record.documentedValue ?? null, record.estimatedValue ?? null, record.valueEstimationMethodology || null, record.procurementDeadline || null, record.evidenceConfidence ?? null, record.classificationRationale, record.sourceUrl, record.sourceDocumentUrl || null, JSON.stringify(incomingPayload)],
      );
      if (rows[0]?.was_inserted) inserted++; else { updated++; duplicates++; }
      if (existing && existing.status !== record.status) {
        await queryDb(
          `INSERT INTO oi_opportunity_status_history (
             opportunity_id, source_id, previous_status, new_status, change_reason, source_url
           ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [rows[0].id, sourceId, existing.status, record.status,
            "Status changed during authoritative source synchronization.", record.sourceUrl],
        );
      }
      await queryDb(`INSERT INTO oi_opportunity_evidence (opportunity_id, source_id, evidence_type, title, description, source_url, source_document_url, source_record_id, is_direct_evidence, confidence, verified_at) VALUES ($1,$2,'source_record',$3,$4,$5,$6,$7,TRUE,$8,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`, [rows[0].id, sourceId, record.title, record.summary || null, record.sourceUrl, record.sourceDocumentUrl || null, record.sourceRecordId, record.evidenceConfidence ?? null]);
    }
    await queryDb(`UPDATE oi_source_sync_history SET status='completed', finished_at=CURRENT_TIMESTAMP, records_ingested=$2, records_updated=$3, records_unchanged=$4, duplicates_detected=$5, records_failed=$6 WHERE id=$1`, [runId, inserted, updated, unchanged, duplicates, failed]);
    await queryDb(`UPDATE oi_data_sources SET status='connected_current', is_operational=TRUE, last_attempted_at=CURRENT_TIMESTAMP, last_successful_at=CURRENT_TIMESTAMP, records_ingested=records_ingested+$2, records_updated=records_updated+$3, duplicates_detected=duplicates_detected+$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [sourceId, inserted, updated, duplicates]);
    return { sourceId, runId, seen: records.length, inserted, updated, unchanged, duplicates, failed };
  } catch (error) {
    await queryDb(`UPDATE oi_source_sync_history SET status='failed', finished_at=CURRENT_TIMESTAMP, records_ingested=$2, records_updated=$3, duplicates_detected=$4, records_failed=$5, error_message=$6 WHERE id=$1`, [runId, inserted, updated, duplicates, failed, error instanceof Error ? error.message : String(error)]);
    throw error;
  }
}

export async function bridgeOperationalLegacyProcurement(limit = 1000) {
  const sources = await queryDb(`SELECT * FROM fl_procurement_sources WHERE last_successful_at IS NOT NULL ORDER BY id`);
  const outcomes = [];
  for (const source of sources) {
    const sourceId = `legacy:${source.id}`;
    await queryDb(`INSERT INTO oi_data_sources (id, source_name, source_url, source_category, access_method, data_format, update_frequency, geographic_coverage, status, is_operational, last_attempted_at, last_successful_at, limitations) VALUES ($1,$2,$3,'procurement',$4,$5,$6,$7::jsonb,'connected_current',TRUE,$8,$9,'Bridged from the existing operational procurement adapter; source documents remain authoritative.') ON CONFLICT (id) DO UPDATE SET last_attempted_at=EXCLUDED.last_attempted_at,last_successful_at=EXCLUDED.last_successful_at,is_operational=TRUE,status='connected_current',updated_at=CURRENT_TIMESTAMP`, [sourceId, source.agency_name, source.portal_url, source.collection_method, source.supported_format, source.collection_frequency, JSON.stringify({ state: "FL", county: source.county || null, city: source.city || null }), source.last_attempted_at, source.last_successful_at]);
    const bids = await queryDb(`SELECT * FROM fl_commercial_bids WHERE source_id=$1 AND source_url IS NOT NULL AND source_url<>'' ORDER BY updated_at DESC LIMIT $2`, [source.id, limit]);
    const records: CanonicalOpportunityInput[] = bids.map((bid) => ({
      sourceRecordId: String(bid.id), title: String(bid.title), summary: bid.description ? String(bid.description) : null,
      tradeSlug: bid.trade_slug ? String(bid.trade_slug) : null, classification: "confirmed",
      status: bid.status === "open" && (!bid.closing_date || new Date(String(bid.closing_date)) >= new Date()) ? "active" : bid.status === "awarded" ? "awarded" : bid.status === "cancelled" ? "cancelled" : "expired",
      geographicScopeType: bid.zip_code ? "city" : bid.county ? "county" : "unknown", city: bid.city ? String(bid.city) : null, county: bid.county ? String(bid.county) : null, zipCode: bid.zip_code ? String(bid.zip_code) : null,
      estimatedValue: bid.estimated_value === null ? null : Number(bid.estimated_value), valueEstimationMethodology: bid.estimated_value === null ? null : "Estimate supplied by the legacy operational procurement adapter; verify against the linked source document.",
      procurementDeadline: bid.closing_date ? new Date(String(bid.closing_date)).toISOString() : null, evidenceConfidence: 95,
      classificationRationale: "An operational procurement source documents this solicitation. Classification does not imply award probability or client fit.", sourceUrl: String(bid.source_url), sourcePayload: bid.raw_data || {},
    }));
    outcomes.push(await ingestOpportunityBatch(sourceId, records));
  }
  return { sourcesProcessed: sources.length, outcomes };
}
