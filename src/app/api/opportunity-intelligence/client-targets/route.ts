import { NextRequest, NextResponse } from "next/server";
import {
  getClientTerritoryOutreachTargets,
  pushParcelToClientPipeline,
} from "@/lib/client-outreach-engine";
import { getRegisteredClientsList } from "@/lib/opportunity-intelligence";
import { verifyBusinessActivity } from "@/lib/search-verification-provider";
import { addClientExclusion, getClientRegistrations, updateClientRegistration, type ClientRegistrationRecord } from "@/lib/permits-and-registrations";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || undefined;
    const territory = searchParams.get("territory") || undefined;
    const channel = searchParams.get("channel") || undefined;
    const verificationStatus = searchParams.get("verificationStatus") || undefined;
    const sqftBand = searchParams.get("sqftBand") || undefined;
    const search = searchParams.get("search") || undefined;
    const needsReviewOnly = searchParams.get("needsReviewOnly") === "true";

    const [outreachData, registeredClients] = await Promise.all([
      getClientTerritoryOutreachTargets({
        clientId,
        territoryInput: territory,
        channelFilter: channel,
        verificationFilter: verificationStatus,
        sqftFilter: sqftBand,
        searchQuery: search,
        needsReviewOnly,
      }),
      getRegisteredClientsList(),
    ]);

    // If client is selected, also get vendor registrations
    let clientRegistrations: ClientRegistrationRecord[] = [];
    if (clientId && clientId !== "all") {
      clientRegistrations = await getClientRegistrations(clientId);
    }

    return NextResponse.json({
      ok: true,
      registeredClients,
      clientRegistrations,
      ...outreachData,
    });
  } catch (error) {
    console.error("Client targets API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed querying client outreach database" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Layer 6 Search Verification
    if (action === "verify") {
      const { businessName, city, county, targetType, targetId, streetAddress, phone, forceRefresh } = body;
      if (!businessName || !city || !county) {
        return NextResponse.json({ ok: false, error: "businessName, city, and county are required" }, { status: 400 });
      }

      const verified = await verifyBusinessActivity({
        businessName,
        city,
        county,
        targetType: targetType || "commercial_target",
        targetId,
        streetAddress,
        phone,
        forceRefresh: Boolean(forceRefresh),
      });

      return NextResponse.json({ ok: true, verification: verified });
    }

    // 2. Add to Client Pipeline with evidence trail
    if (action === "add_pipeline") {
      const {
        clientId,
        clientName,
        parcelId,
        county,
        businessName,
        channel,
        situsAddress,
        incumbentContractor,
        lastPermitDate,
        evidenceUrls,
        officialWebsite,
        phone,
      } = body;

      const result = await pushParcelToClientPipeline({
        clientId,
        clientName,
        parcelId,
        county,
        businessName,
        channel,
        situsAddress,
        incumbentContractor,
        lastPermitDate,
        evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
        officialWebsite,
        phone,
      });

      return NextResponse.json(result);
    }

    // 3. Human Review Queue Resolution
    if (action === "resolve_review") {
      const { verificationId, decision, reviewerName } = body;
      if (!verificationId || !decision) {
        return NextResponse.json({ ok: false, error: "verificationId and decision required" }, { status: 400 });
      }

      await sql`
        UPDATE fl_search_verifications
        SET 
          verification_status = ${decision === "approve" ? "VERIFIED_ACTIVE" : "CLOSED"},
          needs_review = FALSE,
          reviewed_by = ${reviewerName || "admin"},
          reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ${verificationId}
      `;

      return NextResponse.json({ ok: true });
    }

    // 4. Client Account Exclusion
    if (action === "add_exclusion") {
      const { clientId, accountName, reason } = body;
      if (!clientId || !accountName) {
        return NextResponse.json({ ok: false, error: "clientId and accountName required" }, { status: 400 });
      }

      const ok = await addClientExclusion(clientId, accountName, reason);
      return NextResponse.json({ ok });
    }

    // 5. Vendor Registration Update
    if (action === "update_registration") {
      const { clientId, portalName, status, vendorNumber, notes } = body;
      if (!clientId || !portalName || !status) {
        return NextResponse.json({ ok: false, error: "clientId, portalName, status required" }, { status: 400 });
      }

      const ok = await updateClientRegistration({ clientId, portalName, status, vendorNumber, notes });
      return NextResponse.json({ ok });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Client targets POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed executing client target operation" },
      { status: 500 }
    );
  }
}
