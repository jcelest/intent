import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { BRAND_NAME } from "@/lib/seo";
import * as db from "@/lib/db";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function resolveAcceptanceId(
  stripe: Stripe,
  eventType: string,
  obj: Record<string, unknown>,
  db: {
    getAgreementByPaymentIntentId: (id: string) => Promise<{ acceptance_id?: string } | undefined>;
  }
): Promise<string | undefined> {
  const direct = obj.metadata as { acceptanceId?: string } | undefined;
  if (direct?.acceptanceId) return direct.acceptanceId;

  const subscriptionRef = obj.subscription;
  if (subscriptionRef) {
    const subscriptionId =
      typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef as { id?: string }).id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.metadata?.acceptanceId) {
        return subscription.metadata.acceptanceId;
      }
    }
  }

  if (eventType.startsWith("payment_intent.") && typeof obj.id === "string") {
    const agreement = await db.getAgreementByPaymentIntentId(obj.id);
    if (agreement?.acceptance_id) return agreement.acceptance_id;
  }

  return undefined;
}

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
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const obj = event.data.object as unknown as Record<string, unknown>;
  const acceptanceId = await resolveAcceptanceId(stripe, event.type, obj, db);
  const agreement = acceptanceId ? await db.getAgreementByAcceptanceId(acceptanceId) : null;

  const isNew = await db.processStripeEvent(event.id, event.type, acceptanceId);
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "invoice.paid": {
      if (obj.billing_reason === "subscription_create") {
        const subscriptionId =
          typeof obj.subscription === "string" ? obj.subscription : undefined;

        if (
          !agreement ||
          !acceptanceId ||
          subscriptionId !== agreement.stripe_subscription_id ||
          obj.customer !== agreement.stripe_customer_id
        ) {
          console.error("Stripe invoice validation failed against database agreement.", {
            invoice_id: obj.id,
            acceptanceId,
          });
          await db.markEventFailed(event.id);
          return NextResponse.json({ error: "Validation failed" }, { status: 400 });
        }

        const paidAt = (obj.status_transitions as { paid_at?: number } | undefined)?.paid_at;
        if (!paidAt) {
          console.error("Stripe invoice missing paid_at timestamp.", { invoice_id: obj.id });
          await db.markEventFailed(event.id);
          return NextResponse.json({ error: "Missing paid_at timestamp" }, { status: 500 });
        }

        const trialEndTimestamp = paidAt + 30 * 24 * 60 * 60;

        if (agreement.recurring_billing_start_at) {
          const existingStart = Math.floor(
            new Date(agreement.recurring_billing_start_at).getTime() / 1000
          );
          if (existingStart !== trialEndTimestamp) {
            console.error("recurring_billing_start_at mismatch.", { existingStart, trialEndTimestamp });
            await db.markEventFailed(event.id);
            return NextResponse.json({ error: "Timestamp mismatch" }, { status: 500 });
          }
        } else {
          try {
            await stripe.subscriptions.update(subscriptionId!, {
              trial_end: trialEndTimestamp,
              proration_behavior: "none",
            });
          } catch (err) {
            console.error("Failed to sync deterministic 30-day trial clock:", err);
            await db.markEventFailed(event.id);
            return NextResponse.json({ error: "Failed to update subscription trial_end" }, { status: 500 });
          }

          await db.updateAgreementStatus(
            acceptanceId,
            "payment_completed",
            "active",
            new Date(paidAt * 1000),
            new Date(trialEndTimestamp * 1000)
          );

          const resendApiKey = process.env.RESEND_API_KEY;
          const notifyEmails = [
            process.env.INQUIRY_NOTIFY_EMAIL,
            process.env.INQUIRY_NOTIFY_EMAIL_2,
          ].filter((email): email is string => !!email?.trim());

          const metadata = obj.metadata as { name?: string; company?: string; email?: string } | undefined;

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
                subject: `New LeadNet start | ${BRAND_NAME}`,
                html: `
                  <h2>Someone started LeadNet</h2>
                  <p><strong>Name:</strong> ${metadata?.name || agreement.customer_name || ""}</p>
                  <p><strong>Company:</strong> ${metadata?.company || agreement.company_name || ""}</p>
                  <p><strong>Email:</strong> ${(obj.customer_email as string) || metadata?.email || agreement.customer_email || ""}</p>
                  <p><strong>Amount Paid:</strong> ${((obj.amount_paid as number) / 100).toFixed(0)} ${String(obj.currency || "usd").toUpperCase()}</p>
                  <p><strong>Stripe Invoice:</strong> ${obj.id}</p>
                `,
              }),
            });
          }
        }
      } else if (acceptanceId) {
        await db.updateSubscriptionStatus(acceptanceId, "active");
      }
      break;
    }
    case "invoice.payment_failed": {
      if (!acceptanceId) break;
      if (obj.billing_reason === "subscription_create") {
        await db.updateAgreementStatus(acceptanceId, "payment_failed", "past_due");
      } else {
        await db.updateSubscriptionStatus(acceptanceId, "past_due");
      }
      break;
    }
    case "payment_intent.succeeded":
      // Canonical setup completion is invoice.paid (subscription_create).
      break;
    case "payment_intent.payment_failed":
      // Canonical initial failure is invoice.payment_failed (subscription_create).
      if (acceptanceId && agreement?.payment_status === "pending_payment") {
        await db.updateAgreementStatus(acceptanceId, "payment_failed");
      }
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (acceptanceId && typeof obj.status === "string") {
        await db.updateSubscriptionStatus(acceptanceId, obj.status);
      }
      break;
    }
    case "customer.subscription.deleted": {
      if (acceptanceId) {
        await db.updateSubscriptionStatus(acceptanceId, "canceled");
      }
      break;
    }
    default:
      break;
  }

  await db.completeStripeEvent(event.id);
  return NextResponse.json({ received: true });
}
