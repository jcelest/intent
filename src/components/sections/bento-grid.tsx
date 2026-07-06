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

const BENTO_ITEMS = [
  {
    title: "Revenue Streams",
    description:
      "We work on your behalf to find and grow high-value revenue: demand, conversion, maintenance agreements, and repeat work. Not just more clicks.",
    Icon: AtomIcon,
    span: "col-span-1 row-span-2",
    accent: false,
    gold: true,
    kicker: "#1: Strategy & growth",
    visual: null,
  },
  {
    title: "We Build Your Application & Software",
    description:
      "Custom site, speed-to-lead & intake automation, AI voice when your team can't answer, and an analytics dashboard built for your trade. Software we build for you, not off-the-shelf.",
    Icon: LightningIcon,
    span: "col-span-1 row-span-2",
    accent: false,
    gold: true,
    kicker: "#2: We build it for your trade",
    visual: "speed",
  },
  {
    title: "Google Search: Organic Growth",
    description:
      "We push exceptional organic pace: geo-targeted pages, local SEO, and content on Google. Organic-first, always.",
    Icon: TargetIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    gold: false,
    kicker: "Organic-first",
    visual: null,
  },
  {
    title: "Paid Ads & Content",
    description:
      "Content creation and Google ad campaigns that complement organic: creative, targeting, and management tied to leads.",
    Icon: DispatcherIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    gold: false,
    kicker: "Amplifies organic",
    visual: null,
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
          Built for the <span className="text-accent">Trades</span>
        </h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          {BRAND_NAME} leads with revenue strategy and software, then exceptional organic growth on
          Google Search, with paid ads & content when you need more lift.
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
            {bento.visual === "speed" && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-200">Intent: &lt;1s</span>
                  <span className="text-muted">Manual: 5min</span>
                </div>
                <div className="flex gap-1 h-2 w-full">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    className="origin-left w-[3%] rounded bg-amber-400 h-full"
                  />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                    className="origin-left flex-1 rounded bg-muted/30 h-full"
                  />
                </div>
              </div>
            )}
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
