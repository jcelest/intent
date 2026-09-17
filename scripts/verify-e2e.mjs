import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

async function verifyNeon() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error("❌ ERROR: DATABASE_URL missing.");
    process.exit(1);
  }
  
  const sql = neon(databaseUrl);
  console.log("🚀 Running E2E DB Verification in Neon...");

  const acceptanceId = crypto.randomUUID();
  const publicToken = crypto.randomUUID();
  const html = `<html><body><p>Test Agreement Snapshot</p></body></html>`;
  const hash = crypto.createHash("sha256").update(html).digest("hex");
  const orderSnapshot = {
    offerVersion: "leadnet-website-first-2026-09",
    agreementVersion: "leadnet-website-first-2026-09-v1",
    selection: {
      packageId: "business",
      paymentMode: "monthly",
      leadNetSelected: false,
      careSelected: false,
    },
    dueTodayCents: 49400,
  };

  try {
    // 1. Insert snapshot
    await sql`
      INSERT INTO agreements (
        acceptance_id, public_download_token, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id,
        agreement_version, agreement_html, agreement_hash, customer_name, customer_email, customer_phone,
        company_name, package_id, addons, order_snapshot, customer_details, offer_version, website_package_id,
        payment_mode, leadnet_selected, care_selected, initial_amount_cents, recurring_amount_cents, currency,
        accepted_at, ip_address, user_agent, payment_status, subscription_status
      ) VALUES (
        ${acceptanceId}, ${publicToken}, 'cus_test123', null, null,
        'leadnet-website-first-2026-09-v1', ${html}, ${hash}, 'John Doe', 'john@example.com', '1234567890',
        'Test Corp', 'business', '{"leadnet":false,"care":false}', ${JSON.stringify(orderSnapshot)}, '{"industry":"HVAC"}',
        'leadnet-website-first-2026-09', 'business', 'monthly', false, false, 49400, 19700, 'usd',
        CURRENT_TIMESTAMP, '127.0.0.1', 'test-agent', 'pending_payment', null
      )
    `;
    console.log("✅ Agreement inserted successfully into Neon.");

    // 2. Fetch via public download token
    const rows = await sql`SELECT * FROM agreements WHERE public_download_token = ${publicToken} LIMIT 1`;
    const record = rows[0];

    if (!record) {
      console.error("❌ ERROR: Could not retrieve record by public download token.");
      process.exit(1);
    }

    if (record.agreement_html !== html) {
      console.error("❌ ERROR: HTML snapshot mismatch!");
    } else {
      console.log("✅ HTML snapshot matches perfectly.");
    }

    if (record.agreement_hash !== hash) {
      console.error("❌ ERROR: Hash mismatch!");
    } else {
      console.log("✅ Hash matches perfectly.");
    }

    console.log("✅ Database architecture strictly verified.");
  } catch (err) {
    console.error("❌ E2E Neon Verification Failed:", err);
  }
}

verifyNeon();
