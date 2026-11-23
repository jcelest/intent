import { sql } from "../src/lib/db";

async function check() {
  const parcels = await sql`
    SELECT county, count(*)::int as count 
    FROM fl_parcels 
    GROUP BY county 
    ORDER BY count DESC 
    LIMIT 15
  `;
  console.log("Top parcel counties:", parcels);

  const regStatus = await sql`
    SELECT status, count(*)::int as count 
    FROM fl_county_parcel_registry 
    GROUP BY status
  `;
  console.log("Registry status counts:", regStatus);

  const queueCounts = await sql`
    SELECT layer, status, count(*)::int as count 
    FROM fl_ingestion_queue 
    GROUP BY layer, status
  `;
  console.log("Queue counts:", queueCounts);

  const totalParcels = await sql`SELECT count(*)::int as total FROM fl_parcels`;
  console.log("Total commercial parcels:", totalParcels[0].total);
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
