"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CAPTURE_ADDONS,
  LEADNET_INCLUDED_DAYS,
  LEADNET_MONTHLY_CENTS,
  addonAmount,
  addonDisplayCents,
  isLeadNetTestCheckout,
  leadNetSprintCents,
  type CaptureAddonId,
} from "@/lib/engagements";
import { formatCurrency } from "@/lib/utils";
import { LeadNetDemoVideo } from "@/components/sections/leadnet-demo-video";
import { LeadNetPhonePaths } from "@/components/sections/leadnet-phone-paths";
import { BRAND_NAME } from "@/lib/seo";

const FEATURES = [
  {
    title: "Your Company",
    body: "Your Company gets its own LeadNet app. Intake, missed-call text-back, owner alerts, and the dashboard run as their system.",
  },
  {
    title: "Missed-Call Text-Back",
    body: "If they miss the ring, the homeowner gets a text from the tracking number. The lead stays in.",
  },
  {
    title: "Priority Intake",
    body: "A mobile form for the job, system age, and a job value estimate. The tech does not type dollars.",
  },
  {
    title: "Owner Alerts",
    body: "New leads hit the owner’s phone. The dashboard shows open est. value as jobs move.",
  },
  {
    title: "Google Review SMS",
    body: "After the job, send the 5 star request from the same system. Follow-up is automatic.",
  },
];

export function CaptureContent() {
  const sprintCents = leadNetSprintCents();
  const testCheckout = isLeadNetTestCheckout();
  const [addons, setAddons] = useState<CaptureAddonId[]>([]);
  const total = useMemo(
    () => sprintCents + addonAmount(addons),
    [addons, sprintCents]
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
            The call you missed still gets a text
          </motion.p>
          {testCheckout ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-200">
              Test checkout {formatCurrency(sprintCents)}. Not the live sprint.
            </p>
          ) : null}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight"
          >
            Intent <span className="text-accent">LeadNet</span>
          </motion.h1>
          <p className="mt-3 text-sm sm:text-base tracking-wide text-foreground/80">
            Missed-Call Software
          </p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto leading-relaxed"
          >
            The missed-call and review system {BRAND_NAME} is rolling out to
            trades. One tracking number. Leads stay in the system.
            Nothing slips through the cracks.
          </motion.p>
        </div>
        <div className="mt-10 max-w-4xl mx-auto">
          <LeadNetDemoVideo />
        </div>
        <div className="mt-10 max-w-xl mx-auto text-center">
          <p className="text-4xl sm:text-5xl font-semibold tracking-tight text-accent">
            {formatCurrency(sprintCents)}
          </p>
          <p className="mt-2 font-mono text-sm uppercase tracking-[0.2em] text-muted">
            sprint
          </p>
          <p className="mt-3 text-base sm:text-lg text-foreground/80">
            Then {formatCurrency(LEADNET_MONTHLY_CENTS)}/month after{" "}
            {LEADNET_INCLUDED_DAYS} days.
          </p>
          <p className="mt-2 mx-auto max-w-md text-sm text-foreground/65 leading-relaxed">
            Tracking number and texts are in the monthly. A second cell line,
            if you use one, is paid to your carrier.
          </p>
          <a
            href="#start-leadnet"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-oled drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:bg-cyan-300"
          >
            See pricing
          </a>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border-2 border-accent/45 bg-card/80 p-6"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <LeadNetPhonePaths />

      <section id="start-leadnet" className="px-4 sm:px-6 lg:px-8 py-12 scroll-mt-24">
        <div className="max-w-xl mx-auto rounded-2xl border-2 border-accent/50 bg-card/90 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Start LeadNet</h2>
          <p className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight text-accent">
            {formatCurrency(sprintCents)}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            base sprint
          </p>
          <p className="mt-4 text-sm text-foreground/75 leading-relaxed">
            Add only what you want. Software we build stays with Intent unless
            a signed contract says otherwise. Every lead stays in. The amount
            due today is the sprint and any add-ons.{" "}
            {formatCurrency(LEADNET_MONTHLY_CENTS)}/month starts after{" "}
            {LEADNET_INCLUDED_DAYS} days.
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
                      : "border-white/25 hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{addon.label}</p>
                      <p className="mt-1 text-sm text-muted">{addon.detail}</p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-accent shrink-0">
                      {formatCurrency(addonDisplayCents(addon.amountCents))}
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
          <p className="mt-2 text-sm text-foreground/70 leading-relaxed">
            Due today. Then {formatCurrency(LEADNET_MONTHLY_CENTS)}/month after{" "}
            {LEADNET_INCLUDED_DAYS} days.
          </p>
          <p className="mt-4 text-sm text-foreground/65 leading-relaxed">
            Not in this total: ads, a website, or a second cell line. We do not
            guarantee a number of leads. The monthly starts after{" "}
            {LEADNET_INCLUDED_DAYS} days.
          </p>
          <Link
            href={beginHref}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-8 py-4 text-lg font-semibold text-oled drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:bg-cyan-300"
          >
            Pay and start LeadNet
          </Link>
          <p className="mt-4 text-center text-xs text-muted leading-relaxed">
            Pay the sprint first. Then sign the LeadNet agreement, including
            the monthly. See{" "}
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
