import { sql } from "@/lib/db";

function toTitleCase(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseOwnerName(raw: string): { firstName: string; lastName: string; fullName: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { firstName: "", lastName: "", fullName: "" };

  const primaryPart = trimmed.split("/")[0].trim();
  const cleanName = primaryPart.replace(/\([^)]*\)/g, "").replace(/\b(P:|MGR:|AMBR:|Mana:|AR:|VP:|PRES:|DIR:|OFFI:)\b/gi, "").trim();

  let firstName = "";
  let lastName = "";

  if (cleanName.includes(",")) {
    const [lPart, fPart] = cleanName.split(",").map((s) => s.trim());
    const fTokens = (fPart || "").split(/\s+/).filter(Boolean);
    const lTokens = (lPart || "").split(/\s+/).filter(Boolean);
    firstName = fTokens.map(toTitleCase).join(" ");
    lastName = lTokens.map(toTitleCase).join(" ");
  } else {
    const tokens = cleanName.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      firstName = toTitleCase(tokens[0]);
    } else if (tokens.length > 1) {
      firstName = toTitleCase(tokens[0]);
      lastName = tokens.slice(1).map(toTitleCase).join(" ");
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || cleanName;
  return { firstName, lastName, fullName };
}

async function run() {
  console.log("Backfilling missing lead names from CSV metadata...");

  const leads = await sql`
    SELECT id, metadata
    FROM dialer_leads
    WHERE (first_name IS NULL OR first_name = '') AND (last_name IS NULL OR last_name = '')
  `;

  console.log(`Found ${leads.length} leads without names to inspect.`);

  let updatedCount = 0;

  for (const lead of leads) {
    const meta = (lead.metadata || {}) as Record<string, any>;
    const allCsv = (meta.all_csv_fields || {}) as Record<string, string>;

    let rawName = "";

    // 1. Check all_csv_fields keys
    for (const [key, val] of Object.entries(allCsv)) {
      const k = key.toLowerCase();
      if (
        (k.includes("ask for") ||
         k.includes("licensee") ||
         k.includes("qualifier") ||
         k.includes("owner") ||
         k.includes("contact") ||
         k === "name") &&
        typeof val === "string" &&
        val.trim()
      ) {
        rawName = val.trim();
        break;
      }
    }

    // 2. Check metadata fields
    if (!rawName) {
      rawName = meta.owner_name || meta.business_owner || meta.raw_contractor_name || "";
    }

    if (!rawName) continue;

    const { firstName, lastName, fullName } = parseOwnerName(rawName);

    if (firstName || lastName) {
      await sql`
        UPDATE dialer_leads SET
          first_name = ${firstName || null},
          last_name = ${lastName || null},
          metadata = COALESCE(dialer_leads.metadata, '{}'::jsonb) || ${JSON.stringify({ owner_name: fullName, business_owner: fullName })}::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lead.id}
      `;
      updatedCount += 1;
    }
  }

  console.log(`Successfully backfilled names for ${updatedCount} leads!`);

  // Verify
  const sample = await sql`
    SELECT id, first_name, last_name, company, phone_e164
    FROM dialer_leads
    WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
    LIMIT 10
  `;
  console.log("SAMPLE UPDATED LEADS:", sample);
}

run().catch(console.error).finally(() => process.exit(0));
