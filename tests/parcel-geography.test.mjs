import test from "node:test";
import assert from "node:assert/strict";
import { isFloridaCoordinate, parseParcelCentroid } from "../src/lib/parcel-geography-validation.ts";

test("accepts official Florida parcel centroids and preserves source traceability", () => {
  const centroid = parseParcelCentroid({
    attributes: { OBJECTID: 6705497, PARCEL_ID: "29-22-26-0000-00-011" },
    centroid: { x: -81.3799, y: 28.5393 },
  });
  assert.deepEqual(centroid, {
    parcelId: "29-22-26-0000-00-011",
    latitude: 28.5393,
    longitude: -81.3799,
    sourceObjectId: 6705497,
    sourceUrl: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/6705497",
  });
});

test("rejects missing identifiers and coordinates outside Florida", () => {
  assert.equal(parseParcelCentroid({ attributes: { OBJECTID: 1 }, centroid: { x: -81.3, y: 28.5 } }), null);
  assert.equal(parseParcelCentroid({ attributes: { OBJECTID: 1, PARCEL_ID: "x" }, centroid: { x: -74, y: 40.7 } }), null);
  assert.equal(isFloridaCoordinate(40.7, -74), false);
});
