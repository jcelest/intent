import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { BRAND_NAME } from "@/lib/seo";
import { updateAgreementStatus } from "@/lib/agreements-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = headers().get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const meta = intent.metadata ?? {};
    
    if (meta.acceptanceId) {
      await updateAgreementStatus(meta.acceptanceId, "payment_completed");
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const notifyEmails = [
      process.env.INQUIRY_NOTIFY_EMAIL,
      process.env.INQUIRY_NOTIFY_EMAIL_2,
    ].filter((email): email is string => !!email?.trim());

    if (resendApiKey && notifyEmails.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "Intent <onboarding@resend.dev>",
          to: notifyEmails,
          subject: `New start: ${meta.path || "engagement"} | ${BRAND_NAME}`,
          html: `
            <h2>Someone started</h2>
            <p><strong>Path:</strong> ${meta.path || ""}</p>
            <p><strong>Name:</strong> ${meta.name || ""}</p>
            <p><strong>Company:</strong> ${meta.company || ""}</p>
            <p><strong>Email:</strong> ${meta.email || ""}</p>
            <p><strong>Phone:</strong> ${meta.phone || ""}</p>
            <p><strong>Amount:</strong> ${(intent.amount / 100).toFixed(0)} ${intent.currency.toUpperCase()}</p>
            <p><strong>Stripe:</strong> ${intent.id}</p>
          `,
        }),
      });
    }
  }

  return NextResponse.json({ received: true });
}
