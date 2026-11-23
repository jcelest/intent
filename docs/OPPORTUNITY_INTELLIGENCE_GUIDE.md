# Intent Opportunity Intelligence — Florida Edition
## Systems Architecture, Source Registry, and Data Expansion Guide

> This system is built directly into Intent Revenue at `intentrev.net/admin/opportunity-intelligence`. It operates natively on Next.js, Neon Serverless Postgres, and custom deterministic spatial and procurement parsers locked strictly to Florida's 67 counties.

---

## 1. Executive Summary & Why Data Currently Seems Thin

If the dataset currently appears light, this is by architectural design for the Phase 1 release:
1. **Initial Seed Baseline vs. Unbounded Web Scraping**: The database was initialized with a **curated, verified baseline of starter bids and commercial GC networks** (`SEED_BIDS` and `SEED_NETWORKS` in `src/lib/opportunity-intelligence.ts`) to ensure the application boots instantly, maintains 100% schema integrity, and passes automated testing without hitting rate limits or blocking production deployments.
2. **Registry-First Architecture**: We constructed the **complete source infrastructure first** (80+ Florida procurement systems, platforms, and spatial coordinates). The collection job runner is wired to ingest live records directly into `fl_commercial_bids` and `fl_commercial_networks`.
3. **Zero Fabrication Policy**: The prompt mandates: *"Never fabricate missing information or fake counts."* Only real, verified records are stored in the database.

To transition from the current starter baseline to tens of thousands of live commercial bids and indexed organizations across Florida, the system utilizes lightweight HTTP collectors detailed below.

---

## 2. What Sources Are Being Pulled & Registered

The platform maintains an indexed registry of **80+ Florida procurement portals and data sources** in `src/lib/opportunity-sources.ts`.

### A. Florida State Procurement Systems
- **Florida Vendor Bid System (VBS / DMS)**: Official statewide portal for all Florida executive branch agencies. Publishes solicitations for HVAC modernization, commercial roofing, facility maintenance, and electrical infrastructure.
- **FDOT Procurement Portal**: Florida Department of Transportation commercial bidding system covering commercial civil, electrical, highway, and facilities work across Florida's 8 FDOT districts.
- **MyFloridaMarketPlace (MFMP)**: State e-procurement directory with vendor registrations and contracts.

### B. All 67 Florida County Procurement Portals
Every single Florida county is indexed with its official purchasing platform and direct portal URL:
- **Central Florida**: Orange (OpenGov), Seminole (OpenGov), Osceola (DemandStar), Lake (DemandStar), Volusia, Brevard, Sumter.
- **Tampa Bay**: Hillsborough (OpenGov), Pinellas (OpenGov), Pasco (BidNet Direct), Manatee, Sarasota, Hernando.
- **South Florida**: Miami-Dade (MDC Infor/Custom), Broward County, Palm Beach County, Monroe (Florida Keys).
- **First Coast**: Duval / City of Jacksonville (121 Procurement), St. Johns, Clay, Nassau, Baker, Flagler, Putnam.
- **Panhandle & North Central**: Leon / Tallahassee, Escambia / Pensacola, Bay / Panama City, Alachua / Gainesville, Okaloosa, Santa Rosa, etc.

### C. Major Public Authorities & Institutional Buyers
- **Aviation**: Greater Orlando Aviation Authority (GOAA / MCO), Hillsborough County Aviation Authority (TPA), Miami-Dade Aviation Department (MIA).
- **Public School Districts**: Orange County Public Schools (OCPS), Miami-Dade County Public Schools (MDCPS), Broward County Public Schools, Hillsborough County Public Schools (massive multi-million dollar annual mechanical and roofing capital improvement programs).
- **Higher Education**: University of Central Florida (UCF Procurement), University of Florida (UF Procurement), University of South Florida (USF).
- **Utilities & Water Districts**: Orlando Utilities Commission (OUC), JEA (Jacksonville), South Florida Water Management District (SFWMD), St. Johns River Water Management District (SJRWMD).

### D. Private Commercial Networks & General Contractors
- **Tier 1 Commercial GCs**: Brasfield & Gorrie, Turner Construction, Suffolk Construction, Whiting-Turner, Robins & Morton, Hensel Phelps, Coastal Construction, Ajax Building Company.
- **Commercial Property Managers**: Cushman & Wakefield Florida, CBRE Commercial, JLL Florida, Colliers Commercial, Highwoods Properties.
- **Direct Subcontractor Intake Links**: Indexed direct vendor qualification portals where mechanical, electrical, and roofing contractors register for pre-qualification.

---

## 3. How the Geographic Search Engine Resolves Queries

The geographic engine (`src/lib/florida-geo.ts`) is deterministic, zero-external-API, and completely offline-resilient:

| Search Input Type | Examples Handled | How It Resolves |
| :--- | :--- | :--- |
| **Individual ZIPs** | `32801`, `33602`, `33139` | Matches 32000–34999 Florida range; infers county and metro area. |
| **ZIP Code Ranges** | `32801-32810` | Auto-expands and checks each ZIP against Florida postal boundaries. |
| **Counties** | `Orange`, `Hillsborough County`, `Miami-Dade` | Resolves against 67 county centroids and FIPS codes (case-insensitive, cleans "County" or "Co."). |
| **Major Cities** | `Orlando`, `Tampa`, `Miami`, `Jacksonville` | Resolves to primary county and coordinate centroids. |
| **Mixed Multi-Territory** | `32801, Seminole, Tampa, 33101-33105` | Harmonizes duplicates into unified spatial scope and queries bids + networks. |
| **Statewide Florida** | `Florida`, `Statewide`, `All 67 Counties` | Flags `isStatewide = true` and spans all 67 county jurisdictions. |
| **Out-of-State Rejection** | `90210`, `10001`, `Dallas` | Emits human-readable warnings and ignores non-Florida criteria. |

---

## 4. How the Client Matching Engine Works

The Client Matching engine (`src/lib/opportunity-intelligence.ts`) bridges public intelligence with Intent Revenue's active client base:
1. Reads registered Intent Revenue clients from the `trade_demand_clients` database table.
2. Extracts their registered trade capability (`hvac`, `roofing`, `electrical`, `plumbing`, `general_contracting`, etc.).
3. Matches the opportunity's Florida county against the client's registered service territories.
4. Generates an objective capability score:
   - **Trade Fit**: 40 points
   - **County / Territorial Match**: 30 points
   - **Regional Proximity**: 15 points
   - **License / Certification Eligibility**: 15 points
5. Offers one-click action: **Add to Outreach Pipeline** to track business development stages.

---

## 5. How to Ingest High-Density Live Records

To rapidly expand the database from the current starter baseline to thousands of active Florida commercial opportunities, run the ingestion workflows below:

### Step 1: OpenStreetMap / Overpass Commercial Discovery (Free)
Query OpenStreetMap's Overpass API for all commercial facilities, property managers, and general contractors in Florida.
```http
POST https://overpass-api.de/api/interpreter
Content-Type: text/plain

[out:json][timeout:60];
area["ISO3166-2"="US-FL"]->.florida;
(
  node["office"="company"](area.florida);
  node["office"="commercial"](area.florida);
  node["craft"="hvac"](area.florida);
  node["craft"="electrician"](area.florida);
  node["craft"="plumber"](area.florida);
  way["building"="commercial"](area.florida);
);
out center 500;
```
*Stores business name, category, address, phone, website, and lat/lng directly into `fl_commercial_networks`.*

### Step 2: Florida Vendor Bid System (VBS) Direct Ingestion
The Florida Department of Management Services publishes an active JSON and RSS feed of all current state solicitations:
- URL: `https://vendor.myfloridamarketplace.com/search/bids`
- Filter procurement commodity codes for trade services:
  - `7210` (Building maintenance & repair services)
  - `721512` (Heating and cooling and air conditioning HVAC services)
  - `721526` (Roofing and siding services)
  - `721515` (Electrical services)
  - `721511` (Plumbing services)

### Step 3: Scheduled Collection Runner
Trigger a sweep from inside the admin portal:
- Navigate to **Opportunity Intelligence → Collection Jobs** (`/admin/opportunity-intelligence/jobs`).
- Click **"Run Full 67-County Sweep"** or **"Run State MFMP/FDOT Sweep"**.
- This launches an automated collector job that records execution time, records seen, added, and updated.

---

## 6. Database Schema Summary

| Table | Purpose |
| :--- | :--- |
| `fl_commercial_bids` | Public commercial procurements, RFPs, ITBs |
| `fl_commercial_networks` | General contractors, developers, property managers |
| `fl_procurement_sources` | 67 County + State + Authority portals |
| `fl_outreach_pipeline` | BD tracking from Identified to Won |
| `fl_saved_opportunities` | User bookmarks & pinned items |
| `fl_collection_jobs` | Incremental scraping and synchronization logs |
