import test from "node:test";
import assert from "node:assert/strict";

import {
  parseDbprLicenseRows,
  parseDelimitedCsv,
  verificationPriority,
} from "../src/lib/commercial-channel-intelligence.ts";

test("DBPR channel parser preserves source identifiers and missing fields", () => {
  const csv = '"38","CAB","ACME ASSOCIATION MANAGEMENT","ACME CAM","","100 MAIN ST","","","ORLANDO","FL","32801","58","0000123","C","","01/01/2020","01/01/2026","09/30/2028","","","CAB123",""\n';
  const parsed = parseDbprLicenseRows(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].licenseNumber, "CAB123");
  assert.equal(parsed[0].county, "Orange");
  assert.equal(parsed[0].address, "100 MAIN ST");
  assert.equal(parsed[0].dba, "ACME CAM");
});

test("CSV parser preserves quoted commas without inventing values", () => {
  assert.deepEqual(parseDelimitedCsv('"A, INC","","FL"\n'), [["A, INC", "", "FL"]]);
});

test("verification priority follows the authorized county and channel order", () => {
  assert.ok(verificationPriority("property_managers", "Osceola") < verificationPriority("property_managers", "Orange"));
  assert.ok(verificationPriority("property_managers", "Santa Rosa") < verificationPriority("cam_firms", "Osceola"));
  assert.ok(verificationPriority("cam_firms", "Santa Rosa") < verificationPriority("restoration", "Osceola"));
});
