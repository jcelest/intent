import { NextResponse } from "next/server";
import {
  addonAmount,
  getEngagement,
  isDocuSignConfigured,
  parseAddons,
  parseEngagementId,
} from "@/lib/engagements";
import { startCaptureSigning } from "@/lib/docusign";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDocuSignConfigured()) {
    return NextResponse.json(
      { error: "Agreements are not open yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const engagement = getEngagement(parseEngagementId(body?.path));
  if (engagement.id !== "capture" || !engagement.amountCents) {
    return NextResponse.json(
      { error: "DocuSign is set up for LeadNet first." },
      { status: 400 }
    );
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const company = String(body?.company ?? "").trim();
  const addons = parseAddons(body?.addons);
  if (name.length < 2 || !email.includes("@")) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    SITE_URL;

  try {
    const result = await startCaptureSigning({
      name,
      company,
      email,
      phone,
      addons,
      amountCents: engagement.amountCents + addonAmount(addons),
      returnUrl: `${origin.replace(/\/$/, "")}/begin/signed`,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open signing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
