"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutLink } from "@/components/admin/logout-link";

export function AdminHeader() {
  const pathname = usePathname();
  const isForms = pathname?.includes("/forms");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm font-mono text-slate-300 hover:text-[#00e5ff] transition-colors">
            ← Back to Intent
          </Link>
          <h1 className="text-lg font-display font-semibold text-[#00e5ff] drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">
            Admin Hub
          </h1>
          <LogoutLink />
        </div>
        <nav className="flex gap-6">
          <Link
            href="/admin/analytics"
            className={`font-mono text-sm transition-colors ${
              !isForms ? "text-[#00e5ff] font-semibold" : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Analytics
          </Link>
          <Link
            href="/admin/forms"
            className={`font-mono text-sm transition-colors ${
              isForms ? "text-[#00e5ff] font-semibold" : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Forms
          </Link>
        </nav>
      </div>
    </header>
  );
}
