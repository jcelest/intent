import { sql } from "../src/lib/db";
import {
  saveManagementFirms,
  type ManagementFirmRecord,
} from "../src/lib/florida-management-firms";
import { DOR_CODE_TO_COUNTY } from "../src/lib/florida-dor-meta";
import { pathToFileURL } from "node:url";

const DBPR_CSV_URL =
  "https://www2.myfloridalicense.com/sto/file_download/extracts/lic38cam.csv";
const DBPR_EVIDENCE_URL =
  "https://www2.myfloridalicense.com/community-association-managers-and-firms/public-records/";
const CENSUS_BATCH_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

type DbprCabFirm = {
  name: string;
  dba: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  countyCode: number;
  licenseNumber: string;
  primaryStatus: string;
  secondaryStatus: string;
  originalLicensureDate: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
};

type CensusMatch = {
  latitude: number;
  longitude: number;
  matchType: string;
  matchedAddress: string;
};

type SyncOptions = {
  dryRun: boolean;
  skipGoogle: boolean;
  limit: number | null;
  googleConcurrency: number;
};

export function parseCsv(input: string): string[][] {
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
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function clean(value: string | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isMappableStreetAddress(address: string): boolean {
  return /^\d+[A-Z-]*\s+/i.test(address) && !/^\d+\s+P\.?\s*O\.?\s+BOX/i.test(address);
}

export function selectCurrentFloridaCabFirms(rows: string[][]): DbprCabFirm[] {
  const firms = new Map<string, DbprCabFirm>();
  for (const row of rows) {
    const occupation = clean(row[1]).toUpperCase();
    const primaryStatus = clean(row[13]).toUpperCase();
    const state = clean(row[9]).toUpperCase();
    const addressParts = [row[5], row[6], row[7]].map(clean).filter(Boolean);
    const address = clean(addressParts.join(" "));
    const countyCode = Number(row[11]);
    const county = DOR_CODE_TO_COUNTY.get(countyCode)?.name;
    const licenseNumber = clean(row[20] || row[12]).toUpperCase();

    if (
      occupation !== "CAB" ||
      primaryStatus !== "C" ||
      state !== "FL" ||
      !county ||
      !licenseNumber.startsWith("CAB") ||
      !isMappableStreetAddress(address)
    ) {
      continue;
    }

    firms.set(licenseNumber, {
      name: clean(row[2]),
      dba: clean(row[3]) || null,
      address,
      city: clean(row[8]),
      state,
      zipCode: clean(row[10]).slice(0, 5),
      county,
      countyCode,
      licenseNumber,
      primaryStatus,
      secondaryStatus: clean(row[14]).toUpperCase(),
      originalLicensureDate: clean(row[15]) || null,
      effectiveDate: clean(row[16]) || null,
      expirationDate: clean(row[17]) || null,
    });
  }
  return Array.from(firms.values()).sort((left, right) =>
    left.licenseNumber.localeCompare(right.licenseNumber),
  );
}

export function parseCensusBatchResponse(input: string): Map<string, CensusMatch> {
  const matches = new Map<string, CensusMatch>();
  for (const row of parseCsv(input)) {
    if (clean(row[2]).toLowerCase() !== "match") continue;
    const [longitudeText, latitudeText] = clean(row[5]).split(",");
    const longitude = Number(longitudeText);
    const latitude = Number(latitudeText);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 24 ||
      latitude > 32 ||
      longitude < -88 ||
      longitude > -79
    ) {
      continue;
    }
    matches.set(clean(row[0]), {
      latitude,
      longitude,
      matchType: clean(row[3]),
      matchedAddress: clean(row[4]),
    });
  }
  return matches;
}

async function downloadDbprFirms(): Promise<DbprCabFirm[]> {
  const response = await fetch(DBPR_CSV_URL, {
    headers: { "User-Agent": "Intent-Opportunity-Intelligence/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`DBPR download failed with HTTP ${response.status}`);
  }
  return selectCurrentFloridaCabFirms(parseCsv(await response.text()));
}

async function geocodeWithCensus(firms: DbprCabFirm[]): Promise<Map<string, CensusMatch>> {
  const csv = firms
    .map((firm) =>
      [
        csvCell(firm.licenseNumber),
        csvCell(firm.address),
        csvCell(firm.city),
        csvCell(firm.state),
        csvCell(firm.zipCode),
      ].join(","),
    )
    .join("\n");
  const form = new FormData();
  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "florida-cab-firms.csv");
  form.append("benchmark", "Public_AR_Current");
  const response = await fetch(CENSUS_BATCH_URL, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Census batch geocoder failed with HTTP ${response.status}`);
  }
  return parseCensusBatchResponse(await response.text());
}

async function googlePlaceIdForFirm(
  firm: DbprCabFirm,
  apiKey: string,
): Promise<string | null> {
  const textQuery = [firm.dba || firm.name, firm.address, firm.city, firm.state, firm.zipCode]
    .filter(Boolean)
    .join(" ");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 1,
        languageCode: "en",
        regionCode: "US",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const result = (await response.json()) as { places?: Array<{ id?: string }> };
      return clean(result.places?.[0]?.id) || null;
    }
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Google Places returned HTTP ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()),
  );
  return results;
}

function parseOptions(argv: string[]): SyncOptions {
  const limitArgument = argv.find((argument) => argument.startsWith("--limit="));
  const concurrencyArgument = argv.find((argument) => argument.startsWith("--google-concurrency="));
  const limit = limitArgument ? Number(limitArgument.split("=", 2)[1]) : null;
  const googleConcurrency = concurrencyArgument
    ? Number(concurrencyArgument.split("=", 2)[1])
    : 12;
  return {
    dryRun: argv.includes("--dry-run"),
    skipGoogle: argv.includes("--skip-google"),
    limit: limit && limit > 0 ? Math.floor(limit) : null,
    googleConcurrency:
      Number.isFinite(googleConcurrency) && googleConcurrency > 0
        ? Math.min(Math.floor(googleConcurrency), 30)
        : 12,
  };
}

async function persistInBatches(records: ManagementFirmRecord[]): Promise<number> {
  const batchSize = 12;
  let saved = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    const counts = await Promise.all(batch.map((record) => saveManagementFirms([record])));
    saved += counts.reduce((sum, count) => sum + count, 0);
    if ((index + batch.length) % 120 === 0 || index + batch.length === records.length) {
      console.log(`Persisted ${index + batch.length}/${records.length} mapped firms`);
    }
  }
  return saved;
}

async function run() {
  const options = parseOptions(process.argv.slice(2));
  console.log("Downloading the official weekly DBPR CAM/CAB license file...");
  let firms = await downloadDbprFirms();
  if (options.limit) firms = firms.slice(0, options.limit);
  console.log(`Selected ${firms.length} current Florida CAB firms with street addresses.`);

  const censusMatches = await geocodeWithCensus(firms);
  const geocodedFirms = firms.filter((firm) => censusMatches.has(firm.licenseNumber));
  console.log(`Census geocoded ${geocodedFirms.length}/${firms.length} firms.`);

  const googleApiKey = clean(process.env.GOOGLE_MAPS_API_KEY);
  if (!options.skipGoogle && !googleApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required unless --skip-google is used");
  }

  const googlePlaceIds = new Map<string, string>();
  if (!options.skipGoogle) {
    let completed = 0;
    const placeIds = await mapWithConcurrency(
      geocodedFirms,
      options.googleConcurrency,
      async (firm) => {
        try {
          return await googlePlaceIdForFirm(firm, googleApiKey);
        } catch (error) {
          console.warn(`${firm.licenseNumber}: Google lookup failed:`, error);
          return null;
        } finally {
          completed += 1;
          if (completed % 100 === 0 || completed === geocodedFirms.length) {
            console.log(`Checked Google listing IDs for ${completed}/${geocodedFirms.length} firms`);
          }
        }
      },
    );
    geocodedFirms.forEach((firm, index) => {
      const placeId = placeIds[index];
      if (placeId) googlePlaceIds.set(firm.licenseNumber, placeId);
    });
  }

  const checkedAt = new Date().toISOString();
  const records: ManagementFirmRecord[] = geocodedFirms.map((firm) => {
    const coordinates = censusMatches.get(firm.licenseNumber)!;
    const googlePlaceId = googlePlaceIds.get(firm.licenseNumber) || null;
    return {
      name: firm.name,
      dba: firm.dba,
      firmType: "community_association_management",
      licenseNumber: firm.licenseNumber,
      licenseType: "Community Association Management Firm",
      status: firm.secondaryStatus === "I" ? "Current,Inactive" : "Current",
      address: firm.address,
      city: firm.city,
      state: firm.state,
      zipCode: firm.zipCode,
      county: firm.county,
      phone: null,
      email: null,
      website: null,
      qualifierName: null,
      managedPropertiesCount: 0,
      managedPortfolioSqft: null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      source: "FL_DBPR_CAB",
      evidenceUrl: DBPR_EVIDENCE_URL,
      metadata: {
        dbpr_primary_status: firm.primaryStatus,
        dbpr_secondary_status: firm.secondaryStatus || null,
        dbpr_original_licensure_date: firm.originalLicensureDate,
        dbpr_effective_date: firm.effectiveDate,
        dbpr_expiration_date: firm.expirationDate,
        dbpr_county_code: firm.countyCode,
        coordinate_source: "US_CENSUS_GEOCODER",
        coordinate_match_type: coordinates.matchType,
        census_matched_address: coordinates.matchedAddress,
        google_place_id: googlePlaceId,
        google_listing_status: googlePlaceId ? "listing_found" : "not_found",
        google_listing_checked_at: options.skipGoogle ? null : checkedAt,
      },
    };
  });

  const summary = {
    officialCurrentFloridaFirms: firms.length,
    mappedFirms: records.length,
    googleListingsFound: googlePlaceIds.size,
    dryRun: options.dryRun,
  };
  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (records.length < 100 && !options.limit) {
    throw new Error("Safety stop: fewer than 100 firms were geocoded; existing data was not changed");
  }

  const saved = await persistInBatches(records);
  if (saved !== records.length) {
    throw new Error(`Only ${saved}/${records.length} firms were saved; stale cleanup was skipped`);
  }

  if (!options.limit) {
    const officialLicenses = firms.map((firm) => firm.licenseNumber);
    await sql`
      DELETE FROM fl_management_firms
      WHERE source = 'FL_DBPR_CAB'
        AND (license_number IS NULL OR NOT (license_number = ANY(${officialLicenses}::text[])))
    `;
    await sql`
      DELETE FROM oi_opportunities
      WHERE source_id = 'fl-dbpr-open-data'
        AND trade_slug = 'property_management'
        AND NOT (source_record_id = ANY(${officialLicenses}::text[]))
    `;
    await sql`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY license_number
                 ORDER BY updated_at DESC, created_at DESC, id DESC
               ) AS row_number
        FROM fl_management_firms
        WHERE source = 'FL_DBPR_CAB' AND license_number IS NOT NULL
      )
      DELETE FROM fl_management_firms firm
      USING ranked
      WHERE firm.id = ranked.id AND ranked.row_number > 1
    `;
  }

  const countRows = await sql`
    SELECT
      COUNT(*)::int AS mapped,
      COUNT(*) FILTER (WHERE metadata->>'google_listing_status' = 'listing_found')::int AS google_listed,
      COUNT(DISTINCT county)::int AS counties
    FROM fl_management_firms
    WHERE source = 'FL_DBPR_CAB'
  `;
  console.log(JSON.stringify({ ...summary, saved, database: countRows[0] }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
