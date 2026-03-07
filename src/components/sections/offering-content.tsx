"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  DispatcherIcon,
  LightningIcon,
  TargetIcon,
  AtomIcon,
} from "@/components/ui/icons";

const PACKAGE_ITEMS = [
  {
    title: "The Dispatcher",
    description:
      "AI Voice API integration with Vapi & Retell. Real-time outbound calls that qualify leads before your team touches the phone. Reduce no-shows, filter tire-kickers, and book only high-intent appointments.",
    Icon: DispatcherIcon,
    badge: "Voice AI",
  },
  {
    title: "Speed-to-Lead",
    description:
      "Every second counts when capturing intent. Our infrastructure responds to form submissions and inbound signals in under 60 seconds—often before competitors even see the lead.",
    Icon: LightningIcon,
    badge: "<60 sec",
  },
  {
    title: "pSEO Engine",
    description:
      "Programmatic neighborhood-targeting scripts. Dominate local search at scale with geo-specific landing pages, schema markup, and content that converts. Built for plumbers, dentists, auto shops, and more.",
    Icon: TargetIcon,
    badge: "Local SEO",
  },
  {
    title: "Custom React Logic",
    description:
      "Purpose-built components, zero bloat, maximum conversion. We don't use WordPress templates—we build conversion-optimized experiences that capture and nurture leads at every touchpoint.",
    Icon: AtomIcon,
    badge: "Custom Build",
  },
];

const INCLUSIONS = [
  "AI voice qualification & appointment booking",
  "Speed-to-lead automation (<60 sec response)",
  "Local SEO & programmatic landing pages",
  "Custom conversion-focused web experience",
  "Revenue dashboard & analytics",
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
  hidden: { opacity: 1, y: 24 },
  show: { opacity: 1, y: 0 },
};

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
            End-to-end AI infrastructure that captures, qualifies, and closes
            your business leads automatically. No vanity metrics—just revenue.
          </motion.p>
        </div>
      </section>

      {/* Core Stack - Gamified cards */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-12 text-foreground"
          >
            What&apos;s Included
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {PACKAGE_ITEMS.map((pkg) => (
              <motion.article
                key={pkg.title}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group rounded-xl border-2 border-border bg-card p-6 sm:p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-accent/15 text-accent group-hover:bg-accent/25 transition-colors">
                      <pkg.Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-display font-semibold text-foreground">
                      {pkg.title}
                    </h3>
                  </div>
                  <span className="shrink-0 px-3 py-1 rounded-full text-xs font-mono font-medium bg-accent/20 text-accent border border-accent/30">
                    {pkg.badge}
                  </span>
                </div>
                <p className="text-foreground/85 leading-relaxed text-base sm:text-lg">
                  {pkg.description}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Full Package List - Gamified with progress feel */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-10 text-foreground"
          >
            Full Package Overview
          </motion.h2>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-5"
          >
            {INCLUSIONS.map((inclusion, i) => (
              <motion.li
                key={inclusion}
                variants={item}
                className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/50 px-5 py-4 hover:border-accent/30 hover:bg-card/80 transition-all duration-300"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-sm">
                  {i + 1}
                </span>
                <span className="text-foreground/95 font-medium text-base sm:text-lg leading-relaxed">
                  {inclusion}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* CTA - Gamified */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 1, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-foreground">
            Ready to engineer revenue?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            See our tech in action or test the AI yourself.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#test-ai"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg bg-accent text-black hover:bg-accent/90 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              >
                Test the AI
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#proprietary-tech"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg border-2 border-accent/60 text-foreground hover:border-accent hover:bg-accent/10 transition-colors"
              >
                See Our Tech
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
