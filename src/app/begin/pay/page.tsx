import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { ContractPay } from "@/components/sections/contract-pay";
import { BeginOutcome } from "@/components/sections/begin-outcome";

export const metadata: Metadata = {
  title: "Complete Payment",
  robots: { index: false, follow: false },
};

export default function BeginPayPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl pt-24 pb-16 px-4">
        <BeginOutcome
          stage="sign"
          kicker="Agreement Signed"
          title="Almost done."
          body="Complete the payment to kick off your sprint and activate LeadNet."
        >
          <ContractPay />
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
