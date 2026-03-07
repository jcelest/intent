"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DispatcherIcon,
  LightningIcon,
  TargetIcon,
  AtomIcon,
} from "@/components/ui/icons";

const BENTO_ITEMS = [
  {
    title: "The Dispatcher",
    description: "AI Voice API integration with Vapi & Retell. Real-time outbound calls that qualify leads before your team touches the phone.",
    Icon: DispatcherIcon,
    span: "col-span-1 row-span-2",
    accent: true,
    visual: null,
  },
  {
    title: "Speed-to-Lead",
    description: "Every second counts when capturing intent.",
    Icon: LightningIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    visual: "speed",
  },
  {
    title: "pSEO Engine",
    description: "Programmatic neighborhood-targeting scripts. Dominate local search at scale.",
    Icon: TargetIcon,
    span: "col-span-1 row-span-1",
    accent: false,
    visual: null,
  },
  {
    title: "Custom React Logic",
    description: "Why our code beats WordPress templates. Purpose-built components, zero bloat, maximum conversion.",
    Icon: AtomIcon,
    span: "col-span-1 md:col-span-2 row-span-1",
    accent: false,
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
      id="proprietary-tech"
      className="relative py-24 px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold">
          Proprietary <span className="text-accent">Tech</span>
        </h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Infrastructure built for revenue, not vanity metrics.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {BENTO_ITEMS.map((bento) => (
          <motion.article
            key={bento.title}
            variants={item}
            className={cn(
              "rounded-xl border border-border bg-card p-6 sm:p-8 transition-all duration-300",
              "hover:border-accent/50 hover:shadow-glow",
              bento.span
            )}
          >
            <div
              className={cn(
                "mb-4 flex items-center justify-start text-foreground",
                bento.accent && "drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
              )}
            >
              <bento.Icon accent={bento.accent} />
            </div>
            <h3 className="text-xl font-display font-semibold text-foreground mb-2">
              {bento.title}
            </h3>
            <p className="text-muted text-sm sm:text-base leading-relaxed">
              {bento.description}
            </p>
            {bento.visual === "speed" && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-accent">AI: &lt;1s</span>
                  <span className="text-muted">Human: 5min</span>
                </div>
                <div className="flex gap-1 h-2 w-full">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    className="origin-left w-[3%] rounded bg-accent h-full"
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
