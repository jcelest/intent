import { pathToFileURL } from "node:url";
import {
  getChannelCoverageReport,
  processChannelVerificationQueue,
  refreshDirectAccountCoverage,
  syncDbprCommercialChannels,
} from "../src/lib/commercial-channel-intelligence";

async function run() {
  const verifyArgument = process.argv.find((argument) => argument.startsWith("--verify="));
  const verifyLimit = verifyArgument ? Number(verifyArgument.split("=", 2)[1]) : 0;
  const dbpr = await syncDbprCommercialChannels();
  await refreshDirectAccountCoverage();
  const verification = verifyLimit > 0
    ? await processChannelVerificationQueue(Math.min(verifyLimit, 100))
    : null;
  const coverage = await getChannelCoverageReport();
  console.log(JSON.stringify({ dbpr, verification, coverage }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
