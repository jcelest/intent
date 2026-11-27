import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL or POSTGRES_URL is required.");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const migrationPaths = [
  resolve(scriptDir, "..", "migrations", "009_universal_opportunity_hub.sql"),
  resolve(scriptDir, "..", "migrations", "010_opportunity_map_activation.sql"),
  resolve(scriptDir, "..", "migrations", "011_opportunity_operational_integrity.sql"),
  resolve(scriptDir, "..", "migrations", "012_opportunity_source_automation.sql"),
  resolve(scriptDir, "..", "migrations", "013_procurement_notification_inbox.sql"),
  resolve(scriptDir, "..", "migrations", "014_commercial_channel_coverage.sql"),
  resolve(scriptDir, "..", "migrations", "015_permit_property_screen.sql"),
  resolve(scriptDir, "..", "migrations", "016_management_firm_portfolios.sql"),
  resolve(scriptDir, "..", "migrations", "017_verified_management_relationships.sql"),
  resolve(scriptDir, "..", "migrations", "018_statewide_portfolio_acquisition.sql"),
  resolve(scriptDir, "..", "migrations", "019_statewide_maintenance_purchasing_intelligence.sql"),
];
const sql = neon(databaseUrl);

try {
  for (const migrationPath of migrationPaths) {
    const migrationSql = await readFile(migrationPath, "utf8");
    const statements = migrationSql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await sql.query(statement);
    }
  }
  console.log("Universal Opportunity Intelligence Hub migration completed successfully.");
} catch (error) {
  console.error("Opportunity Intelligence Hub migration failed:", error);
  process.exit(1);
}
