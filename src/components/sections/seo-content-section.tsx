"use client";

import { motion } from "framer-motion";
import { BRAND_NAME } from "@/lib/seo";

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
        <div className="mt-8 space-y-5 text-foreground/90 text-base sm:text-lg leading-relaxed">
          <p>
            <strong className="text-foreground">Contractor lead generation</strong> only
            useful when it turns into booked jobs. {BRAND_NAME} partners with HVAC, plumbing,
            roofing, electrical, landscaping, and general contractors to grow real
            revenue: demand, intake, close rates, and repeat work.
          </p>
          <p>
            Trades run on the phone. The{" "}
            <strong className="text-foreground">{BRAND_NAME} application</strong> is custom
            software we build for you: site, speed-to-lead, dashboard, and AI voice when
            your team can&apos;t answer. Your CSRs stay in control.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-1">
            Organic-first Google Search, plus paid when it helps
          </h3>
          <p>
            Local pages, SEO, and content so you rank in your service area and respond
            first. Paid ads when they accelerate what organic already built.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-1">
            Revenue engineering, not vanity metrics
          </h3>
          <p>
            Dashboards tie every lead to booked outcomes by source. You always know
            what&apos;s working and what&apos;s paying for itself.
          </p>
          <p>
            Tell us your trade and territory. {BRAND_NAME} will map how we grow your revenue.
          </p>
        </div>
      </div>
    </section>
  );
}
