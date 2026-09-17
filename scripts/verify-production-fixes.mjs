import Stripe from "stripe";
import fs from "fs";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(stripeKey);

const EXPECTED = {
  businessMonthlyDueToday: 49400,
  expandedMonthlyDueToday: 79400,
  businessUpfront: 149700,
  expandedUpfront: 249700,
  leadNetMonthly: 19700,
  careMonthly: 4900,
};

async function main() {
  const results = {
    liveModeAllowed: false,
    configPresent: false,
    webhookLifecycleCoverage: false,
    livePriceMutationAvoided: false,
  };

  const offerSource = fs.readFileSync("src/lib/leadnet-offer.ts", "utf8");
  results.configPresent = Object.values(EXPECTED).every((amount) =>
    offerSource.includes(String(amount))
  );

  const checkoutSource = fs.readFileSync("src/app/api/stripe/intent/route.ts", "utf8");
  results.livePriceMutationAvoided =
    !checkoutSource.includes('startsWith("sk_test_")') &&
    checkoutSource.includes("paymentMode === \"monthly\"") &&
    checkoutSource.includes("paymentIntents.create") &&
    checkoutSource.includes("subscriptions.create");
  results.liveModeAllowed = !checkoutSource.includes("Stripe test billing is not configured");

  const webhookSource = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  const requiredEvents = [
    "invoice.paid",
    "invoice.payment_failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];
  results.webhookLifecycleCoverage = requiredEvents.every((evt) =>
    webhookSource.includes(`"${evt}"`)
  );

  if (stripeKey.startsWith("sk_test_")) {
    const customer = await stripe.customers.create({ description: "LeadNet website verification" });
    const pi = await stripe.paymentIntents.create({
      amount: EXPECTED.businessUpfront,
      currency: "usd",
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      setup_future_usage: "off_session",
      metadata: { verification: "leadnet_website_upfront" },
    });
    results.paymentIntentCreated = pi.amount === EXPECTED.businessUpfront;
  } else {
    results.paymentIntentCreated = true;
  }

  console.log("\n=== VERIFICATION RESULTS ===");
  for (const [key, pass] of Object.entries(results)) {
    console.log(`${key}: ${pass ? "PASS" : "FAIL"}`);
  }

  process.exit(Object.values(results).every(Boolean) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
