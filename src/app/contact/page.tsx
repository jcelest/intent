import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import type { Metadata } from "next";
import { SITE_URL, BRAND_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Contact Intent Revenue | ${BRAND_NAME}`,
  description:
    "Get in touch with Intent Revenue. Request a consultation, partner with us, or inquiry about our Revenue Capture and marketing systems.",
  keywords: [
    "Intent Revenue",
    "contact Intent Revenue",
    "contractor revenue capture",
    "contractor marketing",
    "Intent LeadNet",
  ],
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: `Contact Intent Revenue | ${BRAND_NAME}`,
    description:
      "Get in touch with Intent Revenue. Inquire about partnership or contractor revenue capture systems.",
    url: `${SITE_URL}/contact`,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `Contact ${BRAND_NAME}` }],
  },
};

export default function ContactPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-16">
        <InquiryFormSection id="contact" />
      </main>
      <Footer />
    </div>
  );
}
