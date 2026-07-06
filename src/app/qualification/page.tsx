import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { ClientQualificationSection } from "@/components/sections/client-qualification-section";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import type { Metadata } from "next";
import { SITE_URL, BRAND_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Partnership Qualification | ${BRAND_NAME}`,
  description:
    "Intent Revenue qualifies every contractor before full partnership. See requirements, Intent Launchpad, and apply for partnership or the qualification path.",
  keywords: [
    "Intent Revenue",
    "partnership qualification",
    "contractor qualification",
    "Intent Launchpad",
    "contractor lead generation",
  ],
  alternates: { canonical: `${SITE_URL}/qualification` },
  openGraph: {
    title: `Partnership Qualification | ${BRAND_NAME}`,
    description:
      "See who Intent Revenue partners with, qualification requirements, and the Launchpad path to full partnership.",
    url: `${SITE_URL}/qualification`,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${BRAND_NAME} partnership qualification` }],
  },
};

export default function QualificationPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-16">
        <ClientQualificationSection />
        <InquiryFormSection />
      </main>
      <Footer />
    </div>
  );
}
