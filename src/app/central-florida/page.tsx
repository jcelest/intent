import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CentralFloridaContent } from "@/components/sections/central-florida-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Marketing Agency Central Florida | Orlando, Tampa, Kissimmee — Intent",
  description:
    "Intent delivers AI-powered lead generation for Central Florida businesses. Orlando, Tampa, Kissimmee, Winter Park, Lakeland. AI voice qualification, pSEO, and revenue automation. We engineer revenue.",
  keywords: [
    "AI marketing agency Central Florida",
    "lead generation Orlando",
    "AI marketing Tampa",
    "Kissimmee business marketing",
    "Winter Park AI agency",
    "Lakeland lead generation",
    "Central Florida revenue automation",
  ],
  openGraph: {
    title: "AI Marketing Agency Central Florida | Intent",
    description:
      "AI-powered lead generation for Orlando, Tampa, Kissimmee & Central Florida. Voice AI, pSEO, revenue automation.",
    url: `${SITE_URL}/central-florida`,
  },
  alternates: { canonical: `${SITE_URL}/central-florida` },
};

export default function CentralFloridaPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Central Florida`}
        description="AI-powered lead generation for Central Florida: Orlando, Tampa, Kissimmee, Winter Park, Lakeland. Voice AI, pSEO, revenue automation."
        url={`${SITE_URL}/central-florida`}
        areaServed={[
          "Orlando, FL",
          "Tampa, FL",
          "Kissimmee, FL",
          "Winter Park, FL",
          "Lakeland, FL",
          "Central Florida",
        ]}
        geo={{ latitude: 28.5383, longitude: -81.3792 }}
      />
      <Header />
      <CentralFloridaContent />
      <Footer />
    </div>
  );
}
