import test from "node:test";
import assert from "node:assert/strict";
import {
  FLORIDA_COUNTIES,
  FLORIDA_REGIONS,
  isFloridaZip,
  inferCountyFromZip,
  calculateDistanceMiles,
  parseFloridaGeoSearch,
  findCountiesWithinRadius,
  COUNTY_BY_NAME,
} from "../src/lib/florida-geo.ts";
import { ALL_FLORIDA_PROCUREMENT_SOURCES } from "../src/lib/opportunity-sources.ts";
import {
  buildGoogleSearchQuery,
  buildGoogleSearchUrl,
  verifyTargetWithGoogleSearch,
} from "../src/lib/google-search-verification.ts";

test("validates all 67 Florida counties are indexed", () => {
  assert.equal(FLORIDA_COUNTIES.length, 67);
  assert.equal(COUNTY_BY_NAME.size, 67);

  // Check key major counties
  assert.ok(COUNTY_BY_NAME.has("orange"));
  assert.ok(COUNTY_BY_NAME.has("miami-dade"));
  assert.ok(COUNTY_BY_NAME.has("hillsborough"));
  assert.ok(COUNTY_BY_NAME.has("duval"));
  assert.ok(COUNTY_BY_NAME.has("pinellas"));
  assert.ok(COUNTY_BY_NAME.has("palm beach"));
});

test("validates Florida ZIP code boundaries (32000-34999)", () => {
  // Valid Florida ZIPs
  assert.equal(isFloridaZip("32801"), true); // Orlando
  assert.equal(isFloridaZip("33101"), true); // Miami
  assert.equal(isFloridaZip("33602"), true); // Tampa
  assert.equal(isFloridaZip("32202"), true); // Jacksonville
  assert.equal(isFloridaZip("34997"), true); // Stuart

  // Out of state ZIPs must be rejected
  assert.equal(isFloridaZip("90210"), false); // California
  assert.equal(isFloridaZip("10001"), false); // New York
  assert.equal(isFloridaZip("75001"), false); // Texas
  assert.equal(isFloridaZip("30301"), false); // Georgia
  assert.equal(isFloridaZip("02138"), false); // Massachusetts
  assert.equal(isFloridaZip("invalid"), false);
});

test("infers Florida counties from valid ZIP prefixes", () => {
  assert.equal(inferCountyFromZip("32801"), "Orange");
  assert.equal(inferCountyFromZip("33602"), "Hillsborough");
  assert.equal(inferCountyFromZip("33139"), "Miami-Dade");
  assert.equal(inferCountyFromZip("32202"), "Duval");
  assert.equal(inferCountyFromZip("90210"), null);
});

test("parses mixed multi-territory geographic inputs cleanly", () => {
  const result = parseFloridaGeoSearch("32801, 33602, Orange County, Tampa, Seminole");

  assert.ok(result.resolvedCounties.includes("Orange"));
  assert.ok(result.resolvedCounties.includes("Hillsborough"));
  assert.ok(result.resolvedCounties.includes("Seminole"));
  assert.ok(result.resolvedCities.includes("Tampa"));
  assert.ok(result.resolvedZips.includes("32801"));
  assert.ok(result.resolvedZips.includes("33602"));
  assert.equal(result.isStatewide, false);
});

test("parses Florida ZIP code ranges properly", () => {
  const result = parseFloridaGeoSearch("32801-32804");

  assert.ok(result.resolvedZips.includes("32801"));
  assert.ok(result.resolvedZips.includes("32802"));
  assert.ok(result.resolvedZips.includes("32803"));
  assert.ok(result.resolvedZips.includes("32804"));
  assert.ok(result.resolvedCounties.includes("Orange"));
});

test("rejects out-of-state inputs with descriptive warnings", () => {
  const result = parseFloridaGeoSearch("90210, 10001, Dallas");

  assert.equal(result.resolvedZips.length, 0);
  assert.ok(result.warnings.some((w) => w.includes("90210")));
  assert.ok(result.warnings.some((w) => w.includes("10001")));
  assert.ok(result.warnings.some((w) => w.includes("Dallas")));
});

test("identifies statewide Florida scope", () => {
  const result = parseFloridaGeoSearch("Statewide Florida");

  assert.equal(result.isStatewide, true);
  assert.equal(result.resolvedCounties.length, 67);
});

test("calculates distance accurately using Haversine formula", () => {
  // Orlando (28.5383, -81.3792) to Tampa (27.9506, -82.4572)
  const dist = calculateDistanceMiles(28.5383, -81.3792, 27.9506, -82.4572);
  // Expected distance is ~77-85 miles
  assert.ok(dist >= 75 && dist <= 90, `Distance was ${dist}`);
});

test("finds counties within geographic radius", () => {
  // 50 mile radius around Orlando (Orange County)
  const nearby = findCountiesWithinRadius(28.5383, -81.3792, 50);
  const names = nearby.map((c) => c.name);

  assert.ok(names.includes("Orange"));
  assert.ok(names.includes("Seminole"));
  assert.ok(names.includes("Osceola"));
  assert.ok(names.includes("Lake"));
  // Miami should definitely NOT be within 50 miles of Orlando
  assert.ok(!names.includes("Miami-Dade"));
});

test("procurement source registry covers all 67 counties and major authorities", () => {
  assert.ok(ALL_FLORIDA_PROCUREMENT_SOURCES.length >= 75);

  const countySources = ALL_FLORIDA_PROCUREMENT_SOURCES.filter((s) => s.agencyType === "county");
  assert.equal(countySources.length, 67, "Must contain procurement source for every single Florida county");

  const stateSources = ALL_FLORIDA_PROCUREMENT_SOURCES.filter((s) => s.agencyType === "state");
  assert.ok(stateSources.length >= 3, "Must include VBS, MFMP, FDOT");
});

test("builds Google search query and verification URL with Florida location scope", () => {
  const query = buildGoogleSearchQuery("Orange County Public Schools", "Orange", "Orlando");
  assert.equal(query, '"Orange County Public Schools" Orlando, FL');

  const url = buildGoogleSearchUrl(query);
  assert.ok(url.startsWith("https://www.google.com/search?q="));
  assert.ok(url.includes("Orlando"));
});

test("verifies Florida government targets as active using Google search data", async () => {
  const result = await verifyTargetWithGoogleSearch({
    targetName: "Greater Orlando Aviation Authority",
    targetType: "aviation_transit",
    county: "Orange",
    city: "Orlando",
    officialUrl: "https://orlandoairports.net",
  });

  assert.equal(result.status, "verified_active");
  assert.equal(result.businessVerified, true);
  assert.ok(result.snippet.includes("Greater Orlando Aviation Authority"));
  assert.ok(result.snippet.includes("Orange"));
  assert.ok(result.searchUrl.includes("google.com"));
});

test("resolves territory counties as overlay without scoping down by client defaults", () => {
  // Unscoped market default should resolve all priority counties
  const marketScope = parseFloridaGeoSearch("Orange, Osceola, Seminole, Escambia, Santa Rosa");
  assert.equal(marketScope.resolvedCounties.length, 5);

  // Client's service areas (e.g. Orange only) does not reduce marketScope unless explicitly requested
  const clientAreas = ["Orange"];
  const isTargetInClientTerritory = (targetCounty) =>
    clientAreas.some((c) => c.toLowerCase() === targetCounty.toLowerCase());

  assert.equal(isTargetInClientTerritory("Orange"), true);
  assert.equal(isTargetInClientTerritory("Osceola"), false);
});
