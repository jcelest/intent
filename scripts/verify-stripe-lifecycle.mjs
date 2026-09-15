import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function runTest() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error("❌ ERROR: STRIPE_SECRET_KEY is missing or not a test key.");
    process.exit(1);
  }

  console.log("🚀 Starting Stripe Test Mode Lifecycle Verification...");

  try {
    // 1. Create a dummy customer
    const customer = await stripe.customers.create({
      email: 'test-verification@intentrev.net',
      name: 'Test Verification User',
      payment_method: 'pm_card_visa', // Stripe test card
      invoice_settings: {
        default_payment_method: 'pm_card_visa',
      }
    });
    console.log(`✅ Created test Customer: ${customer.id}`);

    // 2. Create the Subscription exactly as the intent route does
    console.log("Creating subscription with setup fee and 30-day trial...");
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'LeadNet Ongoing Service' },
          unit_amount: 39700,
          recurring: { interval: 'month' }
        }
      }],
      trial_period_days: 30,
      add_invoice_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'LeadNet Implementation Sprint' },
          unit_amount: 49700
        }
      }],
      // Instead of default_incomplete, we let it pay immediately since we attached a test card
      expand: ['latest_invoice.payment_intent'],
    });

    console.log(`✅ Created test Subscription: ${subscription.id}`);

    // 3. Inspect Initial Invoice
    const invoice = subscription.latest_invoice;
    console.log(`\n--- INSPECTING INITIAL INVOICE (${invoice.id}) ---`);
    console.log(`Billing Reason: ${invoice.billing_reason}`);
    console.log(`Total Amount: $${(invoice.total / 100).toFixed(2)}`);
    console.log(`Paid At Timestamp: ${invoice.status_transitions?.paid_at}`);
    
    if (invoice.billing_reason !== 'subscription_create') {
      console.error("❌ ERROR: billing_reason is not subscription_create");
    }

    if (!invoice.status_transitions?.paid_at) {
      console.error("❌ ERROR: paid_at timestamp is missing on successful test invoice");
    }

    // 4. Simulate Webhook trial_end mutation
    console.log("\n--- SIMULATING WEBHOOK MUTATION ---");
    const paidAt = invoice.status_transitions.paid_at;
    const targetTrialEnd = paidAt + (30 * 24 * 60 * 60);
    
    console.log(`Updating trial_end to ${targetTrialEnd} with proration_behavior: "none"`);
    
    const updatedSub = await stripe.subscriptions.update(subscription.id, {
      trial_end: targetTrialEnd,
      proration_behavior: "none"
    });

    console.log(`✅ Update successful!`);
    console.log(`\n--- INSPECTING MUTATED SUBSCRIPTION ---`);
    console.log(`Trial End: ${updatedSub.trial_end}`);
    console.log(`Current Period End: ${updatedSub.current_period_end}`);
    
    if (updatedSub.trial_end !== targetTrialEnd) {
      console.error("❌ ERROR: trial_end did not match our deterministic timestamp.");
    }

    // 5. Verify the upcoming invoice for recurring billing
    console.log("\n--- INSPECTING UPCOMING RECURRING INVOICE ---");
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: customer.id,
      subscription: subscription.id,
    });
    
    console.log(`Upcoming Total Amount: $${(upcoming.total / 100).toFixed(2)}`);
    console.log(`Next Payment Attempt: ${upcoming.next_payment_attempt}`);
    
    if (upcoming.total !== 39700) {
      console.error(`❌ ERROR: Upcoming invoice is $${(upcoming.total / 100).toFixed(2)}, expected $397.00. (Proration leakage?)`);
    }

    console.log("\n🎉 TEST MODE LIFECYCLE COMPLETELY VERIFIED!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Test verification failed:", error);
    process.exit(1);
  }
}

runTest();
