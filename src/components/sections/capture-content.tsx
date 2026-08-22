"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CAPTURE_ADDONS, type CaptureAddonId } from "@/lib/engagements";
import { formatCurrency } from "@/lib/utils";
import { CaptureFlowVisual } from "@/components/visuals/package-visuals";
import { BRAND_NAME } from "@/lib/seo";

const FEATURES = [
  {
    title: "Your Company",
    body: "Your Company gets its own LeadNet application. Intake, missed-call text-back, owner alerts, and the dashboard run as their system, not a generic form.",
  },
  {
    title: "Missed-call text-back",
    body: "If the company misses the ring, the homeowner gets a text from the tracking number. The lead is not gone.",
  },
  {
    title: "Priority intake",
    body: "A mobile form that captures the job, system age, and a Central Florida value estimate without the tech typing dollars.",
  },
  {
    title: "Owner alerts",
    body: "New leads hit the owner’s phone. The dashboard shows open est. value as jobs move.",
  },
  {
    title: "Google review SMS",
    body: "After the job, send the 5 star request from the same system. Follow-up is automatic.",
  },
];

export function CaptureContent() {
  const [addons, setAddons] = useState<CaptureAddonId[]>([]);
  const total = useMemo(
    () =>
      99900 +
      CAPTURE_ADDONS.filter((addon) => addons.includes(addon.id)).reduce(
        (sum, addon) => sum + addon.amountCents,
        0
      ),
    [addons]
  );

  function toggle(id: CaptureAddonId) {
    setAddons((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const beginHref = `/begin?path=leadnet${addons
    .map((id) => `&${id}=1`)
    .join("")}`;

  return (
    <main className="pt-24 pb-16">
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs uppercase tracking-[0.2em] text-accent"
          >
            Launching now
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight"
          >
            Intent <span className="text-accent">LeadNet</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto leading-relaxed"
          >
            The missed-call and review system {BRAND_NAME} is rolling out to
            trades first. One tracking number. Leads stay in the system.
            Nothing slips through the cracks.
          </motion.p>
          <p className="mt-8 text-6xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-accent">
            {formatCurrency(99900)}
          </p>
          <p className="mt-2 font-mono text-sm uppercase tracking-[0.2em] text-muted">
            sprint
          </p>
          <Link
            href={beginHref}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-oled drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:bg-cyan-300"
          >
            Pay and start LeadNet
          </Link>
        </div>
        <div className="mt-10 max-w-4xl mx-auto">
          <CaptureFlowVisual />
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-border bg-card/80 p-6"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-xl mx-auto rounded-2xl border border-accent/30 bg-card/90 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Start LeadNet</h2>
          <p className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight text-accent">
            {formatCurrency(99900)}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            base sprint
          </p>
          <p className="mt-4 text-sm text-foreground/75 leading-relaxed">
            Add only what you want. Software we build stays with Intent unless
            a signed contract says otherwise. Every lead stays in.
          </p>
          <div className="mt-6 space-y-3">
            {CAPTURE_ADDONS.map((addon) => {
              const on = addons.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggle(addon.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    on
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{addon.label}</p>
                      <p className="mt-1 text-sm text-muted">{addon.detail}</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-accent shrink-0">
                      {formatCurrency(addon.amountCents)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Due to start
          </p>
          <p className="mt-1 text-6xl sm:text-7xl font-semibold tracking-tight text-accent">
            {formatCurrency(total)}
          </p>
          <Link
            href={beginHref}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-oled drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:bg-cyan-300"
          >
            Pay and start LeadNet
          </Link>
          <p className="mt-4 text-center text-xs text-muted">
            Pay first. Then sign the LeadNet agreement. See{" "}
            <Link href="/terms" className="text-accent hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
