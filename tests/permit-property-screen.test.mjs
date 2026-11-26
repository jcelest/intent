import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyParcelUseCode,
  normalizeParcelId,
  normalizePermitAddress,
} from "../src/lib/permit-property-screen.ts";

test("classifies OCPA single-family use codes as residential", () => {
  assert.equal(classifyParcelUseCode("0103"), "RESIDENTIAL");
  assert.equal(classifyParcelUseCode("01"), "RESIDENTIAL");
});

test("allows matched non-single-family parcel codes through the screen", () => {
  assert.equal(classifyParcelUseCode("0300"), "COMMERCIAL");
  assert.equal(classifyParcelUseCode("1100"), "COMMERCIAL");
  assert.equal(classifyParcelUseCode("1700"), "COMMERCIAL");
  assert.equal(classifyParcelUseCode("4100"), "COMMERCIAL");
});

test("fails closed when no parcel use code exists", () => {
  assert.equal(classifyParcelUseCode(null), "UNKNOWN");
  assert.equal(classifyParcelUseCode(""), "UNKNOWN");
});

test("normalizes Orlando permit parcel IDs and addresses for authoritative joins", () => {
  assert.equal(normalizeParcelId("31-23-32-1952-01-060"), "312332195201060");
  assert.equal(normalizePermitAddress("10628 Tibbett Street"), "10628TIBBETTST");
  assert.equal(normalizePermitAddress("10628 TIBBETT ST"), "10628TIBBETTST");
});

