import { Header } from "@/components/sections/header";
import { HeroSection } from "@/components/sections/hero-section";
import { FounderTrustSection } from "@/components/sections/founder-trust-section";
import { TrustOutcomesSection } from "@/components/sections/trust-outcomes-section";
import { HomeProductsSection } from "@/components/sections/home-products-section";
import { HomeFinalCta } from "@/components/sections/home-final-cta";
import { Footer } from "@/components/sections/footer";
import type { Metadata } from "next";
import { SITE_URL, SEO_TITLE_DEFAULT, DEFAULT_DESCRIPTION, PRIMARY_KEYWORD_PHRASE, BRAND_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: SEO_TITLE_DEFAULT,
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "Intent Revenue",
    PRIMARY_KEYWORD_PHRASE,
    "lead generation for contractors",
    "contractor marketing",
    "revenue growth for contractors",
    "HVAC lead generation",
    "plumbing lead generation",
    "lead generation Florida",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${BRAND_NAME}: revenue growth for contractors and the trades` }],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE_DEFAULT,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function Home() {
  return (
    <div className="relative z-10">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <FounderTrustSection />
        <TrustOutcomesSection />
        <HomeProductsSection />
        <HomeFinalCta />
      </main>
      <Footer />
    </div>
  );
}
