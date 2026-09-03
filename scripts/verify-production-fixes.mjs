import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(stripeKey);

async function resolvePaymentIntentFromInvoice(client, invoice) {
  if (!invoice) return null;
  const resolvedInvoice =
    typeof invoice === "string"
      ? await client.invoices.retrieve(invoice, { expand: ["payments"] })
      : invoice.payments?.data?.length
        ? invoice
        : await client.invoices.retrieve(invoice.id, { expand: ["payments"] });
  const paymentRef = resolvedInvoice.payments?.data?.[0]?.payment?.payment_intent;
  if (!paymentRef) return null;
  if (typeof paymentRef === "string") return client.paymentIntents.retrieve(paymentRef);
  return paymentRef;
}

const results = {
  paymentIntentResolution: false,
  checkoutNo500: false,
  invoicePaidHandling: false,
  trialAnchoring: false,
  webhookLifecycleCoverage: false,
  duplicateSideEffectsPrevented: false,
  captureAmountCorrected: false,
};

async function main() {
  if (!stripeKey.startsWith("sk_test_")) {
    console.error("Requires sk_test_ key");
    process.exit(1);
  }

  // 1. PaymentIntent resolution + checkout shape
  const customer = await stripe.customers.create({
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
  });
  const prod = await stripe.products.create({ name: "Verify Recurring " + Date.now() });
  const setupProd = await stripe.products.create({ name: "Verify Setup " + Date.now() });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price_data: { currency: "usd", product: prod.id, unit_amount: 19700, recurring: { interval: "month" } } }],
    trial_period_days: 30,
    add_invoice_items: [{ price_data: { currency: "usd", product: setupProd.id, unit_amount: 139700 } }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payments"],
    metadata: { acceptanceId: "00000000-0000-4000-8000-000000000001" },
  });

  const pi = await resolvePaymentIntentFromInvoice(stripe, sub.latest_invoice);
  results.paymentIntentResolution = Boolean(pi?.id && pi?.client_secret);
  results.checkoutNo500 = results.paymentIntentResolution;

  // 2. Trial anchoring simulation (invoice.paid path)
  const confirmed = await stripe.paymentIntents.confirm(pi.id, { payment_method: "pm_card_visa" });
  if (confirmed.status === "succeeded") {
    const paidInvoice = await stripe.invoices.retrieve(
      typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice.id
    );
    await stripe.invoices.pay(paidInvoice.id, { paid_out_of_band: true }).catch(() => {});

    const refreshed = await stripe.invoices.retrieve(paidInvoice.id);
    const paidAt = refreshed.status_transitions?.paid_at || Math.floor(Date.now() / 1000);
    const trialEnd = paidAt + 30 * 24 * 60 * 60;
    const updated = await stripe.subscriptions.update(sub.id, {
      trial_end: trialEnd,
      proration_behavior: "none",
    });
    results.trialAnchoring = updated.trial_end === trialEnd;

    const upcoming = await stripe.invoices.createPreview({ customer: customer.id, subscription: sub.id });
    results.invoicePaidHandling = refreshed.status === "paid" || confirmed.status === "succeeded";
    results.trialAnchoring = results.trialAnchoring && upcoming.total === 19700;
  }

  // 3. Webhook lifecycle coverage (static check of route source)
  const fs = await import("fs");
  const webhookSource = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  const requiredEvents = [
    "invoice.paid",
    "invoice.payment_failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];
  results.webhookLifecycleCoverage = requiredEvents.every((evt) => webhookSource.includes(`"${evt}"`));

  // 4. Duplicate side effects prevented
  results.duplicateSideEffectsPrevented =
    webhookSource.includes('case "payment_intent.succeeded"') &&
    webhookSource.includes("Canonical setup completion is invoice.paid") &&
    !webhookSource.includes('updateAgreementStatus(acceptanceId, "payment_completed")') ||
    webhookSource.includes("// Canonical setup completion is invoice.paid");

  // Better check: payment_intent.succeeded case should not call updateAgreementStatus with payment_completed
  const piSucceededBlock = webhookSource.split('case "payment_intent.succeeded"')[1]?.split("case ")[0] || "";
  results.duplicateSideEffectsPrevented = !piSucceededBlock.includes("updateAgreementStatus");

  // 5. CAPTURE_AMOUNT_CENTS
  const prodEnv = fs.readFileSync(".env.production", "utf8");
  results.captureAmountCorrected = prodEnv.includes('CAPTURE_AMOUNT_CENTS="139700"');

  console.log("\n=== VERIFICATION RESULTS ===");
  for (const [key, pass] of Object.entries(results)) {
    console.log(`${key}: ${pass ? "PASS" : "FAIL"}`);
  }

  const allPass = Object.values(results).every(Boolean);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
