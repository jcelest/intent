"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const REGIONS = [
  {
    name: "Central Florida",
    cities: "Orlando, Tampa, Kissimmee, Winter Park, Lakeland",
    desc: "Theme parks, tourism, healthcare, and tech—our core service area.",
  },
  {
    name: "South Florida",
    cities: "Miami, Fort Lauderdale, West Palm Beach",
    desc: "Finance, real estate, and international business—we scale lead capture.",
  },
  {
    name: "North Florida",
    cities: "Jacksonville, Tallahassee, Gainesville",
    desc: "Government, education, and logistics—we automate qualification.",
  },
  {
    name: "Gulf Coast",
    cities: "Sarasota, Naples, Fort Myers",
    desc: "Retirement, healthcare, and hospitality—we dominate local search.",
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

export function FloridaContent() {
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
            AI Marketing Agency for{" "}
            <span className="text-accent drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              Florida
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            From Miami to Jacksonville, Tampa to Orlando—we build AI-powered
            lead generation for contractors and local services. We engineer revenue for Florida businesses statewide.
          </motion.p>
        </div>
      </section>

      {/* Regions we serve */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-12 text-foreground"
          >
            Serving Florida Statewide
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {REGIONS.map((region) => (
              <motion.article
                key={region.name}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group rounded-xl border-2 border-border bg-card p-6 sm:p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300"
              >
                <h3 className="text-xl font-display font-semibold text-accent mb-2">
                  {region.name}
                </h3>
                <p className="text-foreground/70 text-sm font-medium mb-3">
                  {region.cities}
                </p>
                <p className="text-foreground/85 leading-relaxed text-base sm:text-lg">
                  {region.desc}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What we deliver */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-10 text-foreground"
          >
            What Florida Businesses Get
          </motion.h2>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-5"
          >
            {[
              "AI voice qualification—real outbound calls that book appointments",
              "Speed-to-lead—respond to leads in under 60 seconds",
              "pSEO engine—programmatic local landing pages at scale",
              "Revenue dashboard—track every lead and conversion",
              "Custom React builds—conversion-focused, zero bloat",
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
            Ready to engineer revenue in Florida?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            Test our AI or explore our full package.
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
                href="/central-florida"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg border-2 border-accent/60 text-foreground hover:border-accent hover:bg-accent/10 transition-colors"
              >
                Central Florida
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
