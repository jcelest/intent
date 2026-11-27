import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePortfolioSummary,
  mailingAddressMatchesFirm,
  normalizeFirmName,
  permitNamesMatchFirm,
} from "../src/lib/management-firm-portfolios.ts";

const empty = {
  parcelsMatchedByMailingAddress: null,
  evictionFilingsTrailing12mo: null,
  permitPropertiesTrailing12mo: null,
  sunbizAssociationsManaged: null,
  associationUnitsTotal: null,
  claimedDoors: null,
};

test("no evidence remains UNKNOWN and never renders as zero", () => {
  assert.deepEqual(calculatePortfolioSummary(empty), {
    portfolioFloor: null,
    portfolioRangeLow: null,
    portfolioRangeHigh: null,
    portfolioTier: "UNKNOWN",
  });
});

test("verified layers set the floor and exact tier boundaries", () => {
  assert.equal(calculatePortfolioSummary({ ...empty, verifiedManagedProperties: 99 }).portfolioTier, "UNDER_100");
  assert.equal(calculatePortfolioSummary({ ...empty, verifiedAssociationUnits: 100 }).portfolioTier, "FROM_100_TO_300");
  assert.equal(calculatePortfolioSummary({ ...empty, verifiedAssociationUnits: 300 }).portfolioTier, "FROM_100_TO_300");
  assert.equal(calculatePortfolioSummary({ ...empty, verifiedAssociationUnits: 301 }).portfolioTier, "OVER_300");
});

test("claimed doors never increase the verified floor", () => {
  const summary = calculatePortfolioSummary({ ...empty, verifiedManagedProperties: 20, claimedDoors: 900 });
  assert.equal(summary.portfolioFloor, 20);
  assert.equal(summary.portfolioTier, "UNDER_100");
});

test("mailing, permit, eviction, and self-reported signals never establish a verified floor", () => {
  const summary = calculatePortfolioSummary({
    ...empty,
    parcelsMatchedByMailingAddress: 500,
    permitPropertiesTrailing12mo: 300,
    evictionFilingsTrailing12mo: 24,
    claimedDoors: 900,
  });
  assert.equal(summary.portfolioFloor, null);
  assert.equal(summary.portfolioRangeLow, null);
  assert.equal(summary.portfolioRangeHigh, null);
  assert.equal(summary.portfolioTier, "UNKNOWN");
});

test("mailing joins require the same normalized street and ZIP", () => {
  assert.equal(mailingAddressMatchesFirm("4767 NEW BROAD ST, ORLANDO FL 32814", "4767 New Broad Street", "32814"), true);
  assert.equal(mailingAddressMatchesFirm("4767 NEW BROAD ST, ORLANDO FL 32815", "4767 New Broad Street", "32814"), false);
});

test("permit contacts match normalized legal names but not unrelated text", () => {
  assert.equal(normalizeFirmName("Verandah Properties, LLC"), "VERANDAH PROPERTIES");
  assert.equal(permitNamesMatchFirm({ applicant_name: "Verandah Properties LLC" }, "VERANDAH PROPERTIES, LLC"), true);
  assert.equal(permitNamesMatchFirm({ contractor_name: "Verandah Properties LLC" }, "VERANDAH PROPERTIES, LLC"), false);
});
