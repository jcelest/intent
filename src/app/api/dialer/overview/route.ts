import { NextResponse } from "next/server";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONVERSATION_DISPOSITIONS = ["contacted", "interested", "callback", "appointment", "converted"];

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const owner = auth.user.role === "owner";
  const userId = auth.user.id;

  const counts = owner
    ? await sql`
        SELECT
          COUNT(*)::int AS all_leads,
          COUNT(*) FILTER (WHERE status = 'to_call' AND do_not_call = FALSE)::int AS to_call,
          COUNT(*) FILTER (WHERE status = 'try_again' AND do_not_call = FALSE)::int AS try_again,
          COUNT(*) FILTER (WHERE status = 'follow_up' AND do_not_call = FALSE)::int AS follow_up,
          COUNT(*) FILTER (WHERE status = 'closed' OR do_not_call = TRUE)::int AS closed,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId})::int AS assigned_to_me,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'to_call' AND do_not_call = FALSE)::int AS assigned_to_me_to_call,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'try_again' AND do_not_call = FALSE)::int AS assigned_to_me_try_again,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'follow_up' AND do_not_call = FALSE)::int AS assigned_to_me_follow_up,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND (status = 'closed' OR do_not_call = TRUE))::int AS assigned_to_me_closed,
          COUNT(*) FILTER (WHERE assigned_user_id IS NOT NULL)::int AS total_assigned,
          COUNT(*) FILTER (WHERE assigned_user_id IS NULL)::int AS total_unassigned
        FROM dialer_leads
      `
    : await sql`
        SELECT
          COUNT(*)::int AS all_leads,
          COUNT(*) FILTER (WHERE status = 'to_call' AND do_not_call = FALSE)::int AS to_call,
          COUNT(*) FILTER (WHERE status = 'try_again' AND do_not_call = FALSE)::int AS try_again,
          COUNT(*) FILTER (WHERE status = 'follow_up' AND do_not_call = FALSE)::int AS follow_up,
          COUNT(*) FILTER (WHERE status = 'closed' OR do_not_call = TRUE)::int AS closed,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId})::int AS assigned_to_me,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'to_call' AND do_not_call = FALSE)::int AS assigned_to_me_to_call,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'try_again' AND do_not_call = FALSE)::int AS assigned_to_me_try_again,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND status = 'follow_up' AND do_not_call = FALSE)::int AS assigned_to_me_follow_up,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId} AND (status = 'closed' OR do_not_call = TRUE))::int AS assigned_to_me_closed,
          COUNT(*) FILTER (WHERE assigned_user_id = ${userId})::int AS total_assigned,
          COUNT(*) FILTER (WHERE assigned_user_id IS NULL)::int AS total_unassigned
        FROM dialer_leads WHERE assigned_user_id = ${userId} OR assigned_user_id IS NULL
      `;

  const metrics = owner
    ? await sql`
        SELECT
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE)::int AS calls_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[]))::int AS conversations_today,
          COUNT(DISTINCT lead_id) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[]))::int AS contacts_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = 'appointment')::int AS meetings_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = 'callback')::int AS callbacks_today,
          COALESCE(SUM(duration_seconds) FILTER (WHERE started_at >= CURRENT_DATE), 0)::int AS talk_seconds_today,
          COUNT(*) FILTER (WHERE started_at >= DATE_TRUNC('week', CURRENT_DATE))::int AS calls_week
        FROM dialer_calls
      `
    : await sql`
        SELECT
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE)::int AS calls_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[]))::int AS conversations_today,
          COUNT(DISTINCT lead_id) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[]))::int AS contacts_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = 'appointment')::int AS meetings_today,
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE AND disposition = 'callback')::int AS callbacks_today,
          COALESCE(SUM(duration_seconds) FILTER (WHERE started_at >= CURRENT_DATE), 0)::int AS talk_seconds_today,
          COUNT(*) FILTER (WHERE started_at >= DATE_TRUNC('week', CURRENT_DATE))::int AS calls_week
        FROM dialer_calls WHERE user_id = ${userId}
      `;

  const recentCalls = owner
    ? await sql`
        SELECT c.*, u.display_name AS user_name, l.first_name, l.last_name, l.company
        FROM dialer_calls c
        LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        ORDER BY c.started_at DESC LIMIT 12
      `
    : await sql`
        SELECT c.*, u.display_name AS user_name, l.first_name, l.last_name, l.company
        FROM dialer_calls c
        LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        WHERE c.user_id = ${userId}
        ORDER BY c.started_at DESC LIMIT 12
      `;

  const conversations = owner
    ? await sql`
        SELECT c.id, c.lead_id, c.disposition, c.notes, c.started_at, c.duration_seconds,
          l.first_name, l.last_name, l.company, l.phone_e164, l.source, l.notes AS lead_notes,
          u.display_name AS user_name, task.title AS open_task_title, task.due_at AS open_task_due_at
        FROM dialer_calls c
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN LATERAL (
          SELECT title, due_at FROM dialer_tasks
          WHERE lead_id = c.lead_id AND status = 'open'
          ORDER BY due_at ASC NULLS LAST, created_at DESC LIMIT 1
        ) task ON TRUE
        WHERE c.started_at >= CURRENT_DATE AND c.disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[])
        ORDER BY c.started_at DESC LIMIT 50
      `
    : await sql`
        SELECT c.id, c.lead_id, c.disposition, c.notes, c.started_at, c.duration_seconds,
          l.first_name, l.last_name, l.company, l.phone_e164, l.source, l.notes AS lead_notes,
          u.display_name AS user_name, task.title AS open_task_title, task.due_at AS open_task_due_at
        FROM dialer_calls c
        LEFT JOIN dialer_leads l ON l.id = c.lead_id
        LEFT JOIN dialer_users u ON u.id = c.user_id
        LEFT JOIN LATERAL (
          SELECT title, due_at FROM dialer_tasks
          WHERE lead_id = c.lead_id AND status = 'open'
          ORDER BY due_at ASC NULLS LAST, created_at DESC LIMIT 1
        ) task ON TRUE
        WHERE c.user_id = ${userId} AND c.started_at >= CURRENT_DATE
          AND c.disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[])
        ORDER BY c.started_at DESC LIMIT 50
      `;

  const outcomeBreakdown = owner
    ? await sql`
        SELECT COALESCE(disposition, status, 'unknown') AS outcome, COUNT(*)::int AS count
        FROM dialer_calls WHERE started_at >= CURRENT_DATE
        GROUP BY COALESCE(disposition, status, 'unknown') ORDER BY count DESC
      `
    : await sql`
        SELECT COALESCE(disposition, status, 'unknown') AS outcome, COUNT(*)::int AS count
        FROM dialer_calls WHERE user_id = ${userId} AND started_at >= CURRENT_DATE
        GROUP BY COALESCE(disposition, status, 'unknown') ORDER BY count DESC
      `;

  const tasks = owner
    ? await sql`
        SELECT t.*, l.first_name, l.last_name, l.company, u.display_name AS assigned_name
        FROM dialer_tasks t
        LEFT JOIN dialer_leads l ON l.id = t.lead_id
        LEFT JOIN dialer_users u ON u.id = t.assigned_user_id
        WHERE t.status = 'open'
        ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC LIMIT 12
      `
    : await sql`
        SELECT t.*, l.first_name, l.last_name, l.company, u.display_name AS assigned_name
        FROM dialer_tasks t
        LEFT JOIN dialer_leads l ON l.id = t.lead_id
        LEFT JOIN dialer_users u ON u.id = t.assigned_user_id
        WHERE t.status = 'open' AND (t.assigned_user_id = ${userId} OR t.assigned_user_id IS NULL)
        ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC LIMIT 12
      `;

  const repStats = await sql`
    SELECT u.id, u.display_name, u.role,
      COUNT(c.id) FILTER (WHERE c.started_at >= CURRENT_DATE)::int AS calls_today,
      COUNT(c.id) FILTER (WHERE c.started_at >= CURRENT_DATE AND c.disposition = ANY(${CONVERSATION_DISPOSITIONS}::text[]))::int AS connected_today,
      COALESCE(SUM(c.duration_seconds) FILTER (WHERE c.started_at >= CURRENT_DATE), 0)::int AS talk_seconds_today
    FROM dialer_users u
    LEFT JOIN dialer_calls c ON c.user_id = u.id
    WHERE u.active = TRUE
    GROUP BY u.id, u.display_name, u.role
    ORDER BY calls_today DESC, u.display_name
  `;

  const setterLeadStats = await sql`
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

  return NextResponse.json({
    user: auth.user,
    counts: counts[0] || {},
    metrics: metrics[0] || {},
    recentCalls,
    conversations,
    outcomeBreakdown,
    tasks,
    repStats,
    setterLeadStats,
  });
}
