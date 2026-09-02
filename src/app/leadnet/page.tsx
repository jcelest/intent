import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CaptureContent } from "@/components/sections/capture-content";
import { LeadNetOfferJsonLd } from "@/components/seo/json-ld";
import { leadNetPricingMetaLine, leadNetPricingSummary } from "@/lib/engagements";
import { SITE_URL, BRAND_NAME } from "@/lib/seo";

const leadNetDescription = `Speed-to-lead auto-replies, missed-call recovery, customer database reactivation, and live dispatch. ${leadNetPricingMetaLine()} from ${BRAND_NAME}.`;

export const metadata: Metadata = {
  title: "Intent LeadNet | Revenue Capture & Reactivation Engine",
  description: leadNetDescription,
  keywords: [
    "Intent LeadNet",
    "Intent Revenue",
    "contractor lead capture",
    "missed call text back",
    "database reactivation",
    leadNetPricingSummary(),
    "$1,397 LeadNet",
    "$197 LeadNet monthly",
  ],
  alternates: { canonical: `${SITE_URL}/leadnet` },
  openGraph: {
    title: `Intent LeadNet | Revenue Capture & Reactivation Engine`,
    description: leadNetDescription,
    url: `${SITE_URL}/leadnet`,
  },
};

export default function LeadNetPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LeadNetOfferJsonLd />
      <Header />
      <CaptureContent />
      <Footer />
    </div>
  );
}
