import { formatCurrency } from "@/lib/utils";
import {
  COMPETITOR_STACK,
  COMPETITOR_TOTALS,
  LEADNET_FEATURES,
} from "@/lib/leadnet-comparison-data";
import { LEADNET_MONTHLY_CENTS, leadNetSprintCents } from "@/lib/engagements";

function CheckIcon() {
  return (
    <svg className="w-5 h-5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Fixed 1080×1920 (9:16) social asset — Them Vs. Us pricing comparison */
export function LeadNetSocialComparison() {
  const sprintCents = leadNetSprintCents();

  return (
    <div
      className="relative overflow-hidden bg-black text-foreground select-none"
      style={{ width: 1080, height: 1920 }}
    >
      {/* Grid + glow background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col px-14 py-16">
        {/* Header */}
        <div className="text-center">
          <p className="font-mono text-[22px] uppercase tracking-[0.22em] text-accent">
            Intent LeadNet
          </p>
          <h1 className="mt-4 text-[72px] font-bold tracking-tight leading-none">
            Them <span className="text-accent">Vs.</span> Us
          </h1>
          <p className="mt-4 text-[26px] text-zinc-300 leading-snug">
            What contractors actually pay for the same stack
          </p>
        </div>

        {/* THEM — Fragmented stack */}
        <div className="mt-10 flex-1 rounded-[28px] border border-zinc-700/80 bg-zinc-950/90 p-8">
          <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 font-mono text-[18px] font-semibold uppercase tracking-wider text-red-400">
            Them · 4+ Vendors
          </span>

          <div className="mt-6 space-y-4">
            {COMPETITOR_STACK.map((item) => (
              <div
                key={item.tools}
                className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 px-6 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[17px] uppercase tracking-wider text-zinc-300">
                      {item.category}
                    </p>
                    <p className="mt-1 text-[32px] font-bold leading-tight text-white">
                      {item.tools}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[28px] font-bold text-red-400">{item.monthlyCost}</p>
                    <p className="mt-0.5 font-mono text-[16px] text-zinc-400">
                      Setup {item.setupCost}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-right font-mono text-[15px] font-semibold text-red-400/90">
                  {item.contract}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/30 px-6 py-5">
            <p className="font-mono text-[16px] uppercase tracking-wider text-zinc-400">
              Estimated first-year cost
            </p>
            <p className="mt-1 text-[44px] font-bold tracking-tight text-red-400">
              {COMPETITOR_TOTALS.firstYear}
            </p>
            <p className="mt-2 text-[24px] font-semibold text-zinc-200">
              {COMPETITOR_TOTALS.monthly}
            </p>
            <p className="font-mono text-[16px] text-red-300">{COMPETITOR_TOTALS.setupNote}</p>
          </div>
        </div>

        {/* VS divider */}
        <div className="my-6 flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <span className="rounded-full border border-accent/50 bg-accent/10 px-5 py-1.5 font-mono text-[20px] font-bold uppercase tracking-widest text-accent">
            Vs
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        </div>

        {/* US — LeadNet */}
        <div className="rounded-[28px] border-2 border-accent bg-gradient-to-b from-zinc-950 to-accent/10 p-8 shadow-[0_0_60px_rgba(34,211,238,0.25)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[38px] font-bold leading-tight">
                Intent <span className="text-accent">LeadNet</span>
              </p>
              <p className="mt-1 font-mono text-[16px] uppercase tracking-wider text-accent">
                All-in-one · No 12-month lock-in
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-4 py-2 font-mono text-[14px] font-bold uppercase tracking-wide text-black">
              Us
            </span>
          </div>

          <ul className="mt-6 space-y-3">
            {LEADNET_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-[22px] text-zinc-100">
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[16px] uppercase tracking-wider text-accent">
                Setup Sprint
              </span>
              <span className="text-[52px] font-bold text-accent">{formatCurrency(sprintCents)}</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-accent/25 pt-3">
              <span className="text-[18px] text-zinc-300">Monthly after 30 days</span>
              <span className="text-[36px] font-bold text-white">
                {formatCurrency(LEADNET_MONTHLY_CENTS)}/mo
              </span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <p className="text-[28px] font-semibold leading-snug">
            Save over{" "}
            <span className="text-accent">$1,200/month</span>
            {" "}vs. the fragmented stack
          </p>
          <p className="mt-3 font-mono text-[26px] font-semibold text-accent">
            intentrev.net/leadnet
          </p>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Competitor names used for comparative pricing only. Trademarks belong to their owners.
          </p>
        </div>
      </div>
    </div>
  );
}
