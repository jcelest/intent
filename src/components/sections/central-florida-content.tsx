"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const CITIES = [
  { name: "Orlando", desc: "Theme parks, tourism, and tech—we help Orlando businesses capture high-intent leads." },
  { name: "Tampa", desc: "Healthcare, finance, and growth—Tampa companies use our AI to qualify and close faster." },
  { name: "Kissimmee", desc: "Hospitality and local services—Kissimmee businesses dominate local search with our pSEO engine." },
  { name: "Winter Park", desc: "Upscale retail and professional services—Winter Park brands scale with AI voice qualification." },
  { name: "Lakeland", desc: "Manufacturing and logistics—Lakeland businesses automate lead capture and revenue tracking." },
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

export function CentralFloridaContent() {
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
              Central Florida
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 1, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Orlando, Tampa, Kissimmee, Winter Park, Lakeland—we build AI-powered
            lead generation for contractors and local services. We engineer revenue for Central Florida businesses.
          </motion.p>
        </div>
      </section>

      {/* Cities we serve */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-12 text-foreground"
          >
            Serving Central Florida Cities
          </motion.h2>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {CITIES.map((city) => (
              <motion.article
                key={city.name}
                variants={item}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group rounded-xl border-2 border-border bg-card p-6 sm:p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300"
              >
                <h3 className="text-xl font-display font-semibold text-accent mb-3">
                  {city.name}
                </h3>
                <p className="text-foreground/85 leading-relaxed text-base sm:text-lg">
                  {city.desc}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why Central Florida */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-display font-semibold text-center mb-10 text-foreground"
          >
            Why Central Florida Businesses Choose Intent
          </motion.h2>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-5"
          >
            {[
              "AI voice qualification—real calls that book high-intent appointments",
              "Speed-to-lead automation—respond in under 60 seconds",
              "pSEO engine—dominate local search in Orlando, Tampa, and beyond",
              "Revenue dashboard—track every lead and conversion",
              "Custom conversion-focused web experiences—no WordPress templates",
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
            Ready to engineer revenue in Central Florida?
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
