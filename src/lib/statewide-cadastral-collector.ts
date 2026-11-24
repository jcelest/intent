import { sql } from "@/lib/db";
import { deriveTonnageRisk, type ParcelRecord } from "@/lib/opportunity-parcels";
import {
  FLORIDA_DOR_COUNTIES,
  DOR_COUNTY_OID_START,
  DOR_CODE_TO_COUNTY,
  COUNTY_NAME_TO_DOR,
  mapDorUseCode,
  type DORCountyMeta,
} from "./florida-dor-meta";

export {
  FLORIDA_DOR_COUNTIES,
  DOR_COUNTY_OID_START,
  DOR_CODE_TO_COUNTY,
  COUNTY_NAME_TO_DOR,
  mapDorUseCode,
  type DORCountyMeta,
};

/**
 * Ensures checkpoint table exists in database
 */
export async function ensureCheckpointTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS fl_ingestion_checkpoints (
      id VARCHAR(60) PRIMARY KEY,
      last_county_index INTEGER NOT NULL DEFAULT 0,
      last_county_name VARCHAR(100),
      last_offset INTEGER NOT NULL DEFAULT 0,
      total_records_ingested INTEGER NOT NULL DEFAULT 0,
      is_running BOOLEAN NOT NULL DEFAULT FALSE,
      last_run_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export interface CadastralArcGISFeature {
  attributes: {
    PARCEL_ID?: string;
    PARCELNO?: string;
    CO_NO?: number;
    DOR_UC?: string;
    OWN_NAME?: string;
    OWN_ADDR1?: string;
    OWN_CITY?: string;
    OWN_STATE?: string;
    OWN_ZIPCD?: string | number;
    PHY_ADDR1?: string;
    PHY_CITY?: string;
    PHY_ZIPCD?: string | number;
    TOT_LVG_AR?: number;
    ACT_YR_BLT?: number;
    OBJECTID?: number;
  };
  centroid?: { x?: number; y?: number };
}

/**
 * Fetches real commercial parcels from Florida GIO / FDOR ArcGIS FeatureServer.
 * Uses index on OBJECTID slice + CO_NO and DOR_UC commercial ranges.
 */
export async function fetchCadastralCommercialParcels(
  dorCode: number,
  countyName: string,
  countySeat: string,
  limit: number = 50,
  offset: number = 0
): Promise<ParcelRecord[]> {
  const startOid = DOR_COUNTY_OID_START[dorCode] || 1;
  const whereClause = `OBJECTID >= ${startOid} AND CO_NO = ${dorCode} AND (DOR_UC LIKE '01%' OR DOR_UC LIKE '02%' OR DOR_UC LIKE '03%' OR DOR_UC LIKE '04%' OR DOR_UC LIKE '07%' OR DOR_UC LIKE '08%') AND OWN_NAME IS NOT NULL`;
  const url = `https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query?where=${encodeURIComponent(
    whereClause
  )}&outFields=OBJECTID,PARCEL_ID,PARCELNO,CO_NO,DOR_UC,OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,TOT_LVG_AR,ACT_YR_BLT&returnGeometry=false&returnCentroid=true&outSR=4326&resultOffset=${offset}&resultRecordCount=${limit}&f=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error(`ArcGIS query failed with status ${res.status} for county ${countyName}`);
      return [];
    }

    const data = await res.json();
    const features: CadastralArcGISFeature[] = data.features || [];

    const records: ParcelRecord[] = [];

    for (const f of features) {
      const a = f.attributes;
      const rawParcelId = (a.PARCEL_ID || a.PARCELNO || "").trim();
      const rawOwner = (a.OWN_NAME || "").trim();
      const rawAddress = (a.PHY_ADDR1 || "").trim() || `${rawOwner} Commercial Site`;

      // Zero-fabrication: require valid parcel id and owner
      if (!rawParcelId || !rawOwner) continue;

      const dorUc = (a.DOR_UC || "011").trim();
      const { channel, category, description } = mapDorUseCode(dorUc);

      const sqft = a.TOT_LVG_AR && Number(a.TOT_LVG_AR) > 0 ? Number(a.TOT_LVG_AR) : null;
      const yearBuilt = a.ACT_YR_BLT && Number(a.ACT_YR_BLT) > 1850 ? Number(a.ACT_YR_BLT) : null;
      const tonnageRisk = deriveTonnageRisk(sqft);

      const city = (a.PHY_CITY || countySeat).trim();
      const zip = a.PHY_ZIPCD ? String(a.PHY_ZIPCD).padStart(5, "0").slice(0, 5) : null;
      const latitude = Number(f.centroid?.y);
      const longitude = Number(f.centroid?.x);
      const hasOfficialCentroid = Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= 24 && latitude <= 32 && longitude >= -88 && longitude <= -79;
      const sourceObjectId = Number(a.OBJECTID);

      let mailing: string | null = null;
      if (a.OWN_ADDR1) {
        mailing = `${a.OWN_ADDR1.trim()}${a.OWN_CITY ? ", " + a.OWN_CITY.trim() : ""}${
          a.OWN_STATE ? " " + a.OWN_STATE.trim() : ""
        }${a.OWN_ZIPCD ? " " + a.OWN_ZIPCD : ""}`;
      }

      records.push({
        county: countyName,
        parcel_id: rawParcelId,
        situs_address: rawAddress,
        situs_city: city,
        situs_zip: zip,
        owner_name_raw: rawOwner,
        owner_mailing_address: mailing,
        use_code: dorUc,
        use_description: description,
        building_sqft: sqft,
        year_built: yearBuilt,
        land_use_category: category,
        channel,
        sqft_band: tonnageRisk,
        tonnage_risk: tonnageRisk,
        last_mechanical_permit_date: null,
        incumbent_contractor: null,
        latitude: hasOfficialCentroid ? latitude : null,
        longitude: hasOfficialCentroid ? longitude : null,
        source_object_id: Number.isInteger(sourceObjectId) ? sourceObjectId : null,
        location_source_url: Number.isInteger(sourceObjectId)
          ? `https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/${sourceObjectId}`
          : null,
        location_method: hasOfficialCentroid ? "official_arcgis_parcel_centroid" : null,
      });
    }

    return records;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Error querying cadastral records for ${countyName}:`, error);
    return [];
  }
}

/**
 * Upserts a batch of real parcels into fl_parcels
 */
export async function upsertCadastralParcels(parcels: ParcelRecord[]): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  for (const p of parcels) {
    try {
      const res = await sql`
        INSERT INTO fl_parcels (
          county, parcel_id, situs_address, situs_city, situs_zip,
          owner_name_raw, owner_mailing_address, use_code, use_description,
          building_sqft, year_built, land_use_category, channel,
          sqft_band, tonnage_risk, last_mechanical_permit_date, incumbent_contractor,
          latitude, longitude, source_object_id, location_source_url, location_method, location_verified_at
        ) VALUES (
          ${p.county}, ${p.parcel_id}, ${p.situs_address}, ${p.situs_city || null}, ${p.situs_zip || null},
          ${p.owner_name_raw}, ${p.owner_mailing_address || null}, ${p.use_code}, ${p.use_description},
          ${p.building_sqft || null}, ${p.year_built || null}, ${p.land_use_category}, ${p.channel},
          ${p.sqft_band}, ${p.tonnage_risk}, ${p.last_mechanical_permit_date || null}, ${p.incumbent_contractor || null},
          ${p.latitude ?? null}, ${p.longitude ?? null}, ${p.source_object_id ?? null}, ${p.location_source_url || null}, ${p.location_method || null},
          ${p.latitude != null && p.longitude != null ? new Date() : null}
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
          latitude = COALESCE(EXCLUDED.latitude, fl_parcels.latitude),
          longitude = COALESCE(EXCLUDED.longitude, fl_parcels.longitude),
          source_object_id = COALESCE(EXCLUDED.source_object_id, fl_parcels.source_object_id),
          location_source_url = COALESCE(EXCLUDED.location_source_url, fl_parcels.location_source_url),
          location_method = COALESCE(EXCLUDED.location_method, fl_parcels.location_method),
          location_verified_at = COALESCE(EXCLUDED.location_verified_at, fl_parcels.location_verified_at),
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS is_insert
      `;

      if (res && res[0] && (res[0] as { is_insert: boolean }).is_insert) {
        added++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`Failed upserting parcel ${p.county}/${p.parcel_id}:`, err);
    }
  }

  return { added, updated };
}

/**
 * Continuous Statewide Ingestion Engine:
 * Cycles continuously across all 67 Florida counties in a circular round-robin loop.
 * Operates without stopping, advancing checkpoints and logging runs in fl_collection_jobs.
 */
export async function runContinuousIngestionStep(options?: {
  countiesPerStep?: number;
  recordsPerCounty?: number;
  triggeredBy?: string;
}): Promise<{
  success: boolean;
  countiesProcessed: string[];
  totalRecordsSeen: number;
  totalRecordsAdded: number;
  totalRecordsUpdated: number;
  currentCountyIndex: number;
  nextCounty: string;
}> {
  await ensureCheckpointTable();

  const countiesPerStep = options?.countiesPerStep || 5;
  const recordsPerCounty = options?.recordsPerCounty || 50;
  const triggeredBy = options?.triggeredBy || "continuous_worker";

  // 1. Read or initialize checkpoint
  const cpRows = await sql`
    SELECT last_county_index, last_county_name, last_offset, total_records_ingested
    FROM fl_ingestion_checkpoints
    WHERE id = 'statewide_cadastral'
    LIMIT 1
  `;

  let startIndex = 0;
  let totalIngested = 0;

  if (cpRows.length > 0) {
    const cp = cpRows[0] as { last_county_index: number; total_records_ingested: number };
    startIndex = (Number(cp.last_county_index || 0) + 1) % FLORIDA_DOR_COUNTIES.length;
    totalIngested = Number(cp.total_records_ingested || 0);
  }

  // Mark running
  await sql`
    INSERT INTO fl_ingestion_checkpoints (id, last_county_index, total_records_ingested, is_running, last_run_at)
    VALUES ('statewide_cadastral', ${startIndex}, ${totalIngested}, TRUE, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET is_running = TRUE, last_run_at = CURRENT_TIMESTAMP
  `;

  // Start fl_collection_jobs record
  const jobRows = await sql`
    INSERT INTO fl_collection_jobs (job_type, target_source_id, status, triggered_by)
    VALUES ('statewide_cadastral_continuous', ${`counties_${startIndex}_to_${(startIndex + countiesPerStep - 1) % 67}`}, 'running', ${triggeredBy})
    RETURNING id
  `;
  const jobId = String((jobRows[0] as { id: string }).id);

  let totalSeen = 0;
  let totalAdded = 0;
  let totalUpdated = 0;
  const processedNames: string[] = [];

  try {
    for (let i = 0; i < countiesPerStep; i++) {
      const countyIdx = (startIndex + i) % FLORIDA_DOR_COUNTIES.length;
      const county = FLORIDA_DOR_COUNTIES[countyIdx];
      processedNames.push(county.name);

      const records = await fetchCadastralCommercialParcels(
        county.dorCode,
        county.name,
        county.seat,
        recordsPerCounty,
        0
      );

      totalSeen += records.length;

      if (records.length > 0) {
        const { added, updated } = await upsertCadastralParcels(records);
        totalAdded += added;
        totalUpdated += updated;
      }
    }

    const lastIdx = (startIndex + countiesPerStep - 1) % FLORIDA_DOR_COUNTIES.length;
    const nextIdx = (lastIdx + 1) % FLORIDA_DOR_COUNTIES.length;
    const nextCounty = FLORIDA_DOR_COUNTIES[nextIdx].name;

    // Update checkpoint
    await sql`
      UPDATE fl_ingestion_checkpoints
      SET 
        last_county_index = ${lastIdx},
        last_county_name = ${FLORIDA_DOR_COUNTIES[lastIdx].name},
        total_records_ingested = total_records_ingested + ${totalAdded},
        is_running = FALSE,
        last_run_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 'statewide_cadastral'
    `;

    // Complete job log
    await sql`
      UPDATE fl_collection_jobs
      SET
        status = 'completed',
        records_seen = ${totalSeen},
        records_added = ${totalAdded},
        records_updated = ${totalUpdated},
        finished_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId}
    `;

    return {
      success: true,
      countiesProcessed: processedNames,
      totalRecordsSeen: totalSeen,
      totalRecordsAdded: totalAdded,
      totalRecordsUpdated: totalUpdated,
      currentCountyIndex: lastIdx,
      nextCounty,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Continuous ingestion failed:", error);

    await sql`
      UPDATE fl_ingestion_checkpoints
      SET is_running = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'statewide_cadastral'
    `;

    await sql`
      UPDATE fl_collection_jobs
      SET status = 'failed', error_message = ${errorMsg}, finished_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId}
    `;

    return {
      success: false,
      countiesProcessed: processedNames,
      totalRecordsSeen: totalSeen,
      totalRecordsAdded: totalAdded,
      totalRecordsUpdated: totalUpdated,
      currentCountyIndex: startIndex,
      nextCounty: FLORIDA_DOR_COUNTIES[startIndex].name,
    };
  }
}

/**
 * Runs a complete statewide ingestion pass across all 67 Florida counties.
 * Ingests real commercial parcels for every single county.
 */
export async function ingestAll67Counties(recordsPerCounty: number = 40): Promise<{
  success: boolean;
  totalCounties: number;
  totalRecordsSeen: number;
  totalAdded: number;
  totalUpdated: number;
  countyResults: Array<{ county: string; seen: number; added: number; updated: number }>;
}> {
  await ensureCheckpointTable();

  const jobRows = await sql`
    INSERT INTO fl_collection_jobs (job_type, target_source_id, status, triggered_by)
    VALUES ('statewide_cadastral_all_67', 'all_67_florida_counties', 'running', 'admin')
    RETURNING id
  `;
  const jobId = String((jobRows[0] as { id: string }).id);

  let grandSeen = 0;
  let grandAdded = 0;
  let grandUpdated = 0;
  const countyResults: Array<{ county: string; seen: number; added: number; updated: number }> = [];

  try {
    for (let i = 0; i < FLORIDA_DOR_COUNTIES.length; i++) {
      const county = FLORIDA_DOR_COUNTIES[i];
      const records = await fetchCadastralCommercialParcels(
        county.dorCode,
        county.name,
        county.seat,
        recordsPerCounty,
        0
      );

      grandSeen += records.length;
      let added = 0;
      let updated = 0;

      if (records.length > 0) {
        const res = await upsertCadastralParcels(records);
        added = res.added;
        updated = res.updated;
        grandAdded += added;
        grandUpdated += updated;
      }

      countyResults.push({
        county: county.name,
        seen: records.length,
        added,
        updated,
      });

      // Update checkpoint along the way
      await sql`
        INSERT INTO fl_ingestion_checkpoints (
          id, last_county_index, last_county_name, total_records_ingested, is_running, last_run_at
        ) VALUES (
          'statewide_cadastral', ${i}, ${county.name}, ${grandAdded}, TRUE, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          last_county_index = ${i},
          last_county_name = ${county.name},
          total_records_ingested = fl_ingestion_checkpoints.total_records_ingested + ${added},
          last_run_at = CURRENT_TIMESTAMP
      `;
    }

    await sql`
      UPDATE fl_ingestion_checkpoints
      SET is_running = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'statewide_cadastral'
    `;

    await sql`
      UPDATE fl_collection_jobs
      SET
        status = 'completed',
        records_seen = ${grandSeen},
        records_added = ${grandAdded},
        records_updated = ${grandUpdated},
        finished_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId}
    `;

    return {
      success: true,
      totalCounties: FLORIDA_DOR_COUNTIES.length,
      totalRecordsSeen: grandSeen,
      totalAdded: grandAdded,
      totalUpdated: grandUpdated,
      countyResults,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Full 67-county ingestion error:", error);

    await sql`
      UPDATE fl_collection_jobs
      SET status = 'failed', error_message = ${errorMsg}, finished_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId}
    `;

    return {
      success: false,
      totalCounties: FLORIDA_DOR_COUNTIES.length,
      totalRecordsSeen: grandSeen,
      totalAdded: grandAdded,
      totalUpdated: grandUpdated,
      countyResults,
    };
  }
}

/**
 * Gets live status of statewide continuous ingestion and coverage breakdown.
 */
export async function getContinuousIngestionStatus(): Promise<{
  isRunning: boolean;
  lastCountyName: string | null;
  lastCountyIndex: number;
  totalRecordsIngested: number;
  lastRunAt: string | null;
  countiesCoverage: Array<{ county: string; count: number }>;
  totalCountiesCovered: number;
}> {
  await ensureCheckpointTable();

  let isRunning = false;
  let lastCountyName: string | null = null;
  let lastCountyIndex = 0;
  let totalRecordsIngested = 0;
  let lastRunAt: string | null = null;

  try {
    const cpRows = await sql`
      SELECT last_county_index, last_county_name, total_records_ingested, is_running, last_run_at
      FROM fl_ingestion_checkpoints
      WHERE id = 'statewide_cadastral'
      LIMIT 1
    `;
    if (cpRows.length > 0) {
      const cp = cpRows[0] as {
        last_county_index: number;
        last_county_name: string | null;
        total_records_ingested: number;
        is_running: boolean;
        last_run_at: string | null;
      };
      lastCountyIndex = Number(cp.last_county_index || 0);
      lastCountyName = cp.last_county_name;
      totalRecordsIngested = Number(cp.total_records_ingested || 0);
      isRunning = Boolean(cp.is_running);
      lastRunAt = cp.last_run_at ? new Date(cp.last_run_at).toISOString() : null;
    }
  } catch (err) {
    console.error("Failed loading ingestion checkpoint:", err);
  }

  const covRows = await sql`
    SELECT county, COUNT(*)::int as count
    FROM fl_parcels
    WHERE county IS NOT NULL
    GROUP BY county
    ORDER BY count DESC, county ASC
  `;

  const countiesCoverage = (covRows as Array<{ county: string; count: number }>);

  return {
    isRunning,
    lastCountyName,
    lastCountyIndex,
    totalRecordsIngested,
    lastRunAt,
    countiesCoverage,
    totalCountiesCovered: countiesCoverage.length,
  };
}
