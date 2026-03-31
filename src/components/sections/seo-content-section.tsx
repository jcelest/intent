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
          Contractor lead generation that{" "}
          <span className="text-accent">engineers revenue</span>
        </motion.h2>
        <div className="mt-8 space-y-6 text-foreground/90 text-base sm:text-lg leading-relaxed">
          <p>
            <strong className="text-foreground">Contractor lead generation</strong> is how you fill
            your schedule with homeowners who are ready to book—not tire-kickers who waste your
            crew&apos;s time. Intent builds that pipeline for HVAC, plumbing, roofing, electrical,
            landscaping, and general contractors who want predictable revenue, not guesswork.
          </p>
          <p>
            Most trades businesses lose leads to slow follow-up. A form submission that sits for
            hours is a lead your competitor already called. We focus on{" "}
            <strong className="text-foreground">speed-to-lead</strong>, clear qualification, and
            local visibility so when someone searches for your trade in your service area, you show
            up and you respond first.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-2">
            Lead generation for contractors in Florida
          </h3>
          <p>
            We work with contractors across Florida—from Central Florida (Orlando, Tampa,
            Kissimmee) to statewide coverage. Whether you run a single truck or a multi-crew
            operation, the same principles apply: capture intent, qualify fast, book jobs, and
            measure what matters. Our stack includes programmatic local pages, voice qualification,
            and dashboards so you see sessions, leads, and outcomes in one place.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-2">
            Revenue engineering—not vanity metrics
          </h3>
          <p>
            &ldquo;We engineer revenue&rdquo; means we tie marketing to booked calls and revenue,
            not likes or impressions alone. You get infrastructure built for conversion: forms that
            route instantly, follow-up that doesn&apos;t sleep on weekends, and reporting that shows
            whether your contractor lead generation is paying for itself. When you&apos;re ready to
            scale, that foundation is already there.
          </p>
          <p>
            Request a free quote and tell us your trade and territory—we&apos;ll map how contractor
            lead generation can work for your business.
          </p>
        </div>
      </div>
    </section>
  );
}
