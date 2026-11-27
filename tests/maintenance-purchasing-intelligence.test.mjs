import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyPortfolioRelationship,
  MAINTENANCE_TRADES,
  PORTFOLIO_TYPES,
} from "../src/lib/maintenance-purchasing-intelligence.ts";

test("authoritative relationship types remain distinct", () => {
  assert.deepEqual(classifyPortfolioRelationship({ propertyKind: "multifamily_property" }), ["multifamily"]);
  assert.deepEqual(classifyPortfolioRelationship({ propertyKind: "commercial_location", commercialClassification: "commercial" }), ["commercial"]);
  assert.deepEqual(classifyPortfolioRelationship({ propertyKind: "condominium_unit", sourceKey: "dbpr-condominiums" }), ["condominium"]);
  assert.deepEqual(classifyPortfolioRelationship({ propertyKind: "association", sourceKey: "published-associations" }), ["hoa"]);
});

test("unknown and indirect data never invent a portfolio type", () => {
  assert.deepEqual(classifyPortfolioRelationship({ sourceKey: "mailing-address-match", metadata: { reviews: 500 } }), []);
  assert.ok(PORTFOLIO_TYPES.includes("single_family_rental"));
  assert.ok(MAINTENANCE_TRADES.includes("building_automation"));
});
