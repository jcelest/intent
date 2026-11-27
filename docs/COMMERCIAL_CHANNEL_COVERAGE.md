# Tier 1 and Tier 2 Commercial Channel Coverage

Last production verification: 2026-11-27 15:25 UTC

This workstream is separate from procurement and solicitation ingestion. Procurement records never count toward the channel totals below.

## Coverage contract

- Stage A is the source-reconciled universe. The source, source date, source-reported count, and database count must agree before a channel can be called complete.
- Stage B is the workable subset. A record must be verified active within 30 days, include an evidence URL and match score, and carry phone, website status, county, and a tonnage screen where relevant.
- Fit score is an ordering aid only. It does not qualify a record or affect coverage.
- Missing fields stay null. Unreached verification records remain in the dated queue.
- Search verification uses Serper only. The lifetime free-tier ledger is capped at 2,500 queries and cannot exceed that cap.

## Verified production state

| Channel | Stage A | Stage B | Current state |
|---|---:|---:|---|
| Property managers | 0 | 0 | Not connected. The 1,783 relationship records and 1,807 management-firm records remain legacy candidates and are excluded from the authoritative denominator. |
| CAM firms and individual licensees | 21,068 | 5 | DBPR reconciled: 2,016 active CAM firms and 19,052 active CAM individuals. |
| HOA and condominium associations | 0 | 0 | Sunbiz nonprofit universe not yet ingested. |
| Direct commercial accounts | 11,845 parcels | 0 | Partial. 26 parcel owners are business-matched and 5 of 67 counties meet the full-depth threshold. |
| Restoration | 5,829 DBPR licenses | 1 | DBPR reconciled: 2,964 mold assessors and 2,865 mold remediators. Franchise locator and Sunbiz reconciliation remain open. |
| FM aggregator platforms | 10 | 0 registered | The active client platform tracker contains all 10 required platform rows. |
| Chains and facility operators | 0 | 0 | Operator and location universe not yet ingested. |

Authoritative connected sources:

- [Florida DBPR CAM public records](https://www2.myfloridalicense.com/community-association-managers-and-firms/public-records/), source snapshot 2026-11-25. Source and database counts both equal 21,068.
- [Florida DBPR Mold-Related Services public records](https://www2.myfloridalicense.com/mold-related-services/public-records/), source snapshot 2026-11-21. Source and database counts both equal 5,829.
- [Florida Department of Revenue Property Data Portal](https://floridarevenue.com/property/Pages/DataPortal.aspx), current database row sum 11,845.

Example direct-account reconciliation:

| County | Parcels | Business matched | Verified active | Source state |
|---|---:|---:|---:|---|
| Orange | 2,250 | 9 | 0 | Ingested |
| Osceola | 1,811 | 0 | 0 | Ingested |

The earlier conflicting direct-account totals are resolved by using the live county row sum. The current sourced total is 11,845.

## Search verification

The production `SERPER_API_KEY` is configured as a protected hosting secret. The first bounded run consumed 25 of 2,500 queries and produced 22 verified-active results plus 3 human-review results. The remaining budget is 2,475 queries.

- All pending firm and restoration records stay in the dated verification queue.
- Every county and channel receives priority 100. Queue order is cadence, creation time, and stable identifiers, not a client, trade, or county preference.
- Results are cached for 30 days. Ambiguous matches go to human review.

Run `npm run data:verify-commercial-channels` for a bounded 25-record production batch. If the 2,500-query cap is reached, all remaining rows become `UNVERIFIED_BUDGET`; the system never silently substitutes unverified records.

## FM platform tracker

The fixed list is ServiceChannel, Lessen, CorrigoPro, Vixxo, DMG Pro, SMS Assist, Chain Store Maintenance, Ferrandino and Son, CBRE vendor system, and JLL/Corrigo. Each active-client row supports `NOT_REGISTERED`, `IN_PROGRESS`, or `REGISTERED`, with date and notes.

## Automated schedule

The authenticated `commercial-channels` scheduler lane runs daily at 07:27 UTC. It refreshes official DBPR files, portfolio sources, maintenance-purchasing evidence, the cached official-website discovery queue, direct-account county counts, and up to 25 Serper verification records. GitHub Actions supplies `CRON_SECRET`; Vercel independently stores the same protected secret.

## Maintenance purchasing intelligence

Production reconciliation on 2026-11-27 contains 24,451 current evidence records across 18,871 firms. Of these, 24,426 records are authoritative portfolio-type relationships and 25 are explicitly labeled first-party self-reported maintenance or portfolio facts. Current purchasing-specific coverage is intentionally narrow: 3 firms have documented maintenance responsibility, 1 has public vendor onboarding, 1 has documented purchasing activity, and 1 has a documented contractor relationship. Etheridge Property Management and NFI Property Management Solutions are both above the verified 200-unit threshold; Associa Gulf Coast has documented maintenance and vendor facts but an unknown verified portfolio floor.

The automatic official-website scanner checked 7 exact-license-matched firms: 4 yielded 13 attributable facts, 2 yielded no qualifying facts, and 1 retrieval failed. It caches successful scans for 30 days and failed scans for 7 days. A CBRE supplier page currently returns HTTP 403 and remains a visible source failure; no bypass is attempted.

## Remaining Stage A work

1. Import the Sunbiz active nonprofit universe and apply documented HOA and condominium name rules. Link a CAM only where a public source states the relationship.
2. Build the county search, NARPM, IREM, and published business-tax-receipt property-manager denominator. Keep each component source count separate.
3. Reconcile SERVPRO and Paul Davis Florida location counts to their official locators, add BELFOR Florida offices, and cross-check Sunbiz restoration and mitigation names. Do not call this channel complete until required phones are present.
4. Build the chain/operator universe from official location lists, franchise disclosures, Sunbiz document numbers, and owners with five or more commercial parcels.
5. Continue county parcel ingestion. Counties without a supported public download remain `RECORDS_REQUEST_REQUIRED`.

## Verification commands

```text
npm run db:migrate:opportunity-hub
npm run data:sync-commercial-channels
npm run verify:commercial-channels
npm run test:opportunity-intelligence
npm run build
```
