import test from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db.ts";
import { getAtlasData } from "../src/lib/opportunity-hub.ts";

test("Florida Property & Asset Management Firms Verification Suite", async (t) => {
  await t.test("1. fl_management_firms table schema and data integrity", async () => {
    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'fl_management_firms'
    `;
    const colNames = new Set(cols.map((c) => c.column_name));
    assert.ok(colNames.has("id"), "Must have id column");
    assert.ok(colNames.has("name"), "Must have name column");
    assert.ok(colNames.has("firm_type"), "Must have firm_type column");
    assert.ok(colNames.has("address"), "Must have address column");
    assert.ok(colNames.has("county"), "Must have county column");
    assert.ok(colNames.has("latitude"), "Must have latitude column");
    assert.ok(colNames.has("longitude"), "Must have longitude column");

    const countRow = await sql`SELECT count(*)::int AS count FROM fl_management_firms`;
    const count = countRow[0]?.count || 0;
    assert.ok(count > 0, "Must have active management firms in database");
  });

  await t.test("2. All management firms have valid Florida geographic coordinates", async () => {
    const invalidCoords = await sql`
      SELECT id, name, latitude, longitude
      FROM fl_management_firms
      WHERE latitude IS NULL
         OR longitude IS NULL
         OR latitude < 24
         OR latitude > 32
         OR longitude < -88
         OR longitude > -79
    `;
    assert.strictEqual(
      invalidCoords.length,
      0,
      `All firms must have valid Florida coordinates. Invalid: ${JSON.stringify(invalidCoords)}`
    );
  });

  await t.test("3. Atlas data returns management portfolios on map", async () => {
    const result = await getAtlasData({ layers: ["portfolios"] });
    assert.ok(result?.features, "Must return GeoJSON FeatureCollection");
    const portfolioFeatures = result.features.filter(
      (f) => f.properties?.featureType === "portfolio" || f.id?.startsWith("portfolio:")
    );
    assert.ok(portfolioFeatures.length > 0, "Must return portfolio features for Atlas map");

    for (const f of portfolioFeatures.slice(0, 10)) {
      assert.strictEqual(f.geometry.type, "Point");
      assert.ok(Array.isArray(f.geometry.coordinates));
      const [lng, lat] = f.geometry.coordinates;
      assert.ok(lat >= 24 && lat <= 32, "Latitude must be within Florida bounds");
      assert.ok(lng >= -88 && lng <= -79, "Longitude must be within Florida bounds");
      assert.ok(f.properties.title, "Must have title property");
      assert.ok(f.properties.address, "Must have address property");
    }
  });

  await t.test("4. Licensed Community Association Management (CAB) firms verification", async () => {
    const cabFirms = await sql`
      SELECT name, license_number, county, city, address
      FROM fl_management_firms
      WHERE license_number LIKE 'CAB%'
    `;
    assert.ok(cabFirms.length > 0, "Must include licensed Florida DBPR CAB firms");
    for (const firm of cabFirms) {
      assert.ok(firm.license_number.startsWith("CAB"), "Must have valid CAB license number");
      assert.ok(firm.address, "Must have physical headquarters address");
      assert.ok(firm.city, "Must have city");
      assert.ok(firm.county, "Must have county");
    }
  });
});
