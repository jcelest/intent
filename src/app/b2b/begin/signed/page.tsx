import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BeginOutcome } from "@/components/sections/begin-outcome";
import { B2BProgress } from "@/components/sections/b2b-progress";
import { B2BDownloadAgreementButton } from "@/components/sections/b2b-download-agreement-button";

export const metadata: Metadata = {
  title: "Commercial Partnership Order Submitted | Intent B2B",
  robots: { index: false, follow: false },
};

export default function B2BBeginSignedPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <BeginOutcome
          stage="done"
          kicker="Order submitted"
          title="We have your partnership order."
          body="Your $2,000 start payment is being securely confirmed. We will review your onboarding packet and documents (COI, W-9, license, and rate sheet) to prepare your outreach launch. The remaining $2,000 completion payment is due only when the 3rd target account reaches Onboarded status."
        >
          <div className="flex flex-col items-center gap-8">
            <B2BProgress />
            <B2BDownloadAgreementButton />
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/b2b"
                className="inline-flex font-semibold text-accent hover:underline"
              >
                Back to Intent B2B
              </Link>
              <span className="hidden sm:inline text-muted">·</span>
              <Link
                href="/"
                className="inline-flex font-semibold text-foreground/75 hover:text-foreground hover:underline"
              >
                Intent Home
              </Link>
            </div>
          </div>
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
