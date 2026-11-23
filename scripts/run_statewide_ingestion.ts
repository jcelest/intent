import { ingestAll67Counties, getContinuousIngestionStatus } from "../src/lib/statewide-cadastral-collector";
import { runSunbizMatchingPass } from "../src/lib/sunbiz-matcher";

async function main() {
  console.log("=== INITIATING STATEWIDE COMMERCIAL INGESTION FOR ALL 67 FLORIDA COUNTIES ===");
  const t0 = Date.now();

  const result = await ingestAll67Counties(25);
  console.log(`\nIngestion complete in ${((Date.now() - t0) / 1000).toFixed(1)}s!`);
  console.log(`Total Counties Ingested: ${result.totalCounties}`);
  console.log(`Total Records Seen: ${result.totalRecordsSeen}`);
  console.log(`Total Records Added: ${result.totalAdded}`);
  console.log(`Total Records Updated: ${result.totalUpdated}`);

  console.log("\nRunning Sunbiz entity matching pass on newly ingested parcels...");
  const sunbiz = await runSunbizMatchingPass();
  console.log(`Sunbiz Matching: Matched=${sunbiz.matchedCount}, Unmatched=${sunbiz.unmatchedCount}`);

  const status = await getContinuousIngestionStatus();
  console.log(`\nStatewide County Coverage: ${status.totalCountiesCovered} of 67 counties active in database.`);
  console.log(`Top 10 counties by volume:`);
  console.log(status.countiesCoverage.slice(0, 10));

  process.exit(0);
}

main().catch(err => {
  console.error("Statewide ingestion failed:", err);
  process.exit(1);
});
