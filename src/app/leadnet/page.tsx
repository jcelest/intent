import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CaptureContent } from "@/components/sections/capture-content";
import { LeadNetOfferJsonLd } from "@/components/seo/json-ld";
import {
  leadNetWebsitePricingMetaLine,
  leadNetWebsitePricingSummary,
} from "@/lib/leadnet-offer";
import { SITE_URL, BRAND_NAME } from "@/lib/seo";

const leadNetDescription = `Professionally built business websites with optional LeadNet Follow-Up. ${leadNetWebsitePricingMetaLine()} from ${BRAND_NAME}.`;

export const metadata: Metadata = {
  title: "LeadNet Websites | Business Websites & Optional Follow-Up",
  description: leadNetDescription,
  keywords: [
    "LeadNet websites",
    "Intent Revenue",
    "business website",
    "contractor website",
    "website care",
    "LeadNet Follow-Up",
    leadNetWebsitePricingSummary(),
  ],
  alternates: { canonical: `${SITE_URL}/leadnet` },
  openGraph: {
    title: "LeadNet Websites | Business Websites & Optional Follow-Up",
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
