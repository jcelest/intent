"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const MOCK_LEADS = [12, 28, 45, 38, 62, 78, 95, 88, 112, 98, 125, 140];
const MOCK_ROI = 847;

export function RevenueDashboard() {
  const [roi, setRoi] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const duration = 2000;
    const steps = 60;
    const increment = MOCK_ROI / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= MOCK_ROI) {
        setRoi(MOCK_ROI);
        clearInterval(timer);
      } else {
        setRoi(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [mounted]);

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold">
          Revenue <span className="text-accent">Dashboard</span>
        </h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Real metrics from real contractor clients. Leads, calls, conversions—no vanity metrics.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto rounded-xl border border-border bg-card p-6 sm:p-8 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex-1">
            <h3 className="font-mono text-sm text-muted mb-2">
              LEADS CAPTURED (30d)
            </h3>
            <div className="h-40 flex items-end gap-1">
              {MOCK_LEADS.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${(value / 140) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className="flex-1 rounded-t bg-accent/60 min-h-[4px]"
                />
              ))}
            </div>
          </div>
          <div className="sm:w-48 flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-border pt-6 sm:pt-0 sm:pl-8">
            <h3 className="font-mono text-sm text-muted mb-2">
              ROI GENERATED
            </h3>
            <motion.span
              initial={{ opacity: 1, scale: 1 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-4xl font-display font-semibold text-accent drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            >
              ${roi}K
            </motion.span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
