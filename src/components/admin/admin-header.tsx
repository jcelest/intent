"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutLink } from "@/components/admin/logout-link";

const NAV = [
  {
    href: "/admin/analytics",
    label: "Intent Analytics",
    match: (p: string) => p.includes("/analytics") && !p.includes("/keyword"),
  },
  { href: "/admin/forms", label: "Intent Forms", match: (p: string) => p.includes("/forms") },
  { href: "/admin/keyword-demand", label: "Intent Traffic", match: (p: string) => p.includes("/keyword-demand") },
] as const;

export function AdminHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm font-mono text-slate-300 hover:text-[#00e5ff] transition-colors">
            ← Back to Intent
          </Link>
          <h1 className="text-lg font-display font-semibold text-[#00e5ff] drop-shadow-[0_0_20px_rgba(0,229,255,0.5)]">
            Intent Admin Hub
          </h1>
          <LogoutLink />
        </div>
        <nav className="flex flex-wrap gap-6">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-mono text-sm transition-colors ${
                  active ? "text-[#00e5ff] font-semibold" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
