import test from "node:test";
import assert from "node:assert/strict";
import { parseProcurementNotice } from "../src/lib/procurement-inbox.ts";

test("accepts an authenticated OpenGov notice and maps Orange County", () => {
  const parsed = parseProcurementNotice({
    providerMessageId: "email-open-gov-1",
    from: "OpenGov Procurement <notifications@updates.opengov.com>",
    to: ["opportunities@example.resend.app"],
    subject: "New Bid: Countywide HVAC Preventive Maintenance",
    receivedAt: "2030-06-01T14:00:00.000Z",
    text: "Orange County, Florida. Solicitation RFP #Y30-100. Due Date: July 15, 2030 at 2:00 PM ET.",
    html: `<p>Orange County, Florida</p><p>Solicitation RFP #Y30-100</p><p>Due Date: July 15, 2030 at 2:00 PM ET</p><a href="https://procurement.opengov.com/portal/orangecountyfl/projects/12345?utm_source=email">Countywide HVAC Preventive Maintenance</a>`,
    headers: { "authentication-results": "spf=pass; dkim=pass; dmarc=pass" },
  }, { allowedRecipients: ["opportunities@example.resend.app"] });

  assert.equal(parsed.disposition, "accepted");
  assert.equal(parsed.portalSource, "opengov");
  assert.equal(parsed.opportunities.length, 1);
  assert.equal(parsed.opportunities[0].county, "Orange");
  assert.equal(parsed.opportunities[0].purchasingOrganization, "Orange County, Florida");
  assert.equal(parsed.opportunities[0].tradeSlug, "hvac");
  assert.equal(parsed.opportunities[0].status, "active");
  assert.equal(parsed.opportunities[0].deadline, "2030-07-15T18:00:00.000Z");
  assert.equal(parsed.opportunities[0].sourceUrl, "https://procurement.opengov.com/portal/orangecountyfl/projects/12345");
});

test("accepts a DemandStar cancellation but preserves it as cancelled", () => {
  const parsed = parseProcurementNotice({
    providerMessageId: "email-demandstar-1",
    from: "DemandStar <bids@notices.demandstar.com>",
    to: ["opportunities@example.resend.app"],
    subject: "Cancelled: ITB 30-45 Building Automation Controls",
    receivedAt: "2030-05-01T14:00:00.000Z",
    text: "Osceola County, FL. ITB 30-45 has been cancelled. https://network.demandstar.com/bids/30-45",
    headers: { "authentication-results": "spf=pass; dkim=pass" },
  });

  assert.equal(parsed.disposition, "accepted");
  assert.equal(parsed.portalSource, "demandstar");
  assert.equal(parsed.opportunities[0].county, "Osceola");
  assert.equal(parsed.opportunities[0].status, "cancelled");
  assert.equal(parsed.opportunities[0].tradeSlug, "automation_controls");
});

test("rejects a spoofed portal notice from an unapproved sender", () => {
  const parsed = parseProcurementNotice({
    providerMessageId: "email-spoofed-1",
    from: "OpenGov <attacker@example.net>",
    to: ["opportunities@example.resend.app"],
    subject: "New Florida bid",
    receivedAt: "2030-05-01T14:00:00.000Z",
    html: `<a href="https://procurement.opengov.com/portal/orangecountyfl/projects/999">Fake bid</a>`,
  });

  assert.equal(parsed.disposition, "ignored");
  assert.match(parsed.reason, /allowlist/i);
  assert.equal(parsed.opportunities.length, 0);
});

test("does not place an out-of-state notice into the Florida feed", () => {
  const parsed = parseProcurementNotice({
    providerMessageId: "email-out-state-1",
    from: "OpenGov <notifications@opengov.com>",
    to: ["opportunities@example.resend.app"],
    subject: "New bid from the City of Portland",
    receivedAt: "2030-05-01T14:00:00.000Z",
    text: "City of Portland, Oregon. RFP 2030-1. Due Date: June 2, 2030.",
    html: `<a href="https://procurement.opengov.com/portal/portlandor/projects/222">City facility work</a>`,
  });

  assert.equal(parsed.disposition, "needs_review");
  assert.match(parsed.reason, /Florida/i);
  assert.equal(parsed.opportunities.length, 0);
});

test("rejects a message with a failed DMARC result", () => {
  const parsed = parseProcurementNotice({
    providerMessageId: "email-dmarc-fail",
    from: "DemandStar <notices@demandstar.com>",
    to: ["opportunities@example.resend.app"],
    subject: "Osceola County, FL bid",
    receivedAt: "2030-05-01T14:00:00.000Z",
    text: "Osceola County, FL. Due Date: June 2, 2030. https://network.demandstar.com/bids/12345",
    headers: { "authentication-results": "spf=pass; dkim=fail; dmarc=fail" },
  });

  assert.equal(parsed.disposition, "ignored");
  assert.match(parsed.reason, /authentication/i);
});
