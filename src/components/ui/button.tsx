"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "shimmer";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-oled disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-accent text-oled hover:bg-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:drop-shadow-[0_0_25px_rgba(34,211,238,0.7)]":
              variant === "primary",
            "bg-card border border-border text-foreground hover:border-accent hover:text-accent":
              variant === "secondary",
            "text-foreground hover:bg-card hover:text-accent": variant === "ghost",
            "shimmer-border bg-accent/10 text-accent border-accent/50 hover:bg-accent/20":
              variant === "shimmer",
          },
          {
            "px-4 py-2 text-sm": size === "sm",
            "px-6 py-3 text-base": size === "md",
            "px-8 py-4 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
