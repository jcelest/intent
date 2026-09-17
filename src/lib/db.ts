import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');

export async function createTables() {
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
      payment_completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS order_snapshot JSONB`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS customer_details JSONB`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS offer_version VARCHAR(100)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS website_package_id VARCHAR(100)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS leadnet_selected BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS care_selected BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS website_subscription_status VARCHAR(50)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS care_subscription_status VARCHAR(50)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS leadnet_subscription_status VARCHAR(50)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'pending'`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS build_status VARCHAR(50) DEFAULT 'not_started'`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS service_states JSONB`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS stripe_setup_intent_id VARCHAR(255)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS stripe_care_subscription_id VARCHAR(255)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS stripe_leadnet_subscription_id VARCHAR(255)`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS initial_payment_paid_at TIMESTAMP WITH TIME ZONE`;
  await sql`ALTER TABLE agreements ADD COLUMN IF NOT EXISTS recurring_billing_start_at TIMESTAMP WITH TIME ZONE`;

  await sql`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id VARCHAR(255) PRIMARY KEY,
      event_type VARCHAR(255) NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      processing_status VARCHAR(50) DEFAULT 'processed',
      acceptance_id UUID REFERENCES agreements(acceptance_id) ON DELETE SET NULL
    );
  `;
}

export async function getAgreementByDownloadToken(token: string) {
  const rows = await sql`
    SELECT * FROM agreements WHERE public_download_token = ${token} LIMIT 1
  `;
  return rows[0];
}

export async function getAgreementByAcceptanceId(id: string) {
  const rows = await sql`
    SELECT * FROM agreements WHERE acceptance_id = ${id} LIMIT 1
  `;
  return rows[0];
}

export async function getAgreementByPaymentIntentId(paymentIntentId: string) {
  const rows = await sql`
    SELECT * FROM agreements WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
  `;
  return rows[0];
}

export async function insertAgreement(data: Record<string, unknown>) {
  await sql`
    INSERT INTO agreements (
      acceptance_id, public_download_token, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id,
      agreement_version, agreement_html, agreement_hash, customer_name, customer_email, customer_phone,
      company_name, package_id, addons, order_snapshot, customer_details, offer_version, website_package_id,
      payment_mode, leadnet_selected, care_selected, initial_amount_cents, recurring_amount_cents, currency,
      accepted_at, ip_address, user_agent, payment_status, subscription_status, website_subscription_status,
      care_subscription_status, leadnet_subscription_status, onboarding_status, build_status, service_states
    ) VALUES (
      ${data.acceptance_id}, ${data.public_download_token}, ${data.stripe_customer_id}, ${data.stripe_payment_intent_id}, ${data.stripe_subscription_id},
      ${data.agreement_version}, ${data.agreement_html}, ${data.agreement_hash}, ${data.customer_name}, ${data.customer_email}, ${data.customer_phone},
      ${data.company_name}, ${data.package_id}, ${data.addons}, ${data.order_snapshot}, ${data.customer_details}, ${data.offer_version}, ${data.website_package_id},
      ${data.payment_mode}, ${data.leadnet_selected}, ${data.care_selected}, ${data.initial_amount_cents}, ${data.recurring_amount_cents}, ${data.currency},
      ${data.accepted_at}, ${data.ip_address}, ${data.user_agent}, ${data.payment_status}, ${data.subscription_status}, ${data.website_subscription_status},
      ${data.care_subscription_status}, ${data.leadnet_subscription_status}, ${data.onboarding_status}, ${data.build_status}, ${data.service_states}
    )
  `;
}

export async function updateAgreementStatus(acceptanceId: string, status: string, subscriptionStatus?: string, initialPaidAt?: Date, recurringStartAt?: Date) {
  if (subscriptionStatus) {
    if (initialPaidAt && recurringStartAt) {
      await sql`
        UPDATE agreements 
        SET payment_status = ${status}, 
            subscription_status = ${subscriptionStatus}, 
            initial_payment_paid_at = ${initialPaidAt},
            recurring_billing_start_at = ${recurringStartAt},
            payment_completed_at = CURRENT_TIMESTAMP, 
            updated_at = CURRENT_TIMESTAMP
        WHERE acceptance_id = ${acceptanceId}
      `;
    } else {
      await sql`
        UPDATE agreements 
        SET payment_status = ${status}, 
            subscription_status = ${subscriptionStatus}, 
            payment_completed_at = CURRENT_TIMESTAMP, 
            updated_at = CURRENT_TIMESTAMP
        WHERE acceptance_id = ${acceptanceId}
      `;
    }
  } else {
    await sql`
      UPDATE agreements 
      SET payment_status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE acceptance_id = ${acceptanceId}
    `;
  }
}

export async function updateSubscriptionStatus(acceptanceId: string, subscriptionStatus: string) {
  await sql`
    UPDATE agreements 
    SET subscription_status = ${subscriptionStatus}, updated_at = CURRENT_TIMESTAMP
    WHERE acceptance_id = ${acceptanceId}
  `;
}

export async function processStripeEvent(eventId: string, eventType: string, acceptanceId?: string) {
  try {
    // Attempt to insert as 'processing'
    await sql`
      INSERT INTO stripe_events (event_id, event_type, acceptance_id, processing_status)
      VALUES (${eventId}, ${eventType}, ${acceptanceId || null}, 'processing')
    `;
    return true; // Newly inserted, proceed
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') { // Unique violation
      // Check current status
      const rows = await sql`SELECT processing_status FROM stripe_events WHERE event_id = ${eventId}`;
      const status = rows[0]?.processing_status;
      
      if (status === 'failed') {
        // Retryable, so update to 'processing'
        await sql`
          UPDATE stripe_events 
          SET processing_status = 'processing', processed_at = CURRENT_TIMESTAMP 
          WHERE event_id = ${eventId}
        `;
        return true;
      }
      
      // If 'processed' or 'processing', do not proceed (prevents concurrent race conditions or double processing)
      return false;
    }
    throw error;
  }
}

export async function completeStripeEvent(eventId: string) {
  await sql`
    UPDATE stripe_events 
    SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP
    WHERE event_id = ${eventId}
  `;
}

export async function markEventFailed(eventId: string) {
  await sql`
    UPDATE stripe_events 
    SET processing_status = 'failed' 
    WHERE event_id = ${eventId}
  `;
}
