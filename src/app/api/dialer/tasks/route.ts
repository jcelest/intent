import { NextResponse } from "next/server";
import { addActivity } from "@/lib/dialer";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const status = new URL(request.url).searchParams.get("status") || "open";
  const tasks = await sql`
    SELECT t.*, l.first_name, l.last_name, l.company, l.phone_e164, u.display_name AS assigned_name
    FROM dialer_tasks t
    LEFT JOIN dialer_leads l ON l.id = t.lead_id
    LEFT JOIN dialer_users u ON u.id = t.assigned_user_id
    WHERE (${status} = 'all' OR t.status = ${status})
      AND (${auth.user.role} = 'owner' OR t.assigned_user_id = ${auth.user.id} OR t.assigned_user_id IS NULL)
    ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.due_at ASC NULLS LAST, t.created_at DESC
    LIMIT 500
  `;
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as {
    leadId?: string | null; assignedUserId?: string | null; taskType?: string;
    title?: string; description?: string; dueAt?: string | null;
  };
  if (!body.title?.trim()) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  const type = ["follow_up", "callback", "general"].includes(body.taskType || "") ? body.taskType : "general";
  const rows = await sql`
    INSERT INTO dialer_tasks (lead_id, assigned_user_id, created_by, task_type, title, description, due_at)
    VALUES (${body.leadId || null}, ${body.assignedUserId || auth.user.id}, ${auth.user.id}, ${type},
      ${body.title.trim()}, ${body.description?.trim() || null}, ${body.dueAt ? new Date(body.dueAt) : null})
    RETURNING *
  `;
  if (body.leadId) await addActivity({ leadId: body.leadId, userId: auth.user.id, type: "task_created", summary: body.title.trim() });
  return NextResponse.json({ task: rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as { id?: string; status?: string; title?: string; dueAt?: string | null; assignedUserId?: string | null };
  if (!body.id) return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  const status = ["open", "completed", "canceled"].includes(body.status || "") ? body.status : null;
  const rows = await sql`
    UPDATE dialer_tasks SET
      status = COALESCE(${status}, status),
      title = COALESCE(${body.title?.trim() || null}, title),
      due_at = CASE WHEN ${body.dueAt === undefined} THEN due_at ELSE ${body.dueAt ? new Date(body.dueAt) : null} END,
      assigned_user_id = CASE WHEN ${body.assignedUserId === undefined} THEN assigned_user_id ELSE ${body.assignedUserId || null} END,
      completed_at = CASE WHEN ${status} = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${body.id} AND (${auth.user.role} = 'owner' OR assigned_user_id = ${auth.user.id})
    RETURNING *
  `;
  return NextResponse.json({ task: rows[0] || null });
}

