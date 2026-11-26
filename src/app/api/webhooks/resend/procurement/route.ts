import { NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";
import { enqueueProcurementEmailEvent, processProcurementInbox } from "@/lib/procurement-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    console.error("Procurement inbox webhook is not configured.");
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }

  const rawPayload = await request.text();
  let event;
  try {
    event = new Resend(apiKey).webhooks.verify({
      payload: rawPayload,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true, eventType: event.type });
  }

  try {
    const queued = await enqueueProcurementEmailEvent(
      event as EmailReceivedEvent,
      request.headers.get("svix-id") || "",
      rawPayload,
    );
    const processing = queued.status === "processed"
      ? { attempted: 0, outcomes: [{ id: queued.id, status: "already_processed" }] }
      : await processProcurementInbox({ id: queued.id, limit: 1 });
    // Once the event is durable, acknowledge it even if downstream processing failed.
    // The authenticated cron recovers failed and leased messages without duplicating alerts.
    return NextResponse.json({ ok: true, queued, processing });
  } catch (error) {
    console.error("Procurement inbox enqueue failed", error);
    // No durable queue record is guaranteed here, so ask Resend to retry the webhook.
    return NextResponse.json({ ok: false, error: "Unable to persist inbound event" }, { status: 500 });
  }
}
