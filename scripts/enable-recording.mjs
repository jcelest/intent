import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required.");
const sql = neon(dbUrl);

await sql`
  UPDATE dialer_settings
  SET value = jsonb_set(value, '{recordingEnabled}', 'true'::jsonb), updated_at = CURRENT_TIMESTAMP
  WHERE key = 'twilio'
`;

const rows = await sql`SELECT * FROM dialer_settings WHERE key = 'twilio'`;
console.log("UPDATED TWILIO SETTING:", JSON.stringify(rows[0], null, 2));
