import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BeginFlow } from "@/components/sections/begin-flow";
import {
  getEngagement,
  isDocuSignConfigured,
  isStripeConfigured,
  parseAddons,
  parseEngagementId,
} from "@/lib/engagements";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Begin",
  description: `Start Intent LeadNet, Launchpad, partnership, or a custom package with ${BRAND_NAME}.`,
  alternates: { canonical: `${SITE_URL}/begin` },
  robots: { index: false, follow: false },
};

export default function BeginPage({
  searchParams,
}: {
  searchParams: { path?: string; styling?: string; nowatermark?: string };
}) {
  const initialPath = parseEngagementId(searchParams.path);
  const initialAddons = parseAddons([
    searchParams.styling === "1" ? "styling" : "",
    searchParams.nowatermark === "1" ? "nowatermark" : "",
  ]);

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
            capture={getEngagement("capture")}
            launchpad={getEngagement("launchpad")}
            partnership={getEngagement("partnership")}
            custom={getEngagement("custom")}
            initialPath={initialPath}
            initialAddons={initialAddons}
            stripeReady={isStripeConfigured()}
            docusignReady={isDocuSignConfigured()}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
