"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const CREDENTIALS = [
  "600+ corporate-level escalations resolved",
  "5+ years in high-stakes customer problem solving",
  "B.S. in Psychology from the University of Central Florida",
  "Founder and hands-on product builder",
];

export function FounderTrustSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-24 border-y border-border/50 bg-card/35 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      aria-labelledby="founder-heading"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-accent/35 via-transparent to-amber-400/20 blur-2xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950 p-2 shadow-[0_0_60px_rgba(34,211,238,0.14)]">
            <Image
              src="/joshua-celestin-founder.png"
              alt="Joshua Celestin, founder of Intent Revenue"
              width={1122}
              height={1402}
              sizes="(max-width: 1024px) 90vw, 38vw"
              className="aspect-[4/5] w-full rounded-[1.55rem] object-cover object-top"
              priority={false}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Meet the founder
          </p>
          <h2
            id="founder-heading"
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            Joshua Celestin builds around one outcome: helping good businesses make more money.
          </h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-foreground/78 sm:text-lg">
            <p>
              Joshua founded Intent Revenue on a straightforward belief: when a business trusts you with its growth, the work should lead back to revenue, not vague activity or impressive-looking reports.
            </p>
            <p>
              Before Intent, he spent more than five years resolving complex executive escalations at Costco Wholesale. He handled more than 600 corporate-level cases across financial, order, fulfillment, refund, and service issues, often coordinating customers, senior leaders, internal teams, and outside partners to reach a clear resolution.
            </p>
            <p>
              That experience shapes how he works with business owners today. Listen closely. Find the real constraint. Communicate clearly. Build a practical system that earns customer trust, captures more opportunities, and gives the owner a better chance to grow revenue.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {CREDENTIALS.map((credential) => (
              <div key={credential} className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-foreground/75">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{credential}</span>
              </div>
            ))}
          </div>

          <Link
            href="/offering"
            className="mt-8 inline-flex items-center justify-center rounded-lg border border-accent/45 bg-accent/10 px-6 py-3 font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            See how Intent works
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
