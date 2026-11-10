export const DEFAULT_TRADES = [
  { slug: "hvac", name: "HVAC" },
  { slug: "plumbing", name: "Plumbing" },
  { slug: "electrical", name: "Electrical" },
  { slug: "roofing", name: "Roofing" },
  { slug: "painting", name: "Painting" },
  { slug: "landscaping", name: "Landscaping" },
] as const;

export const EVIDENCE_TYPES = [
  "early_planning",
  "permit_activity",
  "vendor_intake",
  "published_bid",
  "buyer_confirmed",
] as const;

export const OPPORTUNITY_STAGES = [
  "identified",
  "introduction",
  "bid_invited",
  "bid_submitted",
  "awarded",
  "lost",
  "first_paid_work_order",
  "repeat_work",
  "expired",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export type OrlandoPermitRecord = {
  permit_number?: string;
  application_type?: string;
  parcel_number?: string;
  worktype?: string;
  final_date?: string;
  temp_coo_date?: string;
  coo_date?: string;
  coc_date?: string;
  permit_address?: string;
  property_owner_name?: string;
  parcel_owner_name?: string;
  contractor?: string;
  contractor_name?: string;
  contractor_address?: string;
  contractor_phone_number?: string;
  plan_review_type?: string;
  estimated_cost?: string;
  processed_date?: string;
  under_review_date?: string;
  prescreen_completed_date?: string;
  review_started_date_excluding?: string;
  review_started_including?: string;
  collect_permit_fees_date?: string;
  pending_issuance_date?: string;
  issue_permit_date?: string;
  project_name?: string;
  application_status?: string;
  location?: string;
  square_footage?: string;
  neighborhood?: string;
  commissioner_district?: string;
  private_provider?: string;
  private_provider_company_name?: string;
  private_provider_qualifier_name?: string;
  geocoded_column?: { latitude?: string; longitude?: string };
  [key: string]: unknown;
};

export type ManualOpportunityInput = {
  buyerName: string;
  tradeSlug: string;
  projectName?: string;
  projectPhase?: string;
  serviceTerritory?: string;
  address?: string;
  city?: string;
  county?: string;
  jobType?: string;
  evidenceType: EvidenceType;
  evidenceExcerpt: string;
  sourceUrl: string;
  sourceLabel?: string;
  publishedAt?: string | null;
  checkedAt?: string | null;
  deadline?: string | null;
  deadlineTimezone?: string | null;
  submissionRoute?: string | null;
  bidOpen?: boolean;
  acceptingSubmissionsConfirmed?: boolean;
  publicContactName?: string | null;
  publicContactPhone?: string | null;
  publicContactEmail?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  primeContractStatus?: "unknown" | "holds_prime" | "still_bidding";
  qualificationRequirements?: string[];
};

const TRADE_TERMS: Record<string, string[]> = {
  hvac: ["mechanical", "hvac", "air conditioning", "a/c", "heating", "chiller"],
  plumbing: ["plumbing", "plumber", "gas permit", "sewer", "water line"],
  electrical: ["electrical", "electric", "lighting", "low voltage"],
  roofing: ["roof", "reroof", "re-roof"],
  painting: ["painting", "paint", "coating"],
  landscaping: ["landscape", "landscaping", "irrigation", "hardscape"],
};

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function compactKeyPart(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (normalized.length <= 160) return normalized;
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${normalized.slice(0, 120)}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function classifyPermitTrade(record: OrlandoPermitRecord): string | null {
  const haystack = [
    record.application_type,
    record.worktype,
    record.project_name,
    record.plan_review_type,
  ]
    .map((value) => cleanText(value)?.toLowerCase() ?? "")
    .join(" ");

  for (const [trade, terms] of Object.entries(TRADE_TERMS)) {
    if (terms.some((term) => haystack.includes(term))) return trade;
  }
  return null;
}

export function permitProjectGroupKey(record: OrlandoPermitRecord): string {
  const parcel = cleanText(record.parcel_number)?.toLowerCase();
  const address = cleanText(record.permit_address)?.toLowerCase();
  const project = cleanText(record.project_name)?.toLowerCase();
  return [
    "orlando",
    compactKeyPart(parcel || address || "unknown"),
    compactKeyPart(project || address || "unnamed"),
  ].join(":");
}

export function manualProjectGroupKey(input: ManualOpportunityInput): string {
  const location = cleanText(input.address) || cleanText(input.serviceTerritory) || "unknown";
  const project = cleanText(input.projectName) || cleanText(input.projectPhase) || "recurring";
  return [cleanText(input.buyerName) || "unknown", location, project]
    .map(compactKeyPart)
    .join(":");
}

export function rankOpportunity(input: {
  evidenceType: EvidenceType;
  bidOpen?: boolean;
  deadline?: string | Date | null;
  nextActionAt?: string | Date | null;
  buyerConfirmed?: boolean;
}): { score: number; reason: string } {
  let score = 0;
  let reason = "Permit activity indicates construction, but trade demand must be verified.";

  if (input.evidenceType === "buyer_confirmed" || input.buyerConfirmed) {
    score = 100;
    reason = "Buyer-confirmed need; act on the recorded next step.";
  } else if (input.evidenceType === "published_bid" && input.bidOpen) {
    score = 90;
    reason = "Published trade-specific bid is accepting submissions.";
  } else if (input.evidenceType === "vendor_intake") {
    score = 65;
    reason = "Buyer has an active vendor intake route; verify a live project need.";
  } else if (input.evidenceType === "early_planning") {
    score = 55;
    reason = "Early planning signal; identify the buyer and confirm procurement timing.";
  } else if (input.evidenceType === "published_bid") {
    score = 50;
    reason = "Bid notice needs deadline or submission-status verification.";
  } else {
    score = 40;
  }

  const now = Date.now();
  const deadline = input.deadline ? new Date(input.deadline).getTime() : Number.NaN;
  if (Number.isFinite(deadline) && deadline >= now) {
    const days = Math.ceil((deadline - now) / 86_400_000);
    if (days <= 3) {
      score += 8;
      reason += ` Deadline is in ${days} day${days === 1 ? "" : "s"}.`;
    } else if (days <= 7) {
      score += 5;
      reason += ` Deadline is in ${days} days.`;
    }
  }

  const nextActionAt = input.nextActionAt ? new Date(input.nextActionAt).getTime() : Number.NaN;
  if (Number.isFinite(nextActionAt) && nextActionAt <= now) {
    score += 4;
    reason += " Follow-up is due.";
  }

  return { score, reason };
}

export function validateManualOpportunity(input: ManualOpportunityInput): string[] {
  const errors: string[] = [];
  if (!cleanText(input.buyerName)) errors.push("Buyer is required.");
  if (!cleanText(input.tradeSlug)) errors.push("Trade is required.");
  if (!cleanText(input.projectName) && !cleanText(input.serviceTerritory)) {
    errors.push("Project/phase or service territory is required.");
  }
  if (!EVIDENCE_TYPES.includes(input.evidenceType)) errors.push("Evidence type is invalid.");
  if (!cleanText(input.sourceUrl)) errors.push("Source URL is required.");
  if (!cleanText(input.evidenceExcerpt)) errors.push("Evidence excerpt is required.");

  if (input.bidOpen) {
    if (input.evidenceType !== "published_bid") {
      errors.push("Only a published bid can be marked open.");
    }
    if (!input.acceptingSubmissionsConfirmed) {
      errors.push("Confirm that the source identifies the scope and is accepting submissions.");
    }
  }

  return errors;
}

export function isExpiredBid(input: {
  evidenceType: EvidenceType;
  bidOpen?: boolean;
  deadline?: string | Date | null;
}, now = new Date()): boolean {
  if (input.evidenceType !== "published_bid" || !input.bidOpen || !input.deadline) return false;
  return new Date(input.deadline).getTime() < now.getTime();
}

export function clientMatch(input: {
  opportunity: {
    tradeSlug?: string | null;
    city?: string | null;
    county?: string | null;
    serviceTerritory?: string | null;
    jobType?: string | null;
    qualificationRequirements?: string[] | null;
  };
  client: {
    trades?: string[] | null;
    serviceAreas?: string[] | null;
    jobTypes?: string[] | null;
    capacityNotes?: string | null;
    qualifications?: string[] | null;
  };
}): { score: number; missing: string[]; reasons: string[] } {
  const { opportunity, client } = input;
  const missing: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  if (!client.trades?.length) missing.push("trades");
  else if (opportunity.tradeSlug && client.trades.includes(opportunity.tradeSlug)) {
    score += 45;
    reasons.push("trade match");
  }

  const targetAreas = [opportunity.city, opportunity.county, opportunity.serviceTerritory]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (!client.serviceAreas?.length) missing.push("service area");
  else if (client.serviceAreas.some((area) => targetAreas.some((target) => target.includes(area.toLowerCase()) || area.toLowerCase().includes(target)))) {
    score += 25;
    reasons.push("service-area match");
  }

  if (!client.jobTypes?.length) missing.push("job types");
  else if (opportunity.jobType && client.jobTypes.map((value) => value.toLowerCase()).includes(opportunity.jobType.toLowerCase())) {
    score += 15;
    reasons.push("job-type match");
  }

  if (!cleanText(client.capacityNotes)) missing.push("capacity");
  else {
    score += 5;
    reasons.push("capacity recorded");
  }

  const requirements = opportunity.qualificationRequirements ?? [];
  if (requirements.length) {
    if (!client.qualifications?.length) missing.push("qualifications");
    else {
      const qualifications = client.qualifications.map((value) => value.toLowerCase());
      const matched = requirements.filter((requirement) =>
        qualifications.some((qualification) => qualification.includes(requirement.toLowerCase()))
      );
      score += Math.round((matched.length / requirements.length) * 10);
      if (matched.length) reasons.push(`${matched.length}/${requirements.length} qualifications matched`);
    }
  }

  return { score, missing, reasons };
}
