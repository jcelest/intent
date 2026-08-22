import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { SignedStart } from "@/components/sections/signed-start";

export const metadata: Metadata = {
  title: "Confirm start",
  robots: { index: false, follow: false },
};

export default function BeginSignedPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl pt-24 pb-16 px-4">
        <h1 className="text-center text-3xl font-semibold">You signed.</h1>
        <p className="mt-3 mb-8 text-center text-foreground/75">
          Last step: confirm LeadNet.
        </p>
        <SignedStart />
      </main>
      <Footer />
    </div>
  );
}
