"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/seo";

const QUALIFICATION_CRITERIA = [
  {
    title: "Volume & revenue",
    description: "5+ jobs per month or $25k+ in annual revenue.",
  },
  {
    title: "Phone-first operations",
    description: "Inbound calls and fast follow-up drive your bookings.",
  },
  {
    title: "Google Reviews",
    description: "Active Google Business Profile with real Google reviews.",
  },
  {
    title: "Defined territory",
    description: "A focused service area you can actually cover.",
  },
  {
    title: "Growth investment",
    description: "Budget and commitment to invest in marketing and systems.",
  },
  {
    title: "Full business access",
    description: "Access to your CRM, email, scheduling tools, and ad accounts.",
  },
  {
    title: "Owner in the fight",
    description: "The decision-maker shows up, reviews numbers, and executes.",
  },
];

const LAUNCHPAD_SERVICES = [
  {
    title: "Post-job Google review engine",
    description: "One-tap Google review link sent right after every job closes.",
    highlight: true,
  },
  {
    title: "Google Business Profile build-out",
    description: "Profile optimized so homeowners trust you before they call.",
    highlight: false,
  },
  {
    title: "Intake basics",
    description: "Missed-call text-back, after-hours capture, and a lead form.",
    highlight: false,
  },
  {
    title: "Qualification milestones",
    description: "Monthly scorecard until you're ready for full partnership.",
    highlight: false,
  },
];

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function ClientQualificationSection() {
  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-border/50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent"
          >
            {BRAND_NAME}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-4xl sm:text-5xl md:text-6xl font-display font-semibold text-foreground text-balance"
          >
            Partnership{" "}
            <span className="text-accent">Qualification</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-xl sm:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            We only take clients {BRAND_NAME} can guarantee results for.
          </motion.p>
        </div>
      </section>

      <section
        id="client-qualification"
        className="relative py-24 px-4 sm:px-6 lg:px-8"
        aria-labelledby="qualification-heading"
      >
        <div className="max-w-5xl mx-auto">
          <motion.p
            id="qualification-heading"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto text-foreground/90 text-base sm:text-lg leading-relaxed"
          >
            Meet the bar, we go all in. Not there yet, Launchpad gets you there.
          </motion.p>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-12 grid gap-4 sm:grid-cols-2"
          >
            {QUALIFICATION_CRITERIA.map((criterion, i) => (
              <motion.div
                key={criterion.title}
                variants={item}
                className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/50 px-5 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-sm text-accent">
                  {i + 1}
                </span>
                <div>
                  <h2 className="font-display font-semibold text-foreground">
                    {criterion.title}
                  </h2>
                  <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                    {criterion.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 grid gap-6 sm:grid-cols-2"
          >
            <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-6 sm:p-8">
              <h3 className="text-xl font-display font-semibold text-accent">
                Qualified: full partnership
              </h3>
              <p className="mt-3 text-foreground/90 text-sm leading-relaxed">
                The complete {BRAND_NAME} package: revenue, software, search, and ads.
              </p>
              <Link
                href="#get-in-touch"
                className="mt-5 inline-block font-mono text-sm text-accent hover:underline"
              >
                Apply for partnership →
              </Link>
            </div>
            <div className="rounded-xl border-2 border-border bg-card/50 p-6 sm:p-8">
              <h3 className="text-xl font-display font-semibold text-foreground">
                Not there yet: that&apos;s okay
              </h3>
              <p className="mt-3 text-foreground/90 text-sm leading-relaxed">
                Build your foundation first. Launchpad is the runway.
              </p>
              <Link
                href="#intent-launchpad"
                className="mt-5 inline-block font-mono text-sm text-muted hover:text-accent transition-colors"
              >
                See Intent Launchpad →
              </Link>
            </div>
          </motion.div>

          <motion.div
            id="intent-launchpad"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-600/20 via-amber-900/40 to-amber-950/60 p-6 sm:p-10 shadow-[0_0_48px_rgba(217,169,65,0.12)]"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200/90">
              Path to qualification
            </p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-display font-semibold text-amber-100">
              Intent Launchpad
            </h2>
            <p className="mt-3 max-w-xl text-amber-100/85 text-base leading-relaxed">
              {BRAND_NAME} Launchpad builds your Google Reviews and intake foundation before full partnership.
            </p>

            <motion.ul
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-6 grid gap-4 sm:grid-cols-2"
            >
              {LAUNCHPAD_SERVICES.map((service) => (
                <motion.li
                  key={service.title}
                  variants={item}
                  className={cn(
                    "rounded-lg border px-5 py-4",
                    service.highlight
                      ? "border-amber-400/50 bg-amber-500/15"
                      : "border-amber-500/25 bg-black/20"
                  )}
                >
                  <h4 className="font-display font-semibold text-amber-100">
                    {service.title}
                    {service.highlight && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-300/80">
                        Core
                      </span>
                    )}
                  </h4>
                  <p className="mt-2 text-sm text-amber-100/75 leading-relaxed">
                    {service.description}
                  </p>
                </motion.li>
              ))}
            </motion.ul>

            <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:items-center">
              <Link
                href="/begin?path=launchpad"
                className="inline-flex items-center justify-center rounded-lg bg-amber-500/90 px-6 py-3 font-display font-semibold text-amber-950 hover:bg-amber-400 transition-colors"
              >
                Start with Launchpad
              </Link>
              <p className="text-sm text-amber-200/70 font-mono">
                Graduate when you hit the bar.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
