import { sql } from "@/lib/db";

const RESERVATION_MINUTES = 15;

export async function reserveNextLead(input: {
  userId: string;
  role: string;
  excludeLeadId?: string | null;
}) {
  const rows = await sql`
    WITH candidate AS (
      SELECT l.id
      FROM dialer_leads l
      LEFT JOIN dialer_dnc d ON d.phone_e164 = l.phone_e164
      LEFT JOIN dialer_settings workspace_settings ON workspace_settings.key = 'workspace'
      LEFT JOIN pg_timezone_names prospect_timezone ON prospect_timezone.name = l.timezone
      WHERE l.do_not_call = FALSE AND d.id IS NULL
        AND l.status IN ('to_call', 'try_again')
        AND (l.next_call_at IS NULL OR l.next_call_at <= CURRENT_TIMESTAMP)
        AND (${input.excludeLeadId || null}::uuid IS NULL OR l.id <> ${input.excludeLeadId || null}::uuid)
        AND (${input.role} = 'owner' OR l.assigned_user_id = ${input.userId} OR l.assigned_user_id IS NULL)
        AND (
          l.reserved_by IS NULL
          OR l.reservation_expires_at <= CURRENT_TIMESTAMP
          OR l.reserved_by = ${input.userId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM dialer_calls c
          WHERE c.lead_id = l.id
            AND c.direction = 'outbound'
            AND c.status IN ('queued', 'initiated', 'ringing', 'in-progress', 'answered')
            AND c.started_at >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
        )
        AND (
          COALESCE((workspace_settings.value->>'guardrailsEnabled')::boolean, TRUE) = FALSE
          OR COALESCE((workspace_settings.value->>'enforceCallingWindow')::boolean, TRUE) = FALSE
          OR (
            (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(prospect_timezone.name, 'America/New_York'))::time
              >= COALESCE(NULLIF(workspace_settings.value->>'callWindowStart', '')::time, TIME '08:00')
            AND (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(prospect_timezone.name, 'America/New_York'))::time
              < COALESCE(NULLIF(workspace_settings.value->>'callWindowEnd', '')::time, TIME '20:00')
            AND (
              COALESCE((workspace_settings.value->>'allowWeekendCalling')::boolean, TRUE) = TRUE
              OR EXTRACT(ISODOW FROM CURRENT_TIMESTAMP AT TIME ZONE COALESCE(prospect_timezone.name, 'America/New_York')) < 6
            )
          )
        )
        AND (
          COALESCE((workspace_settings.value->>'guardrailsEnabled')::boolean, TRUE) = FALSE
          OR COALESCE((workspace_settings.value->>'enforceDailyLimit')::boolean, TRUE) = FALSE
          OR (
            SELECT COUNT(*) FROM dialer_calls attempts
            WHERE attempts.lead_id = l.id
              AND attempts.direction = 'outbound'
              AND attempts.started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          ) < COALESCE((workspace_settings.value->>'maxDailyAttempts')::integer, 3)
        )
      ORDER BY CASE WHEN l.assigned_user_id = ${input.userId} THEN 0 ELSE 1 END,
        CASE WHEN l.status = 'to_call' THEN 0 ELSE 1 END,
        l.priority DESC, l.next_call_at ASC NULLS LAST, l.created_at ASC
      FOR UPDATE OF l SKIP LOCKED
      LIMIT 1
    ), reserved AS (
      UPDATE dialer_leads l SET
        reserved_by = ${input.userId},
        reserved_at = CURRENT_TIMESTAMP,
        reservation_expires_at = CURRENT_TIMESTAMP + (${RESERVATION_MINUTES} * INTERVAL '1 minute'),
        updated_at = CURRENT_TIMESTAMP
      FROM candidate
      WHERE l.id = candidate.id
      RETURNING l.*
    )
    SELECT reserved.*, u.display_name AS assigned_name
    FROM reserved
    LEFT JOIN dialer_users u ON u.id = reserved.assigned_user_id
  `;
  return rows[0] || null;
}

export async function claimLead(input: { userId: string; role: string; leadId: string }) {
  const rows = await sql`
    UPDATE dialer_leads l SET
      reserved_by = ${input.userId},
      reserved_at = CURRENT_TIMESTAMP,
      reservation_expires_at = CURRENT_TIMESTAMP + (${RESERVATION_MINUTES} * INTERVAL '1 minute'),
      updated_at = CURRENT_TIMESTAMP
    WHERE l.id = ${input.leadId}
      AND l.do_not_call = FALSE
      AND l.status <> 'closed'
      AND NOT EXISTS (SELECT 1 FROM dialer_dnc d WHERE d.phone_e164 = l.phone_e164)
      AND (${input.role} = 'owner' OR l.assigned_user_id = ${input.userId} OR l.assigned_user_id IS NULL)
      AND (
        l.reserved_by IS NULL
        OR l.reservation_expires_at <= CURRENT_TIMESTAMP
        OR l.reserved_by = ${input.userId}
      )
    RETURNING l.*
  `;
  return rows[0] || null;
}

export async function refreshLeadReservation(input: { userId: string; leadId: string }) {
  const rows = await sql`
    UPDATE dialer_leads SET
      reservation_expires_at = CURRENT_TIMESTAMP + (${RESERVATION_MINUTES} * INTERVAL '1 minute'),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.leadId} AND reserved_by = ${input.userId}
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function releaseLeadReservation(input: { userId: string; leadId: string }) {
  await sql`
    UPDATE dialer_leads SET
      reserved_by = NULL, reserved_at = NULL, reservation_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${input.leadId} AND reserved_by = ${input.userId}
  `;
}
