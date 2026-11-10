import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyPermitTrade,
  clientMatch,
  isExpiredBid,
  manualProjectGroupKey,
  permitProjectGroupKey,
  rankOpportunity,
  validateManualOpportunity,
} from "../src/lib/trade-demand-core.ts";

test("classifies Orlando permit application types conservatively", () => {
  assert.equal(classifyPermitTrade({ application_type: "Mechanical Permit" }), "hvac");
  assert.equal(classifyPermitTrade({ application_type: "Electrical" }), "electrical");
  assert.equal(classifyPermitTrade({ application_type: "Plumbing" }), "plumbing");
  assert.equal(classifyPermitTrade({ application_type: "Building Permit", project_name: "Retail reroof" }), "roofing");
  assert.equal(classifyPermitTrade({ application_type: "Building Permit", project_name: "New retail shell" }), null);
});

test("does not treat vendor intake or permits as open bids", () => {
  const vendorErrors = validateManualOpportunity({
    buyerName: "Builder",
    tradeSlug: "electrical",
    projectName: "Project",
    evidenceType: "vendor_intake",
    evidenceExcerpt: "Apply to become a vendor.",
    sourceUrl: "https://example.com/vendors",
    bidOpen: true,
    acceptingSubmissionsConfirmed: true,
  });
  assert.ok(vendorErrors.some((error) => error.includes("Only a published bid")));

  const unconfirmedBidErrors = validateManualOpportunity({
    buyerName: "GC",
    tradeSlug: "electrical",
    projectName: "Project",
    evidenceType: "published_bid",
    evidenceExcerpt: "Electrical scope is listed.",
    sourceUrl: "https://example.com/bid",
    bidOpen: true,
    acceptingSubmissionsConfirmed: false,
  });
  assert.ok(unconfirmedBidErrors.some((error) => error.includes("accepting submissions")));
});

test("ranks confirmed demand above open bids and permits", () => {
  const confirmed = rankOpportunity({ evidenceType: "buyer_confirmed" });
  const openBid = rankOpportunity({ evidenceType: "published_bid", bidOpen: true });
  const permit = rankOpportunity({ evidenceType: "permit_activity" });
  assert.ok(confirmed.score > openBid.score);
  assert.ok(openBid.score > permit.score);
  assert.match(permit.reason, /does not prove|must be verified|verify/i);
});

test("expires only open published bids with passed deadlines", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(isExpiredBid({ evidenceType: "published_bid", bidOpen: true, deadline: "2026-11-08T12:00:00Z" }, now), true);
  assert.equal(isExpiredBid({ evidenceType: "published_bid", bidOpen: false, deadline: "2026-11-08T12:00:00Z" }, now), false);
  assert.equal(isExpiredBid({ evidenceType: "permit_activity", bidOpen: true, deadline: "2026-11-08T12:00:00Z" }, now), false);
});

test("groups related project evidence without collapsing trades", () => {
  const permitGroup = permitProjectGroupKey({ parcel_number: "123", project_name: "Lake Nona Retail" });
  const samePermitGroup = permitProjectGroupKey({ parcel_number: "123", project_name: "Lake Nona Retail", application_type: "Electrical" });
  assert.equal(permitGroup, samePermitGroup);

  const manualGroup = manualProjectGroupKey({
    buyerName: "GC",
    tradeSlug: "electrical",
    projectName: "Lake Nona Retail",
    address: "1 Main St",
    evidenceType: "published_bid",
    evidenceExcerpt: "Scope",
    sourceUrl: "https://example.com",
  });
  assert.ok(manualGroup.includes("gc"));
});

test("client matching reports missing profile dimensions", () => {
  const result = clientMatch({
    opportunity: { tradeSlug: "electrical", city: "Orlando", county: "Orange", jobType: "commercial" },
    client: { trades: ["electrical"], serviceAreas: ["Orange"], jobTypes: [], capacityNotes: null, qualifications: [] },
  });
  assert.ok(result.score >= 70);
  assert.deepEqual(result.missing.sort(), ["capacity", "job types"]);
});

test("migration enforces idempotent source records and separates notes", async () => {
  const migration = await readFile(new URL("../migrations/001_trade_demand.sql", import.meta.url), "utf8");
  assert.match(migration, /UNIQUE \(source_system, source_record_id\)/);
  assert.match(migration, /staff_notes TEXT/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS trade_demand_activities/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS trade_demand_assignments/);
});
