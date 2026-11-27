import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required");

const migrationSql = await readFile(new URL("../migrations/018_statewide_portfolio_acquisition.sql", import.meta.url), "utf8");
const statements = migrationSql
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);
const sql = neon(databaseUrl);

for (const statement of statements) await sql.query(statement);
console.log(JSON.stringify({ ok: true, migration: "018_statewide_portfolio_acquisition", statements: statements.length }));
