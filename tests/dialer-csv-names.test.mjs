import test from "node:test";
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";

test("Lead name extraction and backfill verification", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(databaseUrl);

  // 1. Verify that leads with 'all_csv_fields' containing 'Ask for (licensee/qualifier)' have first_name populated
  const sample = await sql`
    SELECT id, first_name, last_name, company, metadata->'all_csv_fields'->>'Ask for (licensee/qualifier)' as ask_for
    FROM dialer_leads
    WHERE metadata->'all_csv_fields'->>'Ask for (licensee/qualifier)' IS NOT NULL
    LIMIT 10
  `;

  assert.ok(sample.length > 0, "Expected to find leads with Ask for column");
  for (const row of sample) {
    assert.ok(row.first_name || row.last_name, `Expected lead ${row.id} (${row.company}) to have first_name or last_name populated`);
  }

  // 2. Verify total count of leads with 'Ask for' that still have NULL names is 0
  const nullCount = await sql`
    SELECT COUNT(*)::int as count
    FROM dialer_leads
    WHERE metadata->'all_csv_fields'->>'Ask for (licensee/qualifier)' IS NOT NULL
      AND first_name IS NULL
      AND last_name IS NULL
  `;
  assert.equal(nullCount[0].count, 0, "No leads with Ask for should have NULL first_name and last_name");
});
