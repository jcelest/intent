import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { SITE_URL } from "@/lib/seo";

const CONTACT_TARGET = "/#get-in-touch";

export const metadata: Metadata = {
  title: {
    absolute:
      "Intent Quoting System | Free Instant Quotes for Your Customers | Intent Revenue",
  },
  description:
    "The Intent Quoting System gives your customers a free quote in minutes and gives you back the hours you lose building quotes by hand. $7,000 implementation, $197 per month after calibration.",
  alternates: { canonical: `${SITE_URL}/intent-quoting-system` },
  openGraph: {
    title:
      "Intent Quoting System | Free Instant Quotes for Your Customers | Intent Revenue",
    description:
      "The Intent Quoting System gives your customers a free quote in minutes and gives you back the hours you lose building quotes by hand. $7,000 implementation, $197 per month after calibration.",
    url: `${SITE_URL}/intent-quoting-system`,
  },
};

const PROBLEMS = [
  "Most owners spend 5 to 10 hours a week building and sending quotes at night or between jobs.",
  "Customers shop around. The company that sends a quote first usually gets the job, and a free instant quote beats a callback promised for Thursday.",
  "While your quote is still being typed, your customer already has a number from somebody else.",
];

const STEPS = [
  {
    title: "We build your price book.",
    body: "Your materials, labor rates, and job rules are loaded into the engine. The engine does the math. The AI never invents a price.",
  },
  {
    title: "We calibrate on your real jobs.",
    body: "For the first 90 days we tune the system against your actual quotes and train your team until its numbers match yours.",
  },
  {
    title: "Quotes go out in minutes, two ways.",
    body: "An internal assistant your team uses to build and send quotes and invoices fast, and a customer facing assistant on your website that gives visitors a free quote on the spot, day or night, while your team can still review and approve every quote before it is final.",
  },
];

const PLATFORM_GROUPS = [
  {
    title: "Run it",
    items: [
      "Both agents live and hosted, 24/7",
      "Hosting, security updates, and backups",
      "Model upgrades included as they are released",
      "300 quotes per month included, then $1 per additional quote",
    ],
  },
  {
    title: "Keep it accurate",
    items: [
      "Quarterly price book update (materials and labor)",
      "One small price change per month for single items",
      "Bug fixes always included",
    ],
  },
  {
    title: "Prove it",
    items: [
      "A monthly one page report: quotes generated, average time to quote, total value quoted",
    ],
  },
  {
    title: "Support",
    items: [
      "Email support, business hours, next business day response",
      "Your price book data is yours, export available on request",
    ],
  },
];

const NOT_INCLUDED = [
  "New service lines or trades added to the system (quoted as a project)",
  "New third party integrations (quoted as a project)",
  "Marketing campaigns and customer reactivation (available on higher tiers)",
];

const FAQS = [
  {
    question: "Is the quote really free for my customers?",
    answer:
      "Yes. A visitor answers a few questions on your website and receives a quote at no charge and with no obligation. It is the fastest way to turn a visitor into a lead with a real number attached.",
  },
  {
    question: "How accurate is it?",
    answer:
      "The engine calculates every quote from your price book and your rules. It does not guess prices. During the 90 day calibration period we compare its quotes against yours on real jobs and tune until they match.",
  },
  {
    question: "What does the $197 actually cover?",
    answer:
      "Hosting, usage, your quarterly price updates, the monthly report, and support. It starts after your 90 day calibration period ends.",
  },
  {
    question: "What if I add a new service?",
    answer: "We quote it as a one time project and add it to your price book.",
  },
];

export default function IntentQuotingSystemPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-16">
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
                Intent Quoting System
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Your customers get a free quote in minutes. You get your evenings back.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-foreground/80">
                The Intent Quoting System is an AI quoting agent built on your own price book. A customer on your website answers a few questions and receives a real quote in minutes, free, any time of day. Your team gets the same speed for the quotes they send, without the hours of measuring, math, and typing.
              </p>
              <div className="mt-8">
                <Link
                  href={CONTACT_TARGET}
                  className="inline-flex items-center justify-center rounded-xl bg-accent px-7 py-4 text-lg font-semibold text-black shadow-[0_0_28px_rgba(34,211,238,0.28)] transition-colors hover:bg-cyan-300"
                >
                  Book a walkthrough
                </Link>
                <p className="mt-3 text-sm text-foreground/60">
                  We show you how it prices two of your real jobs. No pitch deck.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-accent/30 bg-card/85 p-5 shadow-[0_0_64px_rgba(34,211,238,0.12)] sm:p-7">
              <div className="rounded-2xl border border-white/10 bg-oled p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="font-semibold text-white">Free quote</p>
                    <p className="mt-1 text-xs text-muted">Available any time of day</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    Online
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {["What do you need quoted?", "A few job details", "Your quote in minutes"].map(
                    (item, index) => (
                      <div key={item} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs text-accent">
                          {index + 1}
                        </span>
                        <span className="text-sm text-foreground/80">{item}</span>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-5 rounded-xl border border-accent/25 bg-accent/10 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
                    Built from your price book
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/75">
                    The engine does the math. The AI never invents a price.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-card/45 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              The problem
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">
              Quoting takes your time and gives the customer time to call somebody else.
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {PROBLEMS.map((problem, index) => (
                <article key={problem} className="rounded-2xl border border-white/10 bg-oled/70 p-6">
                  <span className="font-mono text-sm text-accent">0{index + 1}</span>
                  <p className="mt-4 leading-7 text-foreground/80">{problem}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Your prices, your rules, and less time spent building quotes.
            </h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <article key={step.title} className="rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-7">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-sm text-accent">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/70">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Build it, calibrate it, and keep it running.
              </h2>
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl border border-accent/35 bg-card/90 shadow-[0_0_64px_rgba(34,211,238,0.1)]">
              <div className="grid border-b border-white/10 lg:grid-cols-3">
                <PricingPart
                  part="Part A"
                  title="Implementation"
                  price="$7,000"
                  timing="one time"
                  body="Includes the price book build, the internal and customer facing agents, setup on your website, and team onboarding."
                />
                <PricingPart
                  part="Part B"
                  title="Calibration"
                  price="$1,000"
                  timing="per month for the first 90 days"
                  body="Includes calibration against your real jobs, team training, and unlimited price tweaks while we tune."
                />
                <PricingPart
                  part="Part C"
                  title="Platform"
                  price="$197"
                  timing="per month after the first 90 days"
                  body="Keeps both agents running, accurate, measured, and supported."
                  accent
                />
              </div>

              <div className="p-6 sm:p-8 lg:p-10">
                <h3 className="text-2xl font-semibold">Platform plan includes</h3>
                <div className="mt-7 grid gap-8 md:grid-cols-2">
                  {PLATFORM_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h4 className="text-lg font-semibold text-accent">{group.title}</h4>
                      <IncludedList items={group.items} />
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-2xl border border-white/10 bg-black/25 p-6">
                  <h3 className="text-lg font-semibold">Not included in the platform plan</h3>
                  <IncludedList items={NOT_INCLUDED} muted />
                </div>

                <p className="mt-7 text-center font-semibold text-foreground/85">
                  Platform plan can be prepaid annually at $1,970, two months free.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-card/45 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Questions owners ask first.</h2>
            <div className="mt-8 space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group rounded-xl border border-white/10 bg-oled/75 p-5 open:border-accent/30">
                  <summary className="cursor-pointer list-none pr-8 font-semibold text-foreground marker:hidden">
                    {faq.question}
                  </summary>
                  <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-7 text-foreground/70">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-3xl border border-accent/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.13),rgba(2,6,23,0.92))] p-8 sm:p-12">
            <h2 className="text-3xl font-semibold sm:text-5xl">Send the quote first, every time.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-foreground/75">
              Book a walkthrough and watch the Intent Quoting System price two of your real jobs.
            </p>
            <Link
              href={CONTACT_TARGET}
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-accent px-7 py-4 text-lg font-semibold text-black shadow-[0_0_28px_rgba(34,211,238,0.28)] transition-colors hover:bg-cyan-300"
            >
              Book a walkthrough
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PricingPart({
  part,
  title,
  price,
  timing,
  body,
  accent = false,
}: {
  part: string;
  title: string;
  price: string;
  timing: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div className={`p-6 sm:p-8 ${accent ? "bg-accent/10" : ""} border-b border-white/10 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0`}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{part}</p>
      <h3 className="mt-3 text-xl font-semibold">{title}</h3>
      <p className="mt-5 text-4xl font-semibold text-white">{price}</p>
      <p className="mt-2 text-sm text-muted">{timing}</p>
      <p className="mt-5 text-sm leading-7 text-foreground/70">{body}</p>
    </div>
  );
}

function IncludedList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item} className={`flex gap-3 text-sm leading-6 ${muted ? "text-foreground/60" : "text-foreground/75"}`}>
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${muted ? "bg-muted" : "bg-accent"}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
