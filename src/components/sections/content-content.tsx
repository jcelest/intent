"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { InquiryFormSection } from "@/components/sections/inquiry-form-section";

const CONSULTATION_TARGET = "#content-consultation";
const CONTENT_SIGNAL = "#ff6b5f";

const capabilities = [
  { number: "01", title: "High-volume content production", description: "A repeatable production system built to sustain meaningful monthly output." },
  { number: "02", title: "Short-form video", description: "Editing and production structured for vertical, attention-first viewing." },
  { number: "03", title: "Creative direction", description: "A clear strategic point of view across subjects, formats, hooks, and visual language." },
  { number: "04", title: "Scriptwriting and storytelling", description: "Narratives that create clarity, tension, relevance, and a reason to keep watching." },
  { number: "05", title: "Graphics and carousels", description: "Branded visual systems that make ideas useful, recognizable, and easy to share." },
  { number: "06", title: "Competitor and trend research", description: "Ongoing observation of market conversations, creative patterns, and open territory." },
  { number: "07", title: "Organic social management", description: "Publishing operations that keep the calendar moving across approved channels." },
  { number: "08", title: "Advertising creative", description: "Creative concepts and production inputs designed to support paid campaign testing." },
  { number: "09", title: "Cross-platform distribution", description: "Platform-aware publishing across Instagram, TikTok, Facebook, and YouTube." },
  { number: "10", title: "Analytics and iteration", description: "Creative review that turns audience response into the next production decision." },
];

const productionSteps = [
  { name: "Research", description: "Map the market, customer questions, competitor patterns, platform behavior, and timely opportunities." },
  { name: "Strategize", description: "Build content pillars, format mix, creative angles, cadence, and distribution roles around the business." },
  { name: "Produce", description: "Write, design, edit, and assemble original creative through a structured high-volume workflow." },
  { name: "Distribute", description: "Publish approved creative across the right channels with platform-aware presentation and timing." },
  { name: "Analyze", description: "Review attention signals, retention, interactions, themes, and format performance in context." },
  { name: "Iterate", description: "Carry the strongest signals into the next creative cycle without letting the system become repetitive." },
];

const packages = [
  {
    name: "Growth",
    monthly: 25,
    annual: "300",
    statement: "Build a consistent, credible presence with enough output to learn what earns attention.",
  },
  {
    name: "Authority",
    monthly: 50,
    annual: "600",
    statement: "Increase creative coverage, test more ideas, and establish a stronger voice across the market.",
  },
  {
    name: "Domination",
    monthly: 100,
    annual: "1,200",
    statement: "Operate at category-level volume with a production engine built for sustained creative pressure.",
  },
];

const faqs = [
  {
    question: "What counts as an original content piece?",
    answer: "An original piece is a distinct creative asset produced for the agreed content strategy. Depending on the plan, that may be a short-form video, branded graphic, or carousel. Republishing the same original asset across multiple platforms does not increase the original production count.",
  },
  {
    question: "Does every package include posting and distribution?",
    answer: "Yes. Every package includes strategy, creative development, production, distribution, and performance analysis within the agreed scope. The channel mix and publishing workflow are defined during onboarding.",
  },
  {
    question: "Will every month use the same mix of videos, graphics, and carousels?",
    answer: "Not necessarily. The format mix follows the strategy, available source material, platform needs, and what the creative analysis suggests. We define the production plan before each cycle rather than forcing every business into the same template.",
  },
  {
    question: "Do you guarantee views, followers, virality, or revenue?",
    answer: "No. Organic performance is influenced by the market, platforms, audience, brand, subject matter, timing, and many factors outside any production team’s control. We commit to the agreed production system and continuous creative improvement—not guaranteed reach, followers, virality, or revenue.",
  },
  {
    question: "What do you need from our team?",
    answer: "The exact workflow depends on the content model. We may need subject-matter access, brand assets, approvals, source footage, filming participation, product information, or operational context. Roles and review expectations are established before production begins.",
  },
  {
    question: "Can Intent Content also make creative for paid ads?",
    answer: "Yes. Advertising creative production can be included in scope, and Intent Content can coordinate directly with Intent Ads so paid performance signals inform new concepts and production priorities.",
  },
  {
    question: "How are packages priced?",
    answer: "Pricing is not published yet. Scope depends on the monthly volume, creative mix, filming requirements, platform responsibilities, approval workflow, and production complexity. A consultation is used to define the right package and implementation plan.",
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-[#ff7a70] sm:text-xs">
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

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
      <path d="m7 5 8 5-8 5V5Z" fill="currentColor" />
    </svg>
  );
}

function ContentShowcase() {
  const reduceMotion = useReducedMotion();
  const frames = [
    { label: "Explain", headline: "Make the complex obvious.", color: "#22d3ee", delay: 0.15 },
    { label: "Provoke", headline: "The safe idea disappears.", color: "#ff6b5f", delay: 0.28 },
    { label: "Teach", headline: "Give them a reason to return.", color: "#ffd166", delay: 0.4 },
  ];

  return (
    <div className="relative mx-auto min-w-0 max-w-[660px] lg:ml-auto">
      <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-[#ff6b5f]/[0.07] blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#050708]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#ff6b5f] shadow-[0_0_12px_rgba(255,107,95,0.65)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">Creative production floor</span>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Demo creative</span>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-[0.72fr_1fr_0.72fr] sm:p-5">
          {frames.map((frame, index) => (
            <motion.article
              key={frame.label}
              initial={reduceMotion ? false : { opacity: 0, y: index === 1 ? 20 : 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: frame.delay }}
              className={`relative overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0e10] ${index === 1 ? "sm:-mt-2 sm:mb-2" : "sm:mt-7"}`}
            >
              <div className="relative aspect-[4/5] min-h-[230px] overflow-hidden sm:min-h-0">
                <div aria-hidden="true" className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at ${index === 0 ? "20% 25%" : index === 1 ? "80% 30%" : "50% 70%"}, ${frame.color}55, transparent 42%)` }} />
                <div aria-hidden="true" className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:24px_24px]" />
                {index === 0 ? (
                  <div aria-hidden="true" className="absolute -bottom-6 -right-7 h-32 w-32 rounded-full border-[18px] border-accent/25" />
                ) : index === 1 ? (
                  <motion.div aria-hidden="true" animate={reduceMotion ? undefined : { rotate: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute right-5 top-9 grid h-24 w-24 place-items-center border border-[#ff6b5f]/45 bg-[#ff6b5f]/10 text-4xl font-semibold text-[#ff6b5f]">!</motion.div>
                ) : (
                  <div aria-hidden="true" className="absolute left-5 top-8 space-y-2">{["w-24", "w-16", "w-20"].map((width, i) => <span key={i} className={`block h-2 ${width} rounded-full bg-[#ffd166]/30`} />)}</div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.17em]" style={{ color: frame.color }}>{frame.label}</p>
                  <h3 className="mt-2 text-balance text-xl font-semibold leading-tight text-white sm:text-lg lg:text-xl">{frame.headline}</h3>
                </div>
                <div className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/50 text-white"><PlayIcon /></div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.08] px-3 py-2 font-mono text-[8px] uppercase tracking-wider text-slate-600"><span>9:16</span><span>Concept {String(index + 1).padStart(2, "0")}</span></div>
            </motion.article>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-white/[0.08] bg-white/[0.08]">
          {[["Monthly engine", "25–100"], ["Original assets", "Built to scope"], ["Platforms", "4"]].map(([label, value]) => (
            <div key={label} className="bg-[#050708] px-3 py-3 sm:px-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-slate-600">{label}</p>
              <p className="mt-1 text-xs font-semibold text-white sm:text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.75 }}
        className="pointer-events-none absolute -bottom-5 -right-3 hidden rounded-lg border border-white/10 bg-[#080b0d]/95 px-4 py-3 shadow-2xl sm:block"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Production queue</p>
        <p className="mt-1 text-xs font-medium text-white"><span className="mr-2 text-[#ff6b5f]">●</span>12 creative concepts in motion</p>
      </motion.div>
    </div>
  );
}

function VolumeVisualizer() {
  const [volume, setVolume] = useState<25 | 50 | 100>(50);
  const reduceMotion = useReducedMotion();
  const annual = volume * 12;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-[#050708] lg:grid-cols-[0.72fr_1.28fr]">
      <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Monthly production volume</p>
        <div className="mt-5 space-y-3">
          {packages.map((item) => (
            <button
              key={item.monthly}
              type="button"
              onClick={() => setVolume(item.monthly as 25 | 50 | 100)}
              aria-pressed={volume === item.monthly}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition ${volume === item.monthly ? "border-[#ff6b5f]/45 bg-[#ff6b5f]/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}
            >
              <span><span className={`block font-mono text-[9px] uppercase tracking-[0.15em] ${volume === item.monthly ? "text-[#ff7a70]" : "text-slate-600"}`}>{item.name}</span><span className="mt-1 block text-lg font-semibold text-white">{item.monthly} pieces</span></span>
              <span className={`grid h-8 w-8 place-items-center rounded-full border font-mono text-[10px] ${volume === item.monthly ? "border-[#ff6b5f]/40 text-[#ff7a70]" : "border-white/10 text-slate-600"}`}>→</span>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Annualized original output</p>
          <motion.p key={annual} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-4xl font-semibold tracking-tight text-white">{annual.toLocaleString()}</motion.p>
          <p className="mt-2 text-xs leading-5 text-slate-500">At the selected monthly production level.</p>
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff7a70]">The volume field</p><h3 className="mt-2 text-2xl font-semibold text-white">Every cell is one original piece.</h3></div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">Interactive demonstration</span>
        </div>
        <div className="mt-7 grid grid-cols-10 gap-1.5 sm:gap-2" aria-label={`${volume} of 100 content cells active`}>
          {Array.from({ length: 100 }).map((_, index) => {
            const active = index < volume;
            const type = index % 5;
            return (
              <motion.span
                key={index}
                initial={false}
                animate={{ opacity: active ? 1 : 0.16, scale: active ? 1 : 0.9, backgroundColor: active ? (type === 0 ? "#22d3ee" : type === 1 || type === 3 ? CONTENT_SIGNAL : "#ffd166") : "#334155" }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index, volume) * 0.003 }}
                className="aspect-square rounded-[3px]"
              />
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#ff6b5f]" /> Short-form video</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#ffd166]" /> Graphics</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-accent" /> Carousels</span>
        </div>
        <p className="mt-5 border-t border-white/[0.08] pt-5 text-sm leading-6 text-slate-400">The visualization demonstrates production scale, not a guaranteed format mix. Actual content may include short-form video, graphics, and carousels based on the client strategy. Cross-platform republishing does not count toward original production volume.</p>
      </div>
    </div>
  );
}

function DistributionVisual() {
  const reduceMotion = useReducedMotion();
  const platforms = [
    { name: "Instagram", role: "Reels · Carousels · Graphics", color: "#ff6b5f" },
    { name: "TikTok", role: "Vertical video · Native edits", color: "#22d3ee" },
    { name: "Facebook", role: "Video · Graphics · Community", color: "#60a5fa" },
    { name: "YouTube", role: "Shorts · Video library", color: "#ffd166" },
  ];

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-[#050708] p-5 sm:p-8">
      <div aria-hidden="true" className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff7a70]">Distribution system</p><h3 className="mt-2 text-2xl font-semibold text-white">One production engine. Four platform roles.</h3></div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">Workflow demonstration</span>
      </div>

      <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:min-h-[380px] lg:grid-cols-2 lg:content-between">
        <svg aria-hidden="true" viewBox="0 0 800 340" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full lg:block">
          {[
            "M400 170 C300 170 300 55 160 55",
            "M400 170 C500 170 500 55 640 55",
            "M400 170 C300 170 300 285 160 285",
            "M400 170 C500 170 500 285 640 285",
          ].map((path, index) => (
            <motion.path key={path} d={path} fill="none" stroke={platforms[index].color} strokeOpacity="0.38" strokeWidth="1.3" strokeDasharray="4 5" initial={reduceMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.9, delay: index * 0.1 }} />
          ))}
        </svg>
        {platforms.map((platform, index) => (
          <motion.div key={platform.name} initial={reduceMotion ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ delay: index * 0.08 }} className={`relative z-10 rounded-xl border border-white/[0.09] bg-[#090d0f] p-4 lg:w-[43%] ${index % 2 === 1 ? "lg:ml-auto" : ""}`}>
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border text-sm font-semibold" style={{ borderColor: `${platform.color}55`, color: platform.color, backgroundColor: `${platform.color}0d` }}>{platform.name.slice(0, 1)}</span><div><p className="font-semibold text-white">{platform.name}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.11em] text-slate-600">{platform.role}</p></div></div>
          </motion.div>
        ))}
        <div className="relative z-20 rounded-2xl border border-[#ff6b5f]/35 bg-[#ff6b5f]/[0.07] p-5 sm:col-span-2 lg:absolute lg:left-1/2 lg:top-1/2 lg:w-60 lg:-translate-x-1/2 lg:-translate-y-1/2">
          <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#ff7a70]">Original master assets</p>
          <p className="mt-2 text-xl font-semibold text-white">Created once. Prepared with purpose.</p>
          <p className="mt-3 text-xs leading-5 text-slate-400">Republishing extends distribution; it does not inflate the original content count.</p>
        </div>
      </div>
    </div>
  );
}

export function ContentContent() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="overflow-hidden pt-16">
      <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8 lg:pb-32 lg:pt-28">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(255,107,95,0.11),transparent_30%),radial-gradient(circle_at_18%_15%,rgba(34,211,238,0.08),transparent_27%)]" />
        <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:70px_70px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        <div className="relative mx-auto grid max-w-7xl min-w-0 items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div className="min-w-0 max-w-2xl">
            <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><SectionLabel>Intent Content</SectionLabel></motion.div>
            <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }} className="mt-5 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
              Become Impossible <span className="text-[#ff756a] drop-shadow-[0_0_22px_rgba(255,107,95,0.2)]">to Ignore.</span>
            </motion.h1>
            <motion.p initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.17 }} className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              High-volume content production. Strategic distribution. Relentless creative execution. Built for businesses that want to own attention in their market.
            </motion.p>
            <motion.div initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={CONSULTATION_TARGET} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#ff6b5f] px-7 py-4 text-center font-semibold text-black shadow-[0_0_30px_rgba(255,107,95,0.18)] transition hover:bg-[#ff8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b5f] focus-visible:ring-offset-2 focus-visible:ring-offset-black">Build Your Content Engine <ArrowIcon /></a>
              <a href="#volume" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-white/15 bg-white/[0.03] px-6 py-4 font-semibold text-slate-200 transition hover:border-[#ff6b5f]/45 hover:text-[#ff8b82]">See the volume</a>
            </motion.div>
            <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-500"><span>Volume</span><span>Velocity</span><span>Creativity</span><span>Iteration</span></motion.div>
          </div>
          <ContentShowcase />
        </div>
      </section>

      <section aria-labelledby="philosophy-heading" className="border-y border-white/[0.08] bg-[#020506]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end"><div><SectionLabel>The operating philosophy</SectionLabel><h2 id="philosophy-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Attention compounds when the creative system keeps moving.</h2></div><p className="max-w-2xl text-lg leading-8 text-slate-300 lg:ml-auto">Intent Content is not a calendar-filling social media service. It is an ongoing creative operation built to publish more useful ideas, learn faster, and make the brand increasingly difficult to overlook.</p></div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {[
              ["01", "Volume.", "More original creative means more opportunities to enter the market’s attention, answer questions, reveal expertise, and test ideas."],
              ["02", "Velocity.", "A production engine shortens the distance between insight and execution so the brand can respond while the opportunity is still relevant."],
              ["03", "Creativity.", "Output without original thinking becomes noise. Every cycle needs new hooks, formats, stories, and ways to make the business worth noticing."],
            ].map(([number, title, body], index) => (
              <motion.article key={title} initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ delay: index * 0.09 }} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050708] p-6 sm:p-8"><span className="font-mono text-[10px] text-[#ff7a70]">{number}</span><h3 className="mt-12 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h3><p className="mt-5 leading-7 text-slate-400">{body}</p><span aria-hidden="true" className="absolute -right-5 -top-8 text-[10rem] font-semibold leading-none text-white/[0.025]">{number}</span></motion.article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="capabilities-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl"><SectionLabel>Production capabilities</SectionLabel><h2 id="capabilities-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">From blank page to active market presence.</h2><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Strategy, writing, design, editing, publishing, and analysis operate as one system—so creative does not stall between disconnected vendors or sporadic bursts of inspiration.</p></div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {capabilities.map((item, index) => (
              <motion.article key={item.title} initial={reduceMotion ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: (index % 5) * 0.05 }} className={`group min-h-56 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:-translate-y-1 hover:border-[#ff6b5f]/30 hover:bg-[#ff6b5f]/[0.025] ${index === 0 || index === 7 ? "lg:col-span-2" : ""}`}><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-[#ff7a70]">{item.number}</span><span className="h-1.5 w-1.5 rounded-full bg-slate-700 transition group-hover:bg-[#ff6b5f]" /></div><h3 className="mt-10 text-xl font-semibold leading-tight text-white">{item.title}</h3><p className="mt-4 text-sm leading-6 text-slate-400">{item.description}</p></motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="volume" aria-labelledby="volume-heading" className="scroll-mt-20 border-y border-white/[0.08] bg-[#020506]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl"><div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><SectionLabel>See the scale</SectionLabel><h2 id="volume-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Twenty-five is a cadence. One hundred is a media operation.</h2></div><p className="max-w-2xl text-lg leading-8 text-slate-300 lg:ml-auto">Switch between production levels to see the monthly and annual scale. Each active cell represents one original creative asset—not another platform repost.</p></div><div className="mt-12"><VolumeVisualizer /></div></div>
      </section>

      <section aria-labelledby="distribution-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div><SectionLabel>Cross-platform distribution</SectionLabel><h2 id="distribution-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Built centrally. Distributed natively.</h2><p className="mt-6 text-lg leading-8 text-slate-300">The core idea stays consistent while presentation, framing, captions, and publishing decisions account for the role of each selected platform.</p><div className="mt-8 space-y-3">{["Instagram", "TikTok", "Facebook", "YouTube"].map((platform, index) => <div key={platform} className="flex items-center justify-between border-b border-white/[0.08] py-3"><span className="font-medium text-slate-200">{platform}</span><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-600">Channel 0{index + 1}</span></div>)}</div></div>
          <DistributionVisual />
        </div>
      </section>

      <section aria-labelledby="engine-heading" className="border-y border-white/[0.08] bg-[#020506]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl"><div className="max-w-3xl"><SectionLabel>The production engine</SectionLabel><h2 id="engine-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">A creative loop designed to get smarter.</h2><p className="mt-5 text-lg leading-8 text-slate-300">Production is not the end of the process. Audience response returns to the system and shapes what gets researched, written, designed, and tested next.</p></div>
          <ol className="relative mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6"><div aria-hidden="true" className="absolute left-[7%] right-[7%] top-6 hidden h-px bg-gradient-to-r from-[#ff6b5f]/25 via-accent/35 to-[#ffd166]/25 lg:block" />{productionSteps.map((step, index) => <motion.li key={step.name} initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ delay: index * 0.07 }} className="relative rounded-2xl border border-white/[0.08] bg-[#050708] p-5 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-3"><span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-[#ff6b5f]/35 bg-[#050708] font-mono text-[10px] text-[#ff7a70] shadow-[0_0_22px_rgba(255,107,95,0.09)]">0{index + 1}</span><h3 className="mt-6 text-lg font-semibold text-white">{step.name}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p></motion.li>)}</ol>
          <div className="mt-10 flex items-center gap-4 rounded-xl border border-accent/15 bg-accent/[0.03] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent/30 font-mono text-xs text-accent">↻</span><p className="text-sm leading-6 text-slate-300"><strong className="text-white">The loop matters:</strong> iteration keeps high volume from becoming high repetition.</p></div>
        </div>
      </section>

      <section id="packages" aria-labelledby="packages-heading" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-4xl text-center"><SectionLabel>Service packages</SectionLabel><h2 id="packages-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">Choose the pressure you want to put on the market.</h2><p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">Every tier includes content strategy, creative development, production, distribution, and performance analysis. Final scope is defined through consultation.</p></div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {packages.map((item, index) => (
              <article key={item.name} className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 sm:p-8 ${index === 1 ? "border-[#ff6b5f]/40 bg-[#ff6b5f]/[0.045] shadow-[0_0_45px_rgba(255,107,95,0.08)]" : "border-white/10 bg-[#050708]"}`}>
                {index === 1 ? <span className="absolute right-5 top-5 rounded-full border border-[#ff6b5f]/30 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.13em] text-[#ff7a70]">Expanded cadence</span> : null}
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff7a70]">{item.name}</p>
                <div className="mt-10"><span className="text-7xl font-semibold tracking-[-0.07em] text-white">{item.monthly}</span><span className="ml-3 text-sm text-slate-400">original pieces / month</span></div>
                <div className="mt-6 border-y border-white/[0.08] py-5"><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Annual production</p><p className="mt-2 text-2xl font-semibold text-white">{item.annual} original pieces</p></div>
                <p className="mt-6 min-h-20 leading-7 text-slate-400">{item.statement}</p>
                <ul className="mt-7 space-y-3 text-sm text-slate-300">{["Strategy and creative direction", "Production and approved distribution", "Performance analysis and iteration"].map((benefit) => <li key={benefit} className="flex gap-3"><span className="text-[#ff7a70]">✓</span>{benefit}</li>)}</ul>
                <a href={CONSULTATION_TARGET} className={`mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-center font-semibold transition ${index === 1 ? "bg-[#ff6b5f] text-black hover:bg-[#ff8178]" : "border border-white/15 bg-white/[0.03] text-white hover:border-[#ff6b5f]/40 hover:text-[#ff8b82]"}`}>Discuss {item.name} <ArrowIcon /></a>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center text-sm leading-6 text-slate-400">Content may include short-form videos, graphics, and carousels depending on the client strategy. Cross-platform republishing does not count toward original production volume. Pricing is individually scoped and is not displayed publicly.</div>
        </div>
      </section>

      <section aria-labelledby="integration-heading" className="border-y border-white/[0.08] bg-[#020506]/80 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div><SectionLabel>Content × paid acquisition</SectionLabel><h2 id="integration-heading" className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">Organic attention creates ideas. Paid media puts the strongest ideas under pressure.</h2><p className="mt-6 text-lg leading-8 text-slate-300">Intent Content and Intent Ads can operate independently or as a connected creative feedback system—sharing audience questions, winning hooks, format signals, and production priorities.</p><Link href="/ads" className="mt-8 inline-flex items-center gap-2 font-semibold text-accent hover:underline">Explore Intent Ads <ArrowIcon /></Link></div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050708] p-5 sm:p-8">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(255,107,95,0.09),transparent_33%),radial-gradient(circle_at_82%_50%,rgba(34,211,238,0.09),transparent_33%)]" />
            <div className="relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-2xl border border-[#ff6b5f]/30 bg-[#ff6b5f]/[0.05] p-6"><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#ff7a70]">Intent Content</p><h3 className="mt-3 text-2xl font-semibold text-white">Create the signal.</h3><ul className="mt-5 space-y-3 text-sm text-slate-400"><li>Organic themes</li><li>Hook and format testing</li><li>Advertising creative production</li></ul></div>
              <div className="flex items-center justify-center sm:flex-col"><span className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black font-mono text-sm text-slate-300">⇄</span></div>
              <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-6"><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-accent">Intent Ads</p><h3 className="mt-3 text-2xl font-semibold text-white">Test the signal.</h3><ul className="mt-5 space-y-3 text-sm text-slate-400"><li>Paid audience response</li><li>Creative performance patterns</li><li>New iteration priorities</li></ul></div>
            </div>
            <div className="relative mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Create → distribute → measure → inform the next production cycle</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="content-faq-heading" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.65fr_1.35fr]"><div><SectionLabel>Frequently asked questions</SectionLabel><h2 id="content-faq-heading" className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">What the engine does—and what it does not promise.</h2><p className="mt-5 leading-7 text-slate-400">Clear expectations around production, distribution, collaboration, and outcomes.</p></div><div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">{faqs.map((faq, index) => <details key={faq.question} className="group py-1" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left font-semibold text-white marker:content-none"><span>{faq.question}</span><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 font-mono text-sm text-slate-400 transition group-open:rotate-45 group-open:border-[#ff6b5f]/35 group-open:text-[#ff7a70]">+</span></summary><p className="max-w-3xl pb-6 pr-10 leading-7 text-slate-400">{faq.answer}</p></details>)}</div></div>
      </section>

      <section className="px-4 pb-6 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#ff6b5f]/25 bg-[#100808] px-6 py-14 text-center sm:px-10 sm:py-20"><div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,107,95,0.18),transparent_50%),linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]" /><div className="relative mx-auto max-w-4xl"><SectionLabel>Build the engine</SectionLabel><h2 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">The market cannot remember a brand it rarely sees.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Tell us what you know, who needs to hear it, and how much creative pressure you want to build. We’ll map the production system around your business.</p><a href={CONSULTATION_TARGET} className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#ff6b5f] px-7 py-4 font-semibold text-black shadow-[0_0_30px_rgba(255,107,95,0.18)] transition hover:bg-[#ff8178]">Build Your Content Engine <ArrowIcon /></a></div></div>
      </section>

      <InquiryFormSection id="content-consultation" mode="content" />
    </main>
  );
}
