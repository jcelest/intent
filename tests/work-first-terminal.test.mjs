import test from "node:test";
import assert from "node:assert/strict";
import { getClientTerritoryOutreachTargets } from "../src/lib/client-outreach-engine.ts";
import { getCountyParcelRegistry } from "../src/lib/county-parcel-registry.ts";
import { ensureAutoClientSavedViews, getSavedViews } from "../src/lib/saved-views.ts";
import { sql } from "../src/lib/db.ts";

test("Work-First Terminal Redesign Verification Suite", async (t) => {
  await t.test("1. Baseline row count remains intact (11,858 records across FL)", async () => {
    const result = await getClientTerritoryOutreachTargets({
      mode: "call_list",
      limit: 10,
    });
    assert.strictEqual(
      result.total,
      11858,
      `Total active commercial outreach records must be 11,858, received: ${result.total}`
    );
  });

  await t.test("2. Client overlay NEVER reduces the dataset count", async () => {
    // Fetch registered clients
    const clients = await sql`SELECT id, name FROM trade_demand_clients WHERE active = TRUE ORDER BY created_at ASC LIMIT 1`;
    const clientId = clients[0]?.id;

    // Unscoped
    const unscopedResult = await getClientTerritoryOutreachTargets({ mode: "call_list", limit: 10 });

    if (clientId) {
      // With Client Overlay Lens
      const overlayResult = await getClientTerritoryOutreachTargets({
        clientId,
        mode: "call_list",
        limit: 10,
      });

      // Overlay should NOT filter down total
      assert.strictEqual(
        overlayResult.total,
        unscopedResult.total,
        `Overlay with client ${clientId} reduced dataset! Expected ${unscopedResult.total}, got ${overlayResult.total}`
      );

      // Verify fit scores are computed
      assert.ok(
        overlayResult.targets.every((t) => typeof t.fitScore === "number" && t.fitScore >= 0 && t.fitScore <= 100),
        "All targets must have a fit score between 0 and 100"
      );
    }
  });

  await t.test("3. Pre-existing filters combine with AND", async () => {
    // Test County filter
    const orangeResult = await getClientTerritoryOutreachTargets({
      county: "Orange",
      mode: "call_list",
      limit: 50,
    });
    assert.ok(orangeResult.total > 0, "Orange county should have records");
    assert.ok(
      orangeResult.targets.every((t) => t.county.toLowerCase() === "orange"),
      "Every target must be in Orange county"
    );

    // Test County + Channel filter (AND combination)
    const orangeOfficeResult = await getClientTerritoryOutreachTargets({
      county: "Orange",
      channel: "office",
      mode: "call_list",
      limit: 50,
    });
    assert.ok(
      orangeOfficeResult.total <= orangeResult.total,
      `Orange Office count (${orangeOfficeResult.total}) must be <= Orange total (${orangeResult.total})`
    );
    assert.ok(
      orangeOfficeResult.targets.every(
        (t) => t.county.toLowerCase() === "orange" && t.channel === "office"
      ),
      "Every target must be in Orange AND office channel"
    );

    // Test County + Channel + TonnageRisk filter (AND combination)
    const orangeOfficeUnder10t = await getClientTerritoryOutreachTargets({
      county: "Orange",
      channel: "office",
      tonnageRisk: "UNDER_10T_LIKELY",
      mode: "call_list",
      limit: 50,
    });
    assert.ok(
      orangeOfficeUnder10t.total <= orangeOfficeResult.total,
      `Orange Office <10T (${orangeOfficeUnder10t.total}) must be <= Orange Office (${orangeOfficeResult.total})`
    );
  });

  await t.test("4. Call List ranking follows 4-tier specification", async () => {
    const callListResult = await getClientTerritoryOutreachTargets({
      mode: "call_list",
      limit: 50,
    });

    assert.ok(callListResult.targets.length > 0, "Call list should return targets");

    // Check verification status ranking: VERIFIED_ACTIVE must appear before unverified
    let seenUnverified = false;
    for (const target of callListResult.targets) {
      if (target.verificationStatus === "VERIFIED_ACTIVE") {
        assert.strictEqual(
          seenUnverified,
          false,
          "VERIFIED_ACTIVE target appeared after non-verified target in call list ranking!"
        );
      } else {
        seenUnverified = true;
      }
    }
  });

  await t.test("5. Data Health registry and header computed strictly from data", async () => {
    const registry = await getCountyParcelRegistry();
    assert.strictEqual(registry.length, 67, "Registry must contain all 67 Florida counties");

    const fullDepthCounties = registry.filter((c) => c.status === "INGESTED");
    assert.strictEqual(
      fullDepthCounties.length,
      5,
      `Exactly 5 priority counties must be marked INGESTED/FULL DEPTH, found: ${fullDepthCounties.length}`
    );

    const totalCommercialParcels = registry.reduce(
      (sum, c) => sum + (c.commercialParcelsCount || 0),
      0
    );
    assert.strictEqual(
      totalCommercialParcels,
      11845,
      `Commercial parcels total must be 11,845, got: ${totalCommercialParcels}`
    );
  });

  await t.test("6. Saved views table and client auto-generation", async () => {
    await ensureAutoClientSavedViews();
    const views = await getSavedViews();
    assert.ok(Array.isArray(views), "getSavedViews must return an array");
    assert.ok(views.length > 0, "Saved views should include auto-generated views");
  });

  await t.test("7. View stats computation for active view", async () => {
    const result = await getClientTerritoryOutreachTargets({
      mode: "call_list",
      limit: 50,
    });

    assert.ok(typeof result.stats.totalInView === "number", "totalInView must be a number");
    assert.ok(typeof result.stats.verifiedCallableCount === "number", "verifiedCallableCount must be a number");
    assert.ok(typeof result.stats.withPhonePercent === "number", "withPhonePercent must be a number");
    assert.ok(typeof result.stats.newPermits30dCount === "number", "newPermits30dCount must be a number");
    assert.ok(typeof result.stats.inPipelineCount === "number", "inPipelineCount must be a number");
  });
});
