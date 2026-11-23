import { sql } from "../src/lib/db";
import { getClientTerritoryOutreachTargets } from "../src/lib/client-outreach-engine";

async function verifyBaseline() {
  const parcels = await sql`SELECT count(*)::int as count FROM fl_parcels`;
  const networks = await sql`SELECT count(*)::int as count FROM fl_commercial_networks`;
  const licenses = await sql`SELECT count(*)::int as count FROM fl_licenses`;
  console.log("Raw table counts:", {
    parcels: parcels[0].count,
    networks: networks[0].count,
    licenses: licenses[0].count,
    total: parcels[0].count + networks[0].count + licenses[0].count,
  });

  const res = await getClientTerritoryOutreachTargets({});
  console.log("getClientTerritoryOutreachTargets baseline total:", res.total);
}

verifyBaseline()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
