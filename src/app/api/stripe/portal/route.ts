import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/seo";
import * as db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    return NextResponse.json({ error: "Stripe test billing is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return NextResponse.json({ error: "Invalid billing token." }, { status: 400 });
  }

  const record = await db.getAgreementByDownloadToken(token);
  if (!record?.stripe_customer_id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;
  const session = await stripe.billingPortal.sessions.create({
    customer: record.stripe_customer_id,
    return_url: `${origin.replace(/\/$/, "")}/begin/signed`,
  });

  return NextResponse.json({ url: session.url });
}

