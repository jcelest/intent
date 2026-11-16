import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { B2BContractPay } from "@/components/sections/b2b-contract-pay";
import { BeginOutcome } from "@/components/sections/begin-outcome";

export const metadata: Metadata = {
  title: "Complete Payment | Intent B2B",
  robots: { index: false, follow: false },
};

export default function B2BBeginPayPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl pt-24 pb-16 px-4">
        <BeginOutcome
          stage="sign"
          kicker="Agreement Accepted"
          title="Almost done."
          body="Complete the $2,000 start payment to initiate your Commercial Partnerships campaign."
        >
          <B2BContractPay />
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
