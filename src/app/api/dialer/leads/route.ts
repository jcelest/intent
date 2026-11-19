import { NextResponse } from "next/server";
import { addActivity, DISPOSITIONS, LEAD_STATUSES, normalizePhone, statusForDisposition, timezoneForState, type Disposition, type LeadStatus } from "@/lib/dialer";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadInput = {
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  timezone?: string;
  source?: string;
  notes?: string;
  status?: string;
  disposition?: string;
  nextCallAt?: string | null;
  doNotCall?: boolean;
  assignedUserId?: string | null;
  listId?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search")?.trim() || "";
  const assignee = url.searchParams.get("assignee") || "all";
  const listId = url.searchParams.get("listId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 250), 1), 1000);
  const normalizedStatus = ["to_call", "try_again", "follow_up", "closed"].includes(status) ? status : null;
  const searchTerm = `%${search}%`;

  const leads = await sql`
    SELECT l.*, u.display_name AS assigned_name,
      COALESCE((SELECT ARRAY_AGG(dl.name ORDER BY dl.name)
        FROM dialer_list_members lm JOIN dialer_lists dl ON dl.id = lm.list_id
        WHERE lm.lead_id = l.id), '{}') AS lists
    FROM dialer_leads l
    LEFT JOIN dialer_users u ON u.id = l.assigned_user_id
    WHERE (${normalizedStatus}::text IS NULL OR l.status = ${normalizedStatus})
      AND (${search} = '' OR CONCAT_WS(' ', l.first_name, l.last_name, l.company, l.phone_e164, l.email, l.city, l.state) ILIKE ${searchTerm})
      AND (${assignee} = 'all' OR (${assignee} = 'unassigned' AND l.assigned_user_id IS NULL) OR l.assigned_user_id::text = ${assignee})
      AND (${listId}::text IS NULL OR EXISTS (
        SELECT 1 FROM dialer_list_members lm WHERE lm.lead_id = l.id AND lm.list_id::text = ${listId}
      ))
      AND (${auth.user.role} = 'owner' OR l.assigned_user_id = ${auth.user.id} OR l.assigned_user_id IS NULL)
    ORDER BY
      CASE WHEN l.next_call_at IS NOT NULL AND l.next_call_at <= CURRENT_TIMESTAMP THEN 0 ELSE 1 END,
      l.priority DESC, l.created_at DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { lead?: LeadInput; leads?: LeadInput[]; listId?: string; listName?: string };
  const inputs = body.leads || (body.lead ? [body.lead] : []);
  if (!inputs.length) return NextResponse.json({ error: "At least one lead is required." }, { status: 400 });
  if (inputs.length > 5000) return NextResponse.json({ error: "Imports are limited to 5,000 rows at a time." }, { status: 400 });

  let listId = body.listId || inputs[0]?.listId || null;
  if (!listId && body.listName?.trim()) {
    const rows = await sql`
      INSERT INTO dialer_lists (name, created_by) VALUES (${body.listName.trim()}, ${auth.user.id}) RETURNING id
    `;
    listId = rows[0].id as string;
  }

  const created: unknown[] = [];
  const errors: { row: number; error: string }[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const phone = normalizePhone(input.phone || "");
    if (!phone) {
      errors.push({ row: index + 1, error: "Invalid or missing phone number." });
      continue;
    }
    try {
      const disposition = DISPOSITIONS.includes(input.disposition as Disposition) ? input.disposition as Disposition : null;
      const hasCategory = Boolean(input.status || disposition || input.doNotCall);
      const status = input.doNotCall ? "closed" : disposition ? statusForDisposition(disposition) : LEAD_STATUSES.includes(input.status as LeadStatus) ? input.status as LeadStatus : "to_call";
      const nextCallAt = input.nextCallAt && !Number.isNaN(new Date(input.nextCallAt).getTime()) ? new Date(input.nextCallAt) : null;
      const doNotCall = Boolean(input.doNotCall || disposition === "dnc");
      const duplicate = await sql`
        SELECT id FROM dialer_leads
        WHERE phone_e164 = ${phone} AND LOWER(COALESCE(company, '')) = LOWER(${input.company?.trim() || ""})
        LIMIT 1
      `;
      let leadId: string;
      let lead;
      if (duplicate[0]) {
        leadId = duplicate[0].id as string;
        const rows = await sql`
          UPDATE dialer_leads SET
            first_name = COALESCE(${input.firstName?.trim() || null}, first_name),
            last_name = COALESCE(${input.lastName?.trim() || null}, last_name),
            title = COALESCE(${input.title?.trim() || null}, title),
            email = COALESCE(${input.email?.trim() || null}, email),
            city = COALESCE(${input.city?.trim() || null}, city),
            state = COALESCE(${input.state?.trim() || null}, state),
            postal_code = COALESCE(${input.postalCode?.trim() || null}, postal_code),
            source = COALESCE(${input.source?.trim() || null}, source),
            notes = COALESCE(${input.notes?.trim() || null}, notes),
            status = CASE WHEN ${hasCategory} THEN ${status} ELSE status END,
            disposition = COALESCE(${disposition}, disposition),
            next_call_at = COALESCE(${nextCallAt}, next_call_at),
            do_not_call = CASE WHEN ${doNotCall} THEN TRUE ELSE do_not_call END,
            assigned_user_id = COALESCE(${input.assignedUserId || null}, assigned_user_id),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${leadId} RETURNING *
        `;
        lead = rows[0];
      } else {
        const rows = await sql`
          INSERT INTO dialer_leads (
            first_name, last_name, company, title, phone_e164, phone_raw, email, city, state,
            postal_code, timezone, source, notes, status, disposition, next_call_at, do_not_call,
            assigned_user_id, created_by
          ) VALUES (
            ${input.firstName?.trim() || null}, ${input.lastName?.trim() || null}, ${input.company?.trim() || null},
            ${input.title?.trim() || null}, ${phone}, ${input.phone || phone}, ${input.email?.trim() || null},
            ${input.city?.trim() || null}, ${input.state?.trim() || null}, ${input.postalCode?.trim() || null},
            ${input.timezone || timezoneForState(input.state)}, ${input.source?.trim() || "manual"},
            ${input.notes?.trim() || null}, ${status}, ${disposition}, ${nextCallAt}, ${doNotCall},
            ${input.assignedUserId || null}, ${auth.user.id}
          ) RETURNING *
        `;
        lead = rows[0];
        leadId = lead.id as string;
      }
      if (listId) {
        await sql`INSERT INTO dialer_list_members (list_id, lead_id) VALUES (${listId}, ${leadId}) ON CONFLICT DO NOTHING`;
      }
      if (doNotCall) {
        await sql`
          INSERT INTO dialer_dnc (phone_e164, reason, source, requested_by)
          VALUES (${phone}, ${input.notes?.trim() || "Imported as do not call"}, 'csv_import', ${auth.user.id})
          ON CONFLICT (phone_e164) DO UPDATE SET reason = EXCLUDED.reason
        `;
      }
      created.push(lead);
    } catch (error) {
      errors.push({ row: index + 1, error: error instanceof Error ? error.message : "Import failed." });
    }
  }
  await addActivity({
    userId: auth.user.id,
    type: "lead_import",
    summary: `Imported ${created.length} lead${created.length === 1 ? "" : "s"}`,
    metadata: { errors: errors.length, listId },
  });
  return NextResponse.json({ leads: created, errors, listId }, { status: created.length ? 201 : 400 });
}

export async function PATCH(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as {
    ids?: string[];
    assignedUserId?: string | null;
    status?: string;
    priority?: number;
  };
  if (!body.ids?.length) return NextResponse.json({ error: "Lead ids are required." }, { status: 400 });
  if (body.ids.length > 1000) return NextResponse.json({ error: "Bulk updates are limited to 1,000 leads." }, { status: 400 });
  const status = ["to_call", "try_again", "follow_up", "closed"].includes(body.status || "") ? body.status : null;
  await sql`
    UPDATE dialer_leads SET
      assigned_user_id = CASE WHEN ${body.assignedUserId === undefined} THEN assigned_user_id ELSE ${body.assignedUserId || null} END,
      status = COALESCE(${status}, status),
      priority = COALESCE(${body.priority ?? null}, priority),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY(${body.ids}::uuid[])
  `;
  return NextResponse.json({ success: true, updated: body.ids.length });
}
