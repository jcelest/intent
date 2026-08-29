import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import { BusinessContactBlock } from "@/components/sections/business-contact-block";
import { ContactPageJsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";
import {
  SITE_URL,
  BRAND_NAME,
  BUSINESS_PHONE_DISPLAY,
  SEO_PHONE_KEYWORDS,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: `Contact Intent Revenue | ${BUSINESS_PHONE_DISPLAY}`,
  description:
    `Contact ${BRAND_NAME} at ${BUSINESS_PHONE_DISPLAY}. Contractor lead generation, LeadNet, and revenue systems for HVAC, plumbing, roofing, and home services. Florida and nationwide.`,
  keywords: [
    "Intent Revenue",
    "contact Intent Revenue",
    "contractor revenue capture",
    "contractor marketing",
    "Intent LeadNet",
    ...SEO_PHONE_KEYWORDS,
  ],
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: `Contact ${BRAND_NAME} | ${BUSINESS_PHONE_DISPLAY}`,
    description:
      `Call ${BUSINESS_PHONE_DISPLAY} or send an inquiry. Partnership, LeadNet, and contractor revenue capture.`,
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
      <ContactPageJsonLd />
      <Header />
      <main className="pt-16">
        <section className="relative px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-xl mx-auto">
            <BusinessContactBlock />
          </div>
        </section>
        <InquiryFormSection id="contact" mode="contact" />
      </main>
      <Footer />
    </div>
  );
}
