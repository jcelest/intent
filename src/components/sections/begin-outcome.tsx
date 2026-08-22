import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/seo";
import {
  CheckoutDoneVisual,
  CheckoutSignVisual,
} from "@/components/visuals/checkout-visuals";

export function BeginOutcome({
  stage,
  kicker = BRAND_NAME,
  title,
  body,
  children,
}: {
  stage: "sign" | "done";
  kicker?: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-lg rounded-2xl border-2 p-8 sm:p-10 text-center",
        stage === "done"
          ? "border-accent/55 bg-accent/10 shadow-[0_0_56px_rgba(34,211,238,0.18)]"
          : "border-accent/40 bg-card/80 shadow-[0_0_40px_rgba(34,211,238,0.12)]"
      )}
    >
      {stage === "done" ? <CheckoutDoneVisual /> : <CheckoutSignVisual />}
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">
        {kicker}
      </p>
      <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-4 text-foreground/80 leading-relaxed">{body}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  );
}
