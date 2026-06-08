"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const LiveTerminal = dynamic(
  () => import("@/components/ui/live-terminal").then((mod) => mod.LiveTerminal),
  { ssr: false }
);

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] sm:min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 sm:pt-24 pb-10 sm:pb-12">
      {/* Grid background with radial gradient mask */}
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
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-semibold tracking-tight max-w-4xl w-full text-balance"
        >
          <span className="drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] text-accent">
            Intent
          </span>
          <span className="block mt-2 text-lg sm:text-3xl md:text-4xl text-foreground font-semibold leading-snug">
            Growth partner for contractors and the trades
          </span>
          <span className="block mt-2 sm:mt-3 text-base sm:text-2xl md:text-3xl text-muted font-medium">
            We grow high-value revenue streams.
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 sm:mt-10 w-full min-w-0 flex justify-center px-0 sm:px-0"
        >
          <LiveTerminal className="w-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md sm:max-w-none"
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            onClick={() =>
              document
                .getElementById("get-in-touch")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Get a Free Quote
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = "/offering")}
          >
            See the Package
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
