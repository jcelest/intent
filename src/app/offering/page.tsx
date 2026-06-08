import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { OfferingContent } from "@/components/sections/offering-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Full Package | Revenue Growth for Contractors — Intent",
  description:
    "We map revenue streams, build custom software, grow trades organically at an exceptional pace, and run paid ads & content on Google when it accelerates growth.",
  keywords: [
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
