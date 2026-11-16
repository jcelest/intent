import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { B2BClickwrapAgreement } from "@/components/sections/b2b-clickwrap-agreement";
import { BeginOutcome } from "@/components/sections/begin-outcome";

export const metadata: Metadata = {
  title: "Commercial Partnerships Agreement | Intent B2B",
  robots: { index: false, follow: false },
};

export default function B2BBeginAgreementPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl pt-24 pb-16 px-4">
        <BeginOutcome
          stage="sign"
          kicker="Review Agreement"
          title="Commercial Partnerships Agreement"
          body="Please review and accept the agreement before proceeding to payment."
        >
          <B2BClickwrapAgreement />
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
