import { NextResponse } from "next/server";
import { getStripe, resolvePaymentIntentFromInvoice } from "@/lib/stripe";
import { SITE_URL } from "@/lib/seo";
import type { LeadNetOrderSnapshot } from "@/lib/leadnet-offer";
import {
  getWebsiteMonthlyPriceId,
  getWebsiteSetupPriceId,
  getWebsiteUpfrontPriceId,
  isStripeLiveMode,
  missingStripePriceEnvNames,
} from "@/lib/stripe-price-ids";
import * as db from "@/lib/db";

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

async function validatedPriceAmount(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  priceId: string,
  expectedAmountCents: number
) {
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || price.unit_amount !== expectedAmountCents || price.currency !== "usd") {
    throw new Error("Configured Stripe price does not match the accepted order.");
  }
  return price;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe billing is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const acceptanceId = String(body?.acceptanceId ?? "");
  if (!acceptanceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return NextResponse.json({ error: "Invalid agreement record." }, { status: 400 });
  }

  const record = await db.getAgreementByAcceptanceId(acceptanceId);
  const order = parseSnapshot(record?.order_snapshot);
  if (!record || !record.stripe_customer_id || !order) {
    return NextResponse.json({ error: "Agreement record not found." }, { status: 404 });
  }
  if (record.payment_status === "payment_completed") {
    return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
  }

  const missingPriceEnvNames = missingStripePriceEnvNames(order);
  if (isStripeLiveMode() && missingPriceEnvNames.length) {
    return NextResponse.json(
      { error: `Live Stripe price IDs are not configured: ${missingPriceEnvNames.join(", ")}` },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;
  const returnUrl = `${origin.replace(/\/$/, "")}/begin/signed`;

  try {
    if (record.stripe_payment_intent_id) {
      const paymentIntent = await stripe.paymentIntents.retrieve(record.stripe_payment_intent_id);
      if (paymentIntent.client_secret) {
        return NextResponse.json({ clientSecret: paymentIntent.client_secret, returnUrl });
      }
    }

    if (order.selection.paymentMode === "monthly") {
      const websiteRecurring = order.recurringWebsiteCharges[0];
      const setupLine = order.oneTimeCharges.find((charge) => charge.id === "website-setup");

      if (!websiteRecurring || !setupLine) {
        return NextResponse.json({ error: "Invalid monthly order." }, { status: 400 });
      }

      const monthlyPriceId = getWebsiteMonthlyPriceId(order);
      const setupPriceId = getWebsiteSetupPriceId(order);
      let subscriptionItems;
      let setupInvoiceItem;

      if (monthlyPriceId && setupPriceId) {
        await validatedPriceAmount(stripe, monthlyPriceId, websiteRecurring.amountCents);
        await validatedPriceAmount(stripe, setupPriceId, setupLine.amountCents);
        subscriptionItems = [{ price: monthlyPriceId }];
        setupInvoiceItem = { price: setupPriceId };
      } else {
        const websiteProductId = await getOrCreateProduct(stripe, `${order.package.name} Managed Website`, {
          offerVersion: order.offerVersion,
          websitePackageId: order.package.id,
          kind: "managed_website",
        });
        const setupProductId = await getOrCreateProduct(stripe, `${order.package.name} Setup`, {
          offerVersion: order.offerVersion,
          websitePackageId: order.package.id,
          kind: "website_setup",
        });
        subscriptionItems = [
          {
            price_data: {
              currency: order.currency,
              product: websiteProductId,
              unit_amount: websiteRecurring.amountCents,
              recurring: { interval: "month" as const },
            },
          },
        ];
        setupInvoiceItem = {
          price_data: {
            currency: order.currency,
            product: setupProductId,
            unit_amount: setupLine.amountCents,
          },
        };
      }

      const subscription = await stripe.subscriptions.create(
        {
          customer: record.stripe_customer_id,
          items: subscriptionItems,
          add_invoice_items: [setupInvoiceItem],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          metadata: {
            acceptanceId,
            offerVersion: order.offerVersion,
            paymentMode: order.selection.paymentMode,
            leadnetSelected: String(order.selection.leadNetSelected),
            careSelected: String(order.selection.careSelected),
          },
          expand: ["latest_invoice.payments"],
        },
        { idempotencyKey: `${acceptanceId}:website-subscription` }
      );

      const paymentIntent = await resolvePaymentIntentFromInvoice(stripe, subscription.latest_invoice);
      if (!paymentIntent?.client_secret) {
        return NextResponse.json({ error: "Could not create payment session." }, { status: 500 });
      }

      await db.sql`
        UPDATE agreements
        SET stripe_subscription_id = ${subscription.id},
            stripe_payment_intent_id = ${paymentIntent.id},
            website_subscription_status = ${subscription.status},
            updated_at = CURRENT_TIMESTAMP
        WHERE acceptance_id = ${acceptanceId}
      `;

      return NextResponse.json({ clientSecret: paymentIntent.client_secret, returnUrl });
    }

    const setupFutureUsage =
      order.selection.leadNetSelected || order.selection.careSelected ? "off_session" : undefined;
    const upfrontPriceId = getWebsiteUpfrontPriceId(order);
    if (upfrontPriceId) {
      await validatedPriceAmount(stripe, upfrontPriceId, order.dueTodayCents);
    }
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: order.dueTodayCents,
        currency: order.currency,
        customer: record.stripe_customer_id,
        automatic_payment_methods: { enabled: true },
        setup_future_usage: setupFutureUsage,
        receipt_email: record.customer_email,
        metadata: {
          acceptanceId,
          offerVersion: order.offerVersion,
          paymentMode: order.selection.paymentMode,
          websitePackageId: order.selection.packageId,
          leadnetSelected: String(order.selection.leadNetSelected),
          careSelected: String(order.selection.careSelected),
        },
      },
      { idempotencyKey: `${acceptanceId}:website-payment-intent` }
    );

    if (!paymentIntent.client_secret) {
      return NextResponse.json({ error: "Could not create payment session." }, { status: 500 });
    }

    await db.sql`
      UPDATE agreements
      SET stripe_payment_intent_id = ${paymentIntent.id},
          updated_at = CURRENT_TIMESTAMP
      WHERE acceptance_id = ${acceptanceId}
    `;

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, returnUrl });
  } catch {
    console.error("Stripe checkout creation failed.");
    return NextResponse.json({ error: "Failed to initialize payment." }, { status: 500 });
  }
}
