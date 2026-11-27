import { syncManagementPortfolioSources } from "@/lib/management-portfolio-collectors";
import { reconcileManagementFirmPortfolios } from "@/lib/management-firm-portfolios";

async function main() {
  const force = process.argv.includes("--force");
  const countiesArg = process.argv.find((argument) => argument.startsWith("--counties="));
  const counties = countiesArg
    ? countiesArg.slice("--counties=".length).split(",").map((county) => county.trim()).filter(Boolean)
    : ["Escambia", "Santa Rosa"];
  const collection = await syncManagementPortfolioSources({ force, counties });
  const reconciliation = await reconcileManagementFirmPortfolios();
  console.log(JSON.stringify({ collection, reconciliation }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
