import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { OfferingContent } from "@/components/sections/offering-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offering | Intent — We Engineer Revenue",
  description:
    "Intent's full package: AI voice qualification, speed-to-lead automation, pSEO engine, custom React logic, and revenue analytics. End-to-end infrastructure that captures and closes leads.",
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
