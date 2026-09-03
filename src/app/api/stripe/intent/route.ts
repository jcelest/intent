import { NextResponse } from "next/server";
import {
  addonAmount,
  getEngagement,
  isStripeConfigured,
  parseAddons,
  parseEngagementId,
} from "@/lib/engagements";
import { getStripe, resolvePaymentIntentFromInvoice } from "@/lib/stripe";
import { SITE_URL } from "@/lib/seo";
import * as db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const engagement = getEngagement(parseEngagementId(body?.path));
  if (engagement.id !== "capture") {
    return NextResponse.json(
      { error: "LeadNet is the only path that takes payment here." },
      { status: 400 }
    );
  }
  const addons = parseAddons(body?.addons);
  const extra = addonAmount(addons);
  if (!engagement.amountCents) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }
  const amount = engagement.amountCents + extra;

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  if (name.length < 2 || !email.includes("@") || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Name, email, and phone are required." },
      { status: 400 }
    );
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;
  const acceptanceId = String(body?.acceptanceId ?? "");
  
  // ensure we have a valid uuid or fallback
  if (!acceptanceId || !acceptanceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json({ error: "Invalid agreement record." }, { status: 400 });
  }

  // Get customer id from DB using acceptanceId
  const record = await db.getAgreementByAcceptanceId(acceptanceId);
  
  if (!record || !record.stripe_customer_id) {
    return NextResponse.json({ error: "Agreement record not found." }, { status: 404 });
  }

  try {
    // Dynamically fetch or create Products (since Stripe subscriptions.create price_data does not support product_data)
    let recurringProductId;
    const recurringSearch = await stripe.products.search({ query: 'name~"LeadNet Ongoing Service"', limit: 1 });
    if (recurringSearch.data.length > 0) {
      recurringProductId = recurringSearch.data[0].id;
    } else {
      const prod = await stripe.products.create({ name: 'LeadNet Ongoing Service' });
      recurringProductId = prod.id;
    }

    const setupName = extra ? `${engagement.title} with add-ons Implementation Sprint` : `${engagement.title} Implementation Sprint`;
    let setupProductId;
    const setupSearch = await stripe.products.search({ query: `name~"${setupName}"`, limit: 1 });
    if (setupSearch.data.length > 0) {
      setupProductId = setupSearch.data[0].id;
    } else {
      const prod = await stripe.products.create({ name: setupName });
      setupProductId = prod.id;
    }

    const subscription = await stripe.subscriptions.create({
      customer: record.stripe_customer_id,
      items: [{
        price_data: {
          currency: 'usd',
          product: recurringProductId,
          unit_amount: 19700,
          recurring: {
            interval: 'month'
          }
        }
      }],
      trial_period_days: 30,
      add_invoice_items: [{
        price_data: {
          currency: 'usd',
          product: setupProductId,
          unit_amount: amount
        }
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payments'],
      metadata: {
        acceptanceId,
        path: engagement.id,
        addons: addons.join(",")
      }
    }, {
      idempotencyKey: acceptanceId
    });

    const invoice = subscription.latest_invoice;
    const paymentIntent = await resolvePaymentIntentFromInvoice(stripe, invoice);

    if (!paymentIntent?.client_secret) {
      console.error("Could not resolve PaymentIntent from invoice payments.", {
        acceptanceId,
        subscriptionId: subscription.id,
        invoiceId: typeof invoice === "string" ? invoice : invoice?.id,
      });
      return NextResponse.json(
        { error: "Could not create payment session. PaymentIntent missing." },
        { status: 500 }
      );
    }

    // Update DB with subscription ID and intent ID
    await db.sql`
      UPDATE agreements 
      SET stripe_subscription_id = ${subscription.id}, stripe_payment_intent_id = ${paymentIntent.id}
      WHERE acceptance_id = ${acceptanceId}
    `;

    const afterPay = "/begin/signed";

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      returnUrl: `${origin.replace(/\/$/, "")}${afterPay}`,
    });
  } catch (error) {
    console.error("Stripe subscription error:", error);
    return NextResponse.json({ error: "Failed to initialize payment." }, { status: 500 });
  }
}
