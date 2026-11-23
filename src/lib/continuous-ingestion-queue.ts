import { sql } from "@/lib/db";
import { FLORIDA_PARCEL_REGISTRY_SPECS } from "./county-parcel-registry";
import { fetchCadastralCommercialParcels } from "./statewide-cadastral-collector";
import { runSunbizMatchingPass } from "./sunbiz-matcher";
import { ensureDBPRLicensesIngested } from "./dbpr-licenses";
import { ensurePermitsIngested } from "./permits-and-registrations";
import { verifyBusinessActivity } from "./search-verification-provider";
import type { ParcelRecord } from "./opportunity-parcels";

export type IngestionLayer = "parcels" | "entities" | "licenses" | "permits" | "verifications";

export type QueueJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "WAITING_CADENCE";

export interface QueueItem {
  id: string;
  county: string;
  layer: IngestionLayer;
  priorityOrder: number;
  status: QueueJobStatus;
  batchOffset: number;
  batchSize: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextRunAt: string;
  lastRunAt: string | null;
  completedAt: string | null;
}

export interface QueueSummary {
  totalJobs: number;
  queued: number;
  processing: number;
  waitingCadence: number;
  completed: number;
  failed: number;
  byLayer: Record<IngestionLayer, { queued: number; waitingCadence: number; completed: number }>;
  nextScheduledJob: { county: string; layer: string; nextRunAt: string } | null;
  recentJobs: Array<{
    id: string;
    county: string;
    layer: string;
    recordsSeen: number;
    recordsAdded: number;
    recordsUpdated: number;
    status: string;
    createdAt: string;
  }>;
}

/** Cadence durations in days per layer */
export const CADENCE_DAYS: Record<IngestionLayer, number> = {
  parcels: 30,       // Monthly check
  permits: 7,        // Weekly
  licenses: 30,      // Monthly
  entities: 90,      // Quarterly re-match
  verifications: 30, // Rolling 30-day cache
};

/**
 * Ensures all 67 counties across all 5 layers are present in fl_ingestion_queue.
 * Priority counties (Orange, Osceola, Seminole, Escambia, Santa Rosa) receive priority_order 1..5.
 * The remaining 62 receive priority_order 6..67 in population rank order.
 */
export async function ensureIngestionQueueSeeded(): Promise<void> {
  const existingRows = await sql`SELECT COUNT(*)::int as count FROM fl_ingestion_queue`;
  const existingCount = Number(existingRows[0]?.count || 0);

  // If already seeded across 67 counties * 5 layers (approx 335 items), skip full re-seed
  if (existingCount >= 67 * 5) {
    return;
  }

  const layers: IngestionLayer[] = ["parcels", "entities", "licenses", "permits", "verifications"];

  for (let idx = 0; idx < FLORIDA_PARCEL_REGISTRY_SPECS.length; idx++) {
    const spec = FLORIDA_PARCEL_REGISTRY_SPECS[idx];
    const priorityOrder = idx + 1; // 1-5 for priority counties, 6-67 for remaining

    for (const layer of layers) {
      await sql`
        INSERT INTO fl_ingestion_queue (
          county, layer, priority_order, status, batch_offset, batch_size, next_run_at
        ) VALUES (
          ${spec.county}, ${layer}, ${priorityOrder}, 'QUEUED', 0, 250, CURRENT_TIMESTAMP
        )
        ON CONFLICT (county, layer) DO UPDATE SET
          priority_order = EXCLUDED.priority_order
      `;
    }
  }
}

/**
 * Returns complete queue metrics, layer breakdown, and recent audit logs
 */
export async function getIngestionQueueStatus(): Promise<QueueSummary> {
  await ensureIngestionQueueSeeded();

  const countRows = await sql`
    SELECT status, layer, count(*)::int as count
    FROM fl_ingestion_queue
    GROUP BY status, layer
  `;

  let totalJobs = 0;
  let queued = 0;
  let processing = 0;
  let waitingCadence = 0;
  let completed = 0;
  let failed = 0;

  const byLayer: Record<IngestionLayer, { queued: number; waitingCadence: number; completed: number }> = {
    parcels: { queued: 0, waitingCadence: 0, completed: 0 },
    entities: { queued: 0, waitingCadence: 0, completed: 0 },
    licenses: { queued: 0, waitingCadence: 0, completed: 0 },
    permits: { queued: 0, waitingCadence: 0, completed: 0 },
    verifications: { queued: 0, waitingCadence: 0, completed: 0 },
  };

  for (const r of countRows as Array<{ status: string; layer: IngestionLayer; count: number }>) {
    const count = Number(r.count || 0);
    totalJobs += count;

    if (r.status === "QUEUED") queued += count;
    else if (r.status === "PROCESSING") processing += count;
    else if (r.status === "WAITING_CADENCE") waitingCadence += count;
    else if (r.status === "COMPLETED") completed += count;
    else if (r.status === "FAILED") failed += count;

    if (byLayer[r.layer]) {
      if (r.status === "QUEUED") byLayer[r.layer].queued += count;
      else if (r.status === "WAITING_CADENCE") byLayer[r.layer].waitingCadence += count;
      else if (r.status === "COMPLETED") byLayer[r.layer].completed += count;
    }
  }

  // Next scheduled job
  const nextRows = await sql`
    SELECT county, layer, next_run_at
    FROM fl_ingestion_queue
    WHERE status IN ('QUEUED', 'WAITING_CADENCE')
    ORDER BY next_run_at ASC, priority_order ASC
    LIMIT 1
  `;
  const nextScheduledJob = nextRows.length > 0 ? {
    county: String(nextRows[0].county),
    layer: String(nextRows[0].layer),
    nextRunAt: new Date(String(nextRows[0].next_run_at)).toISOString(),
  } : null;

  // Recent audit logs from fl_collection_jobs
  const jobRows = await sql`
    SELECT id, county, layer, records_seen, records_added, records_updated, status, started_at
    FROM fl_collection_jobs
    WHERE layer IS NOT NULL
    ORDER BY started_at DESC
    LIMIT 10
  `;
  const recentJobs = (jobRows as Array<Record<string, unknown>>).map((j) => ({
    id: String(j.id),
    county: String(j.county || "Statewide"),
    layer: String(j.layer),
    recordsSeen: Number(j.records_seen || 0),
    recordsAdded: Number(j.records_added || 0),
    recordsUpdated: Number(j.records_updated || 0),
    status: String(j.status),
    createdAt: new Date(String(j.started_at)).toISOString(),
  }));

  return {
    totalJobs,
    queued,
    processing,
    waitingCadence,
    completed,
    failed,
    byLayer,
    nextScheduledJob,
    recentJobs,
  };
}

/**
 * Bulk upserts parcels using Postgres UNNEST
 */
async function bulkUpsertParcelsFast(rawParcels: ParcelRecord[]): Promise<{ added: number; updated: number }> {
  if (!rawParcels || rawParcels.length === 0) return { added: 0, updated: 0 };

  // Deduplicate within batch to prevent Postgres 21000 ON CONFLICT error
  const uniqueMap = new Map<string, ParcelRecord>();
  for (const p of rawParcels) {
    const key = `${p.county}:::${p.parcel_id}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  }
  const parcels = Array.from(uniqueMap.values());

  const counties = parcels.map((p) => p.county);
  const parcelIds = parcels.map((p) => p.parcel_id);
  const addresses = parcels.map((p) => p.situs_address);
  const cities = parcels.map((p) => p.situs_city || null);
  const zips = parcels.map((p) => p.situs_zip || null);
  const owners = parcels.map((p) => p.owner_name_raw);
  const mailings = parcels.map((p) => p.owner_mailing_address || null);
  const useCodes = parcels.map((p) => p.use_code);
  const useDescs = parcels.map((p) => p.use_description);
  const sqfts = parcels.map((p) => p.building_sqft || null);
  const yearBuilts = parcels.map((p) => p.year_built || null);
  const landCats = parcels.map((p) => p.land_use_category);
  const channels = parcels.map((p) => p.channel);
  const sqftBands = parcels.map((p) => p.sqft_band);
  const tonnageRisks = parcels.map((p) => p.tonnage_risk);

  const res = await sql`
    INSERT INTO fl_parcels (
      county, parcel_id, situs_address, situs_city, situs_zip,
      owner_name_raw, owner_mailing_address, use_code, use_description,
      building_sqft, year_built, land_use_category, channel,
      sqft_band, tonnage_risk
    )
    SELECT * FROM UNNEST(
      ${counties}::varchar[],
      ${parcelIds}::varchar[],
      ${addresses}::text[],
      ${cities}::varchar[],
      ${zips}::varchar[],
      ${owners}::text[],
      ${mailings}::text[],
      ${useCodes}::varchar[],
      ${useDescs}::text[],
      ${sqfts}::numeric[],
      ${yearBuilts}::integer[],
      ${landCats}::varchar[],
      ${channels}::varchar[],
      ${sqftBands}::varchar[],
      ${tonnageRisks}::varchar[]
    )
    ON CONFLICT (county, parcel_id) DO UPDATE SET
      situs_address = EXCLUDED.situs_address,
      situs_city = COALESCE(EXCLUDED.situs_city, fl_parcels.situs_city),
      situs_zip = COALESCE(EXCLUDED.situs_zip, fl_parcels.situs_zip),
      owner_name_raw = EXCLUDED.owner_name_raw,
      owner_mailing_address = COALESCE(EXCLUDED.owner_mailing_address, fl_parcels.owner_mailing_address),
      building_sqft = COALESCE(EXCLUDED.building_sqft, fl_parcels.building_sqft),
      year_built = COALESCE(EXCLUDED.year_built, fl_parcels.year_built),
      channel = EXCLUDED.channel,
      sqft_band = EXCLUDED.sqft_band,
      tonnage_risk = EXCLUDED.tonnage_risk,
      updated_at = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS is_insert
  `;

  let added = 0;
  let updated = 0;
  for (const r of res as Array<{ is_insert: boolean }>) {
    if (r.is_insert) added++;
    else updated++;
  }
  return { added, updated };
}

/**
 * Processes the next batch of queued ingestion tasks.
 * Respects source rate limits and logs every execution in fl_collection_jobs.
 */
export async function processQueueBatch(limit: number = 3): Promise<{
  processed: number;
  items: Array<{
    county: string;
    layer: IngestionLayer;
    recordsSeen: number;
    recordsAdded: number;
    recordsUpdated: number;
    status: string;
  }>;
}> {
  await ensureIngestionQueueSeeded();

  // Find next items ready for execution
  const queueRows = await sql`
    SELECT id, county, layer, priority_order, status, batch_offset, batch_size, attempts
    FROM fl_ingestion_queue
    WHERE (status = 'QUEUED' OR (status = 'WAITING_CADENCE' AND next_run_at <= CURRENT_TIMESTAMP))
    ORDER BY priority_order ASC, next_run_at ASC
    LIMIT ${limit}
  `;

  const results: Array<{
    county: string;
    layer: IngestionLayer;
    recordsSeen: number;
    recordsAdded: number;
    recordsUpdated: number;
    status: string;
  }> = [];

  for (const row of queueRows as Array<Record<string, unknown>>) {
    const queueId = String(row.id);
    const county = String(row.county);
    const layer = row.layer as IngestionLayer;
    const batchOffset = Number(row.batch_offset || 0);
    const batchSize = Number(row.batch_size || 250);

    // Lock item as PROCESSING
    await sql`
      UPDATE fl_ingestion_queue
      SET status = 'PROCESSING', last_run_at = CURRENT_TIMESTAMP, attempts = attempts + 1
      WHERE id = ${queueId}
    `;

    let recordsSeen = 0;
    let recordsAdded = 0;
    let recordsUpdated = 0;
    let stepError: string | null = null;
    let nextOffset = batchOffset;
    let isCountyFullyIngested = false;

    try {
      if (layer === "parcels") {
        const spec = FLORIDA_PARCEL_REGISTRY_SPECS.find((s) => s.county.toLowerCase() === county.toLowerCase());
        if (spec && spec.fileFormat === "RECORDS_REQUEST_REQUIRED") {
          // Rural county without public API: mark records request required
          recordsSeen = 0;
          isCountyFullyIngested = false;
          await sql`
            UPDATE fl_county_parcel_registry
            SET status = 'RECORDS_REQUEST_REQUIRED', updated_at = CURRENT_TIMESTAMP
            WHERE county = ${county}
          `;
        } else {
          // Direct download via cadastral service
          const dorCountySpec = FLORIDA_PARCEL_REGISTRY_SPECS.findIndex((s) => s.county.toLowerCase() === county.toLowerCase());
          const calculatedDorCode = dorCountySpec >= 0 ? dorCountySpec + 11 : 11;

          const parcels = await fetchCadastralCommercialParcels(
            calculatedDorCode,
            county,
            county,
            batchSize,
            batchOffset
          );

          recordsSeen = parcels.length;
          if (parcels.length > 0) {
            const upsertResult = await bulkUpsertParcelsFast(parcels);
            recordsAdded = upsertResult.added;
            recordsUpdated = upsertResult.updated;
            nextOffset = batchOffset + parcels.length;
          }

          // Check total county parcels
          const countRes = await sql`
            SELECT COUNT(*)::int as count FROM fl_parcels WHERE county = ${county}
          `;
          const currentTotal = Number(countRes[0]?.count || 0);
          const threshold = spec?.fullDepthThreshold || 500;
          isCountyFullyIngested = currentTotal >= threshold;

          // Update registry
          await sql`
            UPDATE fl_county_parcel_registry
            SET 
              commercial_parcels_count = ${currentTotal},
              status = ${isCountyFullyIngested ? "INGESTED" : "DIRECT_DOWNLOAD"},
              last_parcels_pull_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE county = ${county}
          `;
        }
      } else if (layer === "entities") {
        // Run Sunbiz matching on parcels in this county
        const matchRes = await runSunbizMatchingPass();
        recordsSeen = matchRes.matchedCount + matchRes.unmatchedCount;
        recordsAdded = matchRes.matchedCount;
        await sql`
          UPDATE fl_county_parcel_registry
          SET updated_at = CURRENT_TIMESTAMP
          WHERE county = ${county}
        `;
      } else if (layer === "licenses") {
        await ensureDBPRLicensesIngested();
        const licCountRes = await sql`
          SELECT COUNT(*)::int as count FROM fl_licenses WHERE county = ${county}
        `;
        recordsSeen = Number(licCountRes[0]?.count || 0);
        await sql`
          UPDATE fl_county_parcel_registry
          SET last_licenses_pull_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE county = ${county}
        `;
      } else if (layer === "permits") {
        await ensurePermitsIngested();
        const permCountRes = await sql`
          SELECT COUNT(*)::int as count FROM fl_permits WHERE parcel_county = ${county}
        `;
        recordsSeen = Number(permCountRes[0]?.count || 0);
        await sql`
          UPDATE fl_county_parcel_registry
          SET last_permits_pull_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE county = ${county}
        `;
      } else if (layer === "verifications") {
        // Find priority targets in this county needing verification
        const targets = await sql`
          SELECT p.owner_name_raw as name, p.situs_city as city
          FROM fl_parcels p
          LEFT JOIN fl_search_verifications v ON LOWER(p.owner_name_raw) = LOWER(v.business_name)
          WHERE p.county = ${county} AND (v.id IS NULL OR v.expires_at <= CURRENT_TIMESTAMP)
          LIMIT 5
        `;
        recordsSeen = targets.length;
        for (const t of targets as Array<{ name: string; city: string }>) {
          await verifyBusinessActivity({
            businessName: t.name,
            county,
            city: t.city || county,
            targetType: "commercial_property",
          });
          recordsAdded++;
        }
        await sql`
          UPDATE fl_county_parcel_registry
          SET last_verifications_pull_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE county = ${county}
        `;
      }
    } catch (err: unknown) {
      stepError = err instanceof Error ? err.message : String(err);
      console.error(`Queue job failed for ${county} ${layer}:`, err);
    }

    // Determine next state & cadence
    const cadenceDays = CADENCE_DAYS[layer] || 30;
    const finalStatus: QueueJobStatus = stepError
      ? "FAILED"
      : isCountyFullyIngested || recordsSeen === 0
      ? "WAITING_CADENCE"
      : "QUEUED";

    const nextRunInterval =
      finalStatus === "WAITING_CADENCE"
        ? `${cadenceDays} days`
        : finalStatus === "FAILED"
        ? `1 hour`
        : `10 seconds`; // Quick resumption for next batch offset

    await sql`
      UPDATE fl_ingestion_queue
      SET 
        status = ${finalStatus},
        batch_offset = ${nextOffset},
        last_error = ${stepError},
        next_run_at = CURRENT_TIMESTAMP + (${nextRunInterval})::interval,
        completed_at = ${finalStatus === "WAITING_CADENCE" ? sql`CURRENT_TIMESTAMP` : null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${queueId}
    `;

    // Audit log in fl_collection_jobs
    await sql`
      INSERT INTO fl_collection_jobs (
        job_type, target_source_id, county, layer,
        records_seen, records_added, records_updated,
        status, error_message, triggered_by, finished_at
      ) VALUES (
        ${`queue_runner_${layer}`},
        ${`${county.toLowerCase()}_${layer}`},
        ${county},
        ${layer},
        ${recordsSeen},
        ${recordsAdded},
        ${recordsUpdated},
        ${stepError ? "failed" : "completed"},
        ${stepError},
        'continuous_queue_runner',
        CURRENT_TIMESTAMP
      )
    `;

    results.push({
      county,
      layer,
      recordsSeen,
      recordsAdded,
      recordsUpdated,
      status: finalStatus,
    });
  }

  return { processed: results.length, items: results };
}
