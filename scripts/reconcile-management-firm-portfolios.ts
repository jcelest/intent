import { reconcileManagementFirmPortfolios } from "@/lib/management-firm-portfolios";

async function main() {
  const result = await reconcileManagementFirmPortfolios();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
