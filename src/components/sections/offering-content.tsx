"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  LightningIcon,
  TargetIcon,
  AtomIcon,
  DispatcherIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const GOLD_CARD =
  "border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/[0.22] via-[rgba(2,6,23,0.90)] to-card shadow-[0_0_48px_rgba(217,169,65,0.2)] hover:border-amber-300/70 hover:shadow-[0_0_56px_rgba(217,169,65,0.28)]";
const GOLD_ICON = "bg-amber-500/25 text-amber-200";
const GOLD_BADGE = "bg-amber-500/30 text-amber-100 border-amber-400/45";
const GOLD_SUBLABEL = "text-amber-200/90";
const STANDARD_CARD =
  "border-2 border-border bg-card hover:border-accent/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]";

type PackageItem = {
  title: string;
  description: string;
  Icon: typeof AtomIcon;
  badge: string;
  variant: "standard" | "gold";
  kicker?: string;
};

const REVENUE_ITEM: PackageItem = {
  title: "Revenue Streams",
  description:
    "We work on your behalf to find and grow high-value revenue inside your trade business—demand, conversion, ticket size, and repeat work. Not vanity metrics: booked jobs and measurable outcomes.",
  Icon: AtomIcon,
  badge: "Core",
  variant: "gold",
  kicker: "#1 — Strategy & growth",
};

const SOFTWARE_ITEM: PackageItem = {
  title: "We Build Your Application & Software",
  description:
    "We design and build custom software for your trade business. Your conversion site, speed-to-lead & intake automation (forms, missed-call SMS, after-hours, follow-up), AI voice qualification when your team can't answer, and an analytics dashboard built for how you operate. Phone-first, not bot-first.",
  Icon: LightningIcon,
  badge: "We Build It",
  variant: "gold",
  kicker: "#2 — Custom-built for your business",
};

const ORGANIC_ITEM: PackageItem = {
  title: "Google Search — Organic Growth",
  description:
    "We do everything in our power to grow you at an exceptional pace organically—geo-targeted landing pages, local SEO, content, and search strategy on Google. Organic-first, always: the foundation everything else builds on.",
  Icon: TargetIcon,
  badge: "Organic",
  variant: "standard",
};

const PAID_ADS_ITEM: PackageItem = {
  title: "Paid Ads & Content",
  description:
    "Content creation and Google ad campaigns when you need paid lift—creative, targeting, and management built for trades. Complements organic growth; we run ads to accelerate, not to replace ranking the right way.",
  Icon: DispatcherIcon,
  badge: "Paid ads",
  variant: "standard",
};

const PARTNERSHIP_ITEM: PackageItem = {
  title: "Ongoing Partnership",
  description:
    "We stay in the work with you—optimization, reporting reviews, and adjustments as your markets and seasons shift.",
  Icon: AtomIcon,
  badge: "Support",
  variant: "standard",
};

const INCLUSIONS = [
  "Revenue stream discovery & growth—we map underused opportunities and grow the revenue streams that matter most",
  "We build your Intent application & software—custom site, intake automation, and an analytics dashboard built for your trade business",
  "Speed-to-lead & intake automation (forms, missed-call recovery, SMS, after-hours, follow-up)",
  "AI voice qualification & appointment booking when your team can't answer—not on every inbound call",
  "Google Search organic growth—we push exceptional organic pace: local SEO, landing pages, and content",
  "Paid ads & content creation—we produce creative and run Google campaigns that complement organic",
  "Ongoing optimization & support",
];

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};

function PackageCard({ pkg }: { pkg: PackageItem }) {
  const isGold = pkg.variant === "gold";
  return (
    <motion.article
      variants={item}
      whileHover={{ scale: isGold ? 1.01 : 1.02 }}
      className={cn(
        "group rounded-xl p-5 sm:p-6 lg:p-8 transition-all duration-300 min-w-0",
        isGold ? GOLD_CARD : STANDARD_CARD
      )}
    >
      <div className="mb-4 flex flex-col gap-3 min-w-0">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div
            className={cn(
              "p-2 sm:p-2.5 rounded-xl transition-colors shrink-0",
              isGold ? GOLD_ICON : "bg-accent/15 text-accent group-hover:bg-accent/25"
            )}
          >
            <pkg.Icon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg sm:text-xl font-display font-semibold text-foreground leading-snug break-words">
              {pkg.title}
            </h3>
            {pkg.kicker && (
              <p
                className={cn(
                  "mt-1.5 text-[11px] sm:text-xs font-mono uppercase tracking-wider leading-relaxed break-words",
                  GOLD_SUBLABEL
                )}
              >
                {pkg.kicker}
              </p>
            )}
          </div>
        </div>
        <span
          className={cn(
            "self-start max-w-full px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono font-medium border whitespace-nowrap",
            isGold ? GOLD_BADGE : "bg-accent/20 text-accent border-accent/30"
          )}
        >
          {pkg.badge}
        </span>
      </div>
      <p
        className={cn(
          "leading-relaxed text-sm sm:text-base lg:text-lg",
          isGold ? "text-foreground/95" : "text-foreground/85"
        )}
      >
        {pkg.description}
      </p>
    </motion.article>
  );
}

export function OfferingContent() {
  return (
    <main className="pt-24 pb-16">
      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 1, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl font-display font-semibold tracking-tight text-foreground"
          >
            The <span className="text-accent drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">Intent</span> Package
          </motion.h1>
          <motion.p
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Built for contractors and the trades. We map and grow high-value
            revenue streams—then we build the Intent application, grow you
            organically at an exceptional pace, and run paid ads & content when
            it accelerates the plan.
          </motion.p>
        </div>
      </section>

      {/* What's Included — explicit layout for even spacing */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-4 text-foreground"
          >
            What&apos;s Included
          </motion.h2>
          <motion.p
            initial={{ opacity: 1, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center text-foreground/80 max-w-2xl mx-auto mb-12 text-base sm:text-lg"
          >
            Strategy first—then we build the software. Organic growth is the
            priority; paid ads and content amplify when you need more lift.
          </motion.p>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="flex flex-col gap-6"
          >
            <PackageCard pkg={REVENUE_ITEM} />
            <PackageCard pkg={SOFTWARE_ITEM} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <PackageCard pkg={ORGANIC_ITEM} />
              <PackageCard pkg={PAID_ADS_ITEM} />
              <PackageCard pkg={PARTNERSHIP_ITEM} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Full Package Overview — static list (no motion y-offset; keeps even spacing) */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center mb-10 text-foreground">
            Full Package Overview
          </h2>
          <ul className="list-none m-0 p-0 space-y-6">
            {INCLUSIONS.map((inclusion, i) => (
              <li
                key={inclusion}
                className="flex items-start sm:items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card/50 px-4 sm:px-5 py-4 sm:py-5 transition-all duration-300 hover:border-accent/30 hover:bg-card/80"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-sm">
                  {i + 1}
                </span>
                <span className="text-foreground/95 font-medium text-sm sm:text-base lg:text-lg leading-relaxed min-w-0">
                  {inclusion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 1, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-foreground">
            Ready to grow revenue—not just traffic?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            Get a free quote. We&apos;ll map revenue opportunities and what we
            will build for your trade business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#get-in-touch"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg bg-accent text-black hover:bg-accent/90 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              >
                Get a Free Quote
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
