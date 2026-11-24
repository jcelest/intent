import test from "node:test";
import assert from "node:assert/strict";
import { opportunityFingerprint, validateCanonicalOpportunity } from "../src/lib/opportunity-validation.ts";

const validRecord = {
  sourceRecordId: "official-123",
  title: "Published mechanical maintenance solicitation",
  tradeSlug: "hvac",
  classification: "confirmed",
  status: "active",
  geographicScopeType: "county",
  county: "Orange",
  evidenceConfidence: 95,
  classificationRationale: "An official source documents an active solicitation.",
  sourceUrl: "https://example.gov/procurement/official-123",
};

test("canonical opportunity validation accepts a traceable confirmed record", () => {
  assert.deepEqual(validateCanonicalOpportunity(validRecord), []);
});

test("canonical opportunity validation rejects unsupported estimates and partial coordinates", () => {
  const errors = validateCanonicalOpportunity({ ...validRecord, estimatedValue: 500000, latitude: 28.5 });
  assert.ok(errors.includes("estimated values require a methodology"));
  assert.ok(errors.includes("latitude and longitude must be supplied together"));
});

test("canonical opportunity validation rejects low-confidence confirmed demand", () => {
  const errors = validateCanonicalOpportunity({ ...validRecord, evidenceConfidence: 55 });
  assert.ok(errors.some((error) => error.includes("confirmed records below 75")));
});

test("opportunity fingerprints are deterministic and source scoped", () => {
  const first = opportunityFingerprint("source-a", validRecord);
  const repeated = opportunityFingerprint("source-a", validRecord);
  const otherSource = opportunityFingerprint("source-b", validRecord);
  assert.equal(first, repeated);
  assert.notEqual(first, otherSource);
  assert.equal(first.length, 64);
});
