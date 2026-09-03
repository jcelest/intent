import { NextResponse } from "next/server";
import crypto from "crypto";
import { captureAgreementHtml } from "@/lib/capture-agreement";
import { getEngagement, addonAmount, parseEngagementId, parseAddons, LEADNET_MONTHLY_CENTS } from "@/lib/engagements";
import { getStripe } from "@/lib/stripe";
import * as db from "@/lib/db";

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

  const agreementHash = crypto.createHash("sha256").update(html).digest("hex");

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata: {
        companyName: company,
        packageId: engagement.id,
        addons: addons.join(","),
        status: "pending_payment",
      },
    });

    const acceptanceId = crypto.randomUUID();
    const publicDownloadToken = crypto.randomUUID();

    await db.insertAgreement({
      acceptance_id: acceptanceId,
      public_download_token: publicDownloadToken,
      stripe_customer_id: customer.id,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      agreement_version: "1.0",
      agreement_html: html,
      agreement_hash: agreementHash,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      company_name: company,
      package_id: engagement.id,
      addons: JSON.stringify(addons),
      initial_amount_cents: amountCents,
      recurring_amount_cents: LEADNET_MONTHLY_CENTS,
      currency: "usd",
      accepted_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      payment_status: "pending_payment",
      subscription_status: null
    });

    return NextResponse.json({ 
      acceptanceId,
      publicDownloadToken
    });
  } catch (error: unknown) {
    console.error("Failed to save agreement:", error);
    return NextResponse.json({ error: "Could not record agreement." }, { status: 500 });
  }
}
