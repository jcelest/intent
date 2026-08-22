import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { BRAND_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "You're in",
  robots: { index: false, follow: false },
};

export default function BeginConfirmedPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-lg rounded-2xl border border-accent/40 bg-accent/10 p-8 sm:p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            {BRAND_NAME}
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold">You&apos;re in.</h1>
          <p className="mt-4 text-foreground/80 leading-relaxed">
            We have the start. Keep your phone close. We will reach out to kick
            off the work.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex font-semibold text-accent hover:underline"
          >
            Back to Intent
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
