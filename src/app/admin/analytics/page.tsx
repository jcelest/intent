"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutLink } from "@/components/admin/logout-link";
import { motion } from "framer-motion";

// Vibrant accent colors
const VIBRANT_CYAN = "#00e5ff";
const MUTED_BEFORE = "#94a3b8";
const ACCENT_VIOLET = "#a78bfa";
const ACCENT_EMERALD = "#34d399";
const ACCENT_AMBER = "#fbbf24";

type BusinessId = string;

// Each company has unique mock data + visual theme
const BUSINESSES: Array<{
  id: BusinessId;
  name: string;
  joinedDate: string;
  accentColor: string;
  chartLayout: "area-dominant" | "bar-dominant" | "mixed" | "compact";
  metrics: {
    revenue: { before: number[]; after: number[] };
    traffic: { before: number[]; after: number[] };
    leads: { before: number[]; after: number[] };
    conversionRate: { before: number; after: number };
    aiCalls: { before: number; after: number };
  };
}> = [
  {
    id: "acme-plumbing",
    name: "Acme Plumbing Co.",
    joinedDate: "2024-01",
    accentColor: VIBRANT_CYAN,
    chartLayout: "area-dominant",
    metrics: {
      revenue: {
        before: [38, 42, 48, 52, 45, 58, 62, 68, 72, 78, 82, 88],
        after: [88, 95, 108, 115, 102, 128, 135, 148, 158, 168, 175, 192],
      },
      traffic: {
        before: [980, 1120, 1250, 1380, 1180, 1520, 1650, 1780, 1920, 2050, 2180, 2350],
        after: [2350, 2520, 2850, 3020, 2680, 3320, 3480, 3720, 3980, 4220, 4450, 4780],
      },
      leads: {
        before: [6, 9, 11, 14, 10, 16, 18, 22, 24, 26, 28, 32],
        after: [32, 38, 45, 52, 42, 62, 68, 78, 85, 92, 98, 108],
      },
      conversionRate: { before: 18, after: 42 },
      aiCalls: { before: 0, after: 1247 },
    },
  },
  {
    id: "summit-dental",
    name: "Summit Dental Group",
    joinedDate: "2024-03",
    accentColor: ACCENT_EMERALD,
    chartLayout: "bar-dominant",
    metrics: {
      revenue: {
        before: [32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 55],
        after: [55, 58, 62, 68, 72, 78, 85, 92, 98, 105, 112, 118],
      },
      traffic: {
        before: [720, 780, 820, 880, 920, 950, 980, 1020, 1050, 1080, 1120, 1180],
        after: [1180, 1250, 1320, 1420, 1520, 1620, 1720, 1820, 1920, 2020, 2120, 2250],
      },
      leads: {
        before: [4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 12, 14],
        after: [14, 16, 18, 22, 25, 28, 32, 36, 40, 44, 48, 55],
      },
      conversionRate: { before: 22, after: 38 },
      aiCalls: { before: 0, after: 892 },
    },
  },
  {
    id: "metro-auto",
    name: "Metro Auto Services",
    joinedDate: "2024-06",
    accentColor: ACCENT_AMBER,
    chartLayout: "mixed",
    metrics: {
      revenue: {
        before: [72, 68, 78, 85, 92, 88, 95, 102, 108, 115, 112, 118],
        after: [118, 128, 142, 155, 168, 162, 178, 192, 205, 218, 225, 242],
      },
      traffic: {
        before: [1850, 1920, 2050, 2180, 2320, 2250, 2420, 2580, 2720, 2850, 2780, 2950],
        after: [2950, 3180, 3420, 3680, 3920, 3820, 4080, 4320, 4580, 4820, 4950, 5220],
      },
      leads: {
        before: [22, 24, 28, 32, 35, 30, 38, 42, 45, 48, 44, 52],
        after: [52, 58, 65, 72, 78, 72, 85, 92, 98, 105, 102, 115],
      },
      conversionRate: { before: 14, after: 28 },
      aiCalls: { before: 0, after: 2156 },
    },
  },
  {
    id: "green-valley-law",
    name: "Green Valley Law Firm",
    joinedDate: "2024-09",
    accentColor: ACCENT_VIOLET,
    chartLayout: "compact",
    metrics: {
      revenue: {
        before: [22, 24, 26, 28, 30, 28, 32, 34, 36, 38, 35, 42],
        after: [42, 52, 62, 72, 82, 78, 92, 105, 118, 128, 135, 148],
      },
      traffic: {
        before: [380, 420, 450, 480, 520, 490, 550, 580, 620, 650, 620, 720],
        after: [720, 850, 980, 1120, 1250, 1180, 1350, 1520, 1680, 1820, 1920, 2080],
      },
      leads: {
        before: [6, 8, 9, 11, 12, 10, 14, 15, 17, 18, 16, 22],
        after: [22, 32, 42, 52, 58, 55, 68, 78, 88, 95, 102, 112],
      },
      conversionRate: { before: 8, after: 38 },
      aiCalls: { before: 0, after: 534 },
    },
  },
];

const MONTHS_24 = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function buildChartData(business: (typeof BUSINESSES)[0]) {
  const m = business.metrics;
  const b = m.revenue.before;
  const a = m.revenue.after;
  const tb = m.traffic.before;
  const ta = m.traffic.after;
  const lb = m.leads.before;
  const la = m.leads.after;

  const revenueBefore24 = [...b, ...b.map((v, i) => v + (i + 1) * 0.3)];
  const revenueAfter24 = [...b, ...a];
  const trafficBefore24 = [...tb, ...tb.map((v) => v + Math.floor(v * 0.03))];
  const trafficAfter24 = [...tb, ...ta];
  const leadsBefore24 = [...lb, ...lb.map((v) => v + 1)];
  const leadsAfter24 = [...lb, ...la];

  const totalCalls = m.aiCalls?.after ?? 1000;
  const aiCalls24 = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    Math.floor(totalCalls * 0.04), Math.floor(totalCalls * 0.07), Math.floor(totalCalls * 0.1),
    Math.floor(totalCalls * 0.13), Math.floor(totalCalls * 0.16), Math.floor(totalCalls * 0.19),
    Math.floor(totalCalls * 0.22), Math.floor(totalCalls * 0.25), Math.floor(totalCalls * 0.28),
    Math.floor(totalCalls * 0.3), Math.floor(totalCalls * 0.32), Math.floor(totalCalls * 0.35),
  ];

  const convB = m.conversionRate?.before ?? 18;
  const convA = m.conversionRate?.after ?? 35;
  const conversion24 = [
    ...Array(12).fill(convB).map((v, i) => v + (i % 2)),
    ...Array(12).fill(0).map((_, i) => Math.round(convB + ((convA - convB) * (i + 1)) / 12)),
  ];

  return MONTHS_24.map((month, i) => ({
    month: i < 12 ? `${month} '23` : `${month} '24`,
    revenueBefore: revenueBefore24[i],
    revenueAfter: revenueAfter24[i],
    trafficBefore: trafficBefore24[i],
    trafficAfter: trafficAfter24[i],
    leadsBefore: leadsBefore24[i],
    leadsAfter: leadsAfter24[i],
    aiCalls: aiCalls24[i],
    conversionRate: conversion24[i],
  }));
}


function BarChartVisual({
  data,
  dataKey,
  dataKey2,
  maxVal,
  color1,
  color2,
  label1,
  label2,
}: {
  data: Array<{ month: string; [k: string]: string | number | undefined }>;
  dataKey: string;
  dataKey2?: string;
  maxVal: number;
  color1: string;
  color2: string;
  label1: string;
  label2: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-xs text-slate-400 mb-2">
        <span style={{ color: color1 }}>● {label1}</span>
        {dataKey2 && <span style={{ color: color2 }} className="ml-4">● {label2}</span>}
      </div>
      <div className="flex items-end gap-0.5 h-48">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex flex-col-reverse gap-0.5 items-center" style={{ height: 180 }}>
              {dataKey2 && (
                <div
                  className="w-full max-w-[8px] rounded-t transition-all duration-300"
                  style={{
                    height: `${((Number(d[dataKey2]) || 0) / maxVal) * 100}%`,
                    minHeight: 2,
                    backgroundColor: color2,
                  }}
                />
              )}
              <div
                className="w-full max-w-[8px] rounded-t transition-all duration-300"
                style={{
                  height: `${((Number(d[dataKey]) || 0) / maxVal) * 100}%`,
                  minHeight: 2,
                  backgroundColor: color1,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 truncate max-w-full" title={d.month}>
              {String(d.month).replace(" '23", "").replace(" '24", "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaChartVisual({
  data,
  dataKey,
  dataKey2,
  maxVal,
  color1,
  color2,
  label1,
  label2,
}: {
  data: Array<{ month: string; [k: string]: string | number | undefined }>;
  dataKey: string;
  dataKey2?: string;
  maxVal: number;
  color1: string;
  color2: string;
  label1: string;
  label2: string;
}) {
  const vals1 = data.map((d) => Number(d[dataKey]) || 0);
  const vals2 = dataKey2 ? data.map((d) => Number(d[dataKey2]) || 0) : [];
  const max = Math.max(maxVal, ...vals1, ...vals2, 1);
  const toPoints = (arr: number[]) =>
    arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * 100},${100 - (v / max) * 85}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs text-slate-400 mb-2">
        <span style={{ color: color1 }}>● {label1}</span>
        {dataKey2 && <span style={{ color: color2 }}>● {label2}</span>}
      </div>
      <div className="h-48 relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {dataKey2 && vals2.length > 0 && (
            <polygon
              fill={color2}
              fillOpacity={0.35}
              stroke={color2}
              strokeWidth={0.6}
              points={`0,100 ${toPoints(vals2)} 100,100`}
            />
          )}
          <polygon
            fill={color1}
            fillOpacity={0.5}
            stroke={color1}
            strokeWidth={1}
            points={`0,100 ${toPoints(vals1)} 100,100`}
          />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        {data.filter((_, i) => i % 4 === 0).map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
    </div>
  );
}

function AnalyticsContent({ selectedId }: { selectedId: string }) {
  const business = BUSINESSES.find((b) => b.id === selectedId)!;
  const chartData = buildChartData(business);
  const accent = business.accentColor;

  const revMax = Math.max(...chartData.map((d) => Math.max(d.revenueBefore, d.revenueAfter)));
  const trafficMax = Math.max(...chartData.map((d) => Math.max(d.trafficBefore, d.trafficAfter)));
  const leadsMax = Math.max(...chartData.map((d) => Math.max(d.leadsBefore, d.leadsAfter)));
  const aiCallsMax = Math.max(...chartData.map((d) => d.aiCalls), 1);
  const convMax = Math.max(...chartData.map((d) => d.conversionRate), 50);

  const revenueGrowth = ((business.metrics.revenue.after[11] - business.metrics.revenue.before[11]) / business.metrics.revenue.before[11] * 100).toFixed(1);
  const trafficGrowth = ((business.metrics.traffic.after[11] - business.metrics.traffic.before[11]) / business.metrics.traffic.before[11] * 100).toFixed(1);
  const leadsGrowth = ((business.metrics.leads.after[11] - business.metrics.leads.before[11]) / business.metrics.leads.before[11] * 100).toFixed(1);
  const conversionGrowth = business.metrics.conversionRate
    ? ((business.metrics.conversionRate.after - business.metrics.conversionRate.before) / business.metrics.conversionRate.before * 100).toFixed(1)
    : null;

  const ChartCard = ({
    title,
    children,
    borderColor,
  }: {
    title: string;
    children: React.ReactNode;
    borderColor?: string;
  }) => (
    <motion.div
      key={`${selectedId}-${title}`}
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 bg-slate-900/60 p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.2)]"
      style={{ borderColor: borderColor ?? `${accent}40` }}
    >
      <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-6">{title}</h3>
      {children}
    </motion.div>
  );

  return (
        <div key={selectedId}>
        {/* Summary cards - always visible, no animation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <div
            key={`${selectedId}-revenue`}
            className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors"
          >
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Revenue (12mo)</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">${business.metrics.revenue.before[11]}K</span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold" style={{ color: accent }}>${business.metrics.revenue.after[11]}K</span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>+{revenueGrowth}% growth</p>
          </div>
          <div
            key={`${selectedId}-traffic`}
            className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors"
          >
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Monthly Traffic</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">{business.metrics.traffic.before[11].toLocaleString()}</span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold" style={{ color: accent }}>{business.metrics.traffic.after[11].toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>+{trafficGrowth}% growth</p>
          </div>
          <div
            key={`${selectedId}-leads`}
            className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors"
          >
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Leads Captured</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">{business.metrics.leads.before[11]}</span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold" style={{ color: accent }}>{business.metrics.leads.after[11]}</span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>+{leadsGrowth}% growth</p>
          </div>
          <div
            key={`${selectedId}-conversion`}
            className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#a78bfa]/30 hover:border-[#a78bfa]/50 transition-colors"
          >
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Conversion Rate</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">{business.metrics.conversionRate.before}%</span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold text-[#a78bfa]">{business.metrics.conversionRate.after}%</span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold text-[#a78bfa]">+{conversionGrowth}% growth</p>
          </div>
          <div
            key={`${selectedId}-aicalls`}
            className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors"
          >
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">AI Calls (YTD)</h3>
            <span className="text-2xl font-display font-bold" style={{ color: accent }}>{business.metrics.aiCalls?.after?.toLocaleString() ?? "—"}</span>
            <p className="mt-2 text-sm font-mono text-slate-400">Dispatcher active</p>
          </div>
        </div>

        <div className="space-y-8">

          <div className="space-y-12">
              <ChartCard title="Revenue — Before vs After Intent" borderColor={`${accent}40`}>
                <AreaChartVisual
                  data={chartData}
                  dataKey="revenueBefore"
                  dataKey2="revenueAfter"
                  maxVal={revMax}
                  color1={MUTED_BEFORE}
                  color2={accent}
                  label1="Before Intent"
                  label2="After Intent"
                />
              </ChartCard>

              <ChartCard title="Traffic — Before vs After Intent" borderColor={`${accent}40`}>
                {business.chartLayout === "bar-dominant" || business.chartLayout === "mixed" ? (
                  <BarChartVisual
                    data={chartData}
                    dataKey="trafficBefore"
                    dataKey2="trafficAfter"
                    maxVal={trafficMax}
                    color1={MUTED_BEFORE}
                    color2={accent}
                    label1="Before Intent"
                    label2="After Intent"
                  />
                ) : (
                  <AreaChartVisual
                    data={chartData}
                    dataKey="trafficBefore"
                    dataKey2="trafficAfter"
                    maxVal={trafficMax}
                    color1={MUTED_BEFORE}
                    color2={accent}
                    label1="Before Intent"
                    label2="After Intent"
                  />
                )}
              </ChartCard>

              <ChartCard title="Leads — Before vs After Intent" borderColor={`${accent}40`}>
                {business.chartLayout === "area-dominant" ? (
                  <AreaChartVisual
                    data={chartData}
                    dataKey="leadsBefore"
                    dataKey2="leadsAfter"
                    maxVal={leadsMax}
                    color1={MUTED_BEFORE}
                    color2={accent}
                    label1="Before Intent"
                    label2="After Intent"
                  />
                ) : (
                  <BarChartVisual
                    data={chartData}
                    dataKey="leadsBefore"
                    dataKey2="leadsAfter"
                    maxVal={leadsMax}
                    color1={MUTED_BEFORE}
                    color2={accent}
                    label1="Before Intent"
                    label2="After Intent"
                  />
                )}
              </ChartCard>

              <ChartCard title="AI Call Volume — Dispatcher Activity" borderColor={`${accent}40`}>
                <AreaChartVisual
                  data={chartData}
                  dataKey="aiCalls"
                  maxVal={aiCallsMax}
                  color1={accent}
                  color2={accent}
                  label1="AI Calls"
                  label2=""
                />
              </ChartCard>

              <ChartCard title="Conversion Rate — Before vs After Intent" borderColor={`${ACCENT_VIOLET}40`}>
                <AreaChartVisual
                  data={chartData}
                  dataKey="conversionRate"
                  maxVal={convMax}
                  color1={ACCENT_VIOLET}
                  color2={ACCENT_VIOLET}
                  label1="Conversion %"
                  label2=""
                />
              </ChartCard>
          </div>
        </div>
        </div>
  );
}

export default function AnalyticsHubPage() {
  const [selectedId, setSelectedId] = useState(BUSINESSES[0].id);
  const business = BUSINESSES.find((b) => b.id === selectedId)!;
  const accent = business.accentColor;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-[#00e5ff]/[0.03] via-transparent to-[#a78bfa]/[0.03] pointer-events-none z-0" aria-hidden />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-mono text-slate-300 hover:text-[#00e5ff] transition-colors">
            ← Back to Intent
          </Link>
          <h1 className="text-lg font-display font-semibold text-[#00e5ff] drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">
            Admin Analytics Hub
          </h1>
          <LogoutLink />
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <label className="block font-mono text-sm text-slate-400 mb-2">LINKED BUSINESS</label>
          <div className="relative w-full max-w-md">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value as BusinessId)}
              className="w-full rounded-lg border-2 px-4 py-3 pr-12 font-display text-white cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50 appearance-none bg-slate-900/90 hover:border-[#00e5ff]/60"
              style={{
                borderColor: "rgba(0, 229, 255, 0.4)",
                color: "#f8fafc",
              }}
            >
              {BUSINESSES.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name} (since {b.joinedDate})
                </option>
              ))}
            </select>
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: accent }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <AnalyticsContent key={selectedId} selectedId={selectedId} />
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-4 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center shrink-0 text-slate-400 hover:text-[#00e5ff] transition-colors">
            <span className="font-mono text-sm">← Intent</span>
          </Link>
          <p className="text-slate-500 text-sm font-mono">Admin Analytics Hub • Internal Use Only</p>
        </div>
      </footer>
    </div>
  );
}
