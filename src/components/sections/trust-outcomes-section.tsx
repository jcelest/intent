"use client";

import { motion } from "framer-motion";

const OUTCOMES = [
  {
    title: "More qualified opportunities",
    description:
      "Help the right customers find you, understand what you do, and take the next step with confidence.",
  },
  {
    title: "Faster response",
    description:
      "Give new inquiries a clear path forward while the need is still urgent and your business is still top of mind.",
  },
  {
    title: "More booked and repeat work",
    description:
      "Improve the path from first contact to booked job, review, maintenance, referral, and the next sale.",
  },
  {
    title: "Clearer revenue decisions",
    description:
      "See which sources, messages, and workflows create real opportunities so your time and budget have a purpose.",
  },
];

const TRUST_PROMISES = [
  "A clear explanation of what we are building and why",
  "Work connected to customer experience and revenue outcomes",
  "Straight answers when something is not working or is not a fit",
];

export function TrustOutcomesSection() {
  return (
    <section className="relative border-y border-border/50 bg-card/35 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Desired outcomes
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            The outcome is not more marketing. It is a stronger business.
          </h2>
          <p className="mt-5 text-base leading-7 text-foreground/70 sm:text-lg">
            Every part of the work should help the business earn attention, respond well, win more of the right work, and understand what is creating revenue.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((outcome, index) => (
            <motion.article
              key={outcome.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl border border-white/10 bg-oled/75 p-6"
            >
              <span className="font-mono text-xs text-accent">0{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{outcome.title}</h3>
              <p className="mt-3 text-sm leading-6 text-foreground/65">{outcome.description}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-accent/25 bg-accent/[0.06] p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            What you should expect from Intent
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {TRUST_PROMISES.map((promise) => (
              <div key={promise} className="flex gap-3 text-sm leading-6 text-foreground/75">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{promise}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
