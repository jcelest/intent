"use client";

import { motion } from "framer-motion";

const OUTCOMES = [
  {
    title: "Be easier to choose",
    description: "Build confidence before the first conversation.",
  },
  {
    title: "Respond while intent is high",
    description: "Keep good opportunities from going cold.",
  },
  {
    title: "Win more of the right work",
    description: "Create a clearer path from interest to revenue.",
  },
  {
    title: "Know what drives revenue",
    description: "Make decisions with better signals.",
  },
];

export function TrustOutcomesSection() {
  return (
    <section className="relative border-b border-border/50 bg-card/35 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
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
            More trust. More booked work. Better revenue decisions.
          </h2>
          <p className="mt-5 text-base text-foreground/70 sm:text-lg">
            Every system should move the business forward.
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
      </div>
    </section>
  );
}
