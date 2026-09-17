import { NextResponse } from "next/server";
import { isDocuSignConfigured } from "@/lib/engagements";
import { startCaptureSigning } from "@/lib/docusign";
import { SITE_URL } from "@/lib/seo";
import { normalizeLeadNetSelection, type LeadNetCustomerDetails } from "@/lib/leadnet-offer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDocuSignConfigured()) {
    return NextResponse.json(
      { error: "Agreements are not open yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawDetails = (body?.details ?? body ?? {}) as Record<string, unknown>;
  const details: LeadNetCustomerDetails = {
    name: String(rawDetails.name ?? "").trim(),
    company: String(rawDetails.company ?? "").trim(),
    email: String(rawDetails.email ?? "").trim(),
    phone: String(rawDetails.phone ?? "").trim(),
    industry: String(rawDetails.industry ?? "").trim(),
    domainStatus: String(rawDetails.domainStatus ?? "").trim(),
    services: String(rawDetails.services ?? "").trim(),
    serviceAreas: String(rawDetails.serviceAreas ?? "").trim(),
    brandingAssets: String(rawDetails.brandingAssets ?? "").trim(),
    notes: String(rawDetails.notes ?? "").trim(),
  };
  if (details.name.length < 2 || !details.email.includes("@")) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    SITE_URL;

  try {
    const result = await startCaptureSigning({
      details,
      selection: normalizeLeadNetSelection(body?.selection ?? {}),
      returnUrl: `${origin.replace(/\/$/, "")}/begin/signed`,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open signing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
