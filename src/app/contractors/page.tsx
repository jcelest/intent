import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { ContractorsContent } from "@/components/sections/contractors-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lead Generation for Contractors | HVAC, Plumbing, Roofing — Intent",
  description:
    "Get more leads for your contractor business. Lead generation and marketing for HVAC, plumbing, roofing, home services. Grow revenue. Florida and nationwide.",
  keywords: [
    "lead generation for contractors",
    "contractor lead generation",
    "contractor marketing",
    "HVAC lead generation",
    "plumbing lead generation",
    "roofing lead generation",
    "contractor leads",
    "home services lead generation",
    "marketing for contractors",
  ],
  openGraph: {
    title: "Lead Generation for Contractors | Intent",
    description:
      "Get more leads for HVAC, plumbing, roofing, home services. Lead generation and marketing for contractors.",
    url: `${SITE_URL}/contractors`,
  },
  alternates: { canonical: `${SITE_URL}/contractors` },
};

export default function ContractorsPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Contractors`}
        description="Lead generation and marketing for contractors: HVAC, plumbing, roofing, home services. Get more leads, grow revenue. Florida and nationwide."
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
