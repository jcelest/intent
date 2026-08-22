import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BeginOutcome } from "@/components/sections/begin-outcome";
import { BeginProgress } from "@/components/sections/begin-progress";

export const metadata: Metadata = {
  title: "Ready to save leads",
  robots: { index: false, follow: false },
};

export default function BeginConfirmedPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <BeginOutcome
          stage="done"
          kicker="LeadNet is on"
          title="Ready to save leads."
          body="The net is up. We have the start. Keep your phone close. We will pick a phone path and kick off the work. The next missed call stays in."
        >
          <div className="flex flex-col items-center gap-8">
            <BeginProgress />
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
