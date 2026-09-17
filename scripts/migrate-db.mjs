import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ ERROR: DATABASE_URL or POSTGRES_URL environment variable is missing.");
  console.error("Please ensure you run this script with the correct env file, e.g.:");
  console.error("node --env-file=.env.local scripts/migrate-db.mjs");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log("🚀 Starting database migration...");

  try {
    console.log("Creating `agreements` table...");
    await sql`
      CREATE TABLE IF NOT EXISTS agreements (
        acceptance_id UUID PRIMARY KEY,
        public_download_token UUID UNIQUE NOT NULL,
        stripe_customer_id VARCHAR(255),
        stripe_payment_intent_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        agreement_version VARCHAR(50),
        agreement_html TEXT NOT NULL,
        agreement_hash VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        package_id VARCHAR(100) NOT NULL,
        addons JSONB,
        order_snapshot JSONB,
        customer_details JSONB,
        offer_version VARCHAR(100),
        website_package_id VARCHAR(100),
        payment_mode VARCHAR(50),
        leadnet_selected BOOLEAN DEFAULT FALSE,
        care_selected BOOLEAN DEFAULT FALSE,
        initial_amount_cents INTEGER NOT NULL,
        recurring_amount_cents INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'usd',
        accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(255),
        user_agent TEXT,
        payment_status VARCHAR(50) DEFAULT 'pending',
        subscription_status VARCHAR(50),
        website_subscription_status VARCHAR(50),
        care_subscription_status VARCHAR(50),
        leadnet_subscription_status VARCHAR(50),
        onboarding_status VARCHAR(50) DEFAULT 'pending',
        build_status VARCHAR(50) DEFAULT 'not_started',
        service_states JSONB,
        stripe_setup_intent_id VARCHAR(255),
        stripe_care_subscription_id VARCHAR(255),
        stripe_leadnet_subscription_id VARCHAR(255),
        initial_payment_paid_at TIMESTAMP WITH TIME ZONE,
        recurring_billing_start_at TIMESTAMP WITH TIME ZONE,
        payment_completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const agreementColumns = [
      ["order_snapshot", "JSONB"],
      ["customer_details", "JSONB"],
      ["offer_version", "VARCHAR(100)"],
      ["website_package_id", "VARCHAR(100)"],
      ["payment_mode", "VARCHAR(50)"],
      ["leadnet_selected", "BOOLEAN DEFAULT FALSE"],
      ["care_selected", "BOOLEAN DEFAULT FALSE"],
      ["website_subscription_status", "VARCHAR(50)"],
      ["care_subscription_status", "VARCHAR(50)"],
      ["leadnet_subscription_status", "VARCHAR(50)"],
      ["onboarding_status", "VARCHAR(50) DEFAULT 'pending'"],
      ["build_status", "VARCHAR(50) DEFAULT 'not_started'"],
      ["service_states", "JSONB"],
      ["stripe_setup_intent_id", "VARCHAR(255)"],
      ["stripe_care_subscription_id", "VARCHAR(255)"],
      ["stripe_leadnet_subscription_id", "VARCHAR(255)"],
      ["initial_payment_paid_at", "TIMESTAMP WITH TIME ZONE"],
      ["recurring_billing_start_at", "TIMESTAMP WITH TIME ZONE"],
    ];
    for (const [name, type] of agreementColumns) {
      await sql(`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }
    console.log("✅ `agreements` table created successfully.");

    console.log("Creating `stripe_events` table...");
    await sql`
      CREATE TABLE IF NOT EXISTS stripe_events (
        event_id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processing_status VARCHAR(50) DEFAULT 'processed',
        acceptance_id UUID REFERENCES agreements(acceptance_id) ON DELETE SET NULL
      );
    `;
    console.log("✅ `stripe_events` table created successfully.");

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
