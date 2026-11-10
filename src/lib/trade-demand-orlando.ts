import { createHash } from "crypto";
import type { OrlandoPermitRecord } from "@/lib/trade-demand-core";

export const ORLANDO_DATASET_ID = "ryhf-m453";
export const ORLANDO_DATASET_URL = `https://data.cityoforlando.net/Permitting/Permit-Applications/${ORLANDO_DATASET_ID}`;
const ORLANDO_API_BASE = `https://data.cityoforlando.net/resource/${ORLANDO_DATASET_ID}.json`;
const ORLANDO_META_URL = `https://data.cityoforlando.net/api/views/${ORLANDO_DATASET_ID}`;

const EXPECTED_FIELDS = [
  "permit_number",
  "application_type",
  "parcel_number",
  "worktype",
  "permit_address",
  "contractor",
  "contractor_name",
  "contractor_phone_number",
  "processed_date",
  "issue_permit_date",
  "project_name",
  "application_status",
] as const;

type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
};

export type OrlandoPageOptions = FetchOptions & {
  startDate: Date;
  limit: number;
  offset: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "Intent-Trade-Demand/1.0" },
        cache: "no-store",
      });
      if (response.ok) return (await response.json()) as T;

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) {
        throw new Error(`Orlando Socrata request failed with HTTP ${response.status}.`);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown network error";
  throw new Error(`Orlando Socrata request failed after retries: ${message}`);
}

export async function inspectOrlandoSchema(options: FetchOptions = {}): Promise<string[]> {
  const metadata = await fetchJson<{ columns?: Array<{ fieldName?: string }> }>(ORLANDO_META_URL, options);
  const fields = (metadata.columns ?? [])
    .map((column) => column.fieldName)
    .filter((field): field is string => Boolean(field));
  const missing = EXPECTED_FIELDS.filter((field) => !fields.includes(field));
  if (missing.length) throw new Error(`Orlando dataset schema is missing expected fields: ${missing.join(", ")}`);
  return fields;
}

export async function fetchOrlandoPermitPage(options: OrlandoPageOptions): Promise<OrlandoPermitRecord[]> {
  const start = options.startDate.toISOString().replace("Z", "");
  const where = `(processed_date >= '${start}' OR issue_permit_date >= '${start}')`;
  const params = new URLSearchParams({
    "$where": where,
    "$order": "processed_date ASC, permit_number ASC",
    "$limit": String(options.limit),
    "$offset": String(options.offset),
  });
  return fetchJson<OrlandoPermitRecord[]>(`${ORLANDO_API_BASE}?${params.toString()}`, options);
}

export function permitSourceUrl(permitNumber: string): string {
  const params = new URLSearchParams({ permit_number: permitNumber });
  return `${ORLANDO_API_BASE}?${params.toString()}`;
}

export function permitContentHash(record: OrlandoPermitRecord): string {
  const normalized = Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = record[key];
      return result;
    }, {});
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
