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
    const county = searchParams.get("county") || undefined;
    const city = searchParams.get("city") || undefined;
    const zip = searchParams.get("zip") || undefined;
    const channel = searchParams.get("channel") || undefined;
    const tonnageRisk = searchParams.get("tonnageRisk") || searchParams.get("sqftBand") || undefined;
    const verificationStatus = searchParams.get("verificationStatus") || undefined;
    const hasWebsite = searchParams.get("hasWebsite") || undefined;
    const minReviews = searchParams.get("minReviews") ? Number(searchParams.get("minReviews")) : undefined;
    const entityStatus = searchParams.get("entityStatus") || undefined;
    const licenseType = searchParams.get("licenseType") || undefined;
    const permitWithinDays = searchParams.get("permitWithinDays") ? Number(searchParams.get("permitWithinDays")) : undefined;
    const search = searchParams.get("search") || undefined;
    const needsReviewOnly = searchParams.get("needsReviewOnly") === "true";
    const hideExistingAccounts = searchParams.get("hideExistingAccounts") === "true";
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const pageSize = searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 25;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
    const mode = (searchParams.get("mode") as "call_list" | "browse_all") || "call_list";

    const [outreachData, registeredClients] = await Promise.all([
      getClientTerritoryOutreachTargets({
        clientId,
        territoryInput: territory,
        county,
        city,
        zip,
        channelFilter: channel,
        tonnageRisk,
        verificationFilter: verificationStatus,
        hasWebsite,
        minReviews,
        entityStatus,
        licenseType,
        permitWithinDays,
        searchQuery: search,
        needsReviewOnly,
        hideExistingAccounts,
        page,
        pageSize,
        limit,
        mode,
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
    if (action === "add_pipeline" || action === "pipeline") {
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

      return NextResponse.json({ ...result, outreachState: "pipeline" });
    }

    // 2b. Contacted quick action
    if (action === "contacted") {
      const {
        clientId,
        clientName,
        parcelId,
        county,
        businessName,
        channel,
        situsAddress,
        phone,
      } = body;

      await sql`
        INSERT INTO fl_outreach_pipeline (
          opportunity_title, target_name, target_type, stage,
          client_id, client_name, contact_phone, notes
        ) VALUES (
          ${`Commercial Outreach: ${businessName}`},
          ${businessName},
          ${channel || "commercial_target"},
          'contacted',
          ${clientId || null},
          ${clientName || null},
          ${phone || null},
          ${`Direct terminal outreach: Contacted on ${new Date().toLocaleDateString()}. APN: ${parcelId || "N/A"}, County: ${county || "N/A"}, Situs: ${situsAddress || "N/A"}`}
        )
        ON CONFLICT DO NOTHING
      `;

      return NextResponse.json({ ok: true, outreachState: "contacted" });
    }

    // 2c. Exclude quick action (Client overlay -> fl_client_exclusions, or GLOBAL if no overlay)
    if (action === "exclude") {
      const { clientId, businessName, reason } = body;
      const targetClientId = clientId && clientId !== "all" ? clientId : "GLOBAL";
      if (!businessName) {
        return NextResponse.json({ ok: false, error: "businessName required" }, { status: 400 });
      }

      await sql`
        INSERT INTO fl_client_exclusions (client_id, account_name, reason)
        VALUES (${targetClientId}, ${businessName}, ${reason || (targetClientId === "GLOBAL" ? "Global Account Exclusion" : "Client Account Exclusion")})
        ON CONFLICT (client_id, account_name) DO NOTHING
      `;

      return NextResponse.json({ ok: true, isExcluded: true });
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
