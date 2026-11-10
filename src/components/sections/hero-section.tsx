"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(88dvh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
      <div
        className="absolute inset-0 bg-[linear-gradient(transparent_0%,transparent_50%,rgba(0,0,0,0.8)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl mx-auto min-w-0">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl text-balance font-display text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Turn More Demand Into <span className="text-accent drop-shadow-[0_0_15px_rgba(34,211,238,0.45)]">Revenue.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 max-w-2xl text-balance text-lg leading-8 text-foreground/70 sm:text-xl"
        >
          Practical systems that help businesses respond faster, earn trust, and win more work.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Link
            href="/leadnet"
            className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-accent px-7 py-3.5 font-semibold text-oled transition-colors hover:bg-cyan-300 sm:w-auto"
          >
            Explore LeadNet
          </Link>
          <Link
            href="/b2b"
            className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-7 py-3.5 font-semibold text-foreground transition-colors hover:border-accent/50 hover:text-accent sm:w-auto"
          >
            Explore Intent B2B
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
