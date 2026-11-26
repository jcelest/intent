import { sql } from "@/lib/db";
import { normalizeOwnerName } from "@/lib/sunbiz-matcher";
import { createHash } from "node:crypto";

const SERPER_FREE_QUERY_CAP = 2500;

export class SearchBudgetExhaustedError extends Error {
  code = "SEARCH_BUDGET_EXHAUSTED" as const;
  constructor() {
    super("Serper free-tier query budget exhausted");
  }
}

export class SearchProviderNotConfiguredError extends Error {
  code = "SEARCH_PROVIDER_NOT_CONFIGURED" as const;
  constructor() {
    super("SERPER_API_KEY is not configured");
  }
}

export interface SearchVerificationEvidence {
  url: string;
  query: string;
  snippet?: string;
  title?: string;
  verified_at: string;
}

export interface SearchVerificationRecord {
  id?: string;
  business_name: string;
  city: string;
  county: string;
  target_type: string;
  target_id?: string | null;
  query_used: string;
  official_website_url: string | null;
  has_website: boolean;
  gbp_signal: "LISTING_PRESENT" | "NOT_SEEN";
  rating: number | null;
  review_count: number | null;
  phone: string | null;
  operating_status: "ACTIVE" | "PERMANENTLY_CLOSED" | "UNKNOWN";
  verification_status: "VERIFIED_ACTIVE" | "LIKELY_ACTIVE" | "NOT_FOUND" | "AMBIGUOUS" | "CLOSED";
  match_score: number;
  evidence: SearchVerificationEvidence[];
  needs_review: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  verified_at: string;
  expires_at: string;
}

/** Directory domains that do NOT qualify as an official business website */
const DIRECTORY_DOMAINS = [
  "yelp.com",
  "yellowpages.com",
  "bbb.org",
  "manta.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "mapquest.com",
  "sunbiz.org",
  "myfloridalicense.com",
  "chamberofcommerce.com",
  "bloomberg.com",
  "dnb.com",
  "zoominfo.com",
  "buzzfile.com",
  "whitepages.com",
  "superpages.com",
  "angi.com",
  "homeadvisor.com",
];

export function isDirectoryDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return DIRECTORY_DOMAINS.some((d) => host.includes(d));
  } catch {
    return true;
  }
}

/**
 * Pluggable Search Provider Interface
 */
export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
}

export interface PluggableSearchProvider {
  search(query: string): Promise<SearchResultItem[]>;
}

/**
 * Serper API Provider
 */
class SerperSearchProvider implements PluggableSearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string): Promise<SearchResultItem[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5, gl: "us" }),
    });
    if (!res.ok) {
      throw new Error(`Serper API error: ${res.statusText}`);
    }
    const data = await res.json();
    const organic = data.organic || [];
    return organic.map((i: { title?: string; link?: string; snippet?: string }) => ({
      title: i.title || "",
      link: i.link || "",
      snippet: i.snippet || "",
    }));
  }
}

/**
 * Deterministic Verified Fallback Provider:
 * Used when external API keys are not provided in environment.
 * Generates verified official result items with legitimate evidence URLs.
 */
class UnconfiguredSearchProvider implements PluggableSearchProvider {
  async search(): Promise<SearchResultItem[]> {
    throw new SearchProviderNotConfiguredError();
  }
}

/**
 * Factory for search provider
 */
export function getPluggableSearchProvider(): PluggableSearchProvider {
  if (process.env.SERPER_API_KEY) {
    return new SerperSearchProvider(process.env.SERPER_API_KEY);
  }
  return new UnconfiguredSearchProvider();
}

export async function getSearchBudgetStatus(): Promise<{
  provider: "serper";
  queryCap: number;
  queriesUsed: number;
  queriesRemaining: number;
}> {
  await sql`
    INSERT INTO oi_search_query_budgets(provider, query_cap, queries_used)
    VALUES ('serper', ${SERPER_FREE_QUERY_CAP}, 0)
    ON CONFLICT (provider) DO NOTHING
  `;
  const rows = await sql`
    SELECT query_cap, queries_used
    FROM oi_search_query_budgets
    WHERE provider = 'serper'
    LIMIT 1
  `;
  const queryCap = Number(rows[0]?.query_cap || SERPER_FREE_QUERY_CAP);
  const queriesUsed = Number(rows[0]?.queries_used || 0);
  return {
    provider: "serper",
    queryCap,
    queriesUsed,
    queriesRemaining: Math.max(0, queryCap - queriesUsed),
  };
}

async function reserveSearchQuery(): Promise<void> {
  await sql`
    INSERT INTO oi_search_query_budgets(provider, query_cap, queries_used)
    VALUES ('serper', ${SERPER_FREE_QUERY_CAP}, 0)
    ON CONFLICT (provider) DO NOTHING
  `;
  const rows = await sql`
    UPDATE oi_search_query_budgets
    SET queries_used = queries_used + 1, updated_at = CURRENT_TIMESTAMP
    WHERE provider = 'serper' AND queries_used < query_cap AND query_cap <= ${SERPER_FREE_QUERY_CAP}
    RETURNING queries_used
  `;
  if (!rows.length) throw new SearchBudgetExhaustedError();
}

async function runBudgetedSearch(params: {
  provider: PluggableSearchProvider;
  query: string;
  targetType: string;
  targetId?: string | null;
}): Promise<SearchResultItem[]> {
  if (!process.env.SERPER_API_KEY) throw new SearchProviderNotConfiguredError();
  await reserveSearchQuery();
  const queryHash = createHash("sha256").update(params.query).digest("hex");
  try {
    const results = await params.provider.search(params.query);
    await sql`
      INSERT INTO oi_search_query_log(
        provider, target_type, target_id, query_hash, query_text, status, result_count
      ) VALUES (
        'serper', ${params.targetType}, ${params.targetId || null}, ${queryHash},
        ${params.query}, 'completed', ${results.length}
      )
    `;
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      INSERT INTO oi_search_query_log(
        provider, target_type, target_id, query_hash, query_text, status, error_message
      ) VALUES (
        'serper', ${params.targetType}, ${params.targetId || null}, ${queryHash},
        ${params.query}, 'failed', ${message}
      )
    `;
    throw error;
  }
}

/**
 * Verifies business current activity using Serper search results only (no Places API).
 * Query pattern: "{exact business name}" {city} FL
 * Strictly cached: never re-run search for same normalized business name + city within 30 days unless forceRefresh = true.
 */
export async function verifyBusinessActivity(params: {
  businessName: string;
  city: string;
  county: string;
  targetType: string;
  targetId?: string | null;
  streetAddress?: string | null;
  phone?: string | null;
  forceRefresh?: boolean;
}): Promise<SearchVerificationRecord> {
  const normName = normalizeOwnerName(params.businessName);
  const city = params.city.trim();
  const now = new Date();

  // 1. Check 30-day cache in fl_search_verifications
  if (!params.forceRefresh) {
    const cacheRows = await sql`
      SELECT *
      FROM fl_search_verifications
      WHERE business_name = ${params.businessName}
        AND city = ${city}
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY verified_at DESC
      LIMIT 1
    `;

    if (cacheRows.length > 0) {
      const c = cacheRows[0] as Record<string, unknown>;
      return {
        id: String(c.id),
        business_name: String(c.business_name),
        city: String(c.city),
        county: String(c.county),
        target_type: String(c.target_type),
        target_id: c.target_id ? String(c.target_id) : null,
        query_used: String(c.query_used),
        official_website_url: c.official_website_url ? String(c.official_website_url) : null,
        has_website: Boolean(c.has_website),
        gbp_signal: String(c.gbp_signal) as "LISTING_PRESENT" | "NOT_SEEN",
        rating: c.rating !== null ? Number(c.rating) : null,
        review_count: c.review_count !== null ? Number(c.review_count) : null,
        phone: c.phone ? String(c.phone) : null,
        operating_status: String(c.operating_status) as "ACTIVE" | "PERMANENTLY_CLOSED" | "UNKNOWN",
        verification_status: String(c.verification_status) as SearchVerificationRecord["verification_status"],
        match_score: Number(c.match_score || 0),
        evidence: Array.isArray(c.evidence) ? (c.evidence as SearchVerificationEvidence[]) : [],
        needs_review: Boolean(c.needs_review),
        reviewed_by: c.reviewed_by ? String(c.reviewed_by) : null,
        reviewed_at: c.reviewed_at ? String(c.reviewed_at) : null,
        verified_at: new Date(String(c.verified_at)).toISOString(),
        expires_at: new Date(String(c.expires_at)).toISOString(),
      };
    }
  }

  // 2. Query pattern: "{exact business name}" {city} FL
  const primaryQuery = `"${params.businessName}" ${city} FL`;
  const provider = getPluggableSearchProvider();

  let queryUsed = primaryQuery;
  let results = await runBudgetedSearch({
    provider,
    query: primaryQuery,
    targetType: params.targetType,
    targetId: params.targetId,
  });

  // If ambiguous (no results or too generic), run secondary query with streetAddress or county
  if (results.length === 0 && params.streetAddress) {
    const secondaryQuery = `"${params.businessName}" ${params.streetAddress} FL`;
    queryUsed = secondaryQuery;
    results = await runBudgetedSearch({
      provider,
      query: secondaryQuery,
      targetType: params.targetType,
      targetId: params.targetId,
    });
  }

  // 3. Extract signals strictly from search results
  let officialWebsite: string | null = null;
  let gbpSignal: "LISTING_PRESENT" | "NOT_SEEN" = "NOT_SEEN";
  let rating: number | null = null;
  let reviewCount: number | null = null;
  let verifiedPhone: string | null = null;
  let operatingStatus: "ACTIVE" | "PERMANENTLY_CLOSED" | "UNKNOWN" = "ACTIVE";
  let verificationStatus: SearchVerificationRecord["verification_status"] = "NOT_FOUND";
  let matchScore = 0;
  const evidenceList: SearchVerificationEvidence[] = [];

  for (const item of results) {
    evidenceList.push({
      url: item.link,
      query: queryUsed,
      snippet: item.snippet,
      title: item.title,
      verified_at: now.toISOString(),
    });

    const lowerTitle = item.title.toLowerCase();
    const lowerSnippet = item.snippet.toLowerCase();

    // Check permanently closed
    if (lowerSnippet.includes("permanently closed") || lowerTitle.includes("permanently closed")) {
      operatingStatus = "PERMANENTLY_CLOSED";
      verificationStatus = "CLOSED";
    }

    // Identify official business domain
    if (!officialWebsite && item.link.startsWith("http") && !isDirectoryDomain(item.link)) {
      officialWebsite = item.link;
    }

    // Google Business / Maps / Knowledge listing signal
    if (
      item.link.includes("maps.google.com") ||
      item.link.includes("google.com/maps") ||
      lowerSnippet.includes("reviews") ||
      lowerSnippet.includes("rating") ||
      lowerSnippet.includes("address:")
    ) {
      gbpSignal = "LISTING_PRESENT";
    }

    // Extract rating / review count if visible
    const ratingMatch = item.snippet.match(/(\d\.\d)\s*(?:stars|rating|\/\s*5)/i);
    if (ratingMatch && !rating) {
      rating = parseFloat(ratingMatch[1]);
    }
    const reviewMatch = item.snippet.match(/(\d{1,4})\s*reviews/i);
    if (reviewMatch && !reviewCount) {
      reviewCount = parseInt(reviewMatch[1], 10);
    }

    // Extract phone if visible
    const phoneMatch = item.snippet.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch && !verifiedPhone) {
      verifiedPhone = phoneMatch[0];
    }
  }

  // Hard rule: A verification with no evidence URL is invalid and must not be stored.
  if (evidenceList.length === 0) {
    throw new Error("Invalid verification: No evidence URL returned by search provider.");
  }

  // Compute match score and verification status
  if (results.length > 0) {
    const top = results[0];
    const topTitle = top.title.toUpperCase();

    if (topTitle.includes(normName) || normName.includes(topTitle.slice(0, 15))) {
      matchScore += 50;
    } else {
      matchScore += 25;
    }

    if (top.snippet.toLowerCase().includes(city.toLowerCase())) {
      matchScore += 25;
    }

    if (officialWebsite || gbpSignal === "LISTING_PRESENT") {
      matchScore += 25;
    }

    if (operatingStatus === "PERMANENTLY_CLOSED") {
      verificationStatus = "CLOSED";
    } else if (matchScore >= 75 && (officialWebsite || gbpSignal === "LISTING_PRESENT")) {
      verificationStatus = "VERIFIED_ACTIVE";
    } else if (matchScore >= 50) {
      verificationStatus = "LIKELY_ACTIVE";
    } else {
      verificationStatus = "AMBIGUOUS";
    }
  }

  const needsReview = verificationStatus === "AMBIGUOUS";
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day cache

  const record: SearchVerificationRecord = {
    business_name: params.businessName,
    city,
    county: params.county,
    target_type: params.targetType,
    target_id: params.targetId || null,
    query_used: queryUsed,
    official_website_url: officialWebsite,
    has_website: Boolean(officialWebsite),
    gbp_signal: gbpSignal,
    rating,
    review_count: reviewCount,
    phone: verifiedPhone || params.phone || null,
    operating_status: operatingStatus,
    verification_status: verificationStatus,
    match_score: matchScore,
    evidence: evidenceList,
    needs_review: needsReview,
    verified_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // 4. Store in fl_search_verifications
  await sql`
    INSERT INTO fl_search_verifications (
      business_name, city, county, target_type, target_id,
      query_used, official_website_url, has_website, gbp_signal,
      rating, review_count, phone, operating_status, verification_status,
      match_score, evidence, needs_review, verified_at, expires_at
    ) VALUES (
      ${record.business_name}, ${record.city}, ${record.county}, ${record.target_type},
      ${record.target_id}, ${record.query_used}, ${record.official_website_url},
      ${record.has_website}, ${record.gbp_signal}, ${record.rating}, ${record.review_count},
      ${record.phone}, ${record.operating_status}, ${record.verification_status},
      ${record.match_score}, ${JSON.stringify(record.evidence)}::jsonb,
      ${record.needs_review}, ${record.verified_at}, ${record.expires_at}
    )
  `;

  return record;
}
