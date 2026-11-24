import test from "node:test";
import assert from "node:assert/strict";

import {
  parseCensusBatchResponse,
  parseCsv,
  selectCurrentFloridaCabFirms,
} from "../scripts/sync-florida-management-firms.ts";

test("CSV parser preserves commas and escaped quotes", () => {
  const rows = parseCsv('"38","CAB","ACME, INC","A ""GOOD"" FIRM"\r\n');
  assert.deepEqual(rows, [["38", "CAB", "ACME, INC", 'A "GOOD" FIRM']]);
});

test("DBPR selection keeps current Florida CAB firms with mappable street addresses", () => {
  const current = [
    "38", "CAB", "SENTRY MANAGEMENT INC", "", "", "2180 W SR 434", "STE 5000", "",
    "LONGWOOD", "FL", "32779", "69", "0000014", "C", "", "03/30/2009", "10/09/2015",
    "09/30/2027", "", "", "CAB14", "",
  ];
  const poBox = [...current];
  poBox[5] = "PO BOX 123";
  poBox[20] = "CAB15";
  const outOfState = [...current];
  outOfState[9] = "GA";
  outOfState[20] = "CAB16";
  const inactivePrimary = [...current];
  inactivePrimary[13] = "S";
  inactivePrimary[20] = "CAB17";

  const firms = selectCurrentFloridaCabFirms([current, poBox, outOfState, inactivePrimary]);
  assert.equal(firms.length, 1);
  assert.equal(firms[0].licenseNumber, "CAB14");
  assert.equal(firms[0].county, "Seminole");
  assert.equal(firms[0].address, "2180 W SR 434 STE 5000");
});

test("Census response parser accepts Florida matches and rejects invalid coordinates", () => {
  const response = [
    '"CAB14","2180 W SR 434, LONGWOOD, FL, 32779","Match","Non_Exact","2180 STATE HWY 434, LONGWOOD, FL, 32779","-81.395701864775,28.686740068911","93781392","L"',
    '"CAB15","PO BOX 1, ORLANDO, FL, 32801","No_Match","","","","",""',
    '"CAB16","1 MAIN ST, ATLANTA, GA, 30303","Match","Exact","1 MAIN ST, ATLANTA, GA, 30303","-84.3,33.7","1","L"',
  ].join("\n");
  const matches = parseCensusBatchResponse(response);
  assert.equal(matches.size, 1);
  assert.equal(matches.get("CAB14")?.matchType, "Non_Exact");
  assert.equal(matches.get("CAB14")?.latitude, 28.686740068911);
});
