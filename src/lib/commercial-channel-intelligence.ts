import { sql } from "@/lib/db";
import { DOR_CODE_TO_COUNTY } from "@/lib/florida-dor-meta";
import {
  SearchBudgetExhaustedError,
  SearchProviderNotConfiguredError,
  getSearchBudgetStatus,
  verifyBusinessActivity,
} from "@/lib/search-verification-provider";

const DBPR_CAM_URL = "https://www2.myfloridalicense.com/sto/file_download/extracts/lic38cam.csv";
const DBPR_CAM_EVIDENCE = "https://www2.myfloridalicense.com/community-association-managers-and-firms/public-records/";
const DBPR_MOLD_URL = "https://www2.myfloridalicense.com/sto/file_download/extracts/lic07mold.csv";
const DBPR_MOLD_EVIDENCE = "https://www2.myfloridalicense.com/mold-related-services/public-records/";

const PLATFORM_LIST = [
  ["servicechannel", "ServiceChannel"],
  ["lessen", "Lessen"],
  ["corrigopro", "CorrigoPro"],
  ["vixxo", "Vixxo"],
  ["dmg-pro", "DMG Pro"],
  ["sms-assist", "SMS Assist"],
  ["chain-store-maintenance", "Chain Store Maintenance"],
  ["ferrandino-and-son", "Ferrandino and Son"],
  ["cbre-vendor-system", "CBRE vendor system"],
  ["jll-corrigo", "JLL/Corrigo"],
] as const;

export type ChannelCoverageRow = {
  channelKey: string;
  tier: 1 | 2;
  label: string;
  stageACount: number;
  stageASource: string;
  stageASourceUrl: string;
  sourceDate: string | null;
  stageBCount: number;
  queueRemaining: number;
  queueAsOf: string;
  unverifiedBudget: number;
  coverageStatus: "covered" | "partial" | "not_connected";
  reason: string;
};

type DbprRow = {
  occupation: string;
  name: string;
  dba: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  licenseNumber: string;
  primaryStatus: string;
  secondaryStatus: string;
  originalLicensureDate: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
};

export function parseDelimitedCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function parseDbprLicenseRows(input: string): DbprRow[] {
  const records = new Map<string, DbprRow>();
  for (const row of parseDelimitedCsv(input)) {
    const occupation = clean(row[1]).toUpperCase();
    const licenseNumber = clean(row[20] || row[12]).toUpperCase();
    const countyCode = Number(row[11]);
    const county = DOR_CODE_TO_COUNTY.get(countyCode)?.name || null;
    if (!occupation || !licenseNumber) continue;
    records.set(licenseNumber, {
      occupation,
      name: clean(row[2]),
      dba: clean(row[3]) || null,
      address: clean([row[5], row[6], row[7]].map(clean).filter(Boolean).join(" ")) || null,
      city: clean(row[8]) || null,
      state: clean(row[9]).toUpperCase() || null,
      zipCode: clean(row[10]).slice(0, 5) || null,
      county,
      licenseNumber,
      primaryStatus: clean(row[13]).toUpperCase(),
      secondaryStatus: clean(row[14]).toUpperCase(),
      originalLicensureDate: clean(row[15]) || null,
      effectiveDate: clean(row[16]) || null,
      expirationDate: clean(row[17]) || null,
    });
  }
  return Array.from(records.values());
}

function isCurrentActiveDbpr(row: DbprRow): boolean {
  return row.primaryStatus === "C" && !["I", "V"].includes(row.secondaryStatus);
}

async function downloadDbpr(url: string): Promise<{ records: DbprRow[]; sourceDate: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Intent-Commercial-Channel-Intelligence/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`DBPR download failed with HTTP ${response.status}`);
  const lastModified = response.headers.get("last-modified");
  const parsedDate = lastModified ? new Date(lastModified) : new Date();
  const sourceDate = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsedDate.toISOString().slice(0, 10);
  return { records: parseDbprLicenseRows(await response.text()), sourceDate };
}

async function upsertChannelEntities(params: {
  sourceKey: string;
  channelKey: string;
  tier: 1 | 2;
  sourceDate: string;
  evidenceUrl: string;
  records: DbprRow[];
  entityType: (record: DbprRow) => string | null;
}): Promise<number> {
  const candidates = params.records
    .map((record) => ({ record, entityType: params.entityType(record) }))
    .filter((item): item is { record: DbprRow; entityType: string } => Boolean(item.entityType) && isCurrentActiveDbpr(item.record) && item.record.state === "FL");
  const currentIds = candidates.map((item) => item.record.licenseNumber);
  const batchSize = 500;
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const records = batch.map((item) => item.record);
    await sql`
      INSERT INTO oi_channel_entities(
        channel_key, tier, source_key, source_record_id, entity_name, dba_name,
        entity_type, license_number, source_status, is_source_active, address,
        city, county, state, zip_code, evidence_url, source_snapshot_date, metadata
      )
      SELECT
        ${params.channelKey}, ${params.tier}, ${params.sourceKey}, incoming.source_record_id,
        incoming.entity_name, incoming.dba_name, incoming.entity_type, incoming.license_number,
        incoming.source_status, TRUE, incoming.address, incoming.city, incoming.county,
        incoming.state, incoming.zip_code, ${params.evidenceUrl}, ${params.sourceDate}, incoming.metadata::jsonb
      FROM unnest(
        ${records.map((record) => record.licenseNumber)}::text[],
        ${records.map((record) => record.name)}::text[],
        ${records.map((record) => record.dba)}::text[],
        ${batch.map((item) => item.entityType)}::text[],
        ${records.map((record) => record.licenseNumber)}::text[],
        ${records.map((record) => [record.primaryStatus, record.secondaryStatus].filter(Boolean).join(","))}::text[],
        ${records.map((record) => record.address)}::text[],
        ${records.map((record) => record.city)}::text[],
        ${records.map((record) => record.county)}::text[],
        ${records.map((record) => record.state)}::text[],
        ${records.map((record) => record.zipCode)}::text[],
        ${records.map((record) => JSON.stringify({
          occupation: record.occupation,
          original_licensure_date: record.originalLicensureDate,
          effective_date: record.effectiveDate,
          expiration_date: record.expirationDate,
        }))}::text[]
      ) AS incoming(
        source_record_id, entity_name, dba_name, entity_type, license_number,
        source_status, address, city, county, state, zip_code, metadata
      )
      ON CONFLICT(source_key, source_record_id) DO UPDATE SET
        entity_name = EXCLUDED.entity_name,
        dba_name = EXCLUDED.dba_name,
        entity_type = EXCLUDED.entity_type,
        source_status = EXCLUDED.source_status,
        is_source_active = TRUE,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        county = EXCLUDED.county,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        evidence_url = EXCLUDED.evidence_url,
        source_snapshot_date = EXCLUDED.source_snapshot_date,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
  if (currentIds.length) {
    await sql`
      DELETE FROM oi_channel_entities
      WHERE source_key = ${params.sourceKey}
        AND NOT (source_record_id = ANY(${currentIds}::text[]))
    `;
  }
  await sql`
    UPDATE oi_channel_sources
    SET status = 'connected_current', source_reported_count = ${candidates.length},
        database_count = ${candidates.length}, snapshot_date = ${params.sourceDate},
        last_attempted_at = CURRENT_TIMESTAMP, last_successful_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE source_key = ${params.sourceKey}
  `;
  return candidates.length;
}

export async function syncDbprCommercialChannels(): Promise<{
  camFirms: number;
  camIndividuals: number;
  moldAssessors: number;
  moldRemediators: number;
}> {
  await sql`UPDATE oi_channel_sources SET last_attempted_at=CURRENT_TIMESTAMP WHERE source_key IN ('dbpr-cam','dbpr-mold')`;
  const [cam, mold] = await Promise.all([downloadDbpr(DBPR_CAM_URL), downloadDbpr(DBPR_MOLD_URL)]);
  const camCount = await upsertChannelEntities({
    sourceKey: "dbpr-cam",
    channelKey: "cam_firms",
    tier: 1,
    sourceDate: cam.sourceDate,
    evidenceUrl: DBPR_CAM_EVIDENCE,
    records: cam.records,
    entityType: (record) => record.occupation === "CAB" ? "cam_firm" : record.occupation === "CAM" ? "cam_individual" : null,
  });
  const moldCount = await upsertChannelEntities({
    sourceKey: "dbpr-mold",
    channelKey: "restoration",
    tier: 2,
    sourceDate: mold.sourceDate,
    evidenceUrl: DBPR_MOLD_EVIDENCE,
    records: mold.records,
    entityType: (record) => {
      if (record.occupation.includes("MRSA") || record.licenseNumber.startsWith("MRSA")) return "mold_assessor";
      if (record.occupation.includes("MRSR") || record.licenseNumber.startsWith("MRSR")) return "mold_remediator";
      return null;
    },
  });
  const camFirms = cam.records.filter((row) => row.occupation === "CAB" && row.state === "FL" && isCurrentActiveDbpr(row)).length;
  const camIndividuals = camCount - camFirms;
  const moldAssessors = mold.records.filter((row) => (row.occupation.includes("MRSA") || row.licenseNumber.startsWith("MRSA")) && row.state === "FL" && isCurrentActiveDbpr(row)).length;
  await sql`
    UPDATE oi_channel_sources
    SET metadata=${JSON.stringify({ active_cam_firms: camFirms, active_cam_individuals: camIndividuals })}::jsonb,
        updated_at=CURRENT_TIMESTAMP
    WHERE source_key='dbpr-cam'
  `;
  await sql`
    UPDATE oi_channel_sources
    SET metadata=${JSON.stringify({ active_mold_assessors: moldAssessors, active_mold_remediators: moldCount - moldAssessors })}::jsonb,
        updated_at=CURRENT_TIMESTAMP
    WHERE source_key='dbpr-mold'
  `;
  await refreshChannelVerificationQueue();
  return { camFirms, camIndividuals, moldAssessors, moldRemediators: moldCount - moldAssessors };
}

function verificationPriority(channelKey: string, county: string | null): number {
  void channelKey;
  void county;
  return 100;
}

export async function refreshChannelVerificationQueue(): Promise<number> {
  const rows = await sql`
    INSERT INTO oi_channel_verification_queue(entity_id, county, channel_key, priority)
    SELECT entity.id, entity.county, entity.channel_key, 100
    FROM oi_channel_entities entity
    LEFT JOIN fl_search_verifications verification
      ON verification.target_type='channel_entity'
      AND verification.target_id=entity.id::text
      AND verification.expires_at > CURRENT_TIMESTAMP
    WHERE entity.is_source_active=TRUE
      AND entity.entity_type <> 'cam_individual'
      AND verification.id IS NULL
    ON CONFLICT(entity_id) DO UPDATE SET
      county=EXCLUDED.county,
      channel_key=EXCLUDED.channel_key,
      priority=EXCLUDED.priority,
      status=CASE
        WHEN oi_channel_verification_queue.status IN ('VERIFIED','HUMAN_REVIEW','CLOSED') THEN oi_channel_verification_queue.status
        ELSE 'PENDING'
      END,
      updated_at=CURRENT_TIMESTAMP
    RETURNING id
  `;
  await sql`UPDATE oi_channel_verification_queue SET priority=100, is_acceptance_test=FALSE, updated_at=CURRENT_TIMESTAMP`;
  const budget = await getSearchBudgetStatus();
  if (budget.queriesRemaining === 0) {
    await sql`
      UPDATE oi_channel_verification_queue
      SET status='UNVERIFIED_BUDGET', last_error='Serper free-tier query budget exhausted', updated_at=CURRENT_TIMESTAMP
      WHERE status IN ('PENDING','PROCESSING','FAILED')
    `;
  } else if (!process.env.SERPER_API_KEY) {
    await sql`
      UPDATE oi_channel_verification_queue
      SET status='PROVIDER_NOT_CONFIGURED', last_error='SERPER_API_KEY is not configured', updated_at=CURRENT_TIMESTAMP
      WHERE status IN ('PENDING','PROCESSING','FAILED')
    `;
  }
  return rows.length;
}

export async function processChannelVerificationQueue(limit = 25): Promise<{
  attempted: number;
  verified: number;
  humanReview: number;
  providerConfigured: boolean;
  budgetExhausted: boolean;
}> {
  await refreshChannelVerificationQueue();
  if (process.env.SERPER_API_KEY) {
    await sql`UPDATE oi_channel_verification_queue SET status='PENDING', updated_at=CURRENT_TIMESTAMP WHERE status='PROVIDER_NOT_CONFIGURED'`;
  }
  const queueRows = await sql`
    SELECT queue.id AS queue_id, entity.*
    FROM oi_channel_verification_queue queue
    JOIN oi_channel_entities entity ON entity.id=queue.entity_id
    WHERE queue.status IN ('PENDING','FAILED') AND queue.not_before <= CURRENT_TIMESTAMP
    ORDER BY queue.priority, queue.created_at
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;
  let attempted = 0;
  let verified = 0;
  let humanReview = 0;
  let budgetExhausted = false;
  for (const raw of queueRows as Array<Record<string, unknown>>) {
    const queueId = String(raw.queue_id);
    attempted += 1;
    try {
      await sql`UPDATE oi_channel_verification_queue SET status='PROCESSING', attempts=attempts+1, last_attempted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=${queueId}`;
      const result = await verifyBusinessActivity({
        businessName: String(raw.dba_name || raw.entity_name),
        city: String(raw.city || ""),
        county: String(raw.county || "Unknown"),
        targetType: "channel_entity",
        targetId: String(raw.id),
        streetAddress: raw.address ? String(raw.address) : null,
        phone: raw.phone ? String(raw.phone) : null,
      });
      const queueStatus = result.verification_status === "VERIFIED_ACTIVE" ? "VERIFIED" : result.needs_review || result.verification_status === "LIKELY_ACTIVE" ? "HUMAN_REVIEW" : result.verification_status === "CLOSED" ? "CLOSED" : "NOT_FOUND";
      if (queueStatus === "VERIFIED") verified += 1;
      if (queueStatus === "HUMAN_REVIEW") humanReview += 1;
      await sql`
        UPDATE oi_channel_verification_queue
        SET status=${queueStatus}, completed_at=CURRENT_TIMESTAMP, last_error=NULL, updated_at=CURRENT_TIMESTAMP
        WHERE id=${queueId}
      `;
      await sql`
        UPDATE oi_channel_entities
        SET phone=COALESCE(${result.phone}, phone), website_url=${result.official_website_url},
            has_website=${result.has_website}, review_count=${result.review_count}, updated_at=CURRENT_TIMESTAMP
        WHERE id=${String(raw.id)}
      `;
    } catch (error) {
      if (error instanceof SearchProviderNotConfiguredError) {
        await sql`UPDATE oi_channel_verification_queue SET status='PROVIDER_NOT_CONFIGURED', last_error=${error.message}, updated_at=CURRENT_TIMESTAMP WHERE status IN ('PENDING','PROCESSING','FAILED')`;
        return { attempted, verified, humanReview, providerConfigured: false, budgetExhausted: false };
      }
      if (error instanceof SearchBudgetExhaustedError) {
        budgetExhausted = true;
        await sql`UPDATE oi_channel_verification_queue SET status='UNVERIFIED_BUDGET', last_error=${error.message}, updated_at=CURRENT_TIMESTAMP WHERE status IN ('PENDING','PROCESSING','FAILED')`;
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      await sql`UPDATE oi_channel_verification_queue SET status='FAILED', last_error=${message}, not_before=CURRENT_TIMESTAMP + INTERVAL '1 day', updated_at=CURRENT_TIMESTAMP WHERE id=${queueId}`;
    }
  }
  return { attempted, verified, humanReview, providerConfigured: Boolean(process.env.SERPER_API_KEY), budgetExhausted };
}

export async function seedClientPlatformCoverage(): Promise<void> {
  const clients = await sql`SELECT id, name FROM trade_demand_clients WHERE active=TRUE ORDER BY name`;
  const clientRows = clients.length ? clients : [{ id: null, name: "Intent Platform" }];
  for (const client of clientRows as Array<Record<string, unknown>>) {
    for (let index = 0; index < PLATFORM_LIST.length; index += 1) {
      const [platformKey, platformName] = PLATFORM_LIST[index];
      await sql`
        INSERT INTO oi_client_platform_coverage(client_id, client_name, platform_key, platform_name, sort_order)
        VALUES (${client.id || null}, ${String(client.name)}, ${platformKey}, ${platformName}, ${index + 1})
        ON CONFLICT(client_name, platform_key) DO UPDATE SET
          client_id=COALESCE(EXCLUDED.client_id, oi_client_platform_coverage.client_id),
          platform_name=EXCLUDED.platform_name, sort_order=EXCLUDED.sort_order, updated_at=CURRENT_TIMESTAMP
      `;
    }
  }
}

export async function refreshDirectAccountCoverage(): Promise<void> {
  await sql`
    INSERT INTO oi_direct_account_county_coverage(
      county, source_name, source_url, source_status, parcels_count,
      business_matched_count, verified_active_count, snapshot_date, limitations
    )
    SELECT registry.county,
      'County property appraiser / Florida statewide cadastral',
      COALESCE(registry.gis_download_url, registry.official_portal_url),
      CASE
        WHEN registry.file_format='RECORDS_REQUEST_REQUIRED' THEN 'RECORDS_REQUEST_REQUIRED'
        WHEN COUNT(DISTINCT parcel.parcel_id) >= registry.full_depth_threshold THEN 'INGESTED'
        WHEN COUNT(DISTINCT parcel.parcel_id) > 0 THEN 'PARTIAL'
        ELSE 'NOT_CONNECTED'
      END,
      COUNT(DISTINCT parcel.parcel_id),
      COUNT(DISTINCT entity.parcel_id) FILTER (WHERE entity.status='Active'),
      COUNT(DISTINCT parcel.parcel_id) FILTER (WHERE verification.verification_status='VERIFIED_ACTIVE' AND verification.expires_at>CURRENT_TIMESTAMP),
      CURRENT_DATE,
      CASE WHEN registry.file_format='RECORDS_REQUEST_REQUIRED' THEN 'Public bulk download unavailable. Records request required.' ELSE NULL END
    FROM fl_county_parcel_registry registry
    LEFT JOIN fl_parcels parcel ON LOWER(parcel.county)=LOWER(registry.county)
    LEFT JOIN fl_entities entity ON entity.parcel_county=parcel.county AND entity.parcel_id=parcel.parcel_id
    LEFT JOIN fl_search_verifications verification ON LOWER(verification.business_name)=LOWER(parcel.owner_name_raw) AND LOWER(verification.city)=LOWER(COALESCE(parcel.situs_city,''))
    GROUP BY registry.county, registry.gis_download_url, registry.official_portal_url,
      registry.file_format, registry.full_depth_threshold
    ON CONFLICT(county) DO UPDATE SET
      source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
      source_status=EXCLUDED.source_status, parcels_count=EXCLUDED.parcels_count,
      business_matched_count=EXCLUDED.business_matched_count,
      verified_active_count=EXCLUDED.verified_active_count,
      snapshot_date=EXCLUDED.snapshot_date, limitations=EXCLUDED.limitations,
      updated_at=CURRENT_TIMESTAMP
  `;
  const totals = await sql`SELECT COUNT(*)::int counties, COALESCE(SUM(parcels_count),0)::bigint parcels FROM oi_direct_account_county_coverage`;
  const complete = await sql`SELECT COUNT(*)::int count FROM oi_direct_account_county_coverage WHERE source_status='INGESTED'`;
  await sql`
    UPDATE oi_channel_sources SET
      status=CASE WHEN ${Number(complete[0]?.count || 0)}=67 THEN 'connected_current' ELSE 'partial' END,
      source_reported_count=${Number(totals[0]?.parcels || 0)}, database_count=${Number(totals[0]?.parcels || 0)},
      snapshot_date=CURRENT_DATE, last_attempted_at=CURRENT_TIMESTAMP, last_successful_at=CURRENT_TIMESTAMP,
      metadata=${JSON.stringify({ counties_total: Number(totals[0]?.counties || 0), counties_complete: Number(complete[0]?.count || 0) })}::jsonb,
      updated_at=CURRENT_TIMESTAMP
    WHERE source_key='fl-cadastral-direct'
  `;
}

export async function getPlatformCoverage(clientName?: string | null) {
  await seedClientPlatformCoverage();
  const resolvedName = clientName?.trim() || String((await sql`
    SELECT client_name FROM oi_client_platform_coverage
    ORDER BY (client_id IS NULL), client_name LIMIT 1
  `)[0]?.client_name || "Intent Platform");
  const rows = await sql`
    SELECT id, client_id, client_name, platform_key, platform_name, status, status_date, notes, updated_at
    FROM oi_client_platform_coverage
    WHERE LOWER(client_name)=LOWER(${resolvedName})
    ORDER BY sort_order
  `;
  return {
    clientName: resolvedName,
    registered: rows.filter((row) => row.status === "REGISTERED").length,
    total: PLATFORM_LIST.length,
    rows,
  };
}

export async function updatePlatformCoverage(params: {
  clientName: string;
  platformKey: string;
  status: "NOT_REGISTERED" | "IN_PROGRESS" | "REGISTERED";
  notes?: string | null;
}) {
  await seedClientPlatformCoverage();
  const rows = await sql`
    UPDATE oi_client_platform_coverage
    SET status=${params.status}, status_date=CURRENT_DATE, notes=${params.notes || null}, updated_at=CURRENT_TIMESTAMP
    WHERE LOWER(client_name)=LOWER(${params.clientName}) AND platform_key=${params.platformKey}
    RETURNING *
  `;
  if (!rows.length) throw new Error("Unknown client or platform");
  return rows[0];
}

export async function getChannelCoverageReport(): Promise<{
  generatedAt: string;
  searchBudget: Awaited<ReturnType<typeof getSearchBudgetStatus>> & { configured: boolean };
  rows: ChannelCoverageRow[];
  directAccountCounties: unknown[];
}> {
  await Promise.all([seedClientPlatformCoverage(), refreshDirectAccountCoverage()]);
  const [sources, entityCounts, verifiedCounts, queueCounts, directTotals, platform] = await Promise.all([
    sql`SELECT * FROM oi_channel_sources ORDER BY tier, channel_key, source_key`,
    sql`SELECT channel_key, entity_type, COUNT(*)::int count FROM oi_channel_entities WHERE is_source_active=TRUE GROUP BY channel_key, entity_type`,
    sql`
      SELECT entity.channel_key, COUNT(DISTINCT entity.id)::int count
      FROM oi_channel_entities entity
      JOIN fl_search_verifications verification
        ON verification.target_type='channel_entity' AND verification.target_id=entity.id::text
      WHERE verification.verification_status='VERIFIED_ACTIVE'
        AND verification.expires_at>CURRENT_TIMESTAMP
        AND jsonb_array_length(verification.evidence)>0
        AND COALESCE(verification.phone, entity.phone) IS NOT NULL
        AND verification.has_website=TRUE
      GROUP BY entity.channel_key
    `,
    sql`SELECT channel_key, county, status, COUNT(*)::int count FROM oi_channel_verification_queue GROUP BY channel_key, county, status`,
    sql`SELECT COALESCE(SUM(parcels_count),0)::bigint parcels, COALESCE(SUM(business_matched_count),0)::bigint matched, COALESCE(SUM(verified_active_count),0)::bigint verified, COUNT(*) FILTER (WHERE source_status='INGESTED')::int covered_counties FROM oi_direct_account_county_coverage`,
    getPlatformCoverage(),
  ]);
  const sourceByKey = new Map((sources as Array<Record<string, unknown>>).map((row) => [String(row.source_key), row]));
  const countFor = (channel: string, entityType?: string) => (entityCounts as Array<Record<string, unknown>>)
    .filter((row) => row.channel_key === channel && (!entityType || row.entity_type === entityType))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const verifiedFor = (channel: string) => Number((verifiedCounts as Array<Record<string, unknown>>).find((row) => row.channel_key === channel)?.count || 0);
  const queueFor = (channel: string, statuses?: string[]) => (queueCounts as Array<Record<string, unknown>>)
    .filter((row) => row.channel_key === channel && (!statuses || statuses.includes(String(row.status))))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const activeQueueFor = (channel: string) => (queueCounts as Array<Record<string, unknown>>)
    .filter((row) => row.channel_key === channel
      && ["PENDING", "PROCESSING", "FAILED", "PROVIDER_NOT_CONFIGURED", "UNVERIFIED_BUDGET"].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const direct = directTotals[0] || {};
  const now = new Date().toISOString();
  const baseSearchBudget = await getSearchBudgetStatus();
  const searchConfigured = Boolean(process.env.SERPER_API_KEY);
  const buildRow = (config: {
    channelKey: string; tier: 1 | 2; label: string; sourceKey: string;
    count: number; verified?: number; completeWhen?: boolean; reason?: string;
  }): ChannelCoverageRow => {
    const source = sourceByKey.get(config.sourceKey) || {};
    const status = String(source.status || "not_connected");
    const sourceCount = source.source_reported_count == null ? null : Number(source.source_reported_count);
    const databaseCount = Number(source.database_count || 0);
    const reconciled = sourceCount !== null && sourceCount === databaseCount;
    const covered = Boolean(config.completeWhen) && reconciled && (config.channelKey === "fm_platforms" || (searchConfigured && activeQueueFor(config.channelKey) === 0));
    const rawSourceDate = source.snapshot_date;
    const parsedSourceDate = rawSourceDate ? new Date(String(rawSourceDate)) : null;
    return {
      channelKey: config.channelKey,
      tier: config.tier,
      label: config.label,
      stageACount: config.count,
      stageASource: String(source.source_name || "Source not configured"),
      stageASourceUrl: String(source.source_url || ""),
      sourceDate: parsedSourceDate && !Number.isNaN(parsedSourceDate.getTime()) ? parsedSourceDate.toISOString().slice(0, 10) : null,
      stageBCount: config.channelKey === "fm_platforms" ? (config.verified || 0) : searchConfigured ? (config.verified ?? verifiedFor(config.channelKey)) : 0,
      queueRemaining: queueFor(config.channelKey, ["PENDING", "PROCESSING", "FAILED", "PROVIDER_NOT_CONFIGURED", "UNVERIFIED_BUDGET"]),
      queueAsOf: now,
      unverifiedBudget: queueFor(config.channelKey, ["UNVERIFIED_BUDGET"]),
      coverageStatus: covered ? "covered" : status === "not_connected" ? "not_connected" : "partial",
      reason: config.channelKey !== "fm_platforms" && !searchConfigured
        ? `${config.reason || "Coverage is incomplete."} Stage B is zero because SERPER_API_KEY is not configured.`
        : config.reason || (covered ? "Stage A source count reconciles and the statewide Stage B queue is complete." : "Coverage is incomplete. Missing records remain visible in the dated queue."),
    };
  };
  const rows: ChannelCoverageRow[] = [
    buildRow({ channelKey: "property_managers", tier: 1, label: "Property managers", sourceKey: "pm-composite-directory", count: countFor("property_managers"), completeWhen: false, reason: "The existing management-firm and relationship datasets are legacy candidates, not an authoritative statewide denominator." }),
    buildRow({ channelKey: "cam_firms", tier: 1, label: "CAM firms and licensees", sourceKey: "dbpr-cam", count: countFor("cam_firms"), completeWhen: sourceByKey.get("dbpr-cam")?.status === "connected_current" }),
    buildRow({ channelKey: "associations", tier: 1, label: "HOA and condominium associations", sourceKey: "sunbiz-associations", count: countFor("associations"), completeWhen: false }),
    buildRow({ channelKey: "direct_accounts", tier: 1, label: "Direct commercial accounts", sourceKey: "fl-cadastral-direct", count: Number(direct.parcels || 0), verified: Number(direct.verified || 0), completeWhen: Number(direct.covered_counties || 0) === 67, reason: `${Number(direct.matched || 0).toLocaleString()} parcel owners are business-matched. ${Number(direct.covered_counties || 0)} of 67 counties meet the full-depth threshold.` }),
    buildRow({ channelKey: "restoration", tier: 2, label: "Restoration companies", sourceKey: "dbpr-mold", count: countFor("restoration"), completeWhen: false, reason: "DBPR mold licenses are connected only after a successful sync. Official SERVPRO, Paul Davis, BELFOR, and Sunbiz reconciliation remain separate required sources." }),
    buildRow({ channelKey: "fm_platforms", tier: 2, label: "FM aggregator platforms", sourceKey: "fm-platform-fixed", count: platform.total, verified: platform.registered, completeWhen: platform.total === 10, reason: `Platform coverage: ${platform.clientName} ${platform.registered} of ${platform.total}. This measures registration, not search verification.` }),
    buildRow({ channelKey: "chains_operators", tier: 2, label: "Chains and facility operators", sourceKey: "chain-operator-composite", count: countFor("chains_operators"), completeWhen: false }),
  ];
  const directAccountCounties = await sql`SELECT * FROM oi_direct_account_county_coverage ORDER BY county`;
  return { generatedAt: now, searchBudget: { ...baseSearchBudget, configured: searchConfigured }, rows, directAccountCounties };
}

export { verificationPriority };
