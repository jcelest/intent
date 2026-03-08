"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const TRADES = [
  {
    title: "HVAC & Climate",
    desc: "Dominate local search with pSEO. AI voice calls qualify service calls and book installations. Speed-to-lead captures homeowners before they call the competition.",
  },
  {
    title: "Plumbing",
    desc: "Programmatic neighborhood landing pages for plumbers. AI qualification filters emergency vs. non-urgent, books high-value jobs, reduces no-shows.",
  },
  {
    title: "Roofing & Exterior",
    desc: "Storm season, insurance claims, replacements—we capture intent with geo-targeted pages and AI voice qualification that books estimates fast.",
  },
  {
    title: "General Contractors",
    desc: "Remodels, additions, new construction. Custom landing pages per service area. AI calls qualify project scope and budget before your team visits.",
  },
  {
    title: "Electrical & Solar",
    desc: "High-ticket home services need speed. We respond in under 60 seconds, qualify with AI voice, and book consultations before leads go cold.",
  },
  {
    title: "Landscaping & Lawn",
    desc: "Recurring revenue businesses need consistent lead flow. pSEO + AI voice fills your schedule with qualified, ready-to-sign customers.",
  },
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

export function ContractorsContent() {
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
            AI Marketing for{" "}
            <span className="text-accent drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              Contractors
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            HVAC, plumbing, roofing, construction, home services—we build
            AI-powered lead generation that dominates local search and qualifies
            leads before your team touches the phone.
          </motion.p>
        </div>
      </section>

      {/* Trades we serve */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-12 text-foreground"
          >
            Contractor Trades We Serve
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {TRADES.map((trade) => (
              <motion.article
                key={trade.title}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group rounded-xl border-2 border-border bg-card p-6 sm:p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300"
              >
                <h3 className="text-xl font-display font-semibold text-accent mb-3">
                  {trade.title}
                </h3>
                <p className="text-foreground/85 leading-relaxed text-base sm:text-lg">
                  {trade.desc}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why contractors choose us */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-10 text-foreground"
          >
            Why Contractors Choose Intent
          </motion.h2>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-5"
          >
            {[
              "pSEO engine—dominate local search with programmatic neighborhood pages",
              "AI voice qualification—filter tire-kickers, book only high-intent jobs",
              "Speed-to-lead—respond in under 60 seconds, before competitors",
              "Revenue dashboard—track every lead, call, and conversion",
              "Custom conversion-focused sites—no WordPress templates",
            ].map((point, i) => (
              <motion.li
                key={point}
                variants={item}
                className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/50 px-5 py-4 hover:border-accent/30 hover:bg-card/80 transition-all duration-300"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-sm">
                  {i + 1}
                </span>
                <span className="text-foreground/95 font-medium text-base sm:text-lg leading-relaxed">
                  {point}
                </span>
              </motion.li>
            ))}
          </motion.ul>
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
            Ready to engineer revenue as a contractor?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            Test our AI or see the full package.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#get-in-touch"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg bg-accent text-black hover:bg-accent/90 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              >
                Test the AI
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/offering"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg border-2 border-accent/60 text-foreground hover:border-accent hover:bg-accent/10 transition-colors"
              >
                See Our Package
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
