import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a Stripe secret key.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const mode = stripeKey.startsWith("sk_live_") ? "live" : "test";
const suffix = "leadnet_website_first_2026_09_speed_to_lead";

const definitions = [
  {
    env: "STRIPE_PRICE_BUSINESS_WEBSITE_SETUP",
    productName: "Business Website Setup",
    lookupKey: `business_website_setup_${suffix}`,
    amount: 29700,
  },
  {
    env: "STRIPE_PRICE_BUSINESS_WEBSITE_MONTHLY",
    productName: "Business Website Managed Website",
    lookupKey: `business_website_monthly_${suffix}`,
    amount: 19700,
    recurring: { interval: "month" },
  },
  {
    env: "STRIPE_PRICE_BUSINESS_WEBSITE_UPFRONT",
    productName: "Business Website Purchase",
    lookupKey: `business_website_upfront_${suffix}`,
    amount: 149700,
  },
  {
    env: "STRIPE_PRICE_EXPANDED_WEBSITE_SETUP",
    productName: "Expanded Website Setup",
    lookupKey: `expanded_website_setup_${suffix}`,
    amount: 49700,
  },
  {
    env: "STRIPE_PRICE_EXPANDED_WEBSITE_MONTHLY",
    productName: "Expanded Website Managed Website",
    lookupKey: `expanded_website_monthly_${suffix}`,
    amount: 29700,
    recurring: { interval: "month" },
  },
  {
    env: "STRIPE_PRICE_EXPANDED_WEBSITE_UPFRONT",
    productName: "Expanded Website Purchase",
    lookupKey: `expanded_website_upfront_${suffix}`,
    amount: 249700,
  },
  {
    env: "STRIPE_PRICE_WEBSITE_CARE_MONTHLY",
    productName: "Website Care",
    lookupKey: `website_care_monthly_${suffix}`,
    amount: 4900,
    recurring: { interval: "month" },
  },
  {
    env: "STRIPE_PRICE_LEADNET_SPEED_TO_LEAD_MONTHLY",
    productName: "LeadNet Speed To Lead",
    lookupKey: `leadnet_speed_to_lead_monthly_${suffix}`,
    amount: 19700,
    recurring: { interval: "month" },
  },
];

async function productFor(name) {
  const found = await stripe.products.search({ query: `name:"${name}"`, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.products.create({
    name,
    metadata: {
      offer: "leadnet-website-first",
      mode,
    },
  });
}

async function priceFor(definition) {
  const existing = await stripe.prices.list({
    lookup_keys: [definition.lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];

  const product = await productFor(definition.productName);
  return stripe.prices.create({
    currency: "usd",
    unit_amount: definition.amount,
    product: product.id,
    lookup_key: definition.lookupKey,
    recurring: definition.recurring,
    metadata: {
      offer: "leadnet-website-first",
      mode,
      env: definition.env,
    },
  });
}

const created = [];
for (const definition of definitions) {
  const price = await priceFor(definition);
  const recurring = price.recurring ? `/${price.recurring.interval}` : "one-time";
  created.push({ ...definition, price, recurring });
}

console.log(`Stripe ${mode} Price IDs`);
for (const item of created) {
  const amount = `$${(item.amount / 100).toFixed(0)}`;
  console.log(`${item.env}=${item.price.id} # ${item.productName}, ${amount} ${item.recurring}`);
}

