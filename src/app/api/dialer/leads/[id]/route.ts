import { NextResponse } from "next/server";
import { addActivity, normalizePhone, timezoneForState } from "@/lib/dialer";
import { requireDialerSession } from "@/lib/dialer-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response) return auth.response;
  const leads = await sql`
    SELECT l.*, u.display_name AS assigned_name FROM dialer_leads l
    LEFT JOIN dialer_users u ON u.id = l.assigned_user_id WHERE l.id = ${params.id} LIMIT 1
  `;
  if (!leads[0]) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const [calls, tasks, activities] = await Promise.all([
    sql`SELECT c.*, u.display_name AS user_name FROM dialer_calls c LEFT JOIN dialer_users u ON u.id = c.user_id WHERE c.lead_id = ${params.id} ORDER BY c.started_at DESC LIMIT 100`,
    sql`SELECT * FROM dialer_tasks WHERE lead_id = ${params.id} ORDER BY created_at DESC`,
    sql`SELECT a.*, u.display_name AS user_name FROM dialer_activities a LEFT JOIN dialer_users u ON u.id = a.user_id WHERE a.lead_id = ${params.id} ORDER BY a.created_at DESC LIMIT 100`,
  ]);
  return NextResponse.json({ lead: leads[0], calls, tasks, activities });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const body = (await request.json()) as Record<string, unknown>;
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
  const status = typeof body.status === "string" && ["to_call", "try_again", "follow_up", "closed"].includes(body.status) ? body.status : null;
  const rows = await sql`
    UPDATE dialer_leads SET
      first_name = CASE WHEN ${body.firstName === undefined} THEN first_name ELSE ${String(body.firstName || "").trim() || null} END,
      last_name = CASE WHEN ${body.lastName === undefined} THEN last_name ELSE ${String(body.lastName || "").trim() || null} END,
      company = CASE WHEN ${body.company === undefined} THEN company ELSE ${String(body.company || "").trim() || null} END,
      title = CASE WHEN ${body.title === undefined} THEN title ELSE ${String(body.title || "").trim() || null} END,
      phone_e164 = COALESCE(${phone}, phone_e164),
      phone_raw = CASE WHEN ${body.phone === undefined} THEN phone_raw ELSE ${String(body.phone || "")} END,
      email = CASE WHEN ${body.email === undefined} THEN email ELSE ${String(body.email || "").trim() || null} END,
      city = CASE WHEN ${body.city === undefined} THEN city ELSE ${String(body.city || "").trim() || null} END,
      state = CASE WHEN ${body.state === undefined} THEN state ELSE ${String(body.state || "").trim() || null} END,
      timezone = CASE WHEN ${body.timezone === undefined && body.state === undefined} THEN timezone ELSE ${String(body.timezone || timezoneForState(String(body.state || "")))} END,
      notes = CASE WHEN ${body.notes === undefined} THEN notes ELSE ${String(body.notes || "")} END,
      assigned_user_id = CASE WHEN ${body.assignedUserId === undefined} THEN assigned_user_id ELSE ${body.assignedUserId ? String(body.assignedUserId) : null} END,
      status = COALESCE(${status}, status),
      next_call_at = CASE WHEN ${body.nextCallAt === undefined} THEN next_call_at ELSE ${body.nextCallAt ? new Date(String(body.nextCallAt)) : null} END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  await addActivity({ leadId: params.id, userId: auth.user.id, type: "lead_updated", summary: "Updated lead details" });
  return NextResponse.json({ lead: rows[0] });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDialerSession(request);
  if (auth.response || !auth.user) return auth.response;
  const rows = await sql`
    DELETE FROM dialer_leads WHERE id = ${params.id}
    RETURNING id, first_name, last_name, company
  `;
  if (!rows[0]) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const leadName = [rows[0].first_name, rows[0].last_name].filter(Boolean).join(" ") || rows[0].company || "Lead";
  await addActivity({
    userId: auth.user.id,
    type: "lead_deleted",
    summary: `Deleted lead ${leadName}`,
    metadata: { leadId: params.id },
  });
  return NextResponse.json({ success: true, deleted: params.id });
}
