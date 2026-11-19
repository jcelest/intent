import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = neon(dbUrl);

async function run() {
  const settings = await sql`SELECT key, value, updated_at FROM dialer_settings`;
  console.log("SETTINGS:", JSON.stringify(settings, null, 2));

  const calls = await sql`SELECT id, lead_id, started_at, status, twilio_parent_call_sid, twilio_call_sid, recording_sid, recording_url FROM dialer_calls ORDER BY started_at DESC LIMIT 5`;
  console.log("RECENT CALLS:", JSON.stringify(calls, null, 2));

  const leads = await sql`SELECT id, first_name, last_name, phone_e164, timezone, do_not_call, status FROM dialer_leads ORDER BY updated_at DESC LIMIT 5`;
  console.log("RECENT LEADS:", JSON.stringify(leads, null, 2));
}

run().catch(console.error);
