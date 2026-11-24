import test from "node:test";
import assert from "node:assert/strict";
import { sql } from "../src/lib/db.ts";

test("Dialer Assigned Lead Metrics Verification Suite", async (t) => {
  await t.test("1. Lead assignment counts query returns valid numbers without fabricating data", async () => {
    // Check dialer_users
    const users = await sql`SELECT id, display_name, role, active FROM dialer_users ORDER BY created_at ASC`;
    assert.ok(Array.isArray(users), "dialer_users query should return an array");

    // Check dialer_leads total and assignment distribution
    const counts = await sql`
      SELECT
        COUNT(*)::int AS all_leads,
        COUNT(*) FILTER (WHERE assigned_user_id IS NOT NULL)::int AS total_assigned,
        COUNT(*) FILTER (WHERE assigned_user_id IS NULL)::int AS total_unassigned
      FROM dialer_leads
    `;
    assert.ok(counts.length > 0, "Counts query should return a row");
    const { all_leads, total_assigned, total_unassigned } = counts[0];
    assert.strictEqual(
      total_assigned + total_unassigned,
      all_leads,
      "Assigned leads + unassigned leads must exactly equal total leads in dialer_leads"
    );

    // Check per-setter lead stats aggregation
    const setterStats = await sql`
      SELECT
        u.id AS user_id,
        u.display_name,
        u.role,
        COUNT(l.id)::int AS total,
        COUNT(l.id) FILTER (WHERE l.status = 'to_call' AND l.do_not_call = FALSE)::int AS to_call,
        COUNT(l.id) FILTER (WHERE l.status = 'try_again' AND l.do_not_call = FALSE)::int AS try_again,
        COUNT(l.id) FILTER (WHERE l.status = 'follow_up' AND l.do_not_call = FALSE)::int AS follow_up,
        COUNT(l.id) FILTER (WHERE l.status = 'closed' OR l.do_not_call = TRUE)::int AS closed
      FROM dialer_users u
      LEFT JOIN dialer_leads l ON l.assigned_user_id = u.id
      WHERE u.active = TRUE
      GROUP BY u.id, u.display_name, u.role
      ORDER BY total DESC, u.display_name ASC
    `;

    assert.ok(Array.isArray(setterStats), "Setter stats query should return an array");
    const sumAssignedAcrossActiveSetters = setterStats.reduce((sum, s) => sum + Number(s.total), 0);
    assert.ok(
      sumAssignedAcrossActiveSetters <= total_assigned,
      "Sum of assigned leads to active setters cannot exceed total assigned leads"
    );

    for (const stat of setterStats) {
      assert.ok(typeof stat.total === "number", "Total must be a number");
      assert.ok(typeof stat.to_call === "number", "To call count must be a number");
      assert.ok(typeof stat.try_again === "number", "Try again count must be a number");
      assert.ok(typeof stat.follow_up === "number", "Follow up count must be a number");
      assert.ok(typeof stat.closed === "number", "Closed count must be a number");
      assert.strictEqual(
        stat.to_call + stat.try_again + stat.follow_up + stat.closed,
        stat.total,
        `Status breakdown for ${stat.display_name} (${stat.to_call} + ${stat.try_again} + ${stat.follow_up} + ${stat.closed}) must equal total (${stat.total})`
      );
    }
  });

  await t.test("2. Personal assigned leads query returns accurate counts for any user", async () => {
    const users = await sql`SELECT id, display_name FROM dialer_users WHERE active = TRUE LIMIT 1`;
    if (users.length > 0) {
      const testUser = users[0];
      const personalCounts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE assigned_user_id = ${testUser.id} AND COALESCE(archived, FALSE) = FALSE)::int AS assigned_to_me,
          COUNT(*) FILTER (WHERE assigned_user_id = ${testUser.id} AND status = 'to_call' AND do_not_call = FALSE AND COALESCE(archived, FALSE) = FALSE)::int AS assigned_to_me_to_call,
          COUNT(*) FILTER (WHERE assigned_user_id = ${testUser.id} AND status = 'try_again' AND do_not_call = FALSE AND COALESCE(archived, FALSE) = FALSE)::int AS assigned_to_me_try_again,
          COUNT(*) FILTER (WHERE assigned_user_id = ${testUser.id} AND status = 'follow_up' AND do_not_call = FALSE AND COALESCE(archived, FALSE) = FALSE)::int AS assigned_to_me_follow_up,
          COUNT(*) FILTER (WHERE assigned_user_id = ${testUser.id} AND (status = 'closed' OR do_not_call = TRUE) AND COALESCE(archived, FALSE) = FALSE)::int AS assigned_to_me_closed
        FROM dialer_leads
      `;
      const p = personalCounts[0];
      assert.strictEqual(
        p.assigned_to_me_to_call + p.assigned_to_me_try_again + p.assigned_to_me_follow_up + p.assigned_to_me_closed,
        p.assigned_to_me,
        "Setter's sub-breakdowns must equal their total assigned count"
      );
    }
  });

  await t.test("3. Lead archiving and unarchiving integrity", async () => {
    // Check that archived column exists
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dialer_leads' AND column_name IN ('archived', 'archived_at')
    `;
    assert.strictEqual(cols.length, 2, "dialer_leads must contain archived and archived_at columns");

    // Check counts separating active and archived
    const counts = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE COALESCE(archived, FALSE) = FALSE)::int AS active,
        COUNT(*) FILTER (WHERE COALESCE(archived, FALSE) = TRUE)::int AS archived
      FROM dialer_leads
    `;
    assert.ok(counts.length > 0);
    assert.strictEqual(counts[0].active + counts[0].archived, counts[0].total, "active + archived must equal total");
  });
});
