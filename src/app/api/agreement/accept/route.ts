import { NextResponse } from "next/server";
import crypto from "crypto";
import { leadNetWebsiteAgreementHtml } from "@/lib/capture-agreement";
import {
  calculateLeadNetOrder,
  normalizeLeadNetSelection,
  OFFER_CURRENCY,
  type LeadNetCustomerDetails,
} from "@/lib/leadnet-offer";
import { getStripe } from "@/lib/stripe";
import * as db from "@/lib/db";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseDetails(value: unknown): LeadNetCustomerDetails {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    name: clean(raw.name),
    company: clean(raw.company),
    email: clean(raw.email),
    phone: clean(raw.phone),
    industry: clean(raw.industry),
    domainStatus: clean(raw.domainStatus),
    services: clean(raw.services),
    serviceAreas: clean(raw.serviceAreas),
    brandingAssets: clean(raw.brandingAssets),
    notes: clean(raw.notes),
  };
}

function validateDetails(details: LeadNetCustomerDetails) {
  const missing = [
    "name",
    "company",
    "email",
    "phone",
    "industry",
    "domainStatus",
    "services",
    "serviceAreas",
  ].filter((key) => !details[key as keyof LeadNetCustomerDetails]);
  if (missing.length) return "Missing required onboarding fields.";
  if (!details.email.includes("@")) return "A valid email is required.";
  if (details.phone.replace(/\D/g, "").length < 10) return "A valid phone number is required.";
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const selection = normalizeLeadNetSelection(body.selection ?? {});
  const details = parseDetails(body.details);
  const validationError = validateDetails(details);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe billing is not configured." }, { status: 503 });
  }

  const order = calculateLeadNetOrder(selection);
  const html = leadNetWebsiteAgreementHtml({ details, order });
  const agreementHash = crypto.createHash("sha256").update(html).digest("hex");
  const acceptanceId = crypto.randomUUID();
  const publicDownloadToken = crypto.randomUUID();
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    await db.createTables();

    const customer = await stripe.customers.create(
      {
        email: details.email,
        name: details.name,
        phone: details.phone,
        metadata: {
          acceptanceId,
          companyName: details.company,
          offerVersion: order.offerVersion,
          websitePackageId: order.selection.packageId,
          paymentMode: order.selection.paymentMode,
        },
      },
      { idempotencyKey: `${acceptanceId}:customer` }
    );

    await db.insertAgreement({
      acceptance_id: acceptanceId,
      public_download_token: publicDownloadToken,
      stripe_customer_id: customer.id,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      agreement_version: order.agreementVersion,
      agreement_html: html,
      agreement_hash: agreementHash,
      customer_name: details.name,
      customer_email: details.email,
      customer_phone: details.phone,
      company_name: details.company,
      package_id: order.package.id,
      addons: JSON.stringify({
        leadnet: order.selection.leadNetSelected,
        care: order.selection.careSelected,
      }),
      order_snapshot: JSON.stringify(order),
      customer_details: JSON.stringify(details),
      offer_version: order.offerVersion,
      website_package_id: order.selection.packageId,
      payment_mode: order.selection.paymentMode,
      leadnet_selected: order.selection.leadNetSelected,
      care_selected: order.selection.careSelected,
      initial_amount_cents: order.dueTodayCents,
      recurring_amount_cents: order.recurringAfterActivationCents,
      currency: OFFER_CURRENCY,
      accepted_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      payment_status: "pending_payment",
      subscription_status: null,
      website_subscription_status: order.selection.paymentMode === "monthly" ? "pending_payment" : null,
      care_subscription_status: order.selection.careSelected ? "pending_activation" : null,
      leadnet_subscription_status: order.selection.leadNetSelected ? "pending_activation" : null,
      onboarding_status: "captured",
      build_status: "not_started",
      service_states: JSON.stringify({
        agreementAccepted: true,
        payment: "pending",
        websiteOnboarding: "captured",
        build: "not_started",
        careActivation: order.selection.careSelected ? "pending_activation" : "not_selected",
        leadNetSetup: order.selection.leadNetSelected ? "pending_setup" : "not_selected",
        usageBilling: "disabled_until_companion_controls_connected",
      }),
    });

    return NextResponse.json({ acceptanceId, publicDownloadToken });
  } catch {
    console.error("Failed to save website agreement.");
    return NextResponse.json({ error: "Could not record agreement." }, { status: 500 });
  }
}
