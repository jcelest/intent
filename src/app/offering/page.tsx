import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { OfferingContent } from "@/components/sections/offering-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lead Generation Package | Get More Contractor Leads — Intent",
  description:
    "Full lead generation package for contractors. Speed-to-lead, local SEO, voice qualification, revenue dashboard. Capture and close more leads.",
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
