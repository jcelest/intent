import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import {
  cleanText,
  clientMatch,
  classifyPermitTrade,
  manualProjectGroupKey,
  permitProjectGroupKey,
  rankOpportunity,
  validateManualOpportunity,
  type ManualOpportunityInput,
  type OrlandoPermitRecord,
  type OpportunityStage,
} from "@/lib/trade-demand-core";
import {
  fetchOrlandoPermitPage,
  inspectOrlandoSchema,
  permitContentHash,
  permitSourceUrl,
  ORLANDO_DATASET_URL,
} from "@/lib/trade-demand-orlando";
import { TRADE_DEMAND_SOURCE_SHORTCUTS } from "@/lib/trade-demand-sources";

type DbRow = Record<string, unknown>;

export type QueueFilters = {
  trade?: string | null;
  location?: string | null;
  buyer?: string | null;
  evidenceType?: string | null;
  deadline?: "overdue" | "7_days" | "30_days" | "unknown" | null;
  clientId?: string | null;
  nextAction?: "due" | "scheduled" | "missing" | null;
  includeInactive?: boolean;
};

export type OrlandoSyncOptions = {
  windowDays?: number;
  maxRecords?: number;
  pageSize?: number;
};

export class TradeDemandValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
  }
}

export class TradeDemandConflictError extends Error {
  constructor(message: string, public readonly details: DbRow = {}) {
    super(message);
  }
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
}

function sourceExcerpt(record: OrlandoPermitRecord): string {
  const parts = [
    cleanText(record.application_type),
    cleanText(record.worktype),
    cleanText(record.project_name),
    cleanText(record.application_status) ? `Status: ${cleanText(record.application_status)}` : null,
  ].filter(Boolean);
  return parts.join(" — ") || `Permit ${cleanText(record.permit_number) ?? "record"}`;
}

function permitBuyer(record: OrlandoPermitRecord): string {
  return (
    cleanText(record.contractor) ||
    cleanText(record.contractor_name) ||
    cleanText(record.property_owner_name) ||
    cleanText(record.parcel_owner_name) ||
    "Unknown buyer — verify"
  );
}

async function expirePastBids(): Promise<void> {
  await sql`
    UPDATE trade_demand_evidence
    SET expired_at = COALESCE(expired_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE evidence_type = 'published_bid'
      AND bid_open = TRUE
      AND deadline IS NOT NULL
      AND deadline < CURRENT_TIMESTAMP
      AND expired_at IS NULL
  `;

  await sql`
    UPDATE trade_demand_opportunities
    SET active = FALSE,
        stage = CASE WHEN stage IN ('identified', 'introduction', 'bid_invited', 'bid_submitted') THEN 'expired' ELSE stage END,
        updated_at = CURRENT_TIMESTAMP
    WHERE evidence_type = 'published_bid'
      AND bid_open = TRUE
      AND deadline IS NOT NULL
      AND deadline < CURRENT_TIMESTAMP
      AND stage NOT IN ('awarded', 'first_paid_work_order', 'repeat_work', 'lost')
      AND active = TRUE
  `;
}

export async function ensureAgreementClients(): Promise<void> {
  await sql`
    INSERT INTO trade_demand_clients (
      agreement_id, name, contact_name, contact_email, contact_phone, active
    )
    SELECT
      acceptance_id,
      company_name,
      customer_name,
      customer_email,
      customer_phone,
      TRUE
    FROM agreements
    WHERE payment_status = 'payment_completed'
       OR leadnet_selected = TRUE
    ON CONFLICT (agreement_id) DO UPDATE SET
      name = EXCLUDED.name,
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      contact_phone = EXCLUDED.contact_phone,
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function getTradeDemandMeta(): Promise<DbRow> {
  await ensureAgreementClients();
  const [trades, clients, syncRuns] = await Promise.all([
    sql`SELECT slug, name, active, sort_order FROM trade_demand_trades ORDER BY sort_order, name`,
    sql`
      SELECT id, agreement_id, name, contact_name, contact_email, contact_phone,
             trades, service_areas, job_types, capacity_notes, qualifications, active
      FROM trade_demand_clients
      WHERE active = TRUE
      ORDER BY name
    `,
    sql`
      SELECT id, source_system, status, window_start, started_at, finished_at,
             records_seen, records_added, records_updated, records_unchanged, error_message
      FROM trade_demand_sync_runs
      WHERE source_system = 'orlando_socrata'
      ORDER BY started_at DESC
      LIMIT 10
    `,
  ]);
  return { trades, clients, syncRuns, sourceShortcuts: TRADE_DEMAND_SOURCE_SHORTCUTS };
}

export async function listOpportunities(filters: QueueFilters = {}): Promise<DbRow[]> {
  await expirePastBids();
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    clauses.push(clause.replace("?", `$${params.length}`));
  };

  if (!filters.includeInactive) clauses.push("o.active = TRUE");
  if (filters.trade) add("o.trade_slug = ?", filters.trade);
  if (filters.location) {
    params.push(`%${filters.location}%`);
    clauses.push(`(o.city ILIKE $${params.length} OR o.county ILIKE $${params.length} OR o.jurisdiction ILIKE $${params.length} OR o.service_territory ILIKE $${params.length})`);
  }
  if (filters.buyer) {
    params.push(`%${filters.buyer}%`);
    clauses.push(`o.buyer_name ILIKE $${params.length}`);
  }
  if (filters.evidenceType) add("o.evidence_type = ?", filters.evidenceType);
  if (filters.clientId) {
    add("EXISTS (SELECT 1 FROM trade_demand_assignments fa WHERE fa.opportunity_id = o.id AND fa.client_id = ? AND fa.status = 'active')", filters.clientId);
  }
  if (filters.deadline === "overdue") clauses.push("o.deadline < CURRENT_TIMESTAMP");
  if (filters.deadline === "7_days") clauses.push("o.deadline BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '7 days'");
  if (filters.deadline === "30_days") clauses.push("o.deadline BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '30 days'");
  if (filters.deadline === "unknown") clauses.push("o.deadline IS NULL");
  if (filters.nextAction === "due") clauses.push("o.next_action_at IS NOT NULL AND o.next_action_at <= CURRENT_TIMESTAMP");
  if (filters.nextAction === "scheduled") clauses.push("o.next_action_at > CURRENT_TIMESTAMP");
  if (filters.nextAction === "missing") clauses.push("o.next_action IS NULL");

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = `
    SELECT o.*,
      p.permit_number,
      COALESCE((
        SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'status', a.status) ORDER BY c.name)
        FROM trade_demand_assignments a
        JOIN trade_demand_clients c ON c.id = a.client_id
        WHERE a.opportunity_id = o.id AND a.status = 'active'
      ), '[]'::json) AS assignments
    FROM trade_demand_opportunities o
    LEFT JOIN trade_demand_permits p ON p.id = o.primary_permit_id
    ${where}
    ORDER BY o.rank_score DESC, o.next_action_at ASC NULLS LAST, o.updated_at DESC
    LIMIT 500
  `;
  return (await sql.query(query, params)) as DbRow[];
}

export async function getOpportunity(id: string): Promise<DbRow | null> {
  await expirePastBids();
  await ensureAgreementClients();
  const rows = await sql`SELECT * FROM trade_demand_opportunities WHERE id = ${id} LIMIT 1`;
  const opportunity = rows[0] as DbRow | undefined;
  if (!opportunity) return null;

  const [permitRows, evidence, activities, assignments, related, clients] = await Promise.all([
    opportunity.primary_permit_id
      ? sql`SELECT * FROM trade_demand_permits WHERE id = ${opportunity.primary_permit_id} LIMIT 1`
      : Promise.resolve([]),
    sql`SELECT * FROM trade_demand_evidence WHERE opportunity_id = ${id} ORDER BY created_at DESC`,
    sql`SELECT * FROM trade_demand_activities WHERE opportunity_id = ${id} ORDER BY occurred_at DESC, created_at DESC`,
    sql`
      SELECT a.*, c.name AS client_name, c.trades, c.service_areas, c.job_types,
             c.capacity_notes, c.qualifications
      FROM trade_demand_assignments a
      JOIN trade_demand_clients c ON c.id = a.client_id
      WHERE a.opportunity_id = ${id}
      ORDER BY a.assigned_at DESC
    `,
    sql`
      SELECT id, buyer_name, project_name, trade_slug, evidence_type, stage, active, next_action_at
      FROM trade_demand_opportunities
      WHERE id <> ${id}
        AND (lower(buyer_name) = lower(${opportunity.buyer_name}) OR project_group_key = ${opportunity.project_group_key})
      ORDER BY updated_at DESC
      LIMIT 30
    `,
    sql`
      SELECT id, name, contact_name, contact_email, contact_phone, trades, service_areas,
             job_types, capacity_notes, qualifications
      FROM trade_demand_clients
      WHERE active = TRUE
      ORDER BY name
    `,
  ]);

  const matches = (clients as DbRow[])
    .map((client) => ({
      ...client,
      match: clientMatch({
        opportunity: {
          tradeSlug: opportunity.trade_slug as string | null,
          city: opportunity.city as string | null,
          county: opportunity.county as string | null,
          serviceTerritory: opportunity.service_territory as string | null,
          jobType: opportunity.job_type as string | null,
          qualificationRequirements: opportunity.qualification_requirements as string[] | null,
        },
        client: {
          trades: client.trades as string[] | null,
          serviceAreas: client.service_areas as string[] | null,
          jobTypes: client.job_types as string[] | null,
          capacityNotes: client.capacity_notes as string | null,
          qualifications: client.qualifications as string[] | null,
        },
      }),
    }))
    .sort((a, b) => b.match.score - a.match.score);

  return {
    opportunity,
    permit: permitRows[0] ?? null,
    evidence,
    activities,
    assignments,
    related,
    clientMatches: matches,
  };
}

export async function createManualOpportunity(input: ManualOpportunityInput): Promise<DbRow> {
  const errors = validateManualOpportunity(input);
  if (errors.length) throw new TradeDemandValidationError(errors);

  const rank = rankOpportunity({
    evidenceType: input.evidenceType,
    bidOpen: input.bidOpen,
    deadline: input.deadline,
    buyerConfirmed: input.evidenceType === "buyer_confirmed",
    nextActionAt: input.nextActionAt,
  });
  const id = randomUUID();
  const evidenceId = randomUUID();
  const sourceRecordId = `manual:${evidenceId}`;
  const deadlineNeedsVerification = input.evidenceType === "published_bid" && !input.deadline;
  const nextAction = cleanText(input.nextAction) || (deadlineNeedsVerification ? "Verify bid deadline and submission status." : "Contact buyer and verify the trade need.");
  const sourceLabel = cleanText(input.sourceLabel) || "Manual source";
  let projectGroupKey = manualProjectGroupKey(input);
  const projectName = cleanText(input.projectName);
  const address = cleanText(input.address);
  if (projectName && address) {
    const related = await sql`
      SELECT project_group_key
      FROM trade_demand_opportunities
      WHERE lower(project_name) = lower(${projectName})
        AND lower(address) = lower(${address})
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (related[0]?.project_group_key) projectGroupKey = related[0].project_group_key as string;
  }

  const rows = await sql`
    INSERT INTO trade_demand_opportunities (
      id, project_group_key, buyer_name, project_name, project_phase, service_territory,
      address, city, county, trade_slug, job_type, qualification_requirements,
      evidence_type, evidence_summary, source_url, source_label, source_is_manual,
      public_contact_name, public_contact_phone, public_contact_email,
      deadline, deadline_timezone, deadline_needs_verification, submission_route, bid_open,
      prime_contract_status, next_action, next_action_at, rank_score, rank_reason
    ) VALUES (
      ${id}, ${projectGroupKey}, ${cleanText(input.buyerName)}, ${projectName},
      ${cleanText(input.projectPhase)}, ${cleanText(input.serviceTerritory)}, ${cleanText(input.address)},
      ${cleanText(input.city)}, ${cleanText(input.county)}, ${cleanText(input.tradeSlug)}, ${cleanText(input.jobType)},
      ${asStringArray(input.qualificationRequirements)}, ${input.evidenceType}, ${cleanText(input.evidenceExcerpt)},
      ${cleanText(input.sourceUrl)}, ${sourceLabel}, TRUE, ${cleanText(input.publicContactName)},
      ${cleanText(input.publicContactPhone)}, ${cleanText(input.publicContactEmail)}, ${asDate(input.deadline)},
      ${cleanText(input.deadlineTimezone)}, ${deadlineNeedsVerification}, ${cleanText(input.submissionRoute)},
      ${Boolean(input.bidOpen)}, ${input.primeContractStatus ?? "unknown"}, ${nextAction}, ${asDate(input.nextActionAt)},
      ${rank.score}, ${rank.reason}
    )
    RETURNING *
  `;

  await sql`
    INSERT INTO trade_demand_evidence (
      id, opportunity_id, source_system, source_record_id, evidence_type, source_url,
      source_label, excerpt, published_at, checked_at, deadline, deadline_timezone,
      submission_route, is_manual, bid_open
    ) VALUES (
      ${evidenceId}, ${id}, 'manual', ${sourceRecordId}, ${input.evidenceType}, ${cleanText(input.sourceUrl)},
      ${sourceLabel}, ${cleanText(input.evidenceExcerpt)}, ${asDate(input.publishedAt)},
      ${asDate(input.checkedAt) ?? new Date()}, ${asDate(input.deadline)}, ${cleanText(input.deadlineTimezone)},
      ${cleanText(input.submissionRoute)}, TRUE, ${Boolean(input.bidOpen)}
    )
  `;

  return rows[0] as DbRow;
}

export async function updateOpportunity(id: string, input: DbRow): Promise<DbRow | null> {
  const allowedStages = new Set<OpportunityStage>([
    "identified", "introduction", "bid_invited", "bid_submitted", "awarded", "lost",
    "first_paid_work_order", "repeat_work", "expired",
  ]);
  const currentRows = await sql`SELECT * FROM trade_demand_opportunities WHERE id = ${id} LIMIT 1`;
  const current = currentRows[0] as DbRow | undefined;
  if (!current) return null;

  const stage = typeof input.stage === "string" && allowedStages.has(input.stage as OpportunityStage)
    ? input.stage
    : current.stage;
  const evidenceType = (input.evidenceType as string | undefined) ?? (current.evidence_type as string);
  const bidOpen = typeof input.bidOpen === "boolean" ? input.bidOpen : Boolean(current.bid_open);
  if (input.bidOpen === true && evidenceType !== "published_bid") {
    throw new TradeDemandValidationError(["Only published bid evidence can be marked open."]);
  }

  const deadline = input.deadline === undefined ? current.deadline : asDate(input.deadline);
  const nextActionAt = input.nextActionAt === undefined ? current.next_action_at : asDate(input.nextActionAt);
  const rank = rankOpportunity({
    evidenceType: evidenceType as Parameters<typeof rankOpportunity>[0]["evidenceType"],
    bidOpen,
    deadline: deadline as Date | null,
    nextActionAt: nextActionAt as Date | null,
    buyerConfirmed: evidenceType === "buyer_confirmed",
  });

  const rows = await sql`
    UPDATE trade_demand_opportunities SET
      buyer_name = ${cleanText(input.buyerName) ?? current.buyer_name},
      project_name = ${input.projectName === undefined ? current.project_name : cleanText(input.projectName)},
      project_phase = ${input.projectPhase === undefined ? current.project_phase : cleanText(input.projectPhase)},
      service_territory = ${input.serviceTerritory === undefined ? current.service_territory : cleanText(input.serviceTerritory)},
      address = ${input.address === undefined ? current.address : cleanText(input.address)},
      city = ${input.city === undefined ? current.city : cleanText(input.city)},
      county = ${input.county === undefined ? current.county : cleanText(input.county)},
      trade_slug = ${input.tradeSlug === undefined ? current.trade_slug : cleanText(input.tradeSlug)},
      job_type = ${input.jobType === undefined ? current.job_type : cleanText(input.jobType)},
      qualification_requirements = ${input.qualificationRequirements === undefined ? current.qualification_requirements : asStringArray(input.qualificationRequirements)},
      evidence_type = ${evidenceType},
      public_contact_name = ${input.publicContactName === undefined ? current.public_contact_name : cleanText(input.publicContactName)},
      public_contact_phone = ${input.publicContactPhone === undefined ? current.public_contact_phone : cleanText(input.publicContactPhone)},
      public_contact_email = ${input.publicContactEmail === undefined ? current.public_contact_email : cleanText(input.publicContactEmail)},
      deadline = ${deadline},
      deadline_timezone = ${input.deadlineTimezone === undefined ? current.deadline_timezone : cleanText(input.deadlineTimezone)},
      deadline_needs_verification = ${evidenceType === "published_bid" && !deadline},
      submission_route = ${input.submissionRoute === undefined ? current.submission_route : cleanText(input.submissionRoute)},
      bid_open = ${bidOpen},
      prime_contract_status = ${input.primeContractStatus ?? current.prime_contract_status},
      stage = ${stage},
      next_action = ${input.nextAction === undefined ? current.next_action : cleanText(input.nextAction)},
      next_action_at = ${nextActionAt},
      staff_notes = ${input.staffNotes === undefined ? current.staff_notes : cleanText(input.staffNotes)},
      active = ${typeof input.active === "boolean" ? input.active : current.active},
      rank_score = ${rank.score},
      rank_reason = ${rank.reason},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as DbRow | undefined) ?? null;
}

export async function addActivity(id: string, input: DbRow): Promise<DbRow> {
  const summary = cleanText(input.summary);
  const activityType = cleanText(input.activityType);
  if (!summary || !activityType) throw new TradeDemandValidationError(["Activity type and summary are required."]);

  const currentRows = await sql`SELECT stage FROM trade_demand_opportunities WHERE id = ${id} LIMIT 1`;
  if (!currentRows[0]) throw new TradeDemandValidationError(["Opportunity not found."]);
  const stageFrom = currentRows[0].stage as string;
  const stageTo = cleanText(input.stageTo);
  const nextAction = cleanText(input.nextAction);
  const nextActionAt = asDate(input.nextActionAt);
  const rows = await sql`
    INSERT INTO trade_demand_activities (
      opportunity_id, activity_type, summary, contact_name, confirmation_details,
      stage_from, stage_to, next_action, next_action_at, occurred_at
    ) VALUES (
      ${id}, ${activityType}, ${summary}, ${cleanText(input.contactName)}, ${cleanText(input.confirmationDetails)},
      ${stageFrom}, ${stageTo}, ${nextAction}, ${nextActionAt}, ${asDate(input.occurredAt) ?? new Date()}
    )
    RETURNING *
  `;

  if (stageTo || nextAction || nextActionAt || activityType === "buyer_confirmation") {
    const evidenceType = activityType === "buyer_confirmation" ? "buyer_confirmed" : undefined;
    await updateOpportunity(id, {
      stage: stageTo || undefined,
      nextAction: nextAction || undefined,
      nextActionAt: nextActionAt || undefined,
      evidenceType,
    });
  }
  return rows[0] as DbRow;
}

export async function assignClient(id: string, input: DbRow): Promise<DbRow> {
  const clientId = cleanText(input.clientId);
  if (!clientId) throw new TradeDemandValidationError(["Client is required."]);
  const competitors = await sql`
    SELECT a.id, a.client_id, c.name AS client_name
    FROM trade_demand_assignments a
    JOIN trade_demand_clients c ON c.id = a.client_id
    WHERE a.opportunity_id = ${id}
      AND a.status = 'active'
      AND a.client_id <> ${clientId}
  `;
  if (competitors.length && input.overrideWarning !== true) {
    throw new TradeDemandConflictError(
      "This active opportunity is already assigned to a competing client.",
      { competitors }
    );
  }

  const rows = await sql`
    INSERT INTO trade_demand_assignments (
      opportunity_id, client_id, status, warning_overridden, notes
    ) VALUES (
      ${id}, ${clientId}, 'active', ${Boolean(input.overrideWarning)}, ${cleanText(input.notes)}
    )
    ON CONFLICT (opportunity_id, client_id) DO UPDATE SET
      status = 'active',
      ended_at = NULL,
      warning_overridden = EXCLUDED.warning_overridden,
      notes = COALESCE(EXCLUDED.notes, trade_demand_assignments.notes),
      assigned_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return rows[0] as DbRow;
}

export async function updateClient(id: string, input: DbRow): Promise<DbRow | null> {
  const rows = await sql`
    UPDATE trade_demand_clients SET
      trades = ${asStringArray(input.trades)},
      service_areas = ${asStringArray(input.serviceAreas)},
      job_types = ${asStringArray(input.jobTypes)},
      capacity_notes = ${cleanText(input.capacityNotes)},
      qualifications = ${asStringArray(input.qualifications)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as DbRow | undefined) ?? null;
}

export async function upsertTrade(input: DbRow): Promise<DbRow> {
  const name = cleanText(input.name);
  const slug = (cleanText(input.slug) || name)?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!name || !slug) throw new TradeDemandValidationError(["Trade name is required."]);
  const rows = await sql`
    INSERT INTO trade_demand_trades (slug, name, active, sort_order)
    VALUES (${slug}, ${name}, ${input.active !== false}, ${asNumber(input.sortOrder) ?? 100})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return rows[0] as DbRow;
}

async function upsertPermitRecord(record: OrlandoPermitRecord): Promise<"added" | "updated" | "unchanged"> {
  const permitNumber = cleanText(record.permit_number);
  if (!permitNumber) throw new Error("Orlando record is missing permit_number.");
  const hash = permitContentHash(record);
  const existingRows = await sql`
    SELECT id, content_hash FROM trade_demand_permits
    WHERE source_system = 'orlando_socrata' AND source_record_id = ${permitNumber}
    LIMIT 1
  `;
  const existing = existingRows[0] as DbRow | undefined;
  const outcome = !existing ? "added" : existing.content_hash === hash ? "unchanged" : "updated";
  const sourceUrl = permitSourceUrl(permitNumber);
  const permitRows = await sql`
    INSERT INTO trade_demand_permits (
      source_system, source_record_id, source_url, content_hash, jurisdiction,
      permit_number, application_type, work_type, parcel_number, address,
      project_name, description, status, processed_at, issued_at, finaled_at,
      contractor_name, contractor_business_name, contractor_phone, contractor_address,
      property_owner_name, estimated_cost, square_footage, neighborhood, latitude, longitude, raw_data
    ) VALUES (
      'orlando_socrata', ${permitNumber}, ${sourceUrl}, ${hash}, 'City of Orlando',
      ${permitNumber}, ${cleanText(record.application_type)}, ${cleanText(record.worktype)},
      ${cleanText(record.parcel_number)}, ${cleanText(record.permit_address)}, ${cleanText(record.project_name)},
      ${sourceExcerpt(record)}, ${cleanText(record.application_status)}, ${asDate(record.processed_date)},
      ${asDate(record.issue_permit_date)}, ${asDate(record.final_date)}, ${cleanText(record.contractor)},
      ${cleanText(record.contractor_name)}, ${cleanText(record.contractor_phone_number)},
      ${cleanText(record.contractor_address)}, ${cleanText(record.property_owner_name)},
      ${asNumber(record.estimated_cost)}, ${asNumber(record.square_footage)}, ${cleanText(record.neighborhood)},
      ${asNumber(record.geocoded_column?.latitude)}, ${asNumber(record.geocoded_column?.longitude)}, ${JSON.stringify(record)}::jsonb
    )
    ON CONFLICT (source_system, source_record_id) DO UPDATE SET
      source_url = EXCLUDED.source_url,
      content_hash = EXCLUDED.content_hash,
      application_type = EXCLUDED.application_type,
      work_type = EXCLUDED.work_type,
      parcel_number = EXCLUDED.parcel_number,
      address = EXCLUDED.address,
      project_name = EXCLUDED.project_name,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      processed_at = EXCLUDED.processed_at,
      issued_at = EXCLUDED.issued_at,
      finaled_at = EXCLUDED.finaled_at,
      contractor_name = EXCLUDED.contractor_name,
      contractor_business_name = EXCLUDED.contractor_business_name,
      contractor_phone = EXCLUDED.contractor_phone,
      contractor_address = EXCLUDED.contractor_address,
      property_owner_name = EXCLUDED.property_owner_name,
      estimated_cost = EXCLUDED.estimated_cost,
      square_footage = EXCLUDED.square_footage,
      neighborhood = EXCLUDED.neighborhood,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      raw_data = EXCLUDED.raw_data,
      last_seen_at = CURRENT_TIMESTAMP,
      source_changed_at = CASE
        WHEN trade_demand_permits.content_hash <> EXCLUDED.content_hash THEN CURRENT_TIMESTAMP
        ELSE trade_demand_permits.source_changed_at
      END
    RETURNING id
  `;
  const permitId = permitRows[0].id as string;
  const tradeSlug = classifyPermitTrade(record);
  const rank = rankOpportunity({ evidenceType: "permit_activity" });
  const originKey = `orlando-permit:${permitNumber}:${tradeSlug ?? "unclassified"}`;
  const buyer = permitBuyer(record);
  const projectName = cleanText(record.project_name) || cleanText(record.permit_address) || permitNumber;
  const nextAction = tradeSlug
    ? `Verify whether ${tradeSlug} scope is upcoming or already awarded, and identify who controls the award.`
    : "Classify the trade, identify who controls the award, and verify upcoming work.";
  const opportunityRows = await sql`
    INSERT INTO trade_demand_opportunities (
      origin_key, project_group_key, primary_permit_id, buyer_name, project_name,
      parcel_number, address, city, county, jurisdiction, trade_slug, job_type,
      evidence_type, evidence_summary, source_url, source_label, source_is_manual,
      public_contact_name, public_contact_phone, prime_contract_status,
      next_action, rank_score, rank_reason
    ) VALUES (
      ${originKey}, ${permitProjectGroupKey(record)}, ${permitId}, ${buyer}, ${projectName},
      ${cleanText(record.parcel_number)}, ${cleanText(record.permit_address)}, 'Orlando', 'Orange',
      'City of Orlando', ${tradeSlug}, ${cleanText(record.worktype)}, 'permit_activity',
      ${sourceExcerpt(record)}, ${sourceUrl}, 'City of Orlando Permit Applications', FALSE,
      ${cleanText(record.contractor)}, ${cleanText(record.contractor_phone_number)}, 'unknown',
      ${nextAction}, ${rank.score}, ${rank.reason}
    )
    ON CONFLICT (origin_key) DO UPDATE SET
      primary_permit_id = EXCLUDED.primary_permit_id,
      evidence_summary = EXCLUDED.evidence_summary,
      source_url = EXCLUDED.source_url,
      public_contact_phone = COALESCE(trade_demand_opportunities.public_contact_phone, EXCLUDED.public_contact_phone),
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const opportunityId = opportunityRows[0].id as string;
  await sql`
    INSERT INTO trade_demand_evidence (
      opportunity_id, permit_id, source_system, source_record_id, evidence_type,
      source_url, source_label, excerpt, checked_at, is_manual, bid_open, raw_data
    ) VALUES (
      ${opportunityId}, ${permitId}, 'orlando_socrata', ${permitNumber}, 'permit_activity',
      ${sourceUrl}, 'City of Orlando Permit Applications', ${sourceExcerpt(record)}, CURRENT_TIMESTAMP,
      FALSE, FALSE, ${JSON.stringify(record)}::jsonb
    )
    ON CONFLICT (source_system, source_record_id, evidence_type) DO UPDATE SET
      permit_id = EXCLUDED.permit_id,
      opportunity_id = EXCLUDED.opportunity_id,
      source_url = EXCLUDED.source_url,
      excerpt = EXCLUDED.excerpt,
      checked_at = CURRENT_TIMESTAMP,
      raw_data = EXCLUDED.raw_data,
      updated_at = CURRENT_TIMESTAMP
  `;
  return outcome;
}

export async function syncOrlandoPermits(options: OrlandoSyncOptions = {}): Promise<DbRow> {
  const windowDays = Math.min(Math.max(options.windowDays ?? 45, 1), 365);
  const maxRecords = Math.min(Math.max(options.maxRecords ?? 2500, 1), 10_000);
  const pageSize = Math.min(Math.max(options.pageSize ?? 500, 1), 1000);
  const windowStart = new Date(Date.now() - windowDays * 86_400_000);
  const recentRunning = await sql`
    SELECT id FROM trade_demand_sync_runs
    WHERE source_system = 'orlando_socrata'
      AND status = 'running'
      AND started_at > CURRENT_TIMESTAMP - INTERVAL '20 minutes'
    LIMIT 1
  `;
  if (recentRunning.length) {
    throw new TradeDemandConflictError("An Orlando sync is already running.", { runId: recentRunning[0].id });
  }

  const runRows = await sql`
    INSERT INTO trade_demand_sync_runs (source_system, window_start, details)
    VALUES ('orlando_socrata', ${windowStart}, ${JSON.stringify({ windowDays, maxRecords, pageSize, source: ORLANDO_DATASET_URL })}::jsonb)
    RETURNING id
  `;
  const runId = runRows[0].id as string;
  const stats = { seen: 0, added: 0, updated: 0, unchanged: 0 };

  try {
    const fields = await inspectOrlandoSchema();
    let offset = 0;
    while (stats.seen < maxRecords) {
      const limit = Math.min(pageSize, maxRecords - stats.seen);
      const page = await fetchOrlandoPermitPage({ startDate: windowStart, limit, offset });
      if (!page.length) break;
      for (const record of page) {
        const outcome = await upsertPermitRecord(record);
        stats.seen += 1;
        stats[outcome] += 1;
      }
      offset += page.length;
      if (page.length < limit) break;
    }

    const finishedRows = await sql`
      UPDATE trade_demand_sync_runs SET
        status = 'succeeded', finished_at = CURRENT_TIMESTAMP,
        records_seen = ${stats.seen}, records_added = ${stats.added},
        records_updated = ${stats.updated}, records_unchanged = ${stats.unchanged},
        details = details || ${JSON.stringify({ schemaFields: fields.length })}::jsonb
      WHERE id = ${runId}
      RETURNING *
    `;
    return finishedRows[0] as DbRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await sql`
      UPDATE trade_demand_sync_runs SET
        status = 'failed', finished_at = CURRENT_TIMESTAMP,
        records_seen = ${stats.seen}, records_added = ${stats.added},
        records_updated = ${stats.updated}, records_unchanged = ${stats.unchanged},
        error_message = ${message}
      WHERE id = ${runId}
    `;
    throw error;
  }
}
