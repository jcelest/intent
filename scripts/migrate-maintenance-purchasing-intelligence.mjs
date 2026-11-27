import { readFile } from "node:fs/promises";
import { sql } from "../src/lib/db.ts";

const migrationSql = await readFile(new URL("../migrations/019_statewide_maintenance_purchasing_intelligence.sql", import.meta.url), "utf8");
const statements = migrationSql
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) await sql.query(statement);
console.log(JSON.stringify({ ok: true, migration: "019_statewide_maintenance_purchasing_intelligence", statements: statements.length }));
