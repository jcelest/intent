import { sql } from "../src/lib/db";
import { ensureCountyParcelRegistrySeeded } from "../src/lib/county-parcel-registry";
import { deriveTonnageRisk } from "../src/lib/florida-dor-meta";
import { mapDorUseCode } from "../src/lib/florida-dor-meta";
import { ensureDBPRLicensesIngested } from "../src/lib/dbpr-licenses";
import { ensurePermitsIngested } from "../src/lib/permits-and-registrations";
import { runSunbizMatchingPass } from "../src/lib/sunbiz-matcher";

interface PriorityTarget {
  name: string;
  dorCode: number;
  seat: string;
  startOid: number;
  targetCount: number;
}

const PRIORITY_COUNTIES: PriorityTarget[] = [
  { name: "Orange", dorCode: 58, seat: "Orlando", startOid: 6700001, targetCount: 2000 },
  { name: "Osceola", dorCode: 59, seat: "Kissimmee", startOid: 7103330, targetCount: 1500 },
  { name: "Seminole", dorCode: 69, seat: "Sanford", startOid: 9800001, targetCount: 1500 },
  { name: "Escambia", dorCode: 27, seat: "Pensacola", startOid: 2771360, targetCount: 1500 },
  { name: "Santa Rosa", dorCode: 67, seat: "Milton", startOid: 9302280, targetCount: 1000 },
];

async function fetchBoundedCommercialSlice(
  startOid: number,
  endOid: number,
  countyName: string,
  countySeat: string
) {
  const whereClause = `OBJECTID >= ${startOid} AND OBJECTID < ${endOid} AND (DOR_UC LIKE '01%' OR DOR_UC LIKE '02%' OR DOR_UC LIKE '03%' OR DOR_UC LIKE '04%' OR DOR_UC LIKE '07%' OR DOR_UC LIKE '08%') AND OWN_NAME IS NOT NULL`;
  const url = `https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query?where=${encodeURIComponent(
    whereClause
  )}&outFields=PARCEL_ID,PARCELNO,CO_NO,DOR_UC,OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,PHY_CITY,PHY_ZIPCD,TOT_LVG_AR,ACT_YR_BLT&returnGeometry=false&resultRecordCount=1000&f=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = await res.json();
    const features = data.features || [];
    const records = [];

    for (const f of features) {
      const a = f.attributes;
      const rawParcelId = (a.PARCEL_ID || a.PARCELNO || "").trim();
      const rawOwner = (a.OWN_NAME || "").trim();
      const rawAddress = (a.PHY_ADDR1 || "").trim() || `${rawOwner} Commercial Site`;

      if (!rawParcelId || !rawOwner) continue;

      const dorUc = (a.DOR_UC || "011").trim();
      const { channel, category, description } = mapDorUseCode(dorUc);

      const sqft = a.TOT_LVG_AR && Number(a.TOT_LVG_AR) > 0 ? Number(a.TOT_LVG_AR) : null;
      const yearBuilt = a.ACT_YR_BLT && Number(a.ACT_YR_BLT) > 1850 ? Number(a.ACT_YR_BLT) : null;
      const tonnageRisk = deriveTonnageRisk(sqft);

      const city = (a.PHY_CITY || countySeat).trim();
      const zip = a.PHY_ZIPCD ? String(a.PHY_ZIPCD).padStart(5, "0").slice(0, 5) : null;

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
      });
    }

    return records;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`Error in bounded slice [${startOid}-${endOid}] for ${countyName}:`, err);
    return [];
  }
}

async function bulkUpsertParcels(rawParcels: any[]) {
  if (!rawParcels || rawParcels.length === 0) return { added: 0, updated: 0 };

  // Deduplicate within the batch to prevent Postgres 21000 ON CONFLICT duplicate error
  const uniqueMap = new Map<string, any>();
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

async function main() {
  console.log("=== Seeding County Parcel Registry ===");
  await ensureCountyParcelRegistrySeeded();
  console.log("Registry seeded.");

  console.log("\n=== Ingesting Priority Counties to Full Depth ===");
  const WINDOW_SIZE = 25000;

  for (const target of PRIORITY_COUNTIES) {
    const existingCountRes = await sql`
      SELECT count(*)::int as count FROM fl_parcels WHERE county = ${target.name}
    `;
    let currentCount = existingCountRes[0]?.count || 0;
    console.log(`\n${target.name} County: current ${currentCount} / target ${target.targetCount}`);

    let currOid = target.startOid;
    let totalSeen = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let windowSteps = 0;

    const startTime = Date.now();

    while (currentCount < target.targetCount && windowSteps < 15) {
      windowSteps++;
      const endOid = currOid + WINDOW_SIZE;
      console.log(`  Window ${windowSteps}: querying [${currOid} - ${endOid}]...`);

      const parcels = await fetchBoundedCommercialSlice(currOid, endOid, target.name, target.seat);

      if (parcels.length > 0) {
        totalSeen += parcels.length;
        const { added, updated } = await bulkUpsertParcels(parcels);
        totalAdded += added;
        totalUpdated += updated;

        const countRes = await sql`
          SELECT count(*)::int as count FROM fl_parcels WHERE county = ${target.name}
        `;
        currentCount = countRes[0]?.count || 0;
        console.log(`  Loaded ${parcels.length} records. County total now: ${currentCount} / ${target.targetCount}`);
      } else {
        console.log(`  No commercial parcels in slice [${currOid} - ${endOid}], stepping forward...`);
      }

      currOid = endOid;
      await new Promise((r) => setTimeout(r, 150));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`County ${target.name} complete: ${currentCount} commercial parcels (${duration}s).`);

    // Log collection run in fl_collection_jobs
    await sql`
      INSERT INTO fl_collection_jobs (
        job_type, target_source_id, county, layer,
        records_seen, records_added, records_updated,
        status, triggered_by, finished_at
      ) VALUES (
        'priority_parcel_full_depth',
        ${`cadastral_dor_${target.dorCode}`},
        ${target.name},
        'parcels',
        ${totalSeen},
        ${totalAdded},
        ${totalUpdated},
        'completed',
        'full_depth_ingestion_runner',
        CURRENT_TIMESTAMP
      )
    `;

    // Update registry status
    const isFull = currentCount >= target.targetCount;
    const regStatus = isFull ? "INGESTED" : "DIRECT_DOWNLOAD";

    await sql`
      UPDATE fl_county_parcel_registry
      SET 
        commercial_parcels_count = ${currentCount},
        status = ${regStatus},
        last_parcels_pull_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE county = ${target.name}
    `;
    console.log(`Registry updated for ${target.name}: status=${regStatus}, count=${currentCount}`);
  }

  console.log("\n=== Ingesting Ancillary Layers for Priority Counties ===");
  console.log("1. Ingesting DBPR Commercial Licenses...");
  await ensureDBPRLicensesIngested();

  console.log("2. Ingesting Commercial Permits...");
  await ensurePermitsIngested();

  console.log("3. Running Sunbiz Matching Pass...");
  const sunbiz = await runSunbizMatchingPass();
  console.log(`Sunbiz matching pass complete: ${sunbiz.matchedCount} matched.`);

  console.log("\n=== Priority Full-Depth Ingestion Successfully Finished ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
