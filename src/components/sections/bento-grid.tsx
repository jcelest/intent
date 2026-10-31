"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/seo";
import {
  LightningIcon,
  TargetIcon,
  AtomIcon,
  DispatcherIcon,
} from "@/components/ui/icons";
import {
  OrganicSearchVisual,
  PaidAdsVisual,
  RevenueStreamsVisual,
  SoftwareStackVisual,
} from "@/components/visuals/package-visuals";

const BENTO_ITEMS = [
  {
    title: "Turn More Opportunities Into Revenue",
    description:
      "Find where demand, follow-up, close rate, maintenance agreements, and repeat work are leaving money on the table, then improve the path forward.",
    Icon: AtomIcon,
    span: "col-span-1 row-span-2",
    accent: false,
    gold: true,
    kicker: "Outcome: more valuable work",
    Visual: RevenueStreamsVisual,
  },
  {
    title: "Give Customers A Faster, Better Experience",
    description:
      "Use a clear website, faster intake, speed-to-lead follow-up, and helpful automation so customers get answers and your team gets better opportunities.",
    Icon: LightningIcon,
    span: "col-span-1 row-span-2",
    accent: false,
    gold: true,
    kicker: "Outcome: more trust and faster response",
    Visual: SoftwareStackVisual,
  },
  {
    title: "Earn Trust Before The First Call",
    description:
      "Show up with useful service and location content that helps the right customer understand your business before they ever pick up the phone.",
    Icon: TargetIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    gold: false,
    kicker: "Outcome: stronger qualified demand",
    Visual: OrganicSearchVisual,
  },
  {
    title: "Put Budget Behind What Works",
    description:
      "Use paid campaigns when they support a clear offer, a strong customer experience, and a measurable path from attention to real opportunity.",
    Icon: DispatcherIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    gold: false,
    kicker: "Outcome: purposeful growth spend",
    Visual: PaidAdsVisual,
  },
];

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

export function BentoGrid() {
  return (
    <section
      id="how-it-works"
      className="relative py-24 px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold">
          Growth customers can <span className="text-accent">feel and trust</span>
        </h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          {BRAND_NAME} connects strategy, customer experience, search, software, and paid growth to the outcomes that matter: better opportunities, faster response, more booked work, and clearer revenue decisions.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
      >
        {BENTO_ITEMS.map((bento) => (
          <motion.article
            key={bento.title}
            variants={item}
            className={cn(
              "rounded-xl border p-5 sm:p-6 lg:p-8 transition-all duration-300 min-w-0",
              bento.gold
                ? "border-2 border-amber-500/45 bg-gradient-to-br from-amber-600/40 via-amber-900/88 to-amber-950/95 shadow-[0_0_40px_rgba(217,169,65,0.18)] hover:border-amber-400/65 hover:shadow-[0_0_48px_rgba(217,169,65,0.26)]"
                : "border-border bg-card hover:border-accent/50 hover:shadow-glow",
              bento.span
            )}
          >
            <div
              className={cn(
                "mb-4 flex items-center justify-start",
                bento.accent && "text-foreground drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]",
                bento.gold && "text-amber-200",
                !bento.gold && !bento.accent && "text-accent"
              )}
            >
              <bento.Icon accent={bento.gold || bento.accent} />
            </div>
            <h3 className="text-lg sm:text-xl font-display font-semibold text-foreground mb-2 leading-snug break-words">
              {bento.title}
            </h3>
            {"kicker" in bento && bento.kicker && (
              <p
                className={cn(
                  "text-[11px] sm:text-xs font-mono uppercase tracking-wider mb-2 leading-relaxed break-words",
                  bento.gold ? "text-amber-200/85" : "text-accent/80"
                )}
              >
                {bento.kicker}
              </p>
            )}
            <p className="text-muted text-sm sm:text-base leading-relaxed break-words">
              {bento.description}
            </p>
            <div className="mt-4">
              <bento.Visual tone={bento.gold ? "gold" : "cyan"} />
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
