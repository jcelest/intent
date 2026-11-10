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
const migrationPath = resolve(scriptDir, "..", "migrations", "001_trade_demand.sql");
const migrationSql = await readFile(migrationPath, "utf8");
const sql = neon(databaseUrl);

try {
  const statements = migrationSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log("Trade Demand migration completed.");
} catch (error) {
  console.error("Trade Demand migration failed:", error);
  process.exit(1);
}
