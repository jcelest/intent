"use client";

import { motion } from "framer-motion";
import { BRAND_NAME, BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_TEL } from "@/lib/seo";

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
          Revenue growth you can{" "}
          <span className="text-accent">see and understand</span>
        </motion.h2>
        <div className="mt-8 space-y-5 text-foreground/90 text-base sm:text-lg leading-relaxed">
          <p>
            <strong className="text-foreground">Contractor lead generation</strong> is only useful when it creates real opportunities and booked work. {BRAND_NAME} partners with HVAC, plumbing, roofing, electrical, landscaping, and general contractors to improve demand, intake, close rates, and repeat business.
          </p>
          <p>
            Trades run on trust and responsiveness. The{" "}
            <strong className="text-foreground">{BRAND_NAME} application</strong> can bring the website, speed-to-lead follow-up, intake, reporting, and AI voice support into one clearer customer journey while your team stays in control.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-1">
            Be easier to find and easier to choose
          </h3>
          <p>
            Local pages, search strategy, and useful content help customers understand what you do and where you work. Paid ads can add reach when the offer and customer path are ready for it.
          </p>
          <h3 className="text-xl font-display font-semibold text-foreground pt-1">
            Clear reporting, not a black box
          </h3>
          <p>
            Reporting should connect demand, calls, forms, and follow-up to real opportunities and booked outcomes. That gives you a more honest view of what deserves more time and budget.
          </p>
          <p>
            Tell us your trade and territory. {BRAND_NAME} will look for the clearest path to stronger customer trust and more revenue.
            Call{" "}
            <a href={BUSINESS_PHONE_TEL} className="text-accent hover:underline">
              {BUSINESS_PHONE_DISPLAY}
            </a>{" "}
            or{" "}
            <a href="/contact" className="text-accent hover:underline">
              contact us online
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
