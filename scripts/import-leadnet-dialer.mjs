import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required.");
const sql = neon(databaseUrl);

function parseCsv(input) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i], next = input[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])));
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const content = await readFile(new URL("../sales/LeadNet_Hitlist_Pipeline.csv", import.meta.url), "utf8");
const rows = parseCsv(content);
const ownerRows = await sql`SELECT id FROM dialer_users WHERE role = 'owner' AND active = TRUE ORDER BY created_at LIMIT 1`;
const ownerId = ownerRows[0]?.id || null;
const listRows = await sql`
  INSERT INTO dialer_lists (name, description, color, created_by)
  SELECT 'LeadNet Hitlist', 'Verified contractor sales pipeline', '#0e766e', ${ownerId}
  WHERE NOT EXISTS (SELECT 1 FROM dialer_lists WHERE name = 'LeadNet Hitlist')
  RETURNING id
`;
const existingList = listRows[0] || (await sql`SELECT id FROM dialer_lists WHERE name = 'LeadNet Hitlist' LIMIT 1`)[0];
let imported = 0, skipped = 0;

for (const row of rows) {
  const phone = normalizePhone(row["Direct / Cell Phone"] || row["Office / LSA Phone"]);
  if (!phone) { skipped += 1; continue; }
  const contact = (row["Verified Licensee / Owner (DBPR & Sunbiz)"] || "").split("/")[0].replace(/\([^)]*\)/g, "").trim();
  const nameParts = contact.split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || null;
  const lastName = nameParts.join(" ") || null;
  const cityMetro = row["City / Metro"] || "";
  const city = cityMetro.split(",")[0].split("/")[0].trim() || null;
  const state = cityMetro.match(/,\s*([A-Z]{2})\b/)?.[1] || "FL";
  const notes = [row["Speed to Lead Hook / Paid Ad Pain Point"], row["Notes / Next Action"]].filter(Boolean).join("\n\n");
  const priority = String(row["Priority Tier"] || "").startsWith("A") ? 100 : String(row["Priority Tier"] || "").startsWith("B") ? 50 : 0;
  const existing = await sql`
    SELECT id FROM dialer_leads WHERE phone_e164 = ${phone} AND LOWER(COALESCE(company, '')) = LOWER(${row["Company Name"] || ""}) LIMIT 1
  `;
  let leadId;
  if (existing[0]) {
    leadId = existing[0].id;
    await sql`
      UPDATE dialer_leads SET first_name = COALESCE(first_name, ${firstName}), last_name = COALESCE(last_name, ${lastName}),
        email = COALESCE(email, ${row.Email || null}), city = COALESCE(city, ${city}), state = COALESCE(state, ${state}),
        priority = GREATEST(priority, ${priority}), notes = COALESCE(notes, ${notes || null}), updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leadId}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO dialer_leads (first_name, last_name, company, phone_e164, phone_raw, email, city, state, timezone, source, notes, priority, created_by, metadata)
      VALUES (${firstName}, ${lastName}, ${row["Company Name"] || null}, ${phone}, ${row["Direct / Cell Phone"] || row["Office / LSA Phone"]},
        ${row.Email || null}, ${city}, ${state}, 'America/New_York', 'LeadNet Pipeline', ${notes || null}, ${priority}, ${ownerId},
        ${JSON.stringify({ trade: row.Trade, website: row.Website, license: row["State License # (CAC / CFC / CMC)"], runningAds: row["Running Google Ads?"], rating: row["Google Rating / Reviews"] })})
      RETURNING id
    `;
    leadId = inserted[0].id;
  }
  await sql`INSERT INTO dialer_list_members (list_id, lead_id) VALUES (${existingList.id}, ${leadId}) ON CONFLICT DO NOTHING`;
  imported += 1;
}

console.log(`LeadNet dialer import complete: ${imported} imported or updated, ${skipped} skipped.`);

