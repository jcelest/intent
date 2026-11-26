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
  assert.equal(calculatePortfolioSummary({ ...empty, parcelsMatchedByMailingAddress: 99 }).portfolioTier, "UNDER_100");
  assert.equal(calculatePortfolioSummary({ ...empty, permitPropertiesTrailing12mo: 100 }).portfolioTier, "FROM_100_TO_300");
  assert.equal(calculatePortfolioSummary({ ...empty, associationUnitsTotal: 300 }).portfolioTier, "FROM_100_TO_300");
  assert.equal(calculatePortfolioSummary({ ...empty, associationUnitsTotal: 301 }).portfolioTier, "OVER_300");
});

test("claimed doors never increase the verified floor", () => {
  const summary = calculatePortfolioSummary({ ...empty, parcelsMatchedByMailingAddress: 20, claimedDoors: 900 });
  assert.equal(summary.portfolioFloor, 20);
  assert.equal(summary.portfolioTier, "UNDER_100");
});

test("eviction filings widen the estimated range without changing the floor", () => {
  const summary = calculatePortfolioSummary({ ...empty, parcelsMatchedByMailingAddress: 50, evictionFilingsTrailing12mo: 24 });
  assert.equal(summary.portfolioFloor, 50);
  assert.equal(summary.portfolioRangeLow, 300);
  assert.equal(summary.portfolioRangeHigh, 800);
  assert.equal(summary.portfolioTier, "UNDER_100");
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
