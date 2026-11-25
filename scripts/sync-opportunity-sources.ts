import { fetchPendingOpportunityDocuments, requeueFailedOpportunityDocuments } from "../src/lib/opportunity-documents";
import { resetOpportunitySourceCursors, syncDueOpportunitySources } from "../src/lib/opportunity-live-sources";

const force = process.argv.includes("--force");
const documentsOnly = process.argv.includes("--documents-only");
const retryFailed = process.argv.includes("--retry-failed");
const resetCursors = process.argv.includes("--reset-cursors");
const adapterArg = process.argv.find((value) => value.startsWith("--adapters="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const documentSourcesArg = process.argv.find((value) => value.startsWith("--document-sources="));
const adapters = adapterArg?.split("=")[1].split(",").filter(Boolean);
const documentSources = documentSourcesArg?.split("=")[1].split(",").filter(Boolean);
const limit = Number(limitArg?.split("=")[1] || 250);

async function main() {
  if (resetCursors && !adapters?.length) throw new Error("--reset-cursors requires an explicit --adapters list");
  const cursorsReset = resetCursors ? await resetOpportunitySourceCursors(adapters || []) : 0;
  const requeued = retryFailed ? await requeueFailedOpportunityDocuments(documentSources) : 0;
  const sources = documentsOnly ? null : await syncDueOpportunitySources({
    force, adapters, limitPerSource: Math.min(1000, Math.max(1, limit)),
  });
  const documents = await fetchPendingOpportunityDocuments({
    limit: Math.min(100, Math.max(1, Math.ceil(limit / 10))),
    maxPerSource: 20,
    sourceIds: documentSources,
  });
  console.log(JSON.stringify({ sources, cursorsReset, requeued, documents }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
