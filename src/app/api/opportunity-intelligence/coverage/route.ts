import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCountyParcelRegistry, type CountyRegistryEntry } from "@/lib/county-parcel-registry";

export const dynamic = "force-dynamic";

export interface CountyCoverageDetail extends CountyRegistryEntry {
  entitiesMatchedCount: number;
  entitiesMatchedPercent: number;
  licensesCount: number;
  permitsCount: number;
  verifiedCount: number;
  verifiedPercent: number;
}

export async function GET() {
  try {
    const registry = await getCountyParcelRegistry();

    // Query layer counts by county in parallel
    const [
      parcelCountRows,
      entityCountRows,
      licenseCountRows,
      permitCountRows,
      verificationCountRows,
    ] = await Promise.all([
      sql`SELECT county, count(*)::int as count FROM fl_parcels GROUP BY county`,
      sql`
        SELECT p.county, count(*)::int as count 
        FROM fl_entities e
        JOIN fl_parcels p ON e.parcel_county = p.county AND e.parcel_id = p.parcel_id
        WHERE e.status = 'Active'
        GROUP BY p.county
      `,
      sql`SELECT county, count(*)::int as count FROM fl_licenses GROUP BY county`,
      sql`SELECT parcel_county as county, count(*)::int as count FROM fl_permits GROUP BY parcel_county`,
      sql`SELECT county, count(*)::int as count FROM fl_search_verifications WHERE verification_status = 'VERIFIED_ACTIVE' GROUP BY county`,
    ]);

    const parcelMap = new Map<string, number>();
    for (const r of parcelCountRows as Array<{ county: string; count: number }>) {
      if (r.county) parcelMap.set(r.county.toLowerCase(), Number(r.count));
    }

    const entityMap = new Map<string, number>();
    for (const r of entityCountRows as Array<{ county: string; count: number }>) {
      if (r.county) entityMap.set(r.county.toLowerCase(), Number(r.count));
    }

    const licenseMap = new Map<string, number>();
    for (const r of licenseCountRows as Array<{ county: string; count: number }>) {
      if (r.county) licenseMap.set(r.county.toLowerCase(), Number(r.count));
    }

    const permitMap = new Map<string, number>();
    for (const r of permitCountRows as Array<{ county: string; count: number }>) {
      if (r.county) permitMap.set(r.county.toLowerCase(), Number(r.count));
    }

    const verificationMap = new Map<string, number>();
    for (const r of verificationCountRows as Array<{ county: string; count: number }>) {
      if (r.county) verificationMap.set(r.county.toLowerCase(), Number(r.count));
    }

    let totalParcels = 0;
    let totalEntitiesMatched = 0;
    let totalLicenses = 0;
    let totalPermits = 0;
    let totalVerified = 0;
    let ingestedCounties = 0;
    let directDownloadCounties = 0;
    let recordsRequestRequiredCounties = 0;
    let staleCounties = 0;

    const counties: CountyCoverageDetail[] = registry.map((reg) => {
      const cKey = reg.county.toLowerCase();
      const trueParcels = parcelMap.get(cKey) || reg.commercialParcelsCount || 0;
      const entitiesMatched = entityMap.get(cKey) || 0;
      const licenses = licenseMap.get(cKey) || 0;
      const permits = permitMap.get(cKey) || 0;
      const verified = verificationMap.get(cKey) || 0;

      totalParcels += trueParcels;
      totalEntitiesMatched += entitiesMatched;
      totalLicenses += licenses;
      totalPermits += permits;
      totalVerified += verified;

      const entitiesPercent = trueParcels > 0 ? Math.min(100, Math.round((entitiesMatched / trueParcels) * 100)) : 0;
      const verifiedPercent = trueParcels > 0 ? Math.min(100, Math.round((verified / trueParcels) * 100)) : 0;

      // Status check: strictly honesty
      let derivedStatus = reg.status;
      if (reg.fileFormat === "RECORDS_REQUEST_REQUIRED" && trueParcels < reg.fullDepthThreshold) {
        derivedStatus = "RECORDS_REQUEST_REQUIRED";
      } else if (trueParcels >= reg.fullDepthThreshold) {
        derivedStatus = "INGESTED";
      } else if (reg.gisDownloadUrl) {
        derivedStatus = "DIRECT_DOWNLOAD";
      }

      if (derivedStatus === "INGESTED") ingestedCounties++;
      else if (derivedStatus === "DIRECT_DOWNLOAD") directDownloadCounties++;
      else if (derivedStatus === "RECORDS_REQUEST_REQUIRED") recordsRequestRequiredCounties++;
      else if (derivedStatus === "STALE") staleCounties++;

      return {
        ...reg,
        commercialParcelsCount: trueParcels,
        status: derivedStatus,
        entitiesMatchedCount: entitiesMatched,
        entitiesMatchedPercent: entitiesPercent,
        licensesCount: licenses,
        permitsCount: permits,
        verifiedCount: verified,
        verifiedPercent: verifiedPercent,
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        totalCounties: 67,
        ingestedCounties,
        directDownloadCounties,
        recordsRequestRequiredCounties,
        staleCounties,
        totalParcels,
        totalEntitiesMatched,
        totalLicenses,
        totalPermits,
        totalVerified,
      },
      counties,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed fetching Florida coverage summary";
    console.error("Coverage summary API error:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
