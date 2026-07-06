"use client";

import { motion } from "framer-motion";
import { BRAND_NAME } from "@/lib/seo";

export function MissionStatementSection() {
  return (
    <section
      id="our-mission"
      className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-border/50"
      aria-labelledby="mission-heading"
    >
      <div className="max-w-3xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-mono text-xs uppercase tracking-[0.2em] text-accent"
        >
          Our Mission at {BRAND_NAME}
        </motion.p>
        <motion.h2
          id="mission-heading"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mt-4 text-3xl sm:text-4xl md:text-5xl font-display font-semibold text-foreground text-balance"
        >
          Turning Small Businesses to{" "}
          <span className="text-accent">Leading Competitors</span>
        </motion.h2>
      </div>
    </section>
  );
}
