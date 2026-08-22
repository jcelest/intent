import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { PaidSign } from "@/components/sections/paid-sign";

export const metadata: Metadata = {
  title: "Sign the agreement",
  robots: { index: false, follow: false },
};

export default function BeginSignPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl pt-24 pb-16 px-4">
        <h1 className="text-center text-3xl font-semibold">Payment received.</h1>
        <p className="mt-3 mb-8 text-center text-foreground/75">
          Last step: sign the LeadNet agreement.
        </p>
        <PaidSign />
      </main>
      <Footer />
    </div>
  );
}
