import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { B2BBeginFlow } from "@/components/sections/b2b-begin-flow";
import { isStripeConfigured } from "@/lib/engagements";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Commercial Partnerships Checkout | Intent B2B",
  description: `Confirm your details for the Commercial Partnerships campaign with ${BRAND_NAME}. $4,000 total fee, $2,000 start payment due today.`,
  alternates: { canonical: `${SITE_URL}/b2b/begin` },
  robots: { index: false, follow: false },
};

export default function B2BBeginPage({
  searchParams,
}: {
  searchParams: {
    company?: string;
    companyName?: string;
    c?: string;
    name?: string;
    signerName?: string;
    n?: string;
    email?: string;
    e?: string;
    phone?: string;
    p?: string;
    trade?: string;
    serviceArea?: string;
    counties?: string;
    scopeLimits?: string;
    targetAccounts?: string;
  };
}) {
  const initialCompany =
    searchParams.company || searchParams.companyName || searchParams.c || "";
  const initialName =
    searchParams.name || searchParams.signerName || searchParams.n || "";
  const initialEmail = searchParams.email || searchParams.e || "";
  const initialPhone = searchParams.phone || searchParams.p || "";
  const trade = searchParams.trade;
  const serviceArea = searchParams.serviceArea || searchParams.counties;
  const scopeLimits = searchParams.scopeLimits;
  const targetAccounts = searchParams.targetAccounts
    ? parseInt(searchParams.targetAccounts, 10)
    : 3;

  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Intent B2B
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight">
            Commercial Partnerships
          </h1>
          <p className="mt-3 text-base text-foreground/75 leading-relaxed">
            3 commercial accounts landed for your business. $4,000 total, $2,000 start payment due today.
          </p>
        </div>
        <div className="mt-10">
          <B2BBeginFlow
            initialValues={{
              company: initialCompany,
              name: initialName,
              email: initialEmail,
              phone: initialPhone,
              trade,
              serviceArea,
              scopeLimits,
              targetAccounts,
            }}
            stripeReady={isStripeConfigured()}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
