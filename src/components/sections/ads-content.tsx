"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";

const CONSULTATION_TARGET = "#ads-consultation";

const channels = [
  {
    id: "search",
    label: "Google Search",
    eyebrow: "Capture existing demand",
    description:
      "Reach people already searching for the service, product, or solution you provide—then build the path from keyword to qualified action.",
    details: ["Intent-led keyword architecture", "Search term and negative keyword control", "Offer-to-landing-page alignment"],
    icon: "search",
  },
  {
    id: "local",
    label: "Local Services",
    eyebrow: "Compete at the point of need",
    description:
      "Build and manage the operational foundation behind Google Local Services Ads for eligible local businesses.",
    details: ["Profile and service-area structure", "Lead quality review", "Budget and category management"],
    icon: "pin",
  },
  {
    id: "meta",
    label: "Meta",
    eyebrow: "Create and recapture demand",
    description:
      "Use Facebook and Instagram to introduce the right offer, test creative angles, and bring qualified prospects back into the funnel.",
    details: ["Audience and campaign architecture", "Creative testing strategy", "Retargeting sequences"],
    icon: "signal",
  },
] as const;

const services = [
  "Google Search Ads",
  "Google Local Services Ads",
  "Meta Ads (Facebook and Instagram)",
  "Retargeting campaigns",
  "Conversion tracking and attribution",
  "Advertising creative strategy",
  "Landing page and funnel optimization",
  "Ongoing campaign management",
];

const process = [
  {
    name: "Research",
    description: "Study the market, offer, economics, customer, search behavior, and competitive pressure before spend begins.",
  },
  {
    name: "Strategize",
    description: "Define channel roles, campaign architecture, conversion events, creative angles, landing paths, and measurement rules.",
  },
  {
    name: "Launch",
    description: "Build the account, tracking, ads, audiences, and destination experience with a controlled rollout and clear QA.",
  },
  {
    name: "Optimize",
    description: "Review search terms, audiences, creative, cost, conversion quality, and funnel friction—not isolated vanity metrics.",
  },
  {
    name: "Scale",
    description: "Expand only where the signal is strong enough to support more budget, new segments, or additional channels.",
  },
];

const faqs = [
  {
    question: "How is Intent Ads priced?",
    answer:
      "Every engagement is scoped individually. The commercial structure includes an upfront implementation fee and an ongoing monthly management retainer. Advertising spend is separate and paid to the advertising platforms.",
  },
  {
    question: "Is there a minimum advertising budget?",
    answer:
      "The right budget depends on your market, margins, sales capacity, geography, and channel economics. We recommend a range only after the initial assessment; we do not publish a universal minimum that ignores those variables.",
  },
  {
    question: "Do you guarantee leads or revenue?",
    answer:
      "No. Advertising performance depends on the market, offer, budget, sales process, competition, and customer experience. We build and manage for measurable business outcomes, but we do not promise a specific number of leads, customers, or revenue.",
  },
  {
    question: "Can you work with an existing Google Ads or Meta account?",
    answer:
      "Yes. We can assess an existing account, tracking setup, landing pages, and campaign history before recommending whether to repair, restructure, or rebuild parts of the system.",
  },
  {
    question: "Do you create the ads and landing pages?",
    answer:
      "Creative strategy and landing-page or funnel optimization can be included in scope. The exact production responsibilities are defined during planning so ownership, approvals, and timelines are clear before launch.",
  },
  {
    question: "How will I know what is working?",
    answer:
      "Reporting is designed around the journey from spend to qualified actions and customer outcomes. Where the available systems allow it, we connect platform data with calls, forms, pipeline stages, and revenue signals while clearly separating modeled or incomplete data.",
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b7ff4a] sm:text-xs">
      {children}
    </p>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChannelIcon({ name }: { name: "search" | "pin" | "signal" }) {
  if (name === "search") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M4 16.5V20h3.5M4.5 19.5l5-5 3.5 3.5L20 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 9H20v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="m3 8.2 3.1 3L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PerformanceDashboard() {
  const reduceMotion = useReducedMotion();
  const bars = [42, 58, 51, 68, 73, 64, 82, 88, 76, 92, 96, 100];

  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:ml-auto">
      <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-accent/[0.08] blur-3xl" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18, rotateX: 3 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.13] bg-[#03090d]/95 shadow-[0_28px_100px_rgba(0,0,0,0.55),0_0_45px_rgba(34,211,238,0.08)]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.09] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#b7ff4a] shadow-[0_0_12px_rgba(183,255,74,0.7)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.19em] text-slate-300">Acquisition command</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
            Illustrative demo
          </span>
        </div>

        <div className="grid gap-px bg-white/[0.08] sm:grid-cols-3">
          {[
            ["Qualified actions", "126", "+18.4%"],
            ["Cost / action", "$42.18", "-9.7%"],
            ["Tracked value", "$31.4k", "+24.1%"],
          ].map(([label, value, delta]) => (
            <div key={label} className="bg-[#03090d] px-4 py-4 sm:px-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{value}</span>
                <span className="font-mono text-[9px] text-[#b7ff4a]">{delta}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Acquisition signal</p>
                <p className="mt-1 text-sm font-medium text-slate-200">Qualified conversion trend</p>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 30 days
              </div>
            </div>
            <div className="relative mt-5 h-32 overflow-hidden sm:h-40">
              <div className="absolute inset-0 grid grid-rows-4">
                {[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-dashed border-white/[0.07]" />)}
              </div>
              <svg viewBox="0 0 420 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <defs>
                  <linearGradient id="ads-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 126 C25 124 37 104 60 108 C84 111 91 83 118 88 C145 93 157 69 181 76 C207 83 217 52 245 59 C271 65 286 38 310 48 C334 57 344 26 371 34 C394 41 404 20 420 18 L420 150 L0 150 Z"
                  fill="url(#ads-area)"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.45 }}
                />
                <motion.path
                  d="M0 126 C25 124 37 104 60 108 C84 111 91 83 118 88 C145 93 157 69 181 76 C207 83 217 52 245 59 C271 65 286 38 310 48 C334 57 344 26 371 34 C394 41 404 20 420 18"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.2"
                  vectorEffect="non-scaling-stroke"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.3, delay: 0.35, ease: "easeOut" }}
                />
                <motion.circle
                  cx="420"
                  cy="18"
                  r="4"
                  fill="#b7ff4a"
                  animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5], r: [3, 5, 3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </svg>
            </div>
            <div className="mt-2 flex h-7 items-end gap-1" aria-hidden="true">
              {bars.map((height, index) => (
                <motion.span
                  key={index}
                  className="flex-1 rounded-sm bg-[#b7ff4a]/35"
                  initial={reduceMotion ? false : { height: 2 }}
                  animate={{ height: `${Math.max(12, height / 4)}px` }}
                  transition={{ duration: 0.55, delay: 0.5 + index * 0.04 }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Channel mix</p>
              <div className="mt-4 space-y-3">
                {[
                  ["Search", "62%", "bg-accent"],
                  ["Local", "23%", "bg-[#b7ff4a]"],
                  ["Meta", "15%", "bg-blue-400"],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className="flex justify-between font-mono text-[9px] text-slate-400"><span>{label}</span><span>{value}</span></div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div
                        className={`h-full rounded-full ${color}`}
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: value }}
                        transition={{ duration: 0.8, delay: 0.65 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#b7ff4a]/20 bg-[#b7ff4a]/[0.045] p-4">
              <div className="flex items-center gap-2">
                <motion.span
                  className="h-2 w-2 rounded-full bg-[#b7ff4a]"
                  animate={reduceMotion ? undefined : { boxShadow: ["0 0 0 0 rgba(183,255,74,0)", "0 0 0 7px rgba(183,255,74,0.12)", "0 0 0 0 rgba(183,255,74,0)"] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#b7ff4a]">Signal healthy</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-300">Conversion path verified across ad, landing page, and qualified action.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">
            <span>Demo data · not client results</span>
            <span>Attribution window · illustrative</span>
          </div>
        </div>
      </motion.div>
      <div className="pointer-events-none absolute -bottom-5 -right-3 hidden rounded-lg border border-white/10 bg-[#061015]/95 px-4 py-3 shadow-2xl sm:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Latest event</p>
        <p className="mt-1 text-xs font-medium text-white"><span className="mr-2 text-[#b7ff4a]">●</span>Qualified action attributed</p>
      </div>
    </div>
  );
}

function AttributionJourney() {
  const reduceMotion = useReducedMotion();
  const steps = [
    ["01", "Ad viewed", "Meta prospecting"],
    ["02", "Search made", "Google Search"],
    ["03", "Lead captured", "Landing page"],
    ["04", "Outcome known", "CRM / call data"],
  ];
  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#03090d] p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Conversion journey</p>
          <p className="mt-2 text-lg font-semibold">From first signal to known outcome</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">Illustrative</span>
      </div>
      <div className="relative mt-7 grid gap-3 md:grid-cols-4">
        <div aria-hidden="true" className="absolute left-[8%] right-[8%] top-5 hidden h-px bg-white/10 md:block">
          <motion.span
            className="block h-px origin-left bg-gradient-to-r from-accent via-[#b7ff4a] to-blue-400"
            initial={reduceMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.1 }}
          />
        </div>
        {steps.map(([number, title, source], index) => (
          <motion.div
            key={title}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: index * 0.1 }}
            className="relative rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 md:border-0 md:bg-transparent md:p-0"
          >
            <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-[#03090d] font-mono text-[10px] text-accent shadow-[0_0_20px_rgba(34,211,238,0.12)]">{number}</span>
            <p className="mt-4 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{source}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AdsContent() {
  const [activeChannel, setActiveChannel] = useState<(typeof channels)[number]["id"]>("search");
  const selectedChannel = channels.find((channel) => channel.id === activeChannel) ?? channels[0];
  const reduceMotion = useReducedMotion();

  return (
    <main className="overflow-hidden pt-16">
      <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8 lg:pb-32 lg:pt-28">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_76%_25%,rgba(34,211,238,0.1),transparent_30%),radial-gradient(circle_at_20%_12%,rgba(183,255,74,0.05),transparent_24%)]" />
        <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 xl:gap-16">
          <div className="max-w-2xl">
            <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <SectionLabel>Intent Ads</SectionLabel>
            </motion.div>
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="mt-5 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl xl:text-[5.4rem]"
            >
              Turn Attention Into <span className="text-accent drop-shadow-[0_0_24px_rgba(34,211,238,0.22)]">Revenue.</span>
            </motion.h1>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.17 }}
              className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl"
            >
              Strategically engineered advertising campaigns designed to generate demand, acquire customers and scale your business.
            </motion.p>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <a href={CONSULTATION_TARGET} className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-accent px-7 py-4 text-center font-semibold text-oled shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                Build Your Acquisition Strategy <ArrowIcon />
              </a>
              <a href="#channels" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/15 bg-white/[0.03] px-6 py-4 font-semibold text-slate-200 transition hover:border-[#b7ff4a]/45 hover:text-[#b7ff4a]">
                Explore the system
              </a>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-500"
            >
              <span>Demand generation</span><span>Customer acquisition</span><span>Revenue attribution</span>
            </motion.div>
          </div>
          <PerformanceDashboard />
        </div>
      </section>

      <section id="channels" aria-labelledby="channels-heading" className="border-y border-white/[0.08] bg-[#020608]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <SectionLabel>Channels with a job to do</SectionLabel>
              <h2 id="channels-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Meet demand. Create demand. Bring it back.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-300 lg:ml-auto">
              Every platform plays a different role. We design the channel mix around how your customers discover, evaluate, and choose—not around a prebuilt media package.
            </p>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-2xl border border-white/10 bg-[#03090d] lg:grid-cols-[0.85fr_1.15fr]">
            <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(channel.id)}
                  aria-pressed={activeChannel === channel.id}
                  className={`flex w-full items-center gap-4 rounded-xl px-4 py-5 text-left transition ${activeChannel === channel.id ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200"}`}
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${activeChannel === channel.id ? "border-[#b7ff4a]/35 bg-[#b7ff4a]/[0.06] text-[#b7ff4a]" : "border-white/10 text-slate-500"}`}><ChannelIcon name={channel.icon} /></span>
                  <span>
                    <span className="block font-semibold">{channel.label}</span>
                    <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">{channel.eyebrow}</span>
                  </span>
                  <span className="ml-auto font-mono text-xs text-slate-600">0{channels.findIndex((item) => item.id === channel.id) + 1}</span>
                </button>
              ))}
            </div>
            <motion.div key={selectedChannel.id} initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="relative min-h-[360px] p-6 sm:p-10">
              <div aria-hidden="true" className="absolute right-0 top-0 h-56 w-56 bg-[radial-gradient(circle,rgba(34,211,238,0.11),transparent_65%)]" />
              <SectionLabel>{selectedChannel.eyebrow}</SectionLabel>
              <h3 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{selectedChannel.label}</h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{selectedChannel.description}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {selectedChannel.details.map((detail) => (
                  <li key={detail} className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4 text-sm leading-6 text-slate-300">
                    <span className="mb-3 grid h-6 w-6 place-items-center rounded-full bg-accent/10 text-accent"><CheckIcon /></span>{detail}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => (
              <div key={service} className="flex min-h-24 items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="font-mono text-[10px] text-[#b7ff4a]">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-sm font-medium leading-6 text-slate-200">{service}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="revenue-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <SectionLabel>Traffic is not the finish line</SectionLabel>
            <h2 id="revenue-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">The click is a handoff. The customer is the outcome.</h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">Media buying only works as a growth system when the ad, offer, landing experience, follow-up, sales process, and measurement layer can carry the same intent forward.</p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Traffic-first thinking</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-200">Optimize the media report.</h3>
              <ul className="mt-7 space-y-4 text-slate-400">
                {["Celebrate impressions without knowing who became a customer", "Send every audience to the same generic page", "Count every form fill as equally valuable", "Increase spend before the conversion path is understood"].map((item) => (
                  <li key={item} className="flex gap-3 border-b border-white/[0.06] pb-4"><span className="mt-1 font-mono text-xs text-slate-600">×</span><span className="leading-7">{item}</span></li>
                ))}
              </ul>
            </article>
            <article className="relative overflow-hidden rounded-2xl border border-[#b7ff4a]/25 bg-[#b7ff4a]/[0.035] p-6 sm:p-8">
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#b7ff4a]/10 blur-3xl" />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b7ff4a]">Revenue-first engineering</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Optimize the acquisition system.</h3>
              <ul className="mt-7 space-y-4 text-slate-200">
                {["Define qualified actions before the campaign launches", "Match message, audience, offer, and destination", "Inspect lead quality and downstream outcomes", "Scale from evidence—not from platform pressure"].map((item) => (
                  <li key={item} className="flex gap-3 border-b border-[#b7ff4a]/10 pb-4"><span className="mt-1 text-[#b7ff4a]"><CheckIcon /></span><span className="leading-7">{item}</span></li>
                ))}
              </ul>
            </article>
          </div>
          <div className="mt-5"><AttributionJourney /></div>
        </div>
      </section>

      <section aria-labelledby="process-heading" className="border-y border-white/[0.08] bg-[#020608]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>Our process</SectionLabel>
            <h2 id="process-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">A disciplined path from uncertainty to scalable signal.</h2>
          </div>
          <ol className="relative mt-12 grid gap-4 lg:grid-cols-5">
            <div aria-hidden="true" className="absolute left-[9%] right-[9%] top-6 hidden h-px bg-gradient-to-r from-accent/20 via-[#b7ff4a]/40 to-accent/20 lg:block" />
            {process.map((step, index) => (
              <motion.li key={step.name} initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ delay: index * 0.08 }} className="relative rounded-2xl border border-white/[0.08] bg-[#03090d] p-5 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-4">
                <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-accent/30 bg-[#03090d] font-mono text-[11px] text-accent shadow-[0_0_24px_rgba(34,211,238,0.1)]">0{index + 1}</span>
                <h3 className="mt-6 text-xl font-semibold text-white">{step.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="management-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Management and reporting</SectionLabel>
            <h2 id="management-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">A living acquisition system—not a set-and-forget campaign.</h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">Campaigns are monitored and improved through a recurring operating cadence. The reporting layer is built to make decisions easier: what changed, why it matters, and what happens next.</p>
            <div className="mt-8 space-y-3">
              {[
                ["Signal review", "Search terms, audience response, lead quality, tracking integrity, and budget pacing."],
                ["Experimentation", "Deliberate tests across ads, offers, landing experiences, and campaign structure."],
                ["Decision reporting", "Performance context, notable changes, priorities, and recommended next actions."],
              ].map(([title, body]) => (
                <div key={title} className="grid gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-[9rem_1fr] sm:gap-5">
                  <p className="font-semibold text-white">{title}</p><p className="text-sm leading-6 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#03090d] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Performance view</p><h3 className="mt-2 text-xl font-semibold text-white">Spend → signal → outcome</h3></div>
              <span className="rounded-full border border-[#b7ff4a]/20 bg-[#b7ff4a]/[0.05] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[#b7ff4a]">Illustrative only</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Media spend", "$8.4k"], ["Qualified leads", "86"], ["Booked", "31"], ["Known customers", "14"]].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
              <div className="flex justify-between"><p className="text-sm font-medium text-slate-200">Outcome composition</p><p className="font-mono text-[9px] text-slate-500">DEMO DATA</p></div>
              <div className="mt-6 flex h-36 items-end gap-2">
                {[28, 41, 35, 55, 48, 70, 61, 82, 75, 90, 86, 100].map((height, index) => (
                  <motion.div key={index} initial={reduceMotion ? false : { height: 0 }} whileInView={{ height: `${height}%` }} viewport={{ once: true }} transition={{ duration: 0.55, delay: index * 0.04 }} className="relative flex-1 overflow-hidden rounded-t-sm bg-gradient-to-t from-accent/20 to-accent/80">
                    {index === 11 ? <span className="absolute inset-x-0 top-0 h-1 bg-[#b7ff4a]" /> : null}
                  </motion.div>
                ))}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[8px] uppercase tracking-wider text-slate-600"><span>Launch</span><span>Optimization cycles</span><span>Current</span></div>
            </div>
            <div className="mt-5 rounded-xl border border-accent/15 bg-accent/[0.035] p-4">
              <p className="text-sm leading-6 text-slate-300"><span className="font-semibold text-white">Commercial structure:</span> upfront implementation fee + ongoing monthly management retainer. Media spend is separate and paid to the advertising platforms.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="ecosystem-heading" className="border-y border-white/[0.08] bg-[#020608]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <SectionLabel>The Intent ecosystem</SectionLabel>
              <h2 id="ecosystem-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Paid acquisition works harder when the rest of the revenue system can receive it.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-300 lg:ml-auto">Intent Ads can operate independently or connect with the broader Intent Revenue stack—aligning the message people see, the destination they reach, the follow-up they receive, and the growth paths available beyond paid media.</p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-stretch">
            <Link href="/content" className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition hover:border-accent/30 hover:bg-white/[0.035]">
              <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Message</p><h3 className="mt-3 text-2xl font-semibold text-white">Intent Content</h3><p className="mt-4 leading-7 text-slate-400">Develop the ideas, offers, and creative inputs that help campaigns earn attention and build familiarity.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">Explore Intent Content <ArrowIcon /></span>
            </Link>
            <div className="relative overflow-hidden rounded-2xl border border-[#b7ff4a]/25 bg-[#b7ff4a]/[0.04] p-6 sm:p-8">
              <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,255,74,0.12),transparent_55%)]" />
              <div className="relative"><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#b7ff4a]">Demand engine</p><h3 className="mt-3 text-3xl font-semibold text-white">Intent Ads</h3><p className="mt-4 leading-7 text-slate-300">Put the right message in front of the right market, then measure how attention moves toward qualified customer action.</p><div className="mt-8 grid grid-cols-3 gap-2 text-center font-mono text-[9px] uppercase tracking-wider text-slate-400">{["Acquire", "Attribute", "Optimize"].map((item) => <span key={item} className="rounded-lg border border-[#b7ff4a]/15 bg-black/20 px-2 py-3">{item}</span>)}</div></div>
            </div>
            <div className="grid gap-4">
              <Link href="/b2b" className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-accent/30 hover:bg-white/[0.035]"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">New markets</p><h3 className="mt-2 text-xl font-semibold text-white">Intent B2B</h3><p className="mt-2 text-sm leading-6 text-slate-400">Pursue commercial buyers and account-based growth beyond inbound demand.</p></Link>
              <Link href="/leadnet" className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-accent/30 hover:bg-white/[0.035]"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Destination + follow-up</p><h3 className="mt-2 text-xl font-semibold text-white">Intent LeadNet</h3><p className="mt-2 text-sm leading-6 text-slate-400">Strengthen the website destination and, when selected, the inquiry follow-up path.</p></Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <SectionLabel>Frequently asked questions</SectionLabel>
            <h2 id="faq-heading" className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Before we build the plan.</h2>
            <p className="mt-5 leading-7 text-slate-400">Straight answers about scope, spend, production, measurement, and expectations.</p>
          </div>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {faqs.map((faq, index) => (
              <details key={faq.question} className="group py-1" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left font-semibold text-white marker:content-none">
                  <span>{faq.question}</span><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 font-mono text-sm text-slate-400 transition group-open:rotate-45 group-open:border-accent/30 group-open:text-accent">+</span>
                </summary>
                <p className="max-w-3xl pb-6 pr-10 leading-7 text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-accent/20 bg-[#041015] px-6 py-14 text-center sm:px-10 sm:py-20">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_48%),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] [background-size:auto,52px_52px,52px_52px]" />
          <div className="relative mx-auto max-w-4xl">
            <SectionLabel>Build the channel</SectionLabel>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">Your next customer acquisition system starts with the right questions.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Tell us what you sell, who you need to reach, and what a good customer is worth. We’ll assess the path before recommending media.</p>
            <a href={CONSULTATION_TARGET} className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-accent px-7 py-4 font-semibold text-oled shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300">Build Your Acquisition Strategy <ArrowIcon /></a>
          </div>
        </div>
      </section>

      <InquiryFormSection id="ads-consultation" mode="ads" />
    </main>
  );
}
