import type { Metadata } from "next";
import { ContentContent } from "@/components/sections/content-content";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

const description =
  "Intent Content builds high-volume organic content engines with strategy, short-form video, branded creative, cross-platform distribution, and continuous iteration.";

export const metadata: Metadata = {
  title: {
    absolute: "Intent Content | High-Volume Creative Production",
  },
  description,
  keywords: [
    "Intent Content",
    "high-volume content production",
    "short-form video production",
    "organic social media management",
    "content strategy",
    "branded graphics and carousels",
    "advertising creative production",
    "cross-platform content distribution",
  ],
  alternates: { canonical: `${SITE_URL}/content` },
  openGraph: {
    title: "Intent Content | Become Impossible to Ignore",
    description,
    url: `${SITE_URL}/content`,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Intent Content by Intent Revenue",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Intent Content | Become Impossible to Ignore",
    description,
    images: ["/og-image.png"],
  },
};

export default function ContentPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <ContentContent />
      <Footer />
    </div>
  );
}
