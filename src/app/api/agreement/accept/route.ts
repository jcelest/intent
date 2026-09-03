import { NextResponse } from "next/server";
import crypto from "crypto";
import { captureAgreementHtml } from "@/lib/capture-agreement";
import { getEngagement, addonAmount, parseEngagementId, parseAddons, LEADNET_MONTHLY_CENTS } from "@/lib/engagements";
import { saveAgreementRecord, hashAgreementText } from "@/lib/agreements-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const engagement = getEngagement(parseEngagementId(body.path));
  if (engagement.id !== "capture") {
    return NextResponse.json({ error: "Agreement is for LeadNet only." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const company = String(body.company ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const addons = parseAddons(body.addons);
  const amountCents = (engagement.amountCents ?? 0) + addonAmount(addons);

  if (!name || !company || !email || !phone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const html = captureAgreementHtml({
    name,
    company,
    email,
    phone,
    amountCents,
    addons,
  });

  const agreementHash = hashAgreementText(html);
  const id = crypto.randomUUID();

  await saveAgreementRecord({
    id,
    customerName: name,
    companyName: company,
    email,
    phone,
    packageId: engagement.id,
    addons,
    amountCents,
    monthlyCents: LEADNET_MONTHLY_CENTS,
    agreementVersion: "1.0",
    agreementHash,
    agreementHtml: html,
    ipAddress,
    userAgent,
    acceptedAt: new Date().toISOString(),
    status: "pending_payment",
  });

  return NextResponse.json({ acceptanceId: id });
}
