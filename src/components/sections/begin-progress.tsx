"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "captured", label: "Payment captured" },
  { id: "planning", label: "Planning" },
  { id: "design", label: "Design and Setup" },
  { id: "production", label: "Production" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type Phase = "captured" | "planning" | "design";
type Status = "done" | "active" | "loading" | "waiting";

const ORDER: Phase[] = ["captured", "planning", "design"];

function statusFor(step: StepId, phase: Phase): Status {
  if (step === "production") return "waiting";
  const stepIndex = ORDER.indexOf(step as Phase);
  const phaseIndex = ORDER.indexOf(phase);
  if (stepIndex < phaseIndex) return "done";
  if (step === phase) return step === "design" ? "loading" : "active";
  return "waiting";
}

export function BeginProgress() {
  const [phase, setPhase] = useState<Phase>("captured");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("design");
      return;
    }
    const planning = window.setTimeout(() => setPhase("planning"), 900);
    const design = window.setTimeout(() => setPhase("design"), 2100);
    return () => {
      window.clearTimeout(planning);
      window.clearTimeout(design);
    };
  }, []);

  const phaseIndex = ORDER.indexOf(phase);

  return (
    <ol
      className="mx-auto w-full max-w-sm text-left"
      aria-label="LeadNet build progress"
    >
      {STEPS.map((step, index) => {
        const status = statusFor(step.id, phase);
        const next = STEPS[index + 1];
        const connectorOn = index < phaseIndex;

        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepMark status={status} />
              {next ? (
                <span
                  className={cn(
                    "begin-progress-line my-1 w-px flex-1 min-h-[1.75rem]",
                    connectorOn && "begin-progress-line-on"
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className={cn("min-w-0 pb-5", !next && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-semibold leading-6",
                  status === "waiting" ? "text-muted" : "text-foreground"
                )}
              >
                {step.label}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent/80">
                {status === "done"
                  ? "Complete"
                  : status === "active"
                    ? "Checking"
                    : status === "loading"
                      ? "In progress"
                      : "Queued"}
              </p>
              {status === "loading" ? (
                <span className="begin-progress-bar mt-2 block h-1 overflow-hidden rounded-full bg-accent/15">
                  <span className="begin-progress-bar-fill block h-full w-1/2 rounded-full bg-accent" />
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepMark({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
        status === "done" && "border-accent bg-accent text-oled",
        status === "active" && "begin-progress-pulse border-accent bg-accent/15",
        status === "loading" && "border-accent bg-card",
        status === "waiting" && "border-border bg-card text-muted"
      )}
      aria-hidden
    >
      {status === "done" ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <path
            className="begin-progress-check"
            d="M3.5 8.2l2.8 2.8 6.2-6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {status === "loading" ? (
        <span className="begin-progress-spin h-3.5 w-3.5 rounded-full border-2 border-accent/25 border-t-accent" />
      ) : null}
      {status === "active" ? (
        <span className="h-2 w-2 rounded-full bg-accent" />
      ) : null}
    </span>
  );
}
