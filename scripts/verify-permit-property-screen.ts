import { sql } from "../src/lib/db";
import { classifyParcelUseCode } from "../src/lib/permit-property-screen";

type Row = Record<string, unknown>;

async function main() {
  const melendezRows = await sql`
    SELECT permit.permit_number, permit.parcel_number, permit.address, permit.property_type,
           permit.parcel_use_code, permit.parcel_use_description, permit.parcel_evidence_url,
           opportunity.id AS opportunity_id
    FROM trade_demand_permits permit
    JOIN trade_demand_opportunities opportunity ON opportunity.primary_permit_id = permit.id
    WHERE permit.permit_number = 'MEC2025-13987'
       OR permit.project_name = 'MELENDEZ 63564639'
    LIMIT 1
  `;
  const melendez = melendezRows[0] as Row | undefined;
  if (!melendez) throw new Error("MELENDEZ acceptance record was not found.");
  if (melendez.property_type !== "RESIDENTIAL" || melendez.parcel_use_code !== "0103") {
    throw new Error(`MELENDEZ classification mismatch: ${JSON.stringify(melendez)}`);
  }

  const explorerRows = await sql`
    SELECT count(*)::int AS count
    FROM trade_demand_opportunities opportunity
    JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
    WHERE opportunity.active = TRUE
      AND opportunity.trade_slug = 'hvac'
      AND opportunity.county = 'Orange'
      AND permit.permit_number = 'MEC2025-13987'
      AND permit.property_type = 'COMMERCIAL'
  `;
  if (Number(explorerRows[0]?.count || 0) !== 0) {
    throw new Error("MELENDEZ still appears in the commercial HVAC / Orange County view.");
  }

  const countRows = await sql`
    SELECT
      count(*)::int AS prior_commercial_count,
      count(*) FILTER (WHERE permit.property_type = 'COMMERCIAL')::int AS current_commercial_count,
      count(*) FILTER (WHERE permit.property_type <> 'COMMERCIAL')::int AS excluded_count
    FROM trade_demand_opportunities opportunity
    JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
    WHERE opportunity.evidence_type = 'permit_activity' AND opportunity.active = TRUE
  `;
  const counts = countRows[0] as Row;
  if (Number(counts.prior_commercial_count) - Number(counts.current_commercial_count) !== Number(counts.excluded_count)) {
    throw new Error("Commercial count delta does not equal the excluded permit count.");
  }

  const spotRows = await sql`
    SELECT permit_number, property_type, parcel_use_code, parcel_evidence_url
    FROM trade_demand_permits
    WHERE source_system = 'orlando_socrata'
      AND parcel_evidence_url IS NOT NULL
      AND parcel_use_code IS NOT NULL
    ORDER BY CASE WHEN permit_number = 'MEC2025-13987' THEN 0 ELSE 1 END, permit_number
    LIMIT 10
  `;
  if (spotRows.length !== 10) throw new Error(`Expected 10 parcel-backed permits for spot check, found ${spotRows.length}.`);
  const spotChecks: Array<{ permitNumber: string; useCode: string; propertyType: string; agrees: boolean }> = [];
  for (const record of spotRows as Row[]) {
    const response = await fetch(String(record.parcel_evidence_url), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Parcel evidence returned HTTP ${response.status} for ${record.permit_number}.`);
    const payload = await response.json() as { features?: Array<{ attributes?: { DOR_CODE?: string } }> };
    const sourceUseCode = payload.features?.[0]?.attributes?.DOR_CODE || null;
    const agrees = sourceUseCode === record.parcel_use_code
      && classifyParcelUseCode(sourceUseCode) === record.property_type;
    spotChecks.push({
      permitNumber: String(record.permit_number),
      useCode: String(record.parcel_use_code),
      propertyType: String(record.property_type),
      agrees,
    });
  }
  if (spotChecks.some((check) => !check.agrees)) {
    throw new Error(`Parcel spot check failed: ${JSON.stringify(spotChecks)}`);
  }

  const runRows = await sql`
    SELECT id, status, permit_records_seen, commercial_count_before, commercial_count_after,
           reclassified_count, residential_count, unknown_count, finished_at
    FROM trade_demand_permit_classification_runs
    WHERE source_system = 'orlando_socrata' AND status = 'succeeded'
    ORDER BY started_at DESC LIMIT 1
  `;
  const latestRun = runRows[0] as Row | undefined;
  if (!latestRun) throw new Error("No successful permit property-screen run was recorded.");
  if (Number(latestRun.commercial_count_before) - Number(latestRun.commercial_count_after) !== Number(latestRun.reclassified_count)) {
    throw new Error("Latest audit run does not reconcile its commercial count delta.");
  }

  console.log(JSON.stringify({ melendez, counts, latestRun, spotChecks }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

