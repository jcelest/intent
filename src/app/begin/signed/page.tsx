import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BeginOutcome } from "@/components/sections/begin-outcome";
import { BeginProgress } from "@/components/sections/begin-progress";
import { DownloadAgreementButton } from "@/components/sections/download-agreement-button";
import { BillingPortalButton } from "@/components/sections/billing-portal-button";

export const metadata: Metadata = {
  title: "Order submitted",
  robots: { index: false, follow: false },
};

export default function BeginSignedPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <BeginOutcome
          stage="done"
          kicker="Order submitted"
          title="We have the signed order."
          body="Stripe will confirm the payment through the secure webhook before we mark the order paid. We will review the onboarding details, confirm any missing access through secure handoff, and schedule the website build. Optional Care and LeadNet billing begin only when those services are activated."
        >
          <div className="flex flex-col items-center gap-8">
            <BeginProgress />
            <DownloadAgreementButton />
            <BillingPortalButton />
            <Link
              href="/"
              className="inline-flex font-semibold text-accent hover:underline"
            >
              Back to Intent
            </Link>
          </div>
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
