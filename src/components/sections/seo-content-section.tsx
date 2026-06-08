"use client";

import { motion } from "framer-motion";

/**
 * Visible long-form copy for SEO: word count, keyword consistency, readability.
 */
export function SeoContentSection() {
  return (
    <section
      id="contractor-lead-generation"
      className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-border/50"
      aria-labelledby="seo-contractor-heading"
    >
      <div className="max-w-3xl mx-auto">
        <motion.h2
          id="seo-contractor-heading"
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl sm:text-4xl font-display font-semibold text-foreground"
        >
          Revenue growth for contractors that{" "}
          <span className="text-accent">actually sticks</span>
        </motion.h2>
        <div className="mt-8 space-y-6 text-foreground/90 text-base sm:text-lg leading-relaxed">
          <p>
            <strong className="text-foreground">Contractor lead generation</strong> is only
            useful when it feeds real revenue inside your business—not a pile of
            tire-kickers. Intent partners with HVAC, plumbing, roofing, electrical,
            landscaping, and general contractors to find and grow revenue streams:
            better demand, faster intake, stronger close rates, and repeat work like
            maintenance agreements.
          </p>
          <p>
            Trades run on the phone. The{" "}
            <strong className="text-foreground">Intent application</strong> is how we
            run the work—software we build for you: custom site, speed-to-lead and
            intake automation, analytics dashboard, and AI voice when your team
            can&apos;t answer. Not a robot on
            every live call; your CSRs stay in control when someone picks up.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-2">
            Organic-first Google Search—plus paid when it helps
          </h3>
          <p>
            We do everything in our power to grow you at an exceptional pace
            organically: programmatic local pages, local SEO, content, and search
            strategy in your service area. When someone searches for your trade in
            Orlando, Lakeland, Winter Haven, Poinciana, or statewide, you show up—and
            you respond first. We also create content and run Google ad campaigns when
            paid lift complements that organic foundation.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-2">
            Revenue engineering—not vanity metrics
          </h3>
          <p>
            Dashboards tie marketing to leads and booked outcomes by source. You see
            whether your investment is paying for itself. When you&apos;re ready to
            scale, the foundation—demand, capture, and reporting—is already there.
          </p>
          <p>
            Request a free quote and tell us your trade and territory—we&apos;ll map
            revenue streams and how we can grow them for your business.
          </p>
        </div>
      </div>
    </section>
  );
}
