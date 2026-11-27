import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePropertyName,
  parseCsv,
  parseEtheridgeAssociations,
  parseNfiAssociations,
  propertySimilarity,
} from "../src/lib/management-portfolio-collectors.ts";

test("DBPR CSV parser preserves quoted addresses and managing entity fields", () => {
  const rows = parseCsv('"Project Number","Condo Name","County","Units","Managing Entity Name"\n"PR1","Bay Club, A Condo","Escambia","112","Example Management, Inc."\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Condo Name"], "Bay Club, A Condo");
  assert.equal(rows[0]["Managing Entity Name"], "Example Management, Inc.");
});

test("published portfolio parsers extract associations without treating accounting-only work as full management", () => {
  const etheridge = parseEtheridgeAssociations(`
    <h4><span>Airway Oaks</span></h4><h4><span>Santa Rosa County</span></h4><p>Managed by: Ashley</p>
    <h4><span>Baybridge Villas (acct only)</span></h4><h4><span>Santa Rosa County</span></h4><p>Accounting Only</p>
  `);
  assert.deepEqual(etheridge.map((row) => [row.name, row.county, row.accountingOnly]), [
    ["Airway Oaks", "Santa Rosa", false],
    ["Baybridge Villas (acct only)", "Santa Rosa", true],
  ]);

  const nfi = parseNfiAssociations(`
    <h1>Managed HOAs</h1>
    <a href="/airway-oaks">Airway Oaks Homeowners Association, Inc.</a>
    <a href="/contact">Contact Us</a>
    NFI Property Management Solutions 7139 N 9th Ave
  `);
  assert.equal(nfi.length, 1);
  assert.equal(nfi[0].name, "Airway Oaks Homeowners Association, Inc.");
});

test("association normalization supports conservative DBPR-to-website corroboration", () => {
  assert.equal(normalizePropertyName("Bahama Bay Club Townhomes Condominium Association, Inc."), "BAHAMA BAY CLUB TOWNHOMES");
  assert.ok(propertySimilarity("Spyglass Point, A Condo", "Spyglass Point") >= 0.82);
  assert.ok(propertySimilarity("Unrelated Harbor", "Spyglass Point") < 0.82);
});
