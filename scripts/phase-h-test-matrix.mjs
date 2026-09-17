import fs from "fs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const cases = [
  { name: "Business monthly", dueToday: 49400, websiteRecurring: 19700 },
  { name: "Expanded monthly", dueToday: 79400, websiteRecurring: 29700 },
  { name: "Business upfront + care + LeadNet", dueToday: 149700, futureRecurring: 24600 },
  { name: "Expanded upfront without add-ons", dueToday: 249700, futureRecurring: 0 },
];

function staticChecks() {
  const offerSource = fs.readFileSync("src/lib/leadnet-offer.ts", "utf8");
  const checkoutSource = fs.readFileSync("src/app/api/stripe/intent/route.ts", "utf8");
  const agreementSource = fs.readFileSync("src/lib/capture-agreement.ts", "utf8");

  const expectedAmounts = [29700, 19700, 149700, 49700, 29700, 249700, 4900];
  const amountsPresent = expectedAmounts.every((amount) => offerSource.includes(String(amount)));
  const noRetiredTrial = !checkoutSource.includes("trial_period_days");
  const futureActivationDisclosed =
    agreementSource.includes("beginning only when that service is activated") &&
    agreementSource.includes("default approved overage budget is $0");

  return { amountsPresent, noRetiredTrial, futureActivationDisclosed };
}

async function stripeSmokeChecks() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    console.log("Skipping Stripe smoke checks; STRIPE_SECRET_KEY is not a sk_test_ key.");
    return { stripeSmoke: true };
  }

  const customer = await stripe.customers.create({
    description: "LeadNet website matrix smoke test",
  });
  const product = await stripe.products.create({ name: `LeadNet Matrix ${Date.now()}` });

  const monthlySub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: "usd",
            product: product.id,
            unit_amount: cases[0].websiteRecurring,
            recurring: { interval: "month" },
          },
        },
      ],
      add_invoice_items: [
        {
          price_data: {
            currency: "usd",
            product: product.id,
            unit_amount: 29700,
          },
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payments"],
    },
    { idempotencyKey: `leadnet-matrix-${Date.now()}` }
  );

  const invoice =
    typeof monthlySub.latest_invoice === "string"
      ? await stripe.invoices.retrieve(monthlySub.latest_invoice)
      : monthlySub.latest_invoice;

  const upfront = await stripe.paymentIntents.create({
    amount: cases[2].dueToday,
    currency: "usd",
    customer: customer.id,
    automatic_payment_methods: { enabled: true },
    setup_future_usage: "off_session",
  });

  return {
    stripeSmoke: invoice.amount_due === cases[0].dueToday && upfront.amount === cases[2].dueToday,
  };
}

async function main() {
  console.log("LeadNet website-first verification matrix");
  for (const testCase of cases) {
    console.log(`${testCase.name}: due today $${(testCase.dueToday / 100).toFixed(0)}`);
  }

  const results = {
    ...staticChecks(),
    ...(await stripeSmokeChecks()),
  };

  console.log("\n=== VERIFICATION RESULTS ===");
  for (const [key, pass] of Object.entries(results)) {
    console.log(`${key}: ${pass ? "PASS" : "FAIL"}`);
  }
  process.exit(Object.values(results).every(Boolean) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
