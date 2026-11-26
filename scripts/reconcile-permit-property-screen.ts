import { reconcileOrlandoPermitPropertyClassifications } from "../src/lib/permit-property-screen";

async function main() {
  const result = await reconcileOrlandoPermitPropertyClassifications({ batchSize: 250, maxRecords: 20_000 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

