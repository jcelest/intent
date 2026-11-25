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
