import { backfillOfficialParcelGeography, syncMappedParcelsToOpportunityHub } from "../src/lib/parcel-geography";

const pageSize = Number(process.argv.find((value) => value.startsWith("--page-size="))?.split("=")[1] || 1000);

async function main() {
  if (process.argv.includes("--sync-only")) {
    console.log("Synchronizing existing mapped parcels into the Opportunity Intelligence Hub...");
    console.log(JSON.stringify(await syncMappedParcelsToOpportunityHub(), null, 2));
    return;
  }
  console.log(`Backfilling official parcel centroids in pages of ${pageSize}...`);
  const result = await backfillOfficialParcelGeography({ pageSize });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
