"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/seo";

const TRADES = [
  {
    title: "HVAC & Climate",
    desc: "Grow repair, install, and maintenance revenue. Exceptional organic search growth, paid ads when needed, plus speed-to-lead intake so every homeowner gets a response.",
  },
  {
    title: "Plumbing",
    desc: "Emergency and scheduled work need fast capture. Local landing pages, intake automation, and follow-up on estimates so high-value jobs don't go to the next plumber on Google.",
  },
  {
    title: "Roofing & Exterior",
    desc: "Storm season and replacements spike demand. Geo-targeted pages capture intent; speed-to-lead books estimates before leads cool off.",
  },
  {
    title: "General Contractors",
    desc: "Remodels and builds need qualified scope. Custom service-area pages, fast intake, and reporting that ties marketing to booked consultations.",
  },
  {
    title: "Electrical & Solar",
    desc: "High-ticket trades can't afford slow follow-up. Under-60-second response, smart intake when your office is closed, and visibility on Google Search.",
  },
  {
    title: "Landscaping & Lawn",
    desc: "Recurring revenue needs steady demand and retention. Search visibility plus capture automation to fill routes with ready-to-sign customers.",
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
            Revenue Growth for{" "}
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
            HVAC, plumbing, roofing, construction, and home services. We find and grow
            high-value revenue streams, then {BRAND_NAME} builds your application and
            organic search growth and paid ads for your business.
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
            Why Contractors Choose {BRAND_NAME}
          </motion.h2>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-5"
          >
            {[
              "Revenue streams: we identify and grow demand, conversion, and repeat work on your behalf",
              "We build your application & software: custom site, speed-to-lead, intake automation, and analytics dashboard",
              "Google Search organic growth: exceptional pace on local SEO, pages, and content",
              "Paid ads & content: we create creative and run Google campaigns that complement organic",
              "AI voice when your team can't answer. Not on every live call",
              "Ongoing optimization: reporting and adjustments as your business grows",
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
            Ready to grow revenue as a contractor?
          </h2>
          <p className="text-foreground/90 text-lg mb-8 font-medium">
            Get a free quote or see the full package.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/#get-in-touch"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg bg-accent text-black hover:bg-accent/90 transition-colors shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              >
                Get a Free Quote
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
