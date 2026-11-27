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

test("verification priority is geographically and commercially neutral", () => {
  assert.equal(verificationPriority("property_managers", "Osceola"), 100);
  assert.equal(verificationPriority("cam_firms", "Santa Rosa"), 100);
  assert.equal(verificationPriority("restoration", "Liberty"), 100);
});
