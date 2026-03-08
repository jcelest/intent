import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { FloridaContent } from "@/components/sections/florida-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lead Generation Florida | Marketing for Contractors Statewide — Intent",
  description:
    "Lead generation and marketing for Florida contractors. Miami, Jacksonville, Tampa, Orlando. Get more leads, grow revenue. Statewide.",
  keywords: [
    "lead generation Florida",
    "marketing agency Florida",
    "Florida contractor leads",
    "Orlando lead generation",
    "Tampa lead generation",
    "Florida business growth",
    "revenue generation Florida",
  ],
  openGraph: {
    title: "Lead Generation Florida | Intent",
    description:
      "Lead generation and marketing for Florida contractors. Miami, Jacksonville, Tampa, Orlando. Get more leads.",
    url: `${SITE_URL}/florida`,
  },
  alternates: { canonical: `${SITE_URL}/florida` },
};

export default function FloridaPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Florida`}
        description="Lead generation for Florida contractors statewide. Miami, Jacksonville, Tampa, Orlando. Get more leads, grow revenue."
        url={`${SITE_URL}/florida`}
        areaServed={["Florida", "Central Florida", "South Florida", "North Florida"]}
        geo={{ latitude: 28.5383, longitude: -81.3792 }}
      />
      <Header />
      <FloridaContent />
      <Footer />
    </div>
  );
}
