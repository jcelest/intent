import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BeginFlow } from "@/components/sections/begin-flow";
import {
  isStripeConfigured,
} from "@/lib/engagements";
import {
  leadNetWebsitePricingMetaLine,
  parseWebsitePackageId,
  parseWebsitePaymentMode,
} from "@/lib/leadnet-offer";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Begin",
  description: `Start a business website order with ${BRAND_NAME}. ${leadNetWebsitePricingMetaLine()}.`,
  alternates: { canonical: `${SITE_URL}/begin` },
  robots: { index: false, follow: false },
};

export default function BeginPage({
  searchParams,
}: {
  searchParams: { package?: string; mode?: string; leadnet?: string; care?: string };
}) {
  const initialPackageId = parseWebsitePackageId(searchParams.package);
  const initialPaymentMode = parseWebsitePaymentMode(searchParams.mode);

  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            {BRAND_NAME}
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
            Begin
          </h1>
        </div>
        <div className="mt-10">
          <BeginFlow
            initialPackageId={initialPackageId}
            initialPaymentMode={initialPaymentMode}
            initialLeadNetSelected={searchParams.leadnet === "1"}
            initialCareSelected={searchParams.care === "1"}
            stripeReady={isStripeConfigured()}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
