import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CaptureContent } from "@/components/sections/capture-content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Intent LeadNet | Revenue Capture & Reactivation Engine",
  description:
    "Speed-to-lead auto-replies, missed-call recovery, customer database reactivation, and live dispatch. $1,397 sprint, then $197/month from Intent Revenue.",
  alternates: { canonical: `${SITE_URL}/leadnet` },
  openGraph: {
    title: `Intent LeadNet | Revenue Capture & Reactivation Engine`,
    description:
      "Instant speed-to-lead, missed-call recovery, customer database reactivation, and 5-star review booster. Nothing slips through.",
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
