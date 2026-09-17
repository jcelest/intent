import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import type { LeadNetOrderSnapshot } from "@/lib/leadnet-offer";
import * as db from "@/lib/db";
import type Stripe from "stripe";

export const runtime = "nodejs";

function parseSnapshot(value: unknown): LeadNetOrderSnapshot | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as LeadNetOrderSnapshot;
    } catch {
      return null;
    }
  }
  return value as LeadNetOrderSnapshot;
}

async function resolveAcceptanceId(
  stripe: Stripe,
  eventType: string,
  obj: Record<string, unknown>
): Promise<string | undefined> {
  const metadata = obj.metadata as { acceptanceId?: string } | undefined;
  if (metadata?.acceptanceId) return metadata.acceptanceId;

  const subscriptionRef = obj.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : (subscriptionRef as { id?: string } | undefined)?.id;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.metadata?.acceptanceId;
  }

  const parent = obj.parent as
    | { subscription_details?: { subscription?: string; metadata?: { acceptanceId?: string } } }
    | undefined;
  if (parent?.subscription_details?.metadata?.acceptanceId) {
    return parent.subscription_details.metadata.acceptanceId;
  }
  if (parent?.subscription_details?.subscription) {
    const subscription = await stripe.subscriptions.retrieve(parent.subscription_details.subscription);
    return subscription.metadata?.acceptanceId;
  }

  if (eventType.startsWith("payment_intent.") && typeof obj.id === "string") {
    const agreement = await db.getAgreementByPaymentIntentId(obj.id);
    return agreement?.acceptance_id;
  }

  return undefined;
}

async function saveReusablePaymentMethodIfNeeded(
  stripe: Stripe,
  agreement: Record<string, unknown>,
  order: LeadNetOrderSnapshot | null,
  paymentMethod: unknown
) {
  if (!order?.selection.leadNetSelected && !order?.selection.careSelected) return;
  if (typeof paymentMethod !== "string") return;
  if (typeof agreement.stripe_customer_id !== "string") return;
  await stripe.customers.update(agreement.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethod },
  });
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
  const acceptanceId = await resolveAcceptanceId(stripe, event.type, obj);
  const agreement = acceptanceId ? await db.getAgreementByAcceptanceId(acceptanceId) : null;
  const order = agreement ? parseSnapshot(agreement.order_snapshot) : null;

  const isNew = await db.processStripeEvent(event.id, event.type, acceptanceId);
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        if (!acceptanceId || !agreement || !order) break;
        const subscriptionId =
          typeof obj.subscription === "string"
            ? obj.subscription
            : (obj.parent as { subscription_details?: { subscription?: string } } | undefined)
                ?.subscription_details?.subscription;

        if (
          order.selection.paymentMode !== "monthly" ||
          !subscriptionId ||
          subscriptionId !== agreement.stripe_subscription_id ||
          obj.customer !== agreement.stripe_customer_id
        ) {
          await db.markEventFailed(event.id);
          return NextResponse.json({ error: "Validation failed" }, { status: 400 });
        }

        const paidAtSeconds =
          (obj.status_transitions as { paid_at?: number } | undefined)?.paid_at || event.created;
        const invoice = obj as unknown as Stripe.Invoice;
        const paymentIntentId =
          typeof invoice.payments?.data?.[0]?.payment?.payment_intent === "string"
            ? invoice.payments.data[0].payment.payment_intent
            : undefined;
        const paymentIntent = paymentIntentId
          ? await stripe.paymentIntents.retrieve(paymentIntentId)
          : null;

        await saveReusablePaymentMethodIfNeeded(stripe, agreement, order, paymentIntent?.payment_method);

        await db.sql`
          UPDATE agreements
          SET payment_status = 'payment_completed',
              subscription_status = 'active',
              website_subscription_status = 'active',
              initial_payment_paid_at = ${new Date(paidAtSeconds * 1000)},
              payment_completed_at = CURRENT_TIMESTAMP,
              onboarding_status = 'payment_confirmed',
              service_states = jsonb_set(
                COALESCE(service_states, '{}'::jsonb),
                '{payment}',
                '"paid"'::jsonb,
                true
              ),
              updated_at = CURRENT_TIMESTAMP
          WHERE acceptance_id = ${acceptanceId}
        `;
        break;
      }
      case "invoice.payment_failed": {
        if (!acceptanceId) break;
        await db.sql`
          UPDATE agreements
          SET payment_status = CASE WHEN payment_status = 'payment_completed' THEN payment_status ELSE 'payment_failed' END,
              subscription_status = 'past_due',
              website_subscription_status = CASE WHEN website_subscription_status IS NULL THEN website_subscription_status ELSE 'past_due' END,
              updated_at = CURRENT_TIMESTAMP
          WHERE acceptance_id = ${acceptanceId}
        `;
        break;
      }
      case "payment_intent.succeeded": {
        if (!acceptanceId || !agreement || !order) break;
        if (order.selection.paymentMode === "monthly") break;
        if (obj.customer !== agreement.stripe_customer_id) {
          await db.markEventFailed(event.id);
          return NextResponse.json({ error: "Validation failed" }, { status: 400 });
        }
        await saveReusablePaymentMethodIfNeeded(stripe, agreement, order, obj.payment_method);
        await db.sql`
          UPDATE agreements
          SET payment_status = 'payment_completed',
              initial_payment_paid_at = ${new Date(event.created * 1000)},
              payment_completed_at = CURRENT_TIMESTAMP,
              onboarding_status = 'payment_confirmed',
              service_states = jsonb_set(
                COALESCE(service_states, '{}'::jsonb),
                '{payment}',
                '"paid"'::jsonb,
                true
              ),
              updated_at = CURRENT_TIMESTAMP
          WHERE acceptance_id = ${acceptanceId}
        `;
        break;
      }
      case "payment_intent.payment_failed": {
        if (!acceptanceId) break;
        await db.sql`
          UPDATE agreements
          SET payment_status = 'payment_failed',
              updated_at = CURRENT_TIMESTAMP
          WHERE acceptance_id = ${acceptanceId}
            AND payment_status <> 'payment_completed'
        `;
        break;
      }
      case "customer.subscription.updated": {
        if (!acceptanceId || typeof obj.status !== "string") break;
        const service = (obj.metadata as { service?: string } | undefined)?.service;
        if (service === "care") {
          await db.sql`
            UPDATE agreements
            SET care_subscription_status = ${obj.status},
                updated_at = CURRENT_TIMESTAMP
            WHERE acceptance_id = ${acceptanceId}
          `;
        } else if (service === "leadnet") {
          await db.sql`
            UPDATE agreements
            SET leadnet_subscription_status = ${obj.status},
                updated_at = CURRENT_TIMESTAMP
            WHERE acceptance_id = ${acceptanceId}
          `;
        } else {
          await db.updateSubscriptionStatus(acceptanceId, obj.status);
        }
        break;
      }
      case "customer.subscription.deleted": {
        if (!acceptanceId) break;
        const service = (obj.metadata as { service?: string } | undefined)?.service;
        if (service === "care") {
          await db.sql`
            UPDATE agreements
            SET care_subscription_status = 'canceled',
                updated_at = CURRENT_TIMESTAMP
            WHERE acceptance_id = ${acceptanceId}
          `;
        } else if (service === "leadnet") {
          await db.sql`
            UPDATE agreements
            SET leadnet_subscription_status = 'canceled',
                updated_at = CURRENT_TIMESTAMP
            WHERE acceptance_id = ${acceptanceId}
          `;
        } else {
          await db.updateSubscriptionStatus(acceptanceId, "canceled");
        }
        break;
      }
      default:
        break;
    }

    await db.completeStripeEvent(event.id);
    return NextResponse.json({ received: true });
  } catch {
    await db.markEventFailed(event.id);
    console.error("Stripe webhook processing failed.");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
