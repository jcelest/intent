"use client";

import { motion } from "framer-motion";

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
          Our Mission
        </motion.p>
        <motion.h2
          id="mission-heading"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="mt-4 text-3xl sm:text-4xl md:text-5xl font-display font-semibold text-foreground"
        >
          Out With The Old,{" "}
          <span className="text-accent">In With The New</span>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-8 space-y-6 text-foreground/90 text-base sm:text-lg leading-relaxed"
        >
          <p>
            The trades are stuck. Legacy operators built empires on outdated playbooks—
            slow follow-up, bloated overhead, and a stranglehold on local markets while
            homeowners and businesses get worse service at higher prices. Competition
            stopped being about who does the best work. It became about who locked in
            territory first and never had to improve.
          </p>
          <p>
            Intent exists to break that grip. We partner with contractors who are ready
            to compete—not coast—and give them the revenue systems, software, and search
            dominance that legacy shops never built. Phone-first intake, organic search
            that compounds, and dashboards that tie every dollar to booked jobs.
          </p>
          <p>
            We don&apos;t help everyone hold onto market share. We help the best operators
            in every trade take it—replacing the old guard with businesses that answer
            faster, close more, and earn the reviews that keep winning.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
