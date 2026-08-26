"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { LEADNET_MONTHLY_CENTS, leadNetSprintCents } from "@/lib/engagements";

const COMPETITOR_STACK = [
  {
    category: "Speed-to-Lead & Missed Calls",
    tools: "Hatch / CHIIRP",
    setupCost: "$1,000 – $3,000",
    monthlyCost: "$450 – $900/mo",
    contract: "12-Month Lock-in",
    notes: "Per-conversation overages & annual contract trap",
  },
  {
    category: "5-Star Review Collection",
    tools: "Podium / Birdeye",
    setupCost: "$500 – $1,500",
    monthlyCost: "$299 – $599/mo",
    contract: "12-Month Lock-in",
    notes: "Mandatory annual lock-in & surprise renewal fees",
  },
  {
    category: "Database Reactivation & Campaigns",
    tools: "ServiceTitan Marketing Pro / Agency",
    setupCost: "$5,000 – $25,000",
    monthlyCost: "$500 – $2,000/mo",
    contract: "Annual / Long Retainer",
    notes: "Expensive enterprise add-on or agency markup",
  },
  {
    category: "Call Tracking & Routing",
    tools: "CallRail + Voice Assist",
    setupCost: "$0",
    monthlyCost: "$145 – $290/mo",
    contract: "Metered Usage",
    notes: "Billed per minute & per text with escalating tiers",
  },
];

const SALES_PILLARS = [
  {
    kicker: "NO CONTRACT TRAPS",
    title: "Zero 12-Month Lock-In",
    body: "No Sophisticated Contracts To Trap You In. Cancel Anytime",
    icon: (
      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    kicker: "RAPID DEPLOYMENT",
    title: "Speed & Zero Bloat",
    body: "No 8-Week Onboarding Hell. Time is Money. We Implement ASAP.",
    icon: (
      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    kicker: "INSTANT CONVERSION",
    title: "Sub-3-Second Response",
    body: "Customer Auto-Reply Before They Can Make It To The Competition.",
    icon: (
      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function LeadNetComparison() {
  const sprintCents = leadNetSprintCents();

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-accent/5 blur-[120px] pointer-events-none rounded-full"
        aria-hidden
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Built For Contractors · No Enterprise Traps
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-balance">
            Why Contractors Choose <span className="text-accent">LeadNet</span> Over Legacy Software
          </h2>
        </div>

        {/* 3 Core Sales Pillars */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {SALES_PILLARS.map((pillar) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-accent/40 bg-card/85 p-6 sm:p-7 flex flex-col justify-between hover:border-accent transition-colors shadow-lg shadow-black/20"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                  {pillar.icon}
                </div>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                  {pillar.kicker}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
                  {pillar.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* All-in-One Consolidation & Price Comparison Visual */}
        <div className="mt-16 sm:mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              Total Cost of Ownership Teardown
            </p>
            <h3 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-semibold">
              Them Vs. Us
            </h3>
            <p className="mt-2 text-sm text-foreground/70">
              See what contractors actually pay to assemble this functionality across multiple vendors.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Box: The Fragmented Competitor Stack */}
            <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-oled/90 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border/70 pb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-mono font-medium text-red-400 border border-red-500/20">
                      Disjointed Multi-Tool Stack
                    </span>
                    <h4 className="mt-2 text-xl font-semibold text-foreground">
                      4+ Vendors, 4 Logins, Zero Synergy
                    </h4>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {COMPETITOR_STACK.map((item) => (
                    <div
                      key={item.category}
                      className="rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-border"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                        <div>
                          <p className="text-xs sm:text-[13px] font-mono uppercase tracking-wider text-zinc-200 font-medium">
                            {item.category}
                          </p>
                          <p className="mt-0.5 text-lg sm:text-xl font-bold text-white tracking-tight">
                            {item.tools}
                          </p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-base sm:text-lg font-bold text-red-400">
                            {item.monthlyCost}
                          </p>
                          <p className="text-xs font-mono text-zinc-300">
                            Setup: {item.setupCost}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-300/90 border-t border-border/40 pt-2 flex flex-wrap items-center justify-between gap-1">
                        <span>{item.notes}</span>
                        <span className="text-red-400 font-semibold">{item.contract}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stack Totals Summary */}
              <div className="mt-6 pt-5 border-t border-border/80 bg-red-950/20 rounded-xl p-4 border border-red-900/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono uppercase text-muted tracking-wider">
                      Estimated First-Year Cost
                    </p>
                    <p className="text-2xl sm:text-3xl font-semibold text-red-400 tracking-tight">
                      $20,400 – $55,000+
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted">Monthly Recurring Spend</p>
                    <p className="text-base font-semibold text-foreground">
                      $1,494 – $3,789 / month
                    </p>
                    <p className="text-[11px] text-red-300 font-mono">
                      Plus $2,500 – $10,000+ in setup fees
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Intent LeadNet All-In-One */}
            <div className="lg:col-span-5 rounded-2xl border-2 border-accent bg-gradient-to-b from-card via-card to-accent/10 p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_35px_rgba(34,211,238,0.2)] relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-oled px-4 py-1 rounded-full text-xs font-mono uppercase tracking-wider font-bold shadow-lg">
                Contractor Favorite · All-In-One
              </div>

              <div>
                <div className="border-b border-accent/30 pb-4 pt-1">
                  <h4 className="text-2xl font-bold text-foreground">
                    Intent <span className="text-accent">LeadNet</span>
                  </h4>
                  <p className="text-xs font-mono text-accent uppercase tracking-wider mt-1">
                    Complete Revenue Capture &amp; Reactivation Stack
                  </p>
                </div>

                <ul className="mt-6 space-y-3.5">
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">LiveWire Engine:</strong> Sub-3s missed-call text-back &amp; smart triage.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">RevSurge Engine:</strong> 1-click dormant database reactivation drips.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">AutoSet Engine:</strong> Automated 5-star Google review collection &amp; follow-up.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">Speed-to-Lead Webhooks:</strong> Instant Angi &amp; Google LSA auto-replies.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">Priority Mobile Intake:</strong> Estimates job value without tech typing.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <div className="rounded-full bg-accent/20 p-1 text-accent mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>
                      <strong className="text-foreground font-semibold">All Included:</strong> Tracking number, texts, &amp; hosting bundled.
                    </span>
                  </li>
                </ul>
              </div>

              {/* LeadNet Pricing Callout */}
              <div className="mt-8 pt-5 border-t border-accent/40 bg-accent/10 rounded-xl p-4 border border-accent/30">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs uppercase text-accent tracking-wider font-semibold">
                    Setup Sprint
                  </span>
                  <span className="text-3xl sm:text-4xl font-bold text-accent tracking-tight">
                    {formatCurrency(sprintCents)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-accent/20">
                  <span className="text-xs text-foreground/80">
                    Monthly Retainer (Starts after 30 days)
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(LEADNET_MONTHLY_CENTS)}/mo
                  </span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-200 font-mono">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No 12-Month Lock-in · Cancel Anytime
                </div>
              </div>

              <a
                href="#start-leadnet"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-oled drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:bg-cyan-300 transition-colors"
              >
                Claim Your LeadNet System
              </a>
            </div>
          </div>

          {/* Bottom Value Banner & Legal Trademark Disclaimer */}
          <div className="mt-8 rounded-xl border border-accent/30 bg-card/60 p-5 sm:p-6 text-center">
            <p className="text-base sm:text-lg font-medium text-foreground">
              ⚡ <strong className="text-accent">Save over $1,200/month</strong> while eliminating tool
              switching, technician confusion, and annual contract traps.
            </p>
            <p className="mt-3 text-[11px] text-muted leading-relaxed max-w-4xl mx-auto">
              * Competitor product names, logos, and trademarks (including Hatch, Podium, Birdeye, ServiceTitan, CallRail, and CHIIRP) belong to their respective owners and are referenced solely for comparative pricing and feature analysis based on public rate cards and contractor-reported market data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
