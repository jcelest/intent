import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { OfferingContent } from "@/components/sections/offering-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offering | Intent — AI Marketing Package for Florida",
  description:
    "Intent's full package: AI voice qualification, speed-to-lead automation, pSEO engine, custom React logic, and revenue analytics. End-to-end infrastructure for Florida businesses that captures and closes leads.",
  keywords: [
    "AI marketing package Florida",
    "lead generation infrastructure",
    "AI voice qualification",
    "pSEO engine",
    "revenue automation Florida",
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
