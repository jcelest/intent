import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { BentoGrid } from "@/components/sections/bento-grid";
import { RevenueDashboard } from "@/components/sections/revenue-dashboard";
import { SeoContentSection } from "@/components/sections/seo-content-section";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import { Footer } from "@/components/sections/footer";
import type { Metadata } from "next";
import { SITE_URL, SEO_TITLE_DEFAULT, DEFAULT_DESCRIPTION, PRIMARY_KEYWORD_PHRASE } from "@/lib/seo";

export const metadata: Metadata = {
  title: SEO_TITLE_DEFAULT,
  description: DEFAULT_DESCRIPTION,
  keywords: [
    PRIMARY_KEYWORD_PHRASE,
    "lead generation for contractors",
    "contractor marketing",
    "engineer revenue",
    "HVAC lead generation",
    "plumbing lead generation",
    "lead generation Florida",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: "Intent",
    locale: "en_US",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Intent — contractor lead generation for the trades" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function Home() {
  return (
    <div className="relative z-10">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <BentoGrid />
        <RevenueDashboard />
        <SeoContentSection />
        <InquiryFormSection />
      </main>
      <Footer />
    </div>
  );
}
