"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center shrink-0">
          <Logo variant="footer" />
        </Link>
        <div className="flex items-center gap-6">
          <p className="text-muted text-sm font-mono">
            We Engineer Revenue. © {new Date().getFullYear()}
          </p>
          <Link
            href="/admin/login"
            className="text-muted/70 hover:text-accent text-xs font-mono transition-colors"
          >
            Intent
          </Link>
        </div>
      </div>
    </footer>
  );
}
