# Intent Opportunity Intelligence Hub

## Implemented architecture

The hub is mounted at `/admin/opportunity-intelligence` and uses one additive `oi_*` data model for the market overview, opportunity explorer, Intent Atlas, evidence inspection, taxonomy, saved intelligence, source coverage, and analytics.

Migration `009_universal_opportunity_hub.sql` does not drop or rewrite existing tables. It preserves and interoperates with:

- `fl_parcels`, `fl_entities`, `fl_licenses`, `fl_permits`, and search verification records;
- existing procurement source and bid tables;
- county parcel source registry and ingestion queue;
- client overlays, outreach history, saved views, and pipeline records.

The new hub does not use a client profile to determine the market universe. Client targeting remains accessible under Operations as an optional overlay.

## Factual controls

Every universal opportunity has an explicit `classification`:

- `confirmed`: a documented active purchasing request or directly verified need;
- `timing_based`: a documented event or expiration window;
- `asset_based`: documented equipment or infrastructure establishes service relevance;
- `relationship`: a documented property, portfolio, contractor, or operating relationship;
- `inferred`: a transparent recommendation without direct purchasing evidence.

The ingestion layer rejects estimated values without a methodology, incomplete coordinate pairs, coordinates outside a Florida validation envelope, and low-confidence records labeled as confirmed. County centroids are used only for map features labeled `regional_aggregate`; they are never stored as property coordinates.

Legacy procurement records enter the new feed only when their source has a successful synchronization timestamp and a source URL. The former synthetic starter records have no qualifying source and are excluded. The legacy rows remain intact for backward compatibility.

## Map stack and policy validation

Intent Atlas uses:

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) for the interactive WebGL map;
- [OpenFreeMap](https://openfreemap.org/quick_start/) public vector styles (`dark` and `liberty`);
- [OpenStreetMap](https://www.openstreetmap.org/copyright) data through OpenFreeMap;
- [U.S. Census Bureau TIGERweb Counties](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1) for authoritative county boundary visualization;
- optional future [PMTiles](https://docs.protomaps.com/pmtiles/maplibre) support for self-hosted tiles.

Validation performed on November 24, 2026:

- OpenFreeMap permits commercial use, requires map attribution, requires no API key, and provides no SLA. MapLibre renders its supplied attribution automatically.
- OpenFreeMap offline-download rules limit each user-initiated download to 3,000 tiles or 50 MB, at most four parallel requests, with an identifying User-Agent. Intent Atlas does not implement offline tile downloads.
- TIGERweb County layer 1 supports GeoJSON and is queried only for Florida (`STATE='12'`). These boundaries are appropriate for visualization and geographic filtering, not legal parcel surveys.
- PMTiles remains an optional fallback. No paid Google Maps, Mapbox, geocoding, or tile API is required.

## Performance behavior

- Opportunity queries use server-side filtering and cursor pagination.
- Property, equipment, permit, and award tables use server-side filtering and paginated database queries.
- Atlas requests include the visible bounding box and return at most 5,000 features per layer query.
- MapLibre performs geographic clustering; separate non-clustered sources power density and documented-value heatmaps.
- Relational indexes cover classification/status, trade, geography, coordinates, deadlines, expirations, discovery time, source IDs, equipment, permits, and sync history.
- Source adapters use record fingerprints and source-record uniqueness for idempotent upserts.
- Evidence records have a source-record unique index to prevent repeated synchronization from inflating analytics.

For multi-million-record growth, the schema is compatible with PostGIS and vector-tile delivery, but the current deployment does not falsely claim that PostGIS or a tile server is active.

## Source adapters and operational truth

`src/lib/opportunity-ingestion.ts` defines canonical validation, hashing, batched idempotent upserts, source synchronization history, and error accounting. The implemented bridge adapter moves only records from existing procurement adapters that have actually synchronized successfully.

No source is marked operational merely because it appears in the registry. `oi_data_sources.status`, `is_operational`, and synchronization history distinguish discovery from a working connection.

Current verified database state after migration:

- 11,845 existing commercial parcels preserved;
- 5 existing legacy permit records preserved;
- 67 county registry entries preserved;
- 59 editable taxonomy categories;
- 7 deterministic discovery rules;
- 12 universal source catalog entries;
- 0 source-qualified universal opportunities at verification time;
- 8 legacy synthetic bids preserved but excluded from the universal feed.

The zero-opportunity state is intentional and visible in the UI. It is preferable to silently presenting fabricated demand.

## Incomplete source blockers

The coverage dashboard exposes these limitations rather than substituting mock data:

- SAM.gov requires an authorized API key and place-of-performance filtering.
- MyFloridaMarketPlace and many local procurement portals require source-specific document parsers; some provide no stable public API.
- Florida has no single statewide permit API. Each county and municipality has its own ArcGIS service, export, document portal, or public-record procedure.
- Parcel geometry and field mappings vary by county; some jurisdictions require a Florida public-records request.
- AHCA, school districts, universities, housing authorities, airports, ports, hospitals, and utilities require separate official adapters and licensing review.
- CAPTCHA, authenticated, access-restricted, or prohibited sources are never bypassed.
- Overture Maps is cataloged as a future source but is not shown as connected.

## Operations

```powershell
npm.cmd run db:migrate:opportunity-hub
npm.cmd run verify:opportunity-hub
npm.cmd run verify:opportunity-hub-runtime
npm.cmd run test:opportunity-intelligence
npm.cmd run build
```

The operational legacy procurement bridge is an authenticated POST to:

```text
/api/opportunity-intelligence/hub/ingest
{"adapter":"operational_legacy_procurement","limit":1000}
```

It performs no external search. It only normalizes already synchronized, source-backed legacy records.

The deterministic discovery engine is an authenticated POST to `/api/opportunity-intelligence/hub/discovery`. Each generated record stores its rule ID, evidence, confidence, and rationale.
