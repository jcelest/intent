import { neon } from "@neondatabase/serverless";
import fs from "fs";

let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl && fs.existsSync(".env.production")) {
  const content = fs.readFileSync(".env.production", "utf8");
  const match = content.match(/POSTGRES_URL="?([^"\r\n]+)"?/);
  if (match) dbUrl = match[1];
}

const sql = neon(dbUrl);

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
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((values) => Object.fromEntries(headers.map((h, idx) => [h, (values[idx] || "").trim()])));
}

function normalizePhone(val) {
  const digits = String(val || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function parseOwnerName(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { firstName: null, lastName: null, fullName: "" };
  const primaryPart = trimmed.split("/")[0].trim();
  const titleMatch = primaryPart.match(/\(([^)]+)\)/);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const cleanName = primaryPart.replace(/\([^)]*\)/g, "").replace(/\b(P:|MGR:|AMBR:|Mana:|AR:|VP:|PRES:)\b/gi, "").trim();

  const toTitleCase = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

  let firstName = null;
  let lastName = null;

  if (cleanName.includes(",")) {
    const [lPart, fPart] = cleanName.split(",").map((s) => s.trim());
    const fTokens = fPart.split(/\s+/).filter(Boolean);
    const lTokens = lPart.split(/\s+/).filter(Boolean);
    firstName = fTokens.map(toTitleCase).join(" ") || null;
    lastName = lTokens.map(toTitleCase).join(" ") || null;
  } else {
    const tokens = cleanName.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      firstName = toTitleCase(tokens[0]);
    } else if (tokens.length > 1) {
      firstName = toTitleCase(tokens[0]);
      lastName = tokens.slice(1).map(toTitleCase).join(" ");
    }
  }
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return { firstName, lastName, fullName, title };
}

const csvData = parseCsv(fs.readFileSync("data/leads/google_places/hvac_phone_leads_final.csv", "utf8"));
let updated = 0;

for (const row of csvData) {
  const phone = normalizePhone(row.verified_business_phone);
  if (!phone) continue;
  const { firstName, lastName, fullName } = parseOwnerName(row.contractor_name);
  if (!firstName && !lastName) continue;

  const metadata = {
    owner_name: fullName,
    business_owner: fullName,
    raw_contractor_name: row.contractor_name,
    trade: row.license_type || "HVAC",
    website: row.google_website_uri || null,
    address: row.business_address || null,
    county: row.county || null,
    license_number: row.dbpr_license_number || null,
    license_type: row.license_type || null,
    license_status: row.license_status || null,
    license_age_days: row.license_age_days || null,
    sunbiz_entity: row.sunbiz_entity_name || null,
    sunbiz_doc_number: row.sunbiz_document_number || null,
    sunbiz_officer: row.sunbiz_officer_manager_match || null,
    google_reviews: row.google_review_count || null,
    google_places_url: row.google_business_profile_url_or_place_id || null,
  };

  const res = await sql`
    UPDATE dialer_leads SET
      first_name = COALESCE(first_name, ${firstName}),
      last_name = COALESCE(last_name, ${lastName}),
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb,
      updated_at = CURRENT_TIMESTAMP
    WHERE phone_e164 = ${phone}
    RETURNING id
  `;
  if (res.length > 0) updated += res.length;
}

console.log(`Backfilled ${updated} leads in the production database with business owner names & metadata!`);
