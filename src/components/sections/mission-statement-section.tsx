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
      <div className="max-w-5xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-mono text-xs uppercase tracking-[0.2em] text-accent"
        >
          Built on trust. Measured by outcomes.
        </motion.p>
        <motion.h2
          id="mission-heading"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mt-4 text-3xl sm:text-4xl md:text-5xl font-display font-semibold text-foreground text-balance"
        >
          The goal is simple: help good businesses{" "}
          <span className="text-accent">make more money.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-6 max-w-3xl text-base leading-8 text-foreground/70 sm:text-lg"
        >
          {BRAND_NAME} earns trust by understanding how the business actually works, focusing on the places revenue is being lost, and building a clearer path from customer demand to booked and repeat work.
        </motion.p>

        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          {[
            ["Start with the real constraint", "We look for the bottleneck holding revenue back before recommending more activity."],
            ["Build for the customer", "Faster answers, clearer next steps, and a more trustworthy experience help good prospects move forward."],
            ["Stay accountable to revenue", "The work should connect to qualified opportunities, booked jobs, repeat business, and better decisions."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-card/70 p-5">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/65">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
