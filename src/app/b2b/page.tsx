import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";
import { BRAND_NAME, SITE_URL } from "@/lib/seo";

const CALL_TARGET = "#request-call";

const processSteps = [
  {
    title: "Define the work you want.",
    description:
      "Josh and the owner agree on territory, trade, crew capacity, and which jobs or accounts are worth pursuing.",
  },
  {
    title: "Get in front of the buyer.",
    description:
      "Josh handles outreach and follow-up, identifies who assigns the work, and confirms whether they’re accepting vendors or bids.",
  },
  {
    title: "Get ready for the first job.",
    description:
      "Josh helps with vendor onboarding and clarifies what the buyer expects. The contractor approves pricing, submits its bid when required, and delivers the work.",
  },
];

const description =
  "Intent B2B helps Central Florida trade contractors pursue commercial accounts through buyer outreach, follow-up, and vendor onboarding support.";

export const metadata: Metadata = {
  title: {
    absolute: "Intent B2B | Commercial Accounts for Central Florida Contractors",
  },
  description,
  alternates: { canonical: `${SITE_URL}/b2b` },
  openGraph: {
    title: "Intent B2B | Commercial Accounts for Central Florida Contractors",
    description,
    url: `${SITE_URL}/b2b`,
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Intent B2B by Intent Revenue",
      },
    ],
  },
};

function CallLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href={CALL_TARGET}
      className={`inline-flex min-h-14 items-center justify-center rounded-lg bg-accent px-7 py-4 text-center text-base font-semibold text-oled shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-oled ${className}`}
    >
      Request a 10-minute call
    </Link>
  );
}

export default function B2BPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header />
      <main className="pt-16">
        <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8 lg:pb-24 lg:pt-28">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-5xl text-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-accent sm:text-sm">
              Intent B2B
            </p>
            <h1 className="mx-auto mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Land commercial accounts that send repeat work.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-balance text-lg leading-8 text-slate-300 sm:text-xl">
              We find buyers in your service area, reach the people who assign the work, and handle outreach, follow-up, and vendor onboarding for your business.
            </p>
            <div className="mt-9 flex justify-center">
              <CallLink className="w-full sm:w-auto" />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="result-heading"
          className="border-y border-border bg-slate-950/80 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-accent sm:text-sm">
              One Central Florida HVAC client
            </p>
            <h2
              id="result-heading"
              className="mt-5 max-w-5xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Two accounts alone generated over $24,000 in sales in just over four months.
            </h2>
            <p className="mt-7 max-w-4xl text-lg leading-8 text-slate-300">
              Intent B2B helped one Central Florida HVAC contractor land five business accounts. All five sent repeat work. From late June to early November 2026, two accounts alone generated at least $24,588 in documented sales.
            </p>

            <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-black/40">
              <div className="grid gap-2 border-b border-border p-5 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-6 sm:p-6">
                <p className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
                  Account 1
                </p>
                <p className="text-base leading-7 text-slate-200 sm:text-lg">
                  <strong className="font-semibold text-white">$21,088</strong> from late June through early November.
                </p>
              </div>
              <div className="grid gap-2 p-5 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-6 sm:p-6">
                <p className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
                  Account 2
                </p>
                <p className="text-base leading-7 text-slate-200 sm:text-lg">
                  <strong className="font-semibold text-white">$3,500</strong> documented in July and August alone. Later sales from this account are excluded from the total.
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-4xl text-sm leading-6 text-slate-400">
              These are documented sales for one HVAC client. The $12,000 from three installs is already included in Account 1. Client and buyer identities remain private.
            </p>
          </div>
        </section>

        <section aria-labelledby="process-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-accent sm:text-sm">
                The service
              </p>
              <h2 id="process-heading" className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
                A focused path to the right commercial buyer.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                For HVAC, plumbing, electrical, roofing, painting, and landscaping contractors across Central Florida.
              </p>
            </div>

            <ol className="mt-12 grid gap-5 lg:grid-cols-3">
              {processSteps.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-border bg-card/80 p-6 sm:p-7">
                  <span className="font-mono text-sm font-semibold text-accent">0{index + 1}</span>
                  <h3 className="mt-7 text-xl font-semibold text-white sm:text-2xl">{step.title}</h3>
                  <p className="mt-4 leading-7 text-slate-300">{step.description}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-6 text-slate-400">
              Contact lists, research methods, and outreach scripts stay private.
            </p>
          </div>
        </section>

        <section aria-labelledby="offer-heading" className="border-y border-border bg-card/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-accent sm:text-sm">
                The offer
              </p>
              <h2 id="offer-heading" className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                $4,000 upfront.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Before starting, Josh and the contractor agree on one primary campaign goal.
              </p>
            </div>

            <div className="space-y-4">
              <article className="rounded-2xl border border-border bg-black/35 p-6 sm:p-7">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Goal 1</p>
                <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">Three new commercial accounts</h3>
                <p className="mt-3 leading-7 text-slate-300">
                  Each account counts when a distinct buyer issues its first paid work order.
                </p>
              </article>
              <div className="text-center font-mono text-xs uppercase tracking-[0.2em] text-slate-500">or</div>
              <article className="rounded-2xl border border-border bg-black/35 p-6 sm:p-7">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Goal 2</p>
                <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">One signed commercial subcontract</h3>
                <p className="mt-3 leading-7 text-slate-300">
                  The subcontract must meet the contractor’s agreed job-size and margin criteria.
                </p>
              </article>
              <p className="pt-3 text-sm leading-6 text-slate-400">
                These are campaign goals, not interchangeable milestones. A bid invitation or vendor approval is not signed work, and signed work is distinct from a paid work order.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-accent sm:text-sm">
              Your next account
            </p>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              What kind of account would you want two more of?
            </h2>
            <div className="mt-9 flex justify-center">
              <CallLink className="w-full sm:w-auto" />
            </div>
          </div>
        </section>

        <InquiryFormSection id="request-call" mode="b2b" />
      </main>
      <Footer />
    </div>
  );
}
