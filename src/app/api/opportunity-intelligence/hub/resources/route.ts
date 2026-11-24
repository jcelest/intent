import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Queryable = { query: (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };
const queryDb = (query: string, params: unknown[] = []) => (sql as unknown as Queryable).query(query, params);

const FEEDS: Record<string, { sql: string; search: string[]; county: string | null; order: string }> = {
  properties: {
    sql: `SELECT * FROM (
      SELECT p.id::text, 'universal'::text AS record_source, p.name, p.situs_address, p.city, p.county, p.zip_code, p.parcel_id, p.property_use_code, p.property_use_description, p.building_sqft, p.year_built, p.building_count, p.owner_name_raw, p.latitude, p.longitude, p.source_url, p.last_verified_at, p.updated_at
      FROM oi_properties p
      UNION ALL
      SELECT concat(fp.county, ':', fp.parcel_id), 'legacy_parcel', NULL, fp.situs_address, fp.situs_city, fp.county, fp.situs_zip, fp.parcel_id, fp.use_code, fp.use_description, fp.building_sqft, fp.year_built, NULL, fp.owner_name_raw, fp.latitude, fp.longitude, fp.location_source_url, fp.location_verified_at, fp.updated_at
      FROM fl_parcels fp
      WHERE NOT EXISTS (
        SELECT 1 FROM oi_properties property
        WHERE property.source_id = 'fl-dor-cadastral'
          AND property.source_record_id = concat(fp.county, ':', fp.parcel_id)
      )
    ) resource_feed`,
    search: ["name", "situs_address", "parcel_id", "owner_name_raw", "property_use_description"], county: "county", order: "updated_at DESC, id DESC",
  },
  equipment: {
    sql: `SELECT e.id::text, e.equipment_type, e.manufacturer, e.model, e.unit_count, e.individual_capacity_tons, e.aggregate_capacity_tons, e.capacity_is_estimated, e.installation_date, e.replacement_date, e.controls_platform, e.documented_description, e.evidence_url, e.confidence, p.name AS property_name, p.situs_address, p.city, p.county, p.zip_code, e.updated_at FROM oi_equipment e LEFT JOIN oi_properties p ON p.id = e.property_id`,
    search: ["equipment_type", "manufacturer", "model", "controls_platform", "documented_description", "situs_address"], county: "county", order: "updated_at DESC, id DESC",
  },
  permits: {
    sql: `SELECT * FROM (
      SELECT p.id::text, 'universal'::text AS record_source, p.permit_number, p.permit_type, p.permit_status, p.description, p.issue_date, p.final_date, p.job_value, p.contractor_name, p.contractor_license_number, p.address, p.city, p.county, p.zip_code, p.latitude, p.longitude, p.source_url, p.updated_at
      FROM oi_permit_records p
      UNION ALL
      SELECT fp.id::text, 'legacy_permit', fp.permit_number, fp.permit_type, NULL, fp.description, fp.issue_date, NULL, fp.job_value, fp.contractor_name, fp.contractor_license_number, parcel.situs_address, parcel.situs_city, fp.parcel_county, parcel.situs_zip, NULL, NULL, NULL, fp.created_at
      FROM fl_permits fp LEFT JOIN fl_parcels parcel ON parcel.county = fp.parcel_county AND parcel.parcel_id = fp.parcel_id
    ) resource_feed`,
    search: ["permit_number", "permit_type", "description", "contractor_name", "address"], county: "county", order: "issue_date DESC NULLS LAST, id DESC",
  },
  awards: {
    sql: `SELECT a.id::text, a.purchasing_organization, a.awarded_contractor, a.title, a.award_amount, a.award_date, a.contract_start_date, a.contract_expiration_date, a.renewal_options, a.source_url, a.source_document_url, a.updated_at FROM oi_contract_awards a`,
    search: ["purchasing_organization", "awarded_contractor", "title"], county: null, order: "award_date DESC NULLS LAST, id DESC",
  },
  organizations: {
    sql: `SELECT o.id::text, o.legal_name, o.display_name, o.organization_type, o.sunbiz_document_number, o.website, o.phone, o.public_email, o.address, o.city, o.county, o.zip_code, o.location_count, o.verification_status, o.source_url, o.last_verified_at, o.updated_at FROM oi_organizations o`,
    search: ["legal_name", "display_name", "organization_type", "sunbiz_document_number", "address"], county: "county", order: "updated_at DESC, id DESC",
  },
};

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "properties";
  const feed = FEEDS[type];
  if (!feed) return NextResponse.json({ ok: false, error: "Unsupported resource type" }, { status: 400 });
  const search = url.searchParams.get("search")?.trim() || "";
  const counties = url.searchParams.getAll("county").flatMap((value) => value.split(",")).filter(Boolean);
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 75)));
  const params: unknown[] = [];
  const where = ["1=1"];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(${feed.search.map((column) => `${column} ILIKE $${params.length}`).join(" OR ")})`);
  }
  if (feed.county && counties.length) { params.push(counties); where.push(`${feed.county} = ANY($${params.length}::text[])`); }
  params.push(limit, offset);
  try {
    const records = await queryDb(`SELECT *, count(*) OVER()::int AS filtered_total FROM (${feed.sql}) typed_feed WHERE ${where.join(" AND ")} ORDER BY ${feed.order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return NextResponse.json({ ok: true, type, records, total: records.length ? Number(records[0].filtered_total || 0) : 0, limit, offset, hasMore: records.length === limit });
  } catch (error) {
    console.error(`Resource query failed (${type}):`, error);
    return NextResponse.json({ ok: false, error: `Failed to load ${type}` }, { status: 500 });
  }
}
