import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { PaidSign } from "@/components/sections/paid-sign";
import { BeginOutcome } from "@/components/sections/begin-outcome";

export const metadata: Metadata = {
  title: "Ready to save leads",
  robots: { index: false, follow: false },
};

export default function BeginSignPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl pt-24 pb-16 px-4">
        <BeginOutcome
          stage="sign"
          kicker="Payment landed"
          title="Ready to save leads."
          body="The net is almost up. Sign the LeadNet agreement and every missed ring stays in the system."
        >
          <PaidSign />
        </BeginOutcome>
      </main>
      <Footer />
    </div>
  );
}
