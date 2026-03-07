"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-lg border border-border bg-card px-4 py-2 font-mono text-sm text-foreground placeholder:text-muted",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-oled focus:border-accent",
          "transition-colors duration-200",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
