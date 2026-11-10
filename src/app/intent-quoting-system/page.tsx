import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { Header } from "@/components/sections/header";
import { SITE_URL } from "@/lib/seo";

const CONTACT_TARGET = "/#get-in-touch";

export const metadata: Metadata = {
  title: {
    absolute:
      "Quotes & Invoices Without the Paperwork | Intent Revenue",
  },
  description:
    "Describe the job. Review the quote or invoice. Approve delivery. Your prices and branding. $7,000 setup, $1,000/month for 3 months, then $197/month.",
  alternates: { canonical: `${SITE_URL}/intent-quoting-system` },
  openGraph: {
    title:
      "Quotes & Invoices Without the Paperwork | Intent Revenue",
    description:
      "Describe the job. Review the quote or invoice. Approve delivery. Your prices and branding. $7,000 setup, $1,000/month for 3 months, then $197/month.",
    url: `${SITE_URL}/intent-quoting-system`,
  },
};

const PROBLEMS = [
  "Your team has the job details, but someone still has to find the right prices, write up the work, and prepare the paperwork.",
  "Staff call the owner to check what to charge, which fees apply, or whether a discount is allowed.",
  "Finished jobs turn into evening paperwork when notes still need to become invoices.",
];

const USES = [
  {
    title: "Prepare a quote.",
    body: "Tell the assistant what the customer needs. It uses your approved prices, asks for missing details, and prepares a quote for your team to review.",
  },
  {
    title: "Text the work. Get an invoice draft.",
    body: "A technician texts what they finished. The assistant prepares an invoice with your branding. Your team reviews it before approving a customer link with a PDF download.",
  },
  {
    title: "Give website visitors a starting price.",
    body: "Visitors answer a few questions and get a free price range for services you approve. If the job needs a diagnosis or more details, the assistant collects the inquiry for your team.",
  },
];

const STEPS = [
  {
    title: "We organize how you charge.",
    body: "Share your price lists, past quotes, and company policies. We work with you to organize your services, prices, fees, and discounts, including the details your team usually has to ask you about.",
  },
  {
    title: "We teach it how your business works.",
    body: "We give the assistant your approved company information, job examples, and instructions for when to ask questions or involve your team. We add your branding, set who can approve and send paperwork, and show your staff how to use it. Software connections are agreed before setup.",
  },
  {
    title: "We check its work with you.",
    body: "Before your team starts using it, we test sample jobs against answers you approve. For the first three months, we review real jobs and corrections with you, adjust its instructions and pricing rules, and check the changes before putting them into use.",
  },
];

const PLATFORM_GROUPS = [
  {
    title: "Run it",
    items: [
      "Your team and website assistants available 24/7",
      "Hosting, security updates, and backups",
      "Assistant software updates included",
      "300 quotes per month included, then $1 per additional quote",
    ],
  },
  {
    title: "Keep it accurate",
    items: [
      "Quarterly update to your materials and labor prices",
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
      "Your pricing information belongs to you, with a copy available on request",
    ],
  },
];

const NOT_INCLUDED = [
  "Adding new types of services or trades (priced as a separate project)",
  "New connections to other business software (priced as a separate project)",
  "Marketing campaigns and customer reactivation (available on higher tiers)",
];

const FAQS = [
  {
    question: "Do my customers pay to get a price range?",
    answer:
      "No. Visitors can get a price range for the services you approve at no charge and with no obligation. If a final price needs an inspection, diagnosis, or more job details, the assistant explains the next step and collects the inquiry for your team.",
  },
  {
    question: "Where do the prices come from?",
    answer:
      "It calculates using the prices and charging rules you approve. If information is missing or a job falls outside those rules, it asks for details or passes it to your team for review. During the first three months, we check its work against your actual jobs and make adjustments with you.",
  },
  {
    question: "How do you teach the assistant about my business?",
    answer:
      "We collect your price lists, past jobs, company policies, and the details your team usually asks the owner about. Together, we turn them into approved information and clear instructions for the assistant. We test it on example jobs, check the prices and questions against answers you approve, and fine-tune it with you during the first three months. Changes to your standard prices or policies need your approval before they take effect.",
  },
  {
    question: "Can a technician really text in an invoice?",
    answer:
      "A technician can text what they completed. The assistant uses the available job details and your approved prices to prepare an invoice draft, asking for anything missing. Your team reviews and approves it before the customer receives a branded invoice link with a PDF download.",
  },
  {
    question: "Is it set up specifically for my company?",
    answer:
      "Yes. Your setup uses your prices, company policies, branding, and staff approval rules. We confirm the services it will handle and the connections to your existing software before setup begins.",
  },
  {
    question: "Do I need all my prices organized first?",
    answer:
      "No. Bring the price lists, spreadsheets, past quotes, and policies you already have. We help organize them and work through missing or conflicting information with you. You approve the prices and rules before your team uses them.",
  },
  {
    question: "What does the $197 actually cover?",
    answer:
      "It keeps your assistants running and includes hosting, software updates, backups, 300 quotes per month, quarterly price updates, one small monthly price change, reporting, and email support. Additional quotes are $1 each. The $197 monthly plan starts after the first 90 days.",
  },
  {
    question: "What if I add a new service?",
    answer: "We price the additional setup as a separate project and add the new service to your approved prices and job questions.",
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
                Quotes and invoices without the paperwork.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-foreground/80">
                Give your team an assistant that knows your company&apos;s prices and how you charge for work. Tell it what the customer needs or what you finished. It prepares the quote or invoice, asks for any missing details, and lets your team review it before sending.
              </p>
              <p className="mt-5 font-semibold text-accent">
                Your prices. Your branding. Your approval.
              </p>
              <div className="mt-8">
                <Link
                  href={CONTACT_TARGET}
                  className="inline-flex items-center justify-center rounded-xl bg-accent px-7 py-4 text-lg font-semibold text-black shadow-[0_0_28px_rgba(34,211,238,0.28)] transition-colors hover:bg-cyan-300"
                >
                  Book a walkthrough
                </Link>
                <p className="mt-3 text-sm text-foreground/60">
                  See how a job description becomes a quote or invoice draft.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-accent/30 bg-card/85 p-5 shadow-[0_0_64px_rgba(34,211,238,0.12)] sm:p-7">
              <div className="rounded-2xl border border-white/10 bg-oled p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="font-semibold text-white">From work notes to invoice</p>
                    <p className="mt-1 text-xs text-muted">A simple text starts the paperwork</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    Example
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {["Describe the job", "Review the draft", "Approve delivery"].map(
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
                    A technician texts
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/75">
                    &ldquo;Jones job. Condenser wasn&apos;t working. Replaced capacitor.&rdquo;
                  </p>
                  <p className="mt-4 border-t border-accent/20 pt-4 text-sm leading-6 text-foreground/75">
                    The assistant checks the job details and your approved prices, asks for anything missing, and prepares a branded invoice for your team to review.
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
              Stop rebuilding the paperwork and answering every pricing question.
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

        <section className="px-4 pt-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              What it helps you do
            </p>
            <h2 className="mt-3 max-w-4xl text-3xl font-semibold sm:text-4xl">
              From the first price question to the finished job.
            </h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {USES.map((use) => (
                <article key={use.title} className="rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-7">
                  <h3 className="text-xl font-semibold">{use.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/70">{use.body}</p>
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
              We set it up. We check it with you. Your team starts using it.
            </h2>
            <p className="mt-5 max-w-3xl leading-7 text-foreground/70">
              Your setup uses your company&apos;s prices, policies, branding, and staff approval rules. We organize the details with you and show your team how to use the assistant in their day-to-day work.
            </p>
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
                Set it up, fine-tune it, and keep it running.
              </h2>
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl border border-accent/35 bg-card/90 shadow-[0_0_64px_rgba(34,211,238,0.1)]">
              <div className="grid border-b border-white/10 lg:grid-cols-3">
                <PricingPart
                  part="Part A"
                  title="Setup"
                  price="$7,000"
                  timing="one time"
                  body="We organize your prices and charging rules, teach the assistants how your business works, test example jobs with you, add your branding, and train your staff."
                />
                <PricingPart
                  part="Part B"
                  title="Fine-tuning with your team"
                  price="$1,000"
                  timing="per month for the first 90 days"
                  body="We review its work on real jobs, fine-tune its instructions and your approved pricing rules, help your team use it, and make unlimited price adjustments during this period."
                />
                <PricingPart
                  part="Part C"
                  title="Keep it running"
                  price="$197"
                  timing="per month after the first 90 days"
                  body="Keeps your assistants available, with hosting, maintenance, scheduled price updates, reporting, and support."
                  accent
                />
              </div>

              <div className="p-6 sm:p-8 lg:p-10">
                <p className="mb-8 text-sm leading-7 text-foreground/75">
                  Setup and the first three months of fine-tuning total $10,000. The $197 monthly plan starts after the first 90 days.
                </p>
                <h3 className="text-2xl font-semibold">Your ongoing plan includes</h3>
                <div className="mt-7 grid gap-8 md:grid-cols-2">
                  {PLATFORM_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h4 className="text-lg font-semibold text-accent">{group.title}</h4>
                      <IncludedList items={group.items} />
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-2xl border border-white/10 bg-black/25 p-6">
                  <h3 className="text-lg font-semibold">Separate projects and services</h3>
                  <IncludedList items={NOT_INCLUDED} muted />
                </div>

                <p className="mt-7 text-center font-semibold text-foreground/85">
                  Your ongoing plan can be prepaid annually at $1,970, two months free.
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
            <h2 className="text-3xl font-semibold sm:text-5xl">Less paperwork. Fewer pricing calls. More time for the work.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-foreground/75">
              See how your prices and company rules can help your team prepare quotes and invoices with less back-and-forth.
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
