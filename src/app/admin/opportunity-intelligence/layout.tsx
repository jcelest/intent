"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";

interface TabItem {
  href: string;
  label: string;
  exact?: boolean;
}

const OI_TABS: TabItem[] = [
  { href: "/admin/opportunity-intelligence", label: "Overview", exact: true },
  { href: "/admin/opportunity-intelligence/bids", label: "Commercial Bids" },
  { href: "/admin/opportunity-intelligence/networks", label: "Commercial Networks" },
  { href: "/admin/opportunity-intelligence/geographic-search", label: "FL Geographic Search" },
  { href: "/admin/opportunity-intelligence/coverage", label: "FL County Coverage" },
  { href: "/admin/opportunity-intelligence/saved", label: "Saved Opportunities" },
  { href: "/admin/opportunity-intelligence/pipeline", label: "Outreach Pipeline" },
  { href: "/admin/opportunity-intelligence/client-matching", label: "Client Matching" },
  { href: "/admin/opportunity-intelligence/sources", label: "Data Sources" },
  { href: "/admin/opportunity-intelligence/jobs", label: "Collection Jobs" },
  { href: "/admin/opportunity-intelligence/settings", label: "Settings" },
];

export default function OpportunityIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <AdminHeader />
      <div className="border-b border-white/10 bg-[#0d1424]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                  FLORIDA EDITION • 67 COUNTIES
                </span>
                <span className="text-xs text-slate-400 font-mono">v1.0 Production</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                Intent Opportunity Intelligence
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/opportunity-intelligence/geographic-search"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                <span>🔍</span> Quick FL Geo Search
              </Link>
            </div>
          </div>

          <nav className="flex space-x-1 overflow-x-auto pb-1 scrollbar-thin">
            {OI_TABS.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
