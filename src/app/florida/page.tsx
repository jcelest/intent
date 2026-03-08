import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { FloridaContent } from "@/components/sections/florida-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Marketing Agency Florida | Lead Generation & Revenue Automation — Intent",
  description:
    "Intent builds AI-powered lead generation infrastructure for Florida businesses statewide. AI voice qualification, pSEO, speed-to-lead automation. Miami, Jacksonville, Tampa, Orlando. We engineer revenue.",
  keywords: [
    "AI marketing agency Florida",
    "lead generation Florida",
    "AI voice qualification Florida",
    "revenue automation Florida",
    "marketing agency Central Florida",
    "Orlando AI marketing",
    "Tampa lead generation",
    "Florida business growth",
    "pSEO Florida",
    "AI sales automation Florida",
  ],
  openGraph: {
    title: "AI Marketing Agency Florida | Intent",
    description:
      "AI-powered lead generation for Florida businesses. Voice AI, pSEO, revenue automation statewide.",
    url: `${SITE_URL}/florida`,
  },
  alternates: { canonical: `${SITE_URL}/florida` },
};

export default function FloridaPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Florida`}
        description="AI-powered lead generation for Florida businesses statewide. Miami, Jacksonville, Tampa, Orlando. Voice AI, pSEO, revenue automation."
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
