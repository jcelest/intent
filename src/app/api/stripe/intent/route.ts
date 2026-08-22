import { NextResponse } from "next/server";
import {
  addonAmount,
  getEngagement,
  isDocuSignConfigured,
  isStripeConfigured,
  parseAddons,
  parseEngagementId,
} from "@/lib/engagements";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const engagement = getEngagement(parseEngagementId(body?.path));
  if (engagement.id !== "capture") {
    return NextResponse.json(
      { error: "LeadNet is the only path that takes payment here." },
      { status: 400 }
    );
  }
  const addons = parseAddons(body?.addons);
  const extra = addonAmount(addons);
  if (!engagement.amountCents) {
    return NextResponse.json(
      { error: "This start path is not open yet." },
      { status: 503 }
    );
  }
  const amount = engagement.amountCents + extra;

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const company = String(body?.company ?? "").trim();

  if (name.length < 2 || !email.includes("@") || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Name, email, and phone are required." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    SITE_URL;

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    receipt_email: email,
    description: extra
      ? `${engagement.title} with add-ons`
      : engagement.title,
    metadata: {
      path: engagement.id,
      name,
      email,
      phone,
      company,
      addons: addons.join(","),
    },
  });

  if (!intent.client_secret) {
    return NextResponse.json(
      { error: "Could not start. Try again." },
      { status: 500 }
    );
  }

  const afterPay =
    engagement.id === "capture" && isDocuSignConfigured()
      ? "/begin/sign"
      : "/begin/confirmed";

  return NextResponse.json({
    clientSecret: intent.client_secret,
    returnUrl: `${origin.replace(/\/$/, "")}${afterPay}`,
  });
}
