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
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-2">
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

      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-semibold tracking-tight"
        >
          <span className="drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] text-accent">
            Intent
          </span>
          : We Engineer Revenue.
        </motion.h1>

        <motion.p
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg sm:text-xl text-muted max-w-2xl leading-relaxed"
        >
          Moving beyond traditional marketing. We build proprietary AI
          infrastructure that captures, qualifies, and closes your business
          leads automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Button
            variant="primary"
            size="lg"
            className="drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            onClick={() =>
              document
                .getElementById("test-ai")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Test the AI
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() =>
              document
                .getElementById("proprietary-tech")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            See Our Tech
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 w-full flex justify-center"
        >
          <LiveTerminal />
        </motion.div>
      </div>
    </section>
  );
}
