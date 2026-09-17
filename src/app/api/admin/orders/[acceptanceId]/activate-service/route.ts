import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getStripe } from "@/lib/stripe";
import {
  WEBSITE_CARE,
  type LeadNetOrderSnapshot,
} from "@/lib/leadnet-offer";
import * as db from "@/lib/db";

export const runtime = "nodejs";

type ServiceId = "care" | "leadnet";

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

function isServiceId(value: unknown): value is ServiceId {
  return value === "care" || value === "leadnet";
}

async function getOrCreateProduct(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  name: string,
  metadata: Record<string, string>
) {
  const search = await stripe.products.search({ query: `name:"${name}"`, limit: 1 });
  if (search.data[0]) return search.data[0].id;
  const product = await stripe.products.create({ name, metadata });
  return product.id;
}

export async function POST(
  request: Request,
  { params }: { params: { acceptanceId: string } }
) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    return NextResponse.json({ error: "Stripe test billing is not configured." }, { status: 503 });
  }

  const acceptanceId = params.acceptanceId;
  const body = await request.json().catch(() => null);
  const service = body?.service;
  if (!isServiceId(service)) {
    return NextResponse.json({ error: "Service must be care or leadnet." }, { status: 400 });
  }

  const record = await db.getAgreementByAcceptanceId(acceptanceId);
  const order = parseSnapshot(record?.order_snapshot);
  if (!record || !order || !record.stripe_customer_id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (record.payment_status !== "payment_completed") {
    return NextResponse.json({ error: "Initial website payment is not completed." }, { status: 409 });
  }

  const selected =
    service === "care" ? order.selection.careSelected : order.selection.leadNetSelected;
  if (!selected) {
    return NextResponse.json({ error: "Service was not selected in this order." }, { status: 409 });
  }
  if (service === "care" && order.selection.paymentMode !== "upfront") {
    return NextResponse.json({ error: "Website Care is only available for upfront website buyers." }, { status: 409 });
  }
  if (service === "leadnet") {
    return NextResponse.json(
      {
        error:
          "LeadNet activation is disabled until companion-app usage controls are connected.",
        requiredControls: [
          "verified client/account mapping",
          "provider message IDs",
          "segment counts for inbound and outbound SMS",
          "billing-period usage records",
          "outbound reservation and approved-budget enforcement",
          "provider reconciliation",
        ],
      },
      { status: 409 }
    );
  }

  const existingSubscriptionId =
    service === "care" ? record.stripe_care_subscription_id : record.stripe_leadnet_subscription_id;
  if (existingSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      idempotent: true,
    });
  }

  const customer = await stripe.customers.retrieve(record.stripe_customer_id);
  if (customer.deleted || !customer.invoice_settings.default_payment_method) {
    return NextResponse.json(
      { error: "No saved payment method is available. Send the customer through the billing portal first." },
      { status: 409 }
    );
  }

  const productId = await getOrCreateProduct(stripe, WEBSITE_CARE.name, {
    offerVersion: order.offerVersion,
    kind: "website_care",
  });

  const subscription = await stripe.subscriptions.create(
    {
      customer: record.stripe_customer_id,
      items: [
        {
          price_data: {
            currency: order.currency,
            product: productId,
            unit_amount: WEBSITE_CARE.monthlyCents,
            recurring: { interval: "month" },
          },
        },
      ],
      metadata: {
        acceptanceId,
        offerVersion: order.offerVersion,
        service,
      },
    },
    { idempotencyKey: `${acceptanceId}:${service}:activate` }
  );

  await db.sql`
    UPDATE agreements
    SET stripe_care_subscription_id = ${subscription.id},
        care_subscription_status = ${subscription.status},
        service_states = jsonb_set(
          COALESCE(service_states, '{}'::jsonb),
          '{careActivation}',
          ${JSON.stringify(subscription.status)}::jsonb,
          true
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE acceptance_id = ${acceptanceId}
  `;

  return NextResponse.json({
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}
