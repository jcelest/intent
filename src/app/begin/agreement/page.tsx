import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { ClickwrapAgreement } from "@/components/sections/clickwrap-agreement";
import { BeginOutcome } from "@/components/sections/begin-outcome";

export const metadata: Metadata = {
  title: "Service Agreement",
  robots: { index: false, follow: false },
};

export default function BeginAgreementPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl pt-24 pb-16 px-4">
        <BeginOutcome
          stage="sign"
          kicker="Review Agreement"
          title="Service Agreement"
          body="Please review and accept the agreement before proceeding to payment."
        >
          <ClickwrapAgreement />
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
