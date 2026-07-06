import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { OfferingContent } from "@/components/sections/offering-content";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Full Package | Revenue Growth for Contractors`,
  description:
    `${BRAND_NAME} maps revenue streams, builds custom software, grows trades organically, and runs paid ads & content on Google when it accelerates growth.`,
  keywords: [
    "Intent Revenue",
    "lead generation package",
    "contractor lead generation",
    "lead generation for contractors",
    "get more leads",
    "revenue generation",
  ],
};

export default function OfferingPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <OfferingContent />
      <Footer />
    </div>
  );
}
