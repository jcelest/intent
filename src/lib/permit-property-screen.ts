import { sql } from "@/lib/db";

export type PermitPropertyType = "COMMERCIAL" | "RESIDENTIAL" | "UNKNOWN";

export type PermitParcelCandidate = {
  permitId?: string;
  opportunityId?: string | null;
  parcelNumber?: string | null;
  address?: string | null;
  priorPropertyType?: PermitPropertyType | null;
};

export type PermitParcelDecision = {
  propertyType: PermitPropertyType;
  parcelId: string | null;
  parcelUseCode: string | null;
  parcelUseDescription: string | null;
  parcelEvidenceUrl: string | null;
  parcelSourceName: string | null;
  parcelMatchMethod: "parcel_id" | "address" | null;
};

type OcpaAttributes = {
  OBJECTID?: number;
  PARCEL?: string;
  DOR_CODE?: string;
  SITUS?: string;
  NAME1?: string;
  PARCEL_CATEGORY?: string;
};

const OCPA_LAYER = "https://vgispublic.ocpafl.org/server/rest/services/DYNAMIC/Dynamic_Parcels/MapServer/0";
const OCPA_SOURCE = "Orange County Property Appraiser Dynamic Parcels";
const OCPA_FIELDS = "OBJECTID,PARCEL,NAME1,DOR_CODE,SITUS,PARCEL_CATEGORY";

function compact(value: string | null | undefined) {
  return String(value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function normalizeParcelId(value: string | null | undefined) {
  return compact(value);
}

export function normalizePermitAddress(value: string | null | undefined) {
  return String(value || "")
    .toUpperCase()
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bUNIT\s+[A-Z0-9-]+$/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function classifyParcelUseCode(useCode: string | null | undefined): PermitPropertyType {
  const digits = String(useCode || "").replace(/\D/g, "");
  if (!digits) return "UNKNOWN";
  return digits.slice(0, 2) === "01" ? "RESIDENTIAL" : "COMMERCIAL";
}

function useDescription(useCode: string | null | undefined, category: string | null | undefined) {
  const propertyType = classifyParcelUseCode(useCode);
  if (propertyType === "RESIDENTIAL") return "Single-family residential";
  if (propertyType === "COMMERCIAL") {
    return category ? `OCPA parcel category ${category}` : "Non-single-family parcel use";
  }
  return null;
}

function evidenceUrl(objectId: number | undefined) {
  if (!Number.isFinite(objectId)) return null;
  const params = new URLSearchParams({
    where: `OBJECTID = ${objectId}`,
    outFields: OCPA_FIELDS,
    returnGeometry: "false",
    f: "pjson",
  });
  return `${OCPA_LAYER}/query?${params}`;
}

async function fetchOcpaRows(where: string): Promise<OcpaAttributes[]> {
  const params = new URLSearchParams({
    where,
    outFields: OCPA_FIELDS,
    returnGeometry: "false",
    resultRecordCount: "2000",
    f: "json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${OCPA_LAYER}/query?${params}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "Intent-Opportunity-Intelligence/1.0" },
    });
    if (!response.ok) throw new Error(`OCPA parcel query returned HTTP ${response.status}.`);
    const payload = await response.json() as { features?: Array<{ attributes?: OcpaAttributes }>; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message || "OCPA parcel query failed.");
    return (payload.features || []).map((feature) => feature.attributes || {});
  } finally {
    clearTimeout(timeout);
  }
}

function batches<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function resolveOrangePermitParcels(candidates: PermitParcelCandidate[]) {
  const parcelIds = Array.from(new Set(candidates.map((item) => normalizeParcelId(item.parcelNumber)).filter(Boolean)));
  const rows: OcpaAttributes[] = [];
  for (const group of batches(parcelIds, 50)) {
    rows.push(...await fetchOcpaRows(`PARCEL IN (${group.map(sqlString).join(",")})`));
  }

  const byParcel = new Map<string, OcpaAttributes>();
  const byAddress = new Map<string, OcpaAttributes>();
  for (const row of rows) {
    const parcel = normalizeParcelId(row.PARCEL);
    const address = normalizePermitAddress(row.SITUS);
    if (parcel) byParcel.set(parcel, row);
    if (address) byAddress.set(address, row);
  }

  const unresolvedAddresses = Array.from(new Set(candidates
    .filter((candidate) => !byParcel.has(normalizeParcelId(candidate.parcelNumber)))
    .map((candidate) => normalizePermitAddress(candidate.address))
    .filter(Boolean)));
  for (const group of batches(unresolvedAddresses, 20)) {
    const addressRows = await fetchOcpaRows(group.map((address) => {
      const number = address.match(/^\d+/)?.[0];
      return number ? `STR_NUM = ${Number(number)}` : "1 = 0";
    }).join(" OR "));
    for (const row of addressRows) {
      const parcel = normalizeParcelId(row.PARCEL);
      const address = normalizePermitAddress(row.SITUS);
      if (parcel) byParcel.set(parcel, row);
      if (address) byAddress.set(address, row);
    }
  }

  return candidates.map((candidate): PermitParcelDecision => {
    const parcelKey = normalizeParcelId(candidate.parcelNumber);
    const addressKey = normalizePermitAddress(candidate.address);
    const row = byParcel.get(parcelKey) || byAddress.get(addressKey);
    if (!row) {
      return {
        propertyType: "UNKNOWN", parcelId: candidate.parcelNumber || null,
        parcelUseCode: null, parcelUseDescription: null, parcelEvidenceUrl: null,
        parcelSourceName: null, parcelMatchMethod: null,
      };
    }
    const matchMethod = byParcel.get(parcelKey) === row ? "parcel_id" : "address";
    return {
      propertyType: classifyParcelUseCode(row.DOR_CODE),
      parcelId: row.PARCEL || candidate.parcelNumber || null,
      parcelUseCode: row.DOR_CODE || null,
      parcelUseDescription: useDescription(row.DOR_CODE, row.PARCEL_CATEGORY),
      parcelEvidenceUrl: evidenceUrl(row.OBJECTID),
      parcelSourceName: OCPA_SOURCE,
      parcelMatchMethod: matchMethod,
    };
  });
}

export async function getPermitPropertyScreenSummary() {
  const rows = await sql`
    SELECT
      count(*)::int AS total_permits,
      count(*) FILTER (WHERE property_type = 'COMMERCIAL')::int AS commercial_permits,
      count(*) FILTER (WHERE property_type = 'RESIDENTIAL')::int AS residential_permits,
      count(*) FILTER (WHERE property_type = 'UNKNOWN')::int AS unknown_permits,
      count(*) FILTER (WHERE property_type <> 'COMMERCIAL')::int AS excluded_from_commercial,
      count(*) FILTER (WHERE parcel_evidence_url IS NOT NULL)::int AS parcel_evidence_count
    FROM trade_demand_permits
    WHERE source_system = 'orlando_socrata'
  `;
  const latestRuns = await sql`
    SELECT * FROM trade_demand_permit_classification_runs
    WHERE source_system = 'orlando_socrata'
    ORDER BY started_at DESC LIMIT 10
  `;
  return { ...(rows[0] || {}), latestRuns };
}

export async function reconcileOrlandoPermitPropertyClassifications(options: { batchSize?: number; maxRecords?: number } = {}) {
  const batchSize = Math.min(500, Math.max(1, options.batchSize || 250));
  const maxRecords = Math.min(50_000, Math.max(1, options.maxRecords || 20_000));
  const previousRuns = await sql`
    SELECT id FROM trade_demand_permit_classification_runs
    WHERE source_system = 'orlando_socrata' AND status = 'succeeded'
    LIMIT 1
  `;
  const hasPreviousScreen = previousRuns.length > 0;
  const beforeRows = hasPreviousScreen
    ? await sql`
        SELECT count(*)::int AS count
        FROM trade_demand_opportunities opportunity
        JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
        WHERE opportunity.evidence_type = 'permit_activity'
          AND opportunity.active = TRUE
          AND permit.property_type = 'COMMERCIAL'
      `
    : await sql`
        SELECT count(*)::int AS count
        FROM trade_demand_opportunities opportunity
        JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
        WHERE opportunity.evidence_type = 'permit_activity' AND opportunity.active = TRUE
      `;
  const commercialBefore = Number(beforeRows[0]?.count || 0);
  const runRows = await sql`
    INSERT INTO trade_demand_permit_classification_runs (
      source_system, commercial_count_before, details
    ) VALUES (
      'orlando_socrata', ${commercialBefore},
      ${JSON.stringify({ trigger: "full_reconciliation", batchSize, maxRecords })}::jsonb
    ) RETURNING id
  `;
  const runId = String(runRows[0].id);
  let cursor: string | null = null;
  let seen = 0;

  try {
    while (seen < maxRecords) {
      const limit = Math.min(batchSize, maxRecords - seen);
      const permitRows: Array<Record<string, unknown>> = cursor
        ? await sql`
            SELECT permit.id, permit.parcel_number, permit.address, permit.property_type,
                   opportunity.id AS opportunity_id
            FROM trade_demand_permits permit
            LEFT JOIN trade_demand_opportunities opportunity ON opportunity.primary_permit_id = permit.id
            WHERE permit.source_system = 'orlando_socrata' AND permit.id::text > ${cursor}
            ORDER BY permit.id::text LIMIT ${limit}
          `
        : await sql`
            SELECT permit.id, permit.parcel_number, permit.address, permit.property_type,
                   opportunity.id AS opportunity_id
            FROM trade_demand_permits permit
            LEFT JOIN trade_demand_opportunities opportunity ON opportunity.primary_permit_id = permit.id
            WHERE permit.source_system = 'orlando_socrata'
            ORDER BY permit.id::text LIMIT ${limit}
          `;
      if (!permitRows.length) break;
      const decisions = await resolveOrangePermitParcels(permitRows.map((row) => ({
        permitId: String(row.id),
        opportunityId: row.opportunity_id ? String(row.opportunity_id) : null,
        parcelNumber: row.parcel_number ? String(row.parcel_number) : null,
        address: row.address ? String(row.address) : null,
        priorPropertyType: String(row.property_type || "UNKNOWN") as PermitPropertyType,
      })));
      const payload = permitRows.map((row, index) => ({
        permit_id: String(row.id),
        opportunity_id: row.opportunity_id ? String(row.opportunity_id) : null,
        prior_property_type: String(row.property_type || "UNKNOWN"),
        property_type: decisions[index].propertyType,
        parcel_id: decisions[index].parcelId,
        parcel_use_code: decisions[index].parcelUseCode,
        parcel_use_description: decisions[index].parcelUseDescription,
        parcel_evidence_url: decisions[index].parcelEvidenceUrl,
        parcel_source_name: decisions[index].parcelSourceName,
        parcel_match_method: decisions[index].parcelMatchMethod,
      }));

      await sql`
        INSERT INTO trade_demand_permit_classification_audit (
          run_id, permit_id, opportunity_id, prior_property_type, property_type,
          parcel_id, parcel_use_code, parcel_use_description, parcel_evidence_url,
          parcel_match_method, was_commercial_visible, is_commercial_visible
        )
        SELECT
          ${runId}, decision.permit_id, decision.opportunity_id, decision.prior_property_type,
          decision.property_type, decision.parcel_id, decision.parcel_use_code,
          decision.parcel_use_description, decision.parcel_evidence_url,
          decision.parcel_match_method,
          CASE WHEN ${hasPreviousScreen} THEN decision.prior_property_type = 'COMMERCIAL' ELSE TRUE END,
          decision.property_type = 'COMMERCIAL'
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS decision(
          permit_id uuid, opportunity_id uuid, prior_property_type text,
          property_type text, parcel_id text, parcel_use_code text, parcel_use_description text,
          parcel_evidence_url text, parcel_source_name text, parcel_match_method text
        )
        WHERE decision.prior_property_type IS DISTINCT FROM decision.property_type
      `;
      await sql`
        UPDATE trade_demand_permits permit SET
          property_type = decision.property_type,
          parcel_number = COALESCE(decision.parcel_id, permit.parcel_number),
          parcel_use_code = decision.parcel_use_code,
          parcel_use_description = decision.parcel_use_description,
          parcel_evidence_url = decision.parcel_evidence_url,
          parcel_source_name = decision.parcel_source_name,
          parcel_match_method = decision.parcel_match_method,
          parcel_matched_at = CASE WHEN decision.parcel_match_method IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
          last_seen_at = permit.last_seen_at
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS decision(
          permit_id uuid, property_type text, parcel_id text, parcel_use_code text,
          parcel_use_description text, parcel_evidence_url text, parcel_source_name text,
          parcel_match_method text
        )
        WHERE permit.id = decision.permit_id
      `;
      seen += permitRows.length;
      cursor = String(permitRows[permitRows.length - 1].id);
      if (permitRows.length < limit) break;
    }

    await sql`
      UPDATE oi_permit_records canonical SET
        parcel_id = permit.parcel_number,
        property_type = permit.property_type,
        parcel_use_code = permit.parcel_use_code,
        parcel_use_description = permit.parcel_use_description,
        parcel_evidence_url = permit.parcel_evidence_url,
        parcel_match_method = permit.parcel_match_method,
        parcel_matched_at = permit.parcel_matched_at,
        updated_at = CURRENT_TIMESTAMP
      FROM trade_demand_permits permit
      WHERE canonical.source_id = 'orlando-permits'
        AND canonical.source_record_id = permit.source_record_id
    `;
    await sql`
      UPDATE oi_opportunities canonical SET
        parcel_id = permit.parcel_number,
        property_type = permit.property_type,
        parcel_use_code = permit.parcel_use_code,
        parcel_use_description = permit.parcel_use_description,
        parcel_evidence_url = permit.parcel_evidence_url,
        status = CASE WHEN permit.property_type = 'COMMERCIAL' AND canonical.status = 'archived' THEN 'discovered'
                      WHEN permit.property_type <> 'COMMERCIAL' THEN 'archived'
                      ELSE canonical.status END,
        updated_at = CURRENT_TIMESTAMP
      FROM trade_demand_opportunities opportunity
      JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
      WHERE canonical.source_id = 'orlando-permits'
        AND canonical.source_record_id = opportunity.origin_key
    `;
    await sql`
      UPDATE trade_demand_assignments assignment SET
        status = 'ended', ended_at = CURRENT_TIMESTAMP,
        notes = concat_ws(' ', assignment.notes, 'Removed from client targeting: permit parcel is not commercially classified.')
      FROM trade_demand_opportunities opportunity
      JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
      WHERE assignment.opportunity_id = opportunity.id
        AND assignment.status = 'active'
        AND permit.property_type <> 'COMMERCIAL'
    `;

    const countsRows = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE permit.property_type = 'COMMERCIAL')::int AS commercial,
        count(*) FILTER (WHERE permit.property_type = 'RESIDENTIAL')::int AS residential,
        count(*) FILTER (WHERE permit.property_type = 'UNKNOWN')::int AS unknown
      FROM trade_demand_opportunities opportunity
      JOIN trade_demand_permits permit ON permit.id = opportunity.primary_permit_id
      WHERE opportunity.evidence_type = 'permit_activity' AND opportunity.active = TRUE
    `;
    const counts = countsRows[0] || {};
    const commercialAfter = Number(counts.commercial || 0);
    await sql`
      UPDATE trade_demand_permit_classification_runs SET
        status = 'succeeded', finished_at = CURRENT_TIMESTAMP,
        permit_records_seen = ${seen},
        parcel_records_matched = ${Number(counts.commercial || 0) + Number(counts.residential || 0)},
        commercial_count_after = ${commercialAfter},
        reclassified_count = ${Math.max(0, commercialBefore - commercialAfter)},
        residential_count = ${Number(counts.residential || 0)},
        unknown_count = ${Number(counts.unknown || 0)}
      WHERE id = ${runId}
    `;
    return { runId, seen, commercialBefore, commercialAfter, reclassified: Math.max(0, commercialBefore - commercialAfter), ...counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      UPDATE trade_demand_permit_classification_runs SET
        status = 'failed', finished_at = CURRENT_TIMESTAMP, permit_records_seen = ${seen}, error_message = ${message}
      WHERE id = ${runId}
    `;
    throw error;
  }
}
