import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticDispositionForTwilioStatus,
  isAutomaticDialerDisposition,
} from "../src/lib/dialer-outcomes.ts";

test("maps terminal non-answer statuses to automatic dispositions", () => {
  assert.equal(automaticDispositionForTwilioStatus("busy"), "busy");
  assert.equal(automaticDispositionForTwilioStatus("failed"), "failed");
  assert.equal(automaticDispositionForTwilioStatus("no-answer"), "no_answer");
  assert.equal(automaticDispositionForTwilioStatus("canceled"), "no_answer");
});

test("does not guess an outcome for answered or incomplete calls", () => {
  for (const status of ["queued", "initiated", "ringing", "answered", "in-progress", "completed", "unknown"]) {
    assert.equal(automaticDispositionForTwilioStatus(status), null);
  }
});

test("recognizes only server-automatic outcomes", () => {
  assert.equal(isAutomaticDialerDisposition("no_answer"), true);
  assert.equal(isAutomaticDialerDisposition("busy"), true);
  assert.equal(isAutomaticDialerDisposition("failed"), true);
  assert.equal(isAutomaticDialerDisposition("contacted"), false);
  assert.equal(isAutomaticDialerDisposition("voicemail"), false);
});
