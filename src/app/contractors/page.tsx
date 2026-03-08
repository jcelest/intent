import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { ContractorsContent } from "@/components/sections/contractors-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Marketing for Contractors | Lead Generation & pSEO — Intent",
  description:
    "Intent builds AI-powered lead generation for contractors. HVAC, plumbing, roofing, construction, home services. AI voice qualification, pSEO, speed-to-lead. Florida and nationwide.",
  keywords: [
    "AI marketing for contractors",
    "contractor lead generation",
    "HVAC marketing AI",
    "plumbing lead generation",
    "roofing marketing agency",
    "construction contractor marketing",
    "home services lead generation",
  ],
  openGraph: {
    title: "AI Marketing for Contractors | Intent",
    description:
      "AI-powered lead generation for contractors: HVAC, plumbing, roofing, construction. Voice AI, pSEO, speed-to-lead.",
    url: `${SITE_URL}/contractors`,
  },
  alternates: { canonical: `${SITE_URL}/contractors` },
};

export default function ContractorsPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Contractors`}
        description="AI-powered lead generation for contractors: HVAC, plumbing, roofing, construction, home services. Voice AI, pSEO, speed-to-lead. Florida and nationwide."
        url={`${SITE_URL}/contractors`}
        areaServed={["Florida", "Central Florida", "United States"]}
        geo={{ latitude: 28.5383, longitude: -81.3792 }}
      />
      <Header />
      <ContractorsContent />
      <Footer />
    </div>
  );
}
