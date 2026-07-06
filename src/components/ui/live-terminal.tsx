"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BOOT_SEQUENCE = [
  "root@intent:~# initializing_revenue_engine...",
  "[OK] Revenue stream mapping active",
  "[OK] Intent application & software online",
  "[OK] Speed-to-lead & intake automation loaded",
  "[OK] Analytics dashboard connected",
  "[OK] Organic search growth modules ready",
  "[OK] Paid ads & content pipeline armed",
  "root@intent:~# ready_for_growth",
  "> ",
];

const MAX_VISIBLE_LINES = 5;
const ROW_CLASS =
  "h-[1.125rem] sm:h-6 shrink-0 overflow-hidden whitespace-nowrap text-ellipsis min-w-0";

function LineText({ line }: { line: string }) {
  if (!line) return null;
  if (line.startsWith("[OK]")) {
    return (
      <span>
        <span className="text-emerald-400/95">[OK]</span>
        <span className="text-white/90">{line.slice(4)}</span>
      </span>
    );
  }
  if (line.startsWith("root@")) {
    return <span className="text-white/95">{line}</span>;
  }
  return <span className="text-white/80">{line}</span>;
}

function buildSlots(history: string[], displayText: string): string[] {
  const recent = [...history, displayText].slice(-MAX_VISIBLE_LINES);
  const pad = MAX_VISIBLE_LINES - recent.length;
  return [...Array(Math.max(0, pad)).fill(""), ...recent];
}

export function LiveTerminal({ className }: { className?: string }) {
  const [history, setHistory] = useState<string[]>([]);
  const [displayText, setDisplayText] = useState("");
  const [currentLine, setCurrentLine] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const slots = useMemo(
    () => buildSlots(history, displayText),
    [history, displayText]
  );

  useEffect(() => {
    const line = BOOT_SEQUENCE[currentLine];
    if (!line) return;

    let charIndex = 0;
    setDisplayText("");

    const interval = setInterval(() => {
      if (charIndex <= line.length) {
        setDisplayText(line.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setHistory((prev) => [...prev, line].slice(-MAX_VISIBLE_LINES));
          setDisplayText("");
          setCurrentLine((prev) =>
            prev < BOOT_SEQUENCE.length - 1 ? prev + 1 : 0
          );
          if (currentLine === BOOT_SEQUENCE.length - 1) {
            setHistory([]);
          }
        }, currentLine === BOOT_SEQUENCE.length - 1 ? 2200 : 500);
      }
    }, 32);

    return () => clearInterval(interval);
  }, [currentLine]);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn("relative w-full min-w-0 max-w-2xl sm:max-w-3xl", className)}
    >
      {/* Titanium halo */}
      <div
        className="absolute -inset-px rounded-xl bg-gradient-to-b from-zinc-300/20 via-slate-400/10 to-zinc-500/15 blur-sm opacity-90"
        aria-hidden
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-zinc-400/30",
          "bg-gradient-to-br from-zinc-800/95 via-slate-800/90 to-zinc-900/95 backdrop-blur-md",
          "shadow-[0_0_36px_rgba(203,213,225,0.12),0_8px_32px_rgba(0,0,0,0.45)]",
          "ring-1 ring-zinc-300/15",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
          "before:bg-gradient-to-r before:from-transparent before:via-zinc-200/40 before:to-transparent"
        )}
      >
        <div className="border-b border-zinc-500/25 bg-zinc-800/50 shrink-0">
          {/* Mobile: controls row + title on its own line */}
          <div className="sm:hidden px-3 pt-2.5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/90 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              </div>
              <span className="flex items-center gap-1 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-400/95">
                  Live
                </span>
              </span>
            </div>
            <p className="mt-2 font-mono text-[10px] text-white/90 tracking-wide text-center truncate">
              intent revenue | growth engine
            </p>
          </div>
          {/* sm+: single title bar row */}
          <div className="hidden sm:flex items-center justify-between gap-3 px-5 py-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-3 w-3 rounded-full bg-red-500/90 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              <span className="h-3 w-3 rounded-full bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/90 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            </div>
            <span className="font-mono text-xs text-white/90 tracking-wide text-center truncate min-w-0 flex-1 px-2">
              intent revenue | growth engine
            </span>
            <span className="flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400/95">
                Live
              </span>
            </span>
          </div>
        </div>

        <div className="relative px-3 py-3 sm:px-5 sm:py-5 font-mono text-[10px] sm:text-sm leading-none overflow-hidden">
          <div className="flex flex-col justify-end h-[5.625rem] sm:h-[7.5rem]">
            {slots.map((line, i) => {
              const isActive = i === MAX_VISIBLE_LINES - 1;
              const isHistory = line.length > 0 && !isActive;
              return (
                <div
                  key={`slot-${i}`}
                  className={cn(ROW_CLASS, "block w-full", isHistory && "opacity-75")}
                >
                  <LineText line={line} />
                  {isActive && (
                    <span
                      className={cn(
                        "inline-block w-2 h-4 ml-0.5 bg-white align-middle transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.75)]",
                        showCursor ? "opacity-100" : "opacity-0"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
