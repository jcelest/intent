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
import { BRAND_NAME } from "@/lib/seo";
import {
  CaptureFlowVisual,
  InclusionMark,
  OrganicSearchVisual,
  PackageHeroVisual,
  PaidAdsVisual,
  PartnershipVisual,
  RevenueStreamsVisual,
  SoftwareStackVisual,
} from "@/components/visuals/package-visuals";

const GOLD_CARD =
  "border-2 border-amber-500/45 bg-gradient-to-br from-amber-600/40 via-amber-900/88 to-amber-950/95 shadow-[0_0_48px_rgba(217,169,65,0.2)] hover:border-amber-400/65 hover:shadow-[0_0_56px_rgba(217,169,65,0.28)]";
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
  Visual: typeof RevenueStreamsVisual;
};

const REVENUE_ITEM: PackageItem = {
  title: "Revenue Streams",
  description:
    "We work on your behalf to find and grow high-value revenue inside your trade business: demand, conversion, ticket size, and repeat work. Not vanity metrics: booked jobs and measurable outcomes.",
  Icon: AtomIcon,
  badge: "Core",
  variant: "gold",
  kicker: "#1: Strategy & growth",
  Visual: RevenueStreamsVisual,
};

const SOFTWARE_ITEM: PackageItem = {
  title: "We Build Your Application & Software",
  description:
    "We design and build custom software for your trade business. Your conversion site, speed-to-lead & intake automation (forms, missed-call SMS, after-hours, follow-up), AI voice qualification when your team can't answer, and an analytics dashboard built for how you operate. We integrate with your CRM, business email, scheduling tools, and ad accounts. Phone-first, not bot-first.",
  Icon: LightningIcon,
  badge: "We Build It",
  variant: "gold",
  kicker: "#2: Custom-built for your business",
  Visual: SoftwareStackVisual,
};

const ORGANIC_ITEM: PackageItem = {
  title: "Google Search: Organic Growth",
  description:
    "We do everything in our power to grow you at an exceptional pace organically: geo-targeted landing pages, local SEO, content, and search strategy on Google. Organic-first, always: the foundation everything else builds on.",
  Icon: TargetIcon,
  badge: "Organic",
  variant: "standard",
  Visual: OrganicSearchVisual,
};

const PAID_ADS_ITEM: PackageItem = {
  title: "Paid Ads & Content",
  description:
    "Content creation and Google ad campaigns when you need paid lift: creative, targeting, and management built for trades. Complements organic growth; we run ads to accelerate, not to replace ranking the right way.",
  Icon: DispatcherIcon,
  badge: "Paid ads",
  variant: "standard",
  Visual: PaidAdsVisual,
};

const PARTNERSHIP_ITEM: PackageItem = {
  title: "Ongoing Partnership",
  description:
    "We stay in the work with you: optimization, reporting reviews, and adjustments as your markets and seasons shift.",
  Icon: AtomIcon,
  badge: "Support",
  variant: "standard",
  Visual: PartnershipVisual,
};

const INCLUSIONS = [
  "Partnership qualification: we assess fit on job volume, Google Reviews, territory, growth investment, and owner engagement before we start",
  "Revenue stream discovery & growth: we map underused opportunities and grow the revenue streams that matter most",
  `We build your ${BRAND_NAME} application & software: custom site, intake automation, and an analytics dashboard built for your trade business`,
  "Speed-to-lead & intake automation (forms, missed-call recovery, SMS, after-hours, follow-up)",
  "Google Reviews & Google Business Profile: post-job review capture straight to Google, profile optimization, and reputation tracking",
  "Google Search organic growth: we push exceptional organic pace on local SEO, landing pages, and content",
  "Paid ads & content creation: we produce creative and run Google campaigns that complement organic",
  "Deep business integration: we work inside your CRM, business email, scheduling software, and ad accounts to facilitate real change",
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
      <div className="mt-6 opacity-90">
        <pkg.Visual tone={isGold ? "gold" : "cyan"} />
      </div>
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
            The <span className="text-accent drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">{BRAND_NAME}</span> Package
          </motion.h1>
          <motion.p
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Built for contractors and the trades. {BRAND_NAME} maps and grows high-value
            revenue streams. Then we build your application, grow you
            organically at an exceptional pace, and run paid ads & content when
            it accelerates the plan.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-12 max-w-4xl mx-auto"
          >
            <PackageHeroVisual />
          </motion.div>
        </div>
      </section>

      {/* What's Included: explicit layout for even spacing */}
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
            Strategy first, then we build the software. Organic growth is the
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

      {/* Full Package Overview: static list (no motion y-offset; keeps even spacing) */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-center mb-4 text-foreground">
            Full Package Overview
          </h2>
          <p className="text-center text-foreground/80 max-w-2xl mx-auto mb-10 text-base sm:text-lg leading-relaxed">
            Full partnership is selective. {BRAND_NAME} only takes contractors we can guarantee
            results for, and we need inside your operation to make it happen. Every
            item below is part of the complete {BRAND_NAME} package for qualified operators.
          </p>
          <ul className="list-none m-0 p-0 space-y-6">
            {INCLUSIONS.map((inclusion) => (
              <li
                key={inclusion}
                className="flex items-start sm:items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card/50 px-4 sm:px-5 py-4 sm:py-5 transition-all duration-300 hover:border-accent/30 hover:bg-card/80"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <InclusionMark />
                </span>
                <span className="text-foreground/95 font-medium text-sm sm:text-base lg:text-lg leading-relaxed min-w-0">
                  {inclusion}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-12 rounded-xl border-2 border-amber-500/35 bg-gradient-to-br from-amber-600/15 via-amber-900/30 to-amber-950/50 p-6 sm:p-8">
            <h3 className="text-lg sm:text-xl font-display font-semibold text-amber-100">
              Not qualified yet? Start with Intent Launchpad
            </h3>
            <p className="mt-3 text-sm sm:text-base text-amber-100/80 leading-relaxed">
              If you&apos;re still building Google Reviews, intake infrastructure, or
              job volume, Launchpad gets you there: post-job Google review capture,
              Google Business Profile build-out, intake basics, and monthly milestones
              until you graduate to full partnership.
            </p>
            <Link
              href="/qualification#intent-launchpad"
              className="mt-5 inline-block font-mono text-sm text-amber-200 hover:text-amber-100 transition-colors"
            >
              See Intent Launchpad →
            </Link>
          </div>
          <div className="mt-8 rounded-xl border-2 border-accent/30 bg-accent/5 p-6 sm:p-8">
            <h3 className="text-lg sm:text-xl font-display font-semibold text-accent">
              Launching now: Intent LeadNet
            </h3>
            <p className="mt-3 text-sm sm:text-base text-foreground/80 leading-relaxed">
              Missed-call text-back, lead intake, owner alerts, Google review
              SMS, and a company dashboard. $1,397 to start, then $197/month after
              30 days. Every lead stays in. Your Company gets its own app.
              Custom styling is $350. No watermark is $250. Keep the public
              number with a private second line you pay the carrier for, or put
              the tracking number on Google and keep the phone as it is.
            </p>
            <div className="mt-5 opacity-90">
              <CaptureFlowVisual />
            </div>
            <Link
              href="/leadnet"
              className="mt-5 inline-block font-mono text-sm text-accent hover:underline"
            >
              See Intent LeadNet →
            </Link>
          </div>
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
            Ready to grow revenue, not just traffic?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            Apply for full partnership or start with Launchpad. {BRAND_NAME} will assess fit
            and map what we build for your trade business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#get-in-touch"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg bg-accent text-black hover:bg-accent/90 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              >
                Apply for Partnership
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/begin?path=launchpad"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg border-2 border-amber-400/50 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 transition-colors"
              >
                Start with Launchpad
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
