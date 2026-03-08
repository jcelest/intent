import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { CentralFloridaContent } from "@/components/sections/central-florida-content";
import { LocalBusinessJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lead Generation Central Florida | Orlando, Tampa, Kissimmee — Intent",
  description:
    "Lead generation and marketing for Central Florida contractors. Orlando, Tampa, Kissimmee, Winter Park, Lakeland. Get more leads, grow revenue.",
  keywords: [
    "lead generation Central Florida",
    "lead generation Orlando",
    "lead generation Tampa",
    "contractor marketing Orlando",
    "Kissimmee marketing",
    "Winter Park lead generation",
    "Lakeland contractor leads",
  ],
  openGraph: {
    title: "Lead Generation Central Florida | Orlando, Tampa — Intent",
    description:
      "Lead generation and marketing for Central Florida. Orlando, Tampa, Kissimmee. Get more contractor leads.",
    url: `${SITE_URL}/central-florida`,
  },
  alternates: { canonical: `${SITE_URL}/central-florida` },
};

export default function CentralFloridaPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <LocalBusinessJsonLd
        name={`${SITE_NAME} - Central Florida`}
        description="Lead generation for Central Florida: Orlando, Tampa, Kissimmee, Winter Park, Lakeland. Get more contractor leads, grow revenue."
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
