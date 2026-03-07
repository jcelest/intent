"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BOOT_SEQUENCE = [
  "root@intent:~# initializing_growth_engine...",
  "[OK] AI Voice Dispatcher loaded",
  "[OK] Lead qualification pipeline active",
  "[OK] pSEO targeting scripts deployed",
  "[OK] Revenue dashboard connected",
  "root@intent:~# ready_for_capture",
  "> ",
];

export function LiveTerminal({ className }: { className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const [currentLine, setCurrentLine] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const line = BOOT_SEQUENCE[currentLine];
    if (!line) return;

    let charIndex = 0;
    const interval = setInterval(() => {
      if (charIndex <= line.length) {
        setDisplayText(line.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setCurrentLine((prev) =>
            prev < BOOT_SEQUENCE.length - 1 ? prev + 1 : 0
          );
        }, currentLine === BOOT_SEQUENCE.length - 1 ? 2000 : 800);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [currentLine]);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={cn(
        "w-full max-w-2xl rounded-lg border border-border bg-card/80 p-6 font-mono text-sm backdrop-blur-sm",
        "ring-1 ring-white/5 shadow-2xl",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
      </div>
      <div className="min-h-[120px] text-cyan-400/90">
        {displayText}
        <span
          className={cn(
            "inline-block w-2 h-4 ml-0.5 bg-accent align-middle transition-opacity",
            showCursor ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </motion.div>
  );
}
