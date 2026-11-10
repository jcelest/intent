import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { updateClient } from "@/lib/trade-demand";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const client = await updateClient(params.id, await request.json());
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    return NextResponse.json({ client });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
