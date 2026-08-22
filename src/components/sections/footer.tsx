"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BRAND_NAME } from "@/lib/seo";

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center shrink-0">
          <Logo variant="footer" />
        </Link>
        <nav className="flex items-center gap-6 flex-wrap justify-center sm:justify-end">
          <Link
            href="/leadnet"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            LeadNet
          </Link>
          <Link
            href="/offering"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Offering
          </Link>
          <Link
            href="/qualification"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Qualification
          </Link>
          <Link
            href="/central-florida"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Central Florida
          </Link>
          <Link
            href="/florida"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Florida
          </Link>
          <Link
            href="/contractors"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Contractors
          </Link>
          <Link
            href="/terms"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="text-muted/70 hover:text-accent text-sm font-mono transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/admin/login"
            className="text-muted/70 hover:text-accent text-xs font-mono transition-colors"
          >
            Admin
          </Link>
          <p className="text-muted text-sm font-mono">
            {BRAND_NAME}. We Engineer Revenue. © {new Date().getFullYear()}
          </p>
        </nav>
      </div>
    </footer>
  );
}
