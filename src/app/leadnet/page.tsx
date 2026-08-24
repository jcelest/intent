import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CaptureContent } from "@/components/sections/capture-content";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Intent LeadNet",
  description:
    "Protect every lead. Missed-call text-back, intake, owner alerts, Google review SMS, and a company dashboard. $1,397 sprint, then $197/month from Intent Revenue.",
  alternates: { canonical: `${SITE_URL}/leadnet` },
  openGraph: {
    title: `Intent LeadNet | ${BRAND_NAME}`,
    description:
      "Protect every lead. Recover missed calls, capture intake, request Google reviews. Nothing slips through.",
    url: `${SITE_URL}/leadnet`,
  },
};

export default function LeadNetPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <CaptureContent />
      <Footer />
    </div>
  );
}
