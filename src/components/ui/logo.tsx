"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "navbar" | "footer";
}

/**
 * Intent logo - symbol only.
 */
export function Logo({ className, variant = "navbar" }: LogoProps) {
  const heightClass =
    variant === "navbar" ? "h-9 sm:h-10" : "h-11 sm:h-12";

  return (
    <span className={cn("inline-flex shrink-0", heightClass, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/intent-logo-i1.svg"
        alt="Intent"
        width={36}
        height={36}
        className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
      />
    </span>
  );
}
