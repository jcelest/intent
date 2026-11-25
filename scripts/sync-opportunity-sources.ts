import { fetchPendingOpportunityDocuments } from "../src/lib/opportunity-documents";
import { syncDueOpportunitySources } from "../src/lib/opportunity-live-sources";

const force = process.argv.includes("--force");
const documentsOnly = process.argv.includes("--documents-only");
const adapterArg = process.argv.find((value) => value.startsWith("--adapters="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const adapters = adapterArg?.split("=")[1].split(",").filter(Boolean);
const limit = Number(limitArg?.split("=")[1] || 250);

async function main() {
  const sources = documentsOnly ? null : await syncDueOpportunitySources({
    force, adapters, limitPerSource: Math.min(1000, Math.max(1, limit)),
  });
  const documents = await fetchPendingOpportunityDocuments(Math.min(100, Math.max(1, Math.ceil(limit / 10))));
  console.log(JSON.stringify({ sources, documents }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
