"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { motion } from "framer-motion";
import { COMPANIES } from "@/lib/companies";
import {
  type AnalyticsResponse,
  GA4_METRICS,
  GA4_DATE_RANGES,
  type Ga4MetricId,
  type Ga4DateRangeId,
} from "@/lib/analytics-types";

const MUTED_BEFORE = "#94a3b8";
const ACCENT_VIOLET = "#a78bfa";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isTrafficBeforeAfter(
  t: AnalyticsResponse["metrics"]["traffic"]
): t is { before: number[]; after: number[] } {
  return "before" in t && "after" in t;
}

function buildChartData(data: AnalyticsResponse): Array<{ month: string; [k: string]: string | number | undefined }> {
  const m = data.metrics;
  const isLive = data.isLive;

  if (data.ga4) {
    const { dateLabels, series } = data.ga4;
    return dateLabels.map((month, i) => {
      const row: { month: string; [k: string]: string | number | undefined } = { month };
      series.forEach((s) => {
        row[s.id] = s.values[i] ?? 0;
        if (s.valuesPrevious && s.valuesPrevious.length > i) {
          row[`${s.id}_prev`] = s.valuesPrevious[i] ?? 0;
        }
      });
      return row;
    });
  }

  if (isLive && "current" in m.traffic) {
    const current = m.traffic.current;
    const now = new Date();

    return current.map((val, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (current.length - 1 - i), 1);
      return {
        month: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        trafficCurrent: val,
        revenueBefore: 0,
        revenueAfter: 0,
        trafficBefore: 0,
        trafficAfter: 0,
        leadsBefore: 0,
        leadsAfter: 0,
        aiCalls: 0,
        conversionRate: 0,
      };
    });
  }

  if (isTrafficBeforeAfter(m.traffic)) {
    const b = m.revenue?.before ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const a = m.revenue?.after ?? b;
    const tb = m.traffic.before;
    const ta = m.traffic.after;
    const lb = m.leads?.before ?? tb.map(() => 0);
    const la = m.leads?.after ?? ta.map(() => 0);

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

    const MONTHS_24 = [...MONTHS, ...MONTHS];
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
      trafficCurrent: 0,
    }));
  }

  return [];
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
  const dataMax = Math.max(...vals1, ...vals2, 1);
  const max = Math.max(maxVal, dataMax, 1);
  const toPoints = (arr: number[]) =>
    arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * 100},${100 - (v / max) * 88}`).join(" ");

  const labelStep = Math.max(1, Math.floor(data.length / 8));
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex gap-4 text-sm text-slate-400 mb-2">
        <span style={{ color: color1 }}>● {label1}</span>
        {dataKey2 && <span style={{ color: color2 }}>● {label2}</span>}
      </div>
      <div className="h-48 relative w-full bg-slate-900/30 rounded-lg">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full rounded-lg">
          {dataKey2 && vals2.length > 0 && (
            <polygon
              fill={color2}
              fillOpacity={0.4}
              stroke={color2}
              strokeWidth={0.8}
              strokeOpacity={0.8}
              points={`0,100 ${toPoints(vals2)} 100,100`}
            />
          )}
          <polygon
            fill={color1}
            fillOpacity={0.55}
            stroke={color1}
            strokeWidth={1.2}
            strokeOpacity={0.9}
            points={`0,100 ${toPoints(vals1)} 100,100`}
          />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 gap-1">
        {data.filter((_, i) => i % labelStep === 0).map((d) => (
          <span key={d.month} className="truncate">{d.month}</span>
        ))}
      </div>
    </div>
  );
}

function ymdToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ymdDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AnalyticsContent({
  data,
  selectedId,
  dateRange,
  selectedMetrics,
  onDateRangeChange,
  onMetricsChange,
  isLive,
  dateMode,
  customStart,
  customEnd,
  compareEnabled,
  onDateModeChange,
  onCustomStartChange,
  onCustomEndChange,
  onCompareChange,
  onQuickCompare7d,
  onQuickCompare28d,
}: {
  data: AnalyticsResponse | null;
  selectedId: string;
  dateRange: Ga4DateRangeId;
  selectedMetrics: Ga4MetricId[];
  onDateRangeChange: (v: Ga4DateRangeId) => void;
  onMetricsChange: (v: Ga4MetricId[]) => void;
  isLive: boolean;
  dateMode: "preset" | "custom";
  customStart: string;
  customEnd: string;
  compareEnabled: boolean;
  onDateModeChange: (v: "preset" | "custom") => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onCompareChange: (v: boolean) => void;
  onQuickCompare7d: () => void;
  onQuickCompare28d: () => void;
}) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400 font-mono">Loading…</div>
      </div>
    );
  }

  const chartData = buildChartData(data);
  const accent = data.accentColor;
  const hasBeforeAfter = isTrafficBeforeAfter(data.metrics.traffic);

  const trafficMax = Math.max(
    ...chartData.map((d) =>
      Math.max(
        Number(d.trafficBefore) || 0,
        Number(d.trafficAfter) || 0,
        Number(d.trafficCurrent) || 0
      )
    ),
    1
  );
  const revMax = Math.max(
    ...chartData.map((d) => {
      const r = d as { revenueBefore?: number; revenueAfter?: number };
      return Math.max(r.revenueBefore ?? 0, r.revenueAfter ?? 0);
    }),
    1
  );
  const leadsMax = Math.max(
    ...chartData.map((d) => {
      const r = d as { leadsBefore?: number; leadsAfter?: number };
      return Math.max(r.leadsBefore ?? 0, r.leadsAfter ?? 0);
    }),
    1
  );
  const aiCallsMax = Math.max(...chartData.map((d) => Number((d as { aiCalls?: number }).aiCalls) || 0), 1);
  const convMax = Math.max(...chartData.map((d) => Number((d as { conversionRate?: number }).conversionRate) || 0), 50);

  const trafficCurrent: number = hasBeforeAfter
    ? (data.metrics.traffic as { before: number[]; after: number[] }).after[11]
    : "current" in data.metrics.traffic
      ? data.metrics.traffic.current[11] ?? data.metrics.traffic.current.at(-1) ?? 0
      : 0;
  const trafficPrev: number = hasBeforeAfter
    ? (data.metrics.traffic as { before: number[]; after: number[] }).before[11]
    : "current" in data.metrics.traffic
      ? data.metrics.traffic.current[10] ?? 0
      : 0;
  const trafficGrowth =
    typeof trafficPrev === "number" && trafficPrev > 0 && typeof trafficCurrent === "number"
      ? (((trafficCurrent - trafficPrev) / trafficPrev) * 100).toFixed(1)
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
      className="rounded-xl border-2 bg-slate-900/60 p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.2)] overflow-hidden min-w-0"
      style={{ borderColor: borderColor ?? `${accent}40` }}
    >
      <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-6">{title}</h3>
      {children}
    </motion.div>
  );

  return (
    <div key={selectedId} className="min-w-0 overflow-x-hidden">
      {data.error && (
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {data.error}
        </div>
      )}

      {isLive && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Quick compare</span>
            {(() => {
              const quickActive =
                dateMode === "preset" && compareEnabled
                  ? dateRange === "7d"
                    ? "7d"
                    : dateRange === "28d"
                      ? "28d"
                      : null
                  : null;
              const activeClass =
                "rounded-lg border border-[#00e5ff]/40 bg-slate-900/80 px-3 py-1.5 font-mono text-xs text-[#00e5ff] hover:bg-slate-800/80 transition-colors";
              const idleClass =
                "rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 font-mono text-xs text-slate-300 hover:border-[#00e5ff]/40 transition-colors";
              return (
                <>
                  <button
                    type="button"
                    onClick={onQuickCompare7d}
                    className={quickActive === "7d" ? activeClass : idleClass}
                  >
                    Last 7 days vs prior 7 days
                  </button>
                  <button type="button" onClick={onQuickCompare28d} className={quickActive === "28d" ? activeClass : idleClass}>
                    Last 28 days vs prior 28
                  </button>
                </>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-1">RANGE MODE</label>
            <select
              value={dateMode}
              onChange={(e) => onDateModeChange(e.target.value as "preset" | "custom")}
              className="rounded-lg border-2 px-3 py-2 font-mono text-sm text-white bg-slate-900/90 border-[#00e5ff]/40 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50"
            >
              <option value="preset" className="bg-slate-900">Preset</option>
              <option value="custom" className="bg-slate-900">Custom start / end</option>
            </select>
          </div>
          {dateMode === "preset" ? (
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-1">DATE RANGE</label>
            <select
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value as Ga4DateRangeId)}
              className="rounded-lg border-2 px-3 py-2 font-mono text-sm text-white bg-slate-900/90 border-[#00e5ff]/40 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50"
            >
              {GA4_DATE_RANGES.map((r) => (
                <option key={r.id} value={r.id} className="bg-slate-900">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          ) : (
            <>
              <div>
                <label className="block font-mono text-xs text-slate-400 mb-1">START (GA4)</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => onCustomStartChange(e.target.value)}
                  className="rounded-lg border-2 px-3 py-2 font-mono text-sm text-white bg-slate-900/90 border-[#00e5ff]/40 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-slate-400 mb-1">END (GA4)</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => onCustomEndChange(e.target.value)}
                  className="rounded-lg border-2 px-3 py-2 font-mono text-sm text-white bg-slate-900/90 border-[#00e5ff]/40 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50"
                />
              </div>
            </>
          )}
          <label className="flex items-center gap-3 cursor-pointer group py-2 px-2 -m-2 rounded hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => onCompareChange(e.target.checked)}
              className="sr-only peer"
            />
            <span
              className={`
                w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 shrink-0
                peer-focus:ring-2 peer-focus:ring-[#00e5ff]/50
                ${compareEnabled
                  ? "border-[#00e5ff] bg-[#00e5ff]/20"
                  : "border-slate-500 bg-slate-900/50 group-hover:border-slate-400"
                }
              `}
            >
              {compareEnabled && (
                <svg className="w-2.5 h-2.5 text-[#00e5ff]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-6" />
                </svg>
              )}
            </span>
            <span className="text-sm text-slate-300 select-none">Compare to previous period (same length)</span>
          </label>
          </div>
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-1">METRICS</label>
            <div className="flex flex-wrap gap-4">
              {GA4_METRICS.map((m) => {
                const checked = selectedMetrics.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 cursor-pointer group py-1.5 px-2 -m-2 rounded hover:bg-slate-800/50 min-w-[140px]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onMetricsChange(
                          checked ? selectedMetrics.filter((x) => x !== m.id) : [...selectedMetrics, m.id]
                        )
                      }
                      className="sr-only peer"
                    />
                    <span
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 shrink-0
                        peer-focus:ring-2 peer-focus:ring-[#00e5ff]/50
                        ${checked
                          ? "border-[#00e5ff] bg-[#00e5ff]/20"
                          : "border-slate-500 bg-slate-900/50 group-hover:border-slate-400"
                        }
                      `}
                    >
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-[#00e5ff]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-6" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-slate-300 group-hover:text-slate-200 select-none">{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {data.ga4 && data.ga4.series.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-12">
            {data.ga4.series.map((s) => {
              const total = s.values.reduce((a, b) => a + b, 0);
              const avg = s.values.length > 0 ? total / s.values.length : 0;
              const prevTotal = s.valuesPrevious?.reduce((a, b) => a + b, 0);
              const deltaPct =
                prevTotal != null && prevTotal !== 0
                  ? (((total - prevTotal) / prevTotal) * 100).toFixed(1)
                  : null;
              let displayVal: string;
              if (s.format === "percent") {
                const pct = avg <= 1 ? avg * 100 : avg;
                displayVal = `${pct.toFixed(1)}%`;
              } else if (s.format === "duration") {
                const secs = Math.round(avg);
                const m = Math.floor(secs / 60);
                const sec = secs % 60;
                displayVal = `${m}:${String(sec).padStart(2, "0")}`;
              } else {
                displayVal = total.toLocaleString();
              }
              return (
                <div
                  key={s.id}
                  className="rounded-xl border-2 bg-slate-900/60 p-4 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors"
                >
                  <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-1">
                    {s.label}
                  </h3>
                  <span className="text-xl font-display font-bold" style={{ color: accent }}>
                    {displayVal}
                  </span>
                  <p className="mt-1 text-xs font-mono text-slate-500">{data.ga4!.dateRange}</p>
                  {data.ga4?.startDate && data.ga4?.endDate && (
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                      {data.ga4.startDate} → {data.ga4.endDate}
                    </p>
                  )}
                  {deltaPct != null && data.ga4?.comparison && (
                    <p className="mt-2 text-xs font-mono text-slate-400">
                      vs prior ({data.ga4.comparison.startDate} – {data.ga4.comparison.endDate}):{" "}
                      <span
                        className={
                          parseFloat(deltaPct) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }
                      >
                        {parseFloat(deltaPct) >= 0 ? "+" : ""}
                        {deltaPct}%
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-12">
            {data.ga4.series.map((s) => {
              const chartData = buildChartData(data);
              const maxVal = Math.max(
                ...s.values,
                ...(s.valuesPrevious ?? []),
                1
              );
              const hasPrev = Boolean(s.valuesPrevious?.length);
              return (
                <motion.div
                  key={s.id}
                  className="rounded-xl border-2 bg-slate-900/60 p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.2)] overflow-hidden min-w-0"
                  style={{ borderColor: `${accent}40` }}
                >
                  <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider mb-6">
                    {s.label} — {data.ga4!.dateRange} (GA4)
                  </h3>
                  <AreaChartVisual
                    data={chartData as Array<{ month: string; [k: string]: string | number | undefined }>}
                    dataKey={s.id}
                    dataKey2={hasPrev ? `${s.id}_prev` : undefined}
                    maxVal={maxVal}
                    color1={accent}
                    color2={MUTED_BEFORE}
                    label1={hasPrev ? "Current period" : s.label}
                    label2={hasPrev ? "Previous period" : ""}
                  />
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {!data.ga4 && (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
        {hasBeforeAfter && data.metrics.revenue && (
          <div className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors">
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Revenue (12mo)</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">
                ${data.metrics.revenue.before[11]}K
              </span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold" style={{ color: accent }}>
                ${data.metrics.revenue.after[11]}K
              </span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>
              +
              {(
                ((data.metrics.revenue.after[11] - data.metrics.revenue.before[11]) /
                  data.metrics.revenue.before[11]) *
                100
              ).toFixed(1)}
              % growth
            </p>
          </div>
        )}

        <div className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors">
          <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
            {isLive ? "Sessions (12mo)" : "Monthly Traffic"}
          </h3>
          <div className="flex items-baseline gap-3 flex-wrap">
            {hasBeforeAfter && "before" in data.metrics.traffic && (
              <>
                <span className="text-xl font-display font-semibold text-slate-500 line-through">
                  {data.metrics.traffic.before[11].toLocaleString()}
                </span>
                <span className="text-slate-500">→</span>
              </>
            )}
            <span className="text-2xl font-display font-bold" style={{ color: accent }}>
              {(typeof trafficCurrent === "number" ? trafficCurrent : 0).toLocaleString()}
            </span>
          </div>
          {trafficGrowth && (
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>
              +{trafficGrowth}% growth
            </p>
          )}
          {isLive && data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs text-slate-400 hover:text-[#00e5ff]"
            >
              {data.url.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
        </div>

        {hasBeforeAfter && data.metrics.leads && (
          <div className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors">
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Leads Captured</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">
                {data.metrics.leads.before[11]}
              </span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold" style={{ color: accent }}>
                {data.metrics.leads.after[11]}
              </span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold" style={{ color: accent }}>
              +
              {(
                ((data.metrics.leads.after[11] - data.metrics.leads.before[11]) /
                  data.metrics.leads.before[11]) *
                100
              ).toFixed(1)}
              % growth
            </p>
          </div>
        )}

        {hasBeforeAfter && data.metrics.conversionRate && (
          <div className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#a78bfa]/30 hover:border-[#a78bfa]/50 transition-colors">
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">Conversion Rate</h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl font-display font-semibold text-slate-500 line-through">
                {data.metrics.conversionRate.before}%
              </span>
              <span className="text-slate-500">→</span>
              <span className="text-2xl font-display font-bold text-[#a78bfa]">
                {data.metrics.conversionRate.after}%
              </span>
            </div>
            <p className="mt-2 text-sm font-mono font-semibold text-[#a78bfa]">
              +
              {(
                ((data.metrics.conversionRate.after - data.metrics.conversionRate.before) /
                  data.metrics.conversionRate.before) *
                100
              ).toFixed(1)}
              % growth
            </p>
          </div>
        )}

        {(hasBeforeAfter || data.metrics.aiCalls) && (
          <div className="rounded-xl border-2 bg-slate-900/60 p-6 border-[#00e5ff]/30 hover:border-[#00e5ff]/50 transition-colors">
            <h3 className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">AI Calls (YTD)</h3>
            <span className="text-2xl font-display font-bold" style={{ color: accent }}>
              {data.metrics.aiCalls?.after?.toLocaleString() ?? "—"}
            </span>
            <p className="mt-2 text-sm font-mono text-slate-400">Dispatcher active</p>
          </div>
        )}
      </div>

      <div className="space-y-12">
        {hasBeforeAfter && data.metrics.revenue && (
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
        )}

        <ChartCard title={isLive ? "Sessions — Last 12 Months (GA4)" : "Traffic — Before vs After Intent"} borderColor={`${accent}40`}>
          {isLive && "current" in data.metrics.traffic ? (
            <AreaChartVisual
              data={chartData}
              dataKey="trafficCurrent"
              maxVal={trafficMax}
              color1={accent}
              color2={accent}
              label1="Sessions"
              label2=""
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

        {hasBeforeAfter && data.metrics.leads && (
          <ChartCard title="Leads — Before vs After Intent" borderColor={`${accent}40`}>
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
          </ChartCard>
        )}

        {hasBeforeAfter && data.metrics.aiCalls && (
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
        )}

        {hasBeforeAfter && data.metrics.conversionRate && (
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
        )}
      </div>
      </>
      )}
    </div>
  );
}

export default function AnalyticsHubPage() {
  const [selectedId, setSelectedId] = useState(COMPANIES[0].id);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  /** Default to 7d + compare so live GA4 loads “last 7 vs prior 7” on first paint without extra clicks. */
  const [dateRange, setDateRange] = useState<Ga4DateRangeId>("7d");
  const [dateMode, setDateMode] = useState<"preset" | "custom">("preset");
  const [customStart, setCustomStart] = useState(() => ymdDaysAgo(7));
  const [customEnd, setCustomEnd] = useState(() => ymdToday());
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<Ga4MetricId[]>(
    GA4_METRICS.map((m) => m.id)
  );
  const company = COMPANIES.find((c) => c.id === selectedId);
  const accent = company?.accentColor ?? "#00e5ff";
  const isLive = company?.dataSource === "live";

  useEffect(() => {
    let cancelled = false;
    setData(null);
    const params = new URLSearchParams();
    if (isLive) {
      if (dateMode === "custom") {
        if (customStart && customEnd) {
          params.set("startDate", customStart);
          params.set("endDate", customEnd);
        } else {
          params.set("dateRange", dateRange);
        }
      } else {
        params.set("dateRange", dateRange);
      }
      if (compareEnabled) {
        params.set("compare", "1");
      }
      params.set("metrics", selectedMetrics.length > 0 ? selectedMetrics.join(",") : "sessions");
    }
    const url = `/api/analytics/${selectedId}${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((r: AnalyticsResponse) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedId,
    dateRange,
    selectedMetrics,
    isLive,
    dateMode,
    customStart,
    customEnd,
    compareEnabled,
  ]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-[#00e5ff]/[0.03] via-transparent to-[#a78bfa]/[0.03] pointer-events-none z-0" aria-hidden />
      <AdminHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 overflow-x-hidden min-w-0">
        <div className="mb-12">
          <label className="block font-mono text-sm text-slate-400 mb-2">LINKED BUSINESS</label>
          <div className="relative w-full max-w-md">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border-2 px-4 py-3 pr-12 font-display text-white cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00e5ff]/50 appearance-none bg-slate-900/90 hover:border-[#00e5ff]/60"
              style={{
                borderColor: "rgba(0, 229, 255, 0.4)",
                color: "#f8fafc",
              }}
            >
              {COMPANIES.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name} {b.dataSource === "live" ? "●" : ""} (since {b.joinedDate})
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

        <AnalyticsContent
          key={selectedId}
          data={data}
          selectedId={selectedId}
          dateRange={dateRange}
          selectedMetrics={selectedMetrics}
          onDateRangeChange={setDateRange}
          onMetricsChange={setSelectedMetrics}
          isLive={isLive ?? false}
          dateMode={dateMode}
          customStart={customStart}
          customEnd={customEnd}
          compareEnabled={compareEnabled}
          onDateModeChange={setDateMode}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          onCompareChange={setCompareEnabled}
          onQuickCompare7d={() => {
            setDateMode("preset");
            setDateRange("7d");
            setCompareEnabled(true);
          }}
          onQuickCompare28d={() => {
            setDateMode("preset");
            setDateRange("28d");
            setCompareEnabled(true);
          }}
        />
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-4 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center shrink-0 text-slate-400 hover:text-[#00e5ff] transition-colors">
            <span className="font-mono text-sm">← Intent</span>
          </Link>
          <p className="text-slate-500 text-sm font-mono">Intent Admin Hub • Internal Use Only</p>
        </div>
      </footer>
    </div>
  );
}
