"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LEADNET_FOLLOW_UP,
  WEBSITE_INCLUDED,
  WEBSITE_PACKAGES,
  calculateLeadNetOrder,
  type WebsitePackageId,
  type WebsitePaymentMode,
} from "@/lib/leadnet-offer";
import { cn, formatCurrency } from "@/lib/utils";
import { LeadNetDemoVideo } from "@/components/sections/leadnet-demo-video";
import { BRAND_NAME } from "@/lib/seo";

const PROCESS = [
  "Confirm the page list, services, service areas, and access needed.",
  "Build the site around verified business information and a repeatable design system.",
  "Review two consolidated prelaunch revision rounds.",
  "Launch after approval, with hosting handled by the selected plan or by the customer.",
];

const FAQS = [
  {
    question: "Is LeadNet included in the website price?",
    answer:
      "No. LeadNet Speed To Lead is optional software at $197/month. Standard setup is included for website customers, and billing begins only when LeadNet is activated.",
  },
  {
    question: "Do monthly website plans have a minimum term?",
    answer:
      "No. Monthly website customers can cancel future renewals anytime. Service continues through the paid billing period and hosting ends afterward unless a separate transition is arranged.",
  },
  {
    question: "Do upfront buyers have to keep paying for hosting?",
    answer:
      "No. Upfront buyers can arrange their own hosting. Optional Website Care is $49/month and starts only when hosting service is activated.",
  },
  {
    question: "Is this ongoing SEO management?",
    answer:
      "No. The website includes an initial search-ready foundation, titles, descriptions, crawlable content, sitemap, and appropriate structured data. Ongoing SEO management and ranking campaigns are separate work.",
  },
];

export function CaptureContent() {
  const [packageId, setPackageId] = useState<WebsitePackageId>("business");
  const [paymentMode, setPaymentMode] = useState<WebsitePaymentMode>("monthly");
  const [leadNetSelected, setLeadNetSelected] = useState(false);
  const [careSelected, setCareSelected] = useState(false);

  const order = useMemo(
    () =>
      calculateLeadNetOrder({
        packageId,
        paymentMode,
        leadNetSelected,
        careSelected,
      }),
    [careSelected, leadNetSelected, packageId, paymentMode]
  );

  const beginHref = `/begin?package=${packageId}&mode=${paymentMode}&leadnet=${
    leadNetSelected ? "1" : "0"
  }&care=${paymentMode === "upfront" && careSelected ? "1" : "0"}`;

  return (
    <main className="pt-24 pb-16">
      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-xs uppercase tracking-[0.2em] text-accent"
            >
              Websites first. Follow-up when you want it.
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
            >
              A better website. A simpler way to turn inquiries into customers.
            </motion.h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/80">
              {BRAND_NAME} builds professional business websites with a search-ready
              foundation. Add LeadNet Speed To Lead only if you want texting, intake,
              replies, and review-request tools after the website order.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-semibold text-oled hover:bg-cyan-300"
              >
                Configure pricing
              </a>
              <a
                href="#portfolio"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 font-semibold text-foreground hover:border-accent/60"
              >
                See example
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-accent/35 bg-card/85 p-5 shadow-[0_0_48px_rgba(34,211,238,0.12)]">
            <div className="aspect-[16/10] overflow-hidden rounded-lg border border-white/10 bg-oled">
              <div className="grid h-full grid-rows-[auto_1fr]">
                <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                    Business website preview
                  </span>
                </div>
                <div className="grid content-between bg-[linear-gradient(135deg,#020617,#062f3a_52%,#0f172a)] p-6">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200">
                      Search-ready foundation
                    </p>
                    <p className="mt-3 max-w-sm text-3xl font-semibold leading-tight">
                      Clear services. Easy contact. Built to be found.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Inquiry form", "Click-to-call", "Sitemap"].map((item) => (
                      <div key={item} className="rounded-md border border-white/15 bg-white/8 p-3 text-xs text-foreground/80">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground/70">
              Managed monthly plans include hosting, maintenance, and up to 30
              minutes of content edits per month. Upfront buyers can add care or
              host elsewhere.
            </p>
          </div>
        </div>
      </section>

      <section id="portfolio" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Portfolio example
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Novation HVAC</h2>
              <p className="mt-4 leading-relaxed text-foreground/75">
                A real local-business website example focused on clear service
                presentation, accessible contact paths, mobile-friendly layout,
                and a crawlable content foundation.
              </p>
              <Link
                href="https://novationhvac.com"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex font-semibold text-accent hover:underline"
              >
                Visit live website
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-card p-4">
              <div className="overflow-hidden rounded-lg border border-white/10 bg-oled shadow-[0_0_36px_rgba(34,211,238,0.1)]">
                <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 truncate font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                    novationhvac.com
                  </span>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden bg-white sm:aspect-[16/9]">
                  <iframe
                    title="Novation HVAC website preview"
                    src="https://novationhvac.com"
                    loading="lazy"
                    scrolling="no"
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="pointer-events-none h-full w-full border-0"
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-oled/35 to-transparent"
                    aria-hidden
                  />
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Shown as a portfolio reference. No testimonials, revenue figures,
                or sustained SEO-growth claims are made here.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold">What the website includes</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WEBSITE_INCLUDED.map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-card p-4 text-sm leading-relaxed text-foreground/78">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-12 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-xl border-2 border-accent/40 bg-card/90 p-5 sm:p-7">
            <h2 className="text-3xl font-semibold">Configure your website</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ToggleButton active={paymentMode === "monthly"} onClick={() => setPaymentMode("monthly")}>
                Monthly
              </ToggleButton>
              <ToggleButton active={paymentMode === "upfront"} onClick={() => setPaymentMode("upfront")}>
                Upfront
              </ToggleButton>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(Object.keys(WEBSITE_PACKAGES) as WebsitePackageId[]).map((id) => {
                const item = WEBSITE_PACKAGES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPackageId(id)}
                    className={`rounded-lg border p-5 text-left transition-colors ${
                      packageId === id
                        ? "border-accent bg-accent/12"
                        : "border-white/15 hover:border-accent/50"
                    }`}
                  >
                    <p className="text-lg font-semibold">{item.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/70">{item.summary}</p>
                    <p className="mt-4 text-2xl font-semibold text-accent">
                      {paymentMode === "monthly"
                        ? `${formatCurrency(item.monthly.setupCents)} + ${formatCurrency(item.monthly.recurringCents)}/mo`
                        : formatCurrency(item.upfrontCents)}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 space-y-3">
              <CheckRow
                checked={leadNetSelected}
                onChange={setLeadNetSelected}
                title="Add LeadNet Speed To Lead"
                detail={`${formatCurrency(LEADNET_FOLLOW_UP.monthlyCents)}/month beginning at activation. Includes one business texting number, inbox, owner replies, configured text-back and intake, review-request tools, and ${LEADNET_FOLLOW_UP.includedSmsSegments.toLocaleString()} SMS segments per billing month.`}
              />
              {paymentMode === "upfront" ? (
                <CheckRow
                  checked={careSelected}
                  onChange={setCareSelected}
                  title="Add Website Care"
                  detail="$49/month beginning when hosting service is activated. Includes hosting, technical maintenance, and up to 30 minutes of content edits per billing month."
                />
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-foreground/65">
                  Website Care is already part of monthly managed websites, so it is not
                  added as a second charge.
                </p>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-white/15 bg-oled p-5 sm:p-7">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Order summary
            </p>
            <p className="mt-4 text-sm uppercase tracking-[0.12em] text-muted">Due today</p>
            <p className="mt-1 text-5xl font-semibold text-accent">{formatCurrency(order.dueTodayCents)}</p>
            <div className="mt-5 space-y-3">
              {order.oneTimeCharges.map((charge) => (
                <Line key={charge.id} label={charge.label} amount={formatCurrency(charge.amountCents)} />
              ))}
            </div>
            {order.recurringWebsiteCharges.length ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="font-semibold">Website recurring</p>
                {order.recurringWebsiteCharges.map((charge) => (
                  <Line key={charge.id} label={charge.label} amount={`${formatCurrency(charge.amountCents)}/mo`} />
                ))}
              </div>
            ) : null}
            {order.activationCharges.length ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="font-semibold">Begins at activation</p>
                {order.activationCharges.map((charge) => (
                  <Line key={charge.id} label={charge.label} amount={`${formatCurrency(charge.amountCents)}/mo`} />
                ))}
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Future activation charges are not charged today. Billing dates may differ.
                </p>
              </div>
            ) : null}
            <div className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-foreground/70">
              <p>{order.ownershipSummary}</p>
              <p className="mt-3">{order.cancellationSummary}</p>
              <p className="mt-3">
                SMS overages are disabled by default. Additional SMS segments are
                $0.03 only within an expressly approved overage budget.
              </p>
            </div>
            <Link
              href={beginHref}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-6 py-4 text-lg font-semibold text-oled hover:bg-cyan-300"
            >
              Review agreement
            </Link>
          </aside>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-semibold">Optional LeadNet demonstration</h2>
          <p className="mt-3 text-foreground/75">
            LeadNet Speed To Lead is separate from the base website. It helps handle
            text-back, intake, replies, review requests, and self-service reactivation
            access where operational.
          </p>
          <div className="mt-6">
            <LeadNetDemoVideo />
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold">Build process</h2>
            <ol className="mt-6 space-y-3">
              {PROCESS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-foreground/75">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/60 font-mono text-xs text-accent">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-3xl font-semibold">FAQs</h2>
            <div className="mt-6 space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-white/10 bg-card p-4">
                  <summary className="cursor-pointer font-semibold">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold">Start with the website. Add follow-up when it fits.</h2>
        <a
          href="#pricing"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-oled hover:bg-cyan-300"
        >
          Configure order
        </a>
      </section>
    </main>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 font-semibold transition-colors ${
        active ? "border-accent bg-accent/15 text-accent" : "border-white/15 text-foreground/75"
      }`}
    >
      {children}
    </button>
  );
}

function CheckRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
        checked
          ? "border-accent bg-accent/12 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
          : "border-white/10 bg-black/20 hover:border-accent/45 hover:bg-black/30"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
          checked
            ? "border-accent bg-accent text-oled"
            : "border-white/25 bg-oled/70 group-hover:border-accent/60"
        )}
        aria-hidden
      >
        {checked ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
            <path
              d="M3.2 8.3 6.4 11.3 12.8 4.7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            />
          </svg>
        ) : null}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-foreground/65">{detail}</span>
      </span>
    </label>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-foreground/70">{label}</span>
      <span className="shrink-0 font-semibold text-foreground">{amount}</span>
    </div>
  );
}
