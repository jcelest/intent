import type { Metadata } from "next";
import { AdsContent } from "@/components/sections/ads-content";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

const description =
  "Intent Ads builds, manages, and optimizes paid customer acquisition systems across Google Search, Local Services Ads, Meta, retargeting, and conversion infrastructure.";

export const metadata: Metadata = {
  title: {
    absolute: "Intent Ads | Paid Customer Acquisition by Intent Revenue",
  },
  description,
  keywords: [
    "Intent Ads",
    "paid customer acquisition",
    "Google Search Ads management",
    "Google Local Services Ads management",
    "Meta Ads management",
    "conversion tracking and attribution",
    "retargeting campaigns",
  ],
  alternates: { canonical: `${SITE_URL}/ads` },
  openGraph: {
    title: "Intent Ads | Turn Attention Into Revenue",
    description,
    url: `${SITE_URL}/ads`,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Intent Ads by Intent Revenue",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Intent Ads | Turn Attention Into Revenue",
    description,
    images: ["/og-image.png"],
  },
};

export default function AdsPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <AdsContent />
      <Footer />
    </div>
  );
}
