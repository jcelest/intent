"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { SearchIcon } from "@/components/admin/opportunity-intelligence/icons";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";

interface TabItem {
  href: string;
  label: string;
  exact?: boolean;
}

const OI_TABS: TabItem[] = [
  { href: "/admin/opportunity-intelligence", label: "Overview", exact: true },
  { href: "/admin/opportunity-intelligence/client-targets", label: "Client Targets (Call List)" },
  { href: "/admin/opportunity-intelligence/coverage", label: "Data Health" },
  { href: "/admin/opportunity-intelligence/outreach-database", label: "Portals" },
  { href: "/admin/opportunity-intelligence/bids", label: "Bids" },
  { href: "/admin/opportunity-intelligence/networks", label: "Networks" },
  { href: "/admin/opportunity-intelligence/geographic-search", label: "Geo Search" },
  { href: "/admin/opportunity-intelligence/saved", label: "Saved" },
  { href: "/admin/opportunity-intelligence/pipeline", label: "Pipeline" },
  { href: "/admin/opportunity-intelligence/client-matching", label: "Client Matching" },
  { href: "/admin/opportunity-intelligence/sources", label: "Sources" },
  { href: "/admin/opportunity-intelligence/jobs", label: "Jobs" },
  { href: "/admin/opportunity-intelligence/settings", label: "Settings" },
];

export default function OpportunityIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  // Cmd+K / Ctrl+K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paletteQuery.trim()) return;
    const query = paletteQuery.trim();
    // Check if query matches a Florida county
    const matchedCounty = FLORIDA_COUNTIES.find(
      (c) => c.name.toLowerCase() === query.toLowerCase() || `${c.name.toLowerCase()} county` === query.toLowerCase()
    );
    if (matchedCounty) {
      router.push(`/admin/opportunity-intelligence/client-targets?county=${encodeURIComponent(matchedCounty.name)}`);
    } else {
      router.push(`/admin/opportunity-intelligence/client-targets?search=${encodeURIComponent(query)}`);
    }
    setCommandPaletteOpen(false);
    setPaletteQuery("");
  };

  const handleSelectCounty = (countyName: string) => {
    router.push(`/admin/opportunity-intelligence/client-targets?county=${encodeURIComponent(countyName)}`);
    setCommandPaletteOpen(false);
    setPaletteQuery("");
  };

  const filteredCounties = paletteQuery.trim()
    ? FLORIDA_COUNTIES.filter((c) => c.name.toLowerCase().includes(paletteQuery.toLowerCase())).slice(0, 8)
    : FLORIDA_COUNTIES.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans antialiased">
      <AdminHeader />

      {/* Terminal System Header */}
      <div className="border-b border-[#262626] bg-[#111111]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#FFB000] inline-block animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono tracking-wider uppercase text-[#FFB000] font-bold">
                    [TERMINAL ACTIVE]
                  </span>
                  <span className="text-[11px] font-mono text-[#888888]">
                    FLORIDA OPPORTUNITY INTELLIGENCE
                  </span>
                </div>
                <h1 className="text-base font-bold tracking-tight text-white font-mono">
                  INTENT REVENUE // WORK-FIRST OPERATIONS TERMINAL
                </h1>
              </div>
            </div>

            {/* Quick Actions & Command Palette Trigger */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="inline-flex items-center gap-2 rounded-[2px] border border-[#262626] bg-[#161616] px-3 py-1.5 text-xs font-mono text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors focus:outline-none focus:ring-1 focus:ring-[#FFB000]"
                title="Command Palette (Cmd+K / Ctrl+K)"
              >
                <SearchIcon className="h-3.5 w-3.5 text-[#FFB000]" />
                <span>Search Records & Counties...</span>
                <kbd className="rounded-[2px] bg-[#222222] px-1.5 py-0.5 text-[10px] text-[#888888] border border-[#333333]">
                  ⌘K
                </kbd>
              </button>

              <Link
                href="/admin/opportunity-intelligence/coverage"
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#262626] bg-[#161616] px-3 py-1.5 text-xs font-mono text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors"
              >
                [DATA HEALTH]
              </Link>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex space-x-1 overflow-x-auto pt-2 pb-0.5 scrollbar-thin">
            {OI_TABS.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-mono transition-colors rounded-[2px] ${
                    active
                      ? "bg-[#1C1C1C] text-[#FFB000] border-b-2 border-[#FFB000] font-semibold"
                      : "text-[#888888] hover:text-white hover:bg-[#161616]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Terminal Viewport */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">{children}</main>

      {/* Global Cmd+K Command Palette Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-[2px] border border-[#262626] bg-[#111111] shadow-2xl overflow-hidden font-mono">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative border-b border-[#262626]">
              <SearchIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-[#FFB000]" />
              <input
                type="text"
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Search businesses, situs addresses, APNs, or Florida counties..."
                className="w-full bg-[#111111] py-3.5 pl-10 pr-12 text-sm text-white placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-[#FFB000]"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="absolute right-3 top-3 text-xs text-[#666666] hover:text-white px-1.5 py-0.5 rounded-[2px] border border-[#262626]"
              >
                ESC
              </button>
            </form>

            {/* Quick Actions & Navigation List */}
            <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
              {paletteQuery.trim() && (
                <div>
                  <div className="text-[10px] text-[#888888] uppercase tracking-wider mb-1.5 px-1">
                    Free-Text Target Search
                  </div>
                  <button
                    onClick={handleSearchSubmit}
                    className="w-full text-left px-2.5 py-1.5 rounded-[2px] text-xs text-white hover:bg-[#1C1C1C] hover:text-[#FFB000] flex items-center justify-between border border-transparent hover:border-[#262626]"
                  >
                    <span>Search all targets for: &quot;{paletteQuery}&quot;</span>
                    <span className="text-[10px] text-[#888888]">[ENTER]</span>
                  </button>
                </div>
              )}

              <div>
                <div className="text-[10px] text-[#888888] uppercase tracking-wider mb-1.5 px-1">
                  Florida Counties
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {filteredCounties.map((c) => (
                    <button
                      key={c.fips}
                      onClick={() => handleSelectCounty(c.name)}
                      className="text-left px-2 py-1 rounded-[2px] text-xs text-[#CCCCCC] hover:bg-[#1C1C1C] hover:text-[#FFB000] flex items-center justify-between border border-transparent hover:border-[#262626]"
                    >
                      <span>{c.name} County</span>
                      <span className="text-[10px] text-[#666666]">{c.region}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#888888] uppercase tracking-wider mb-1.5 px-1">
                  Terminal Views
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      router.push("/admin/opportunity-intelligence/client-targets");
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 rounded-[2px] text-xs text-[#CCCCCC] hover:bg-[#1C1C1C] hover:text-[#FFB000] flex items-center justify-between"
                  >
                    <span>Client Targets // Call List Mode</span>
                    <span className="text-[10px] text-[#666666]">/client-targets</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/opportunity-intelligence/coverage");
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 rounded-[2px] text-xs text-[#CCCCCC] hover:bg-[#1C1C1C] hover:text-[#FFB000] flex items-center justify-between"
                  >
                    <span>Data Health // 67-County Status</span>
                    <span className="text-[10px] text-[#666666]">/coverage</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/opportunity-intelligence/pipeline");
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 rounded-[2px] text-xs text-[#CCCCCC] hover:bg-[#1C1C1C] hover:text-[#FFB000] flex items-center justify-between"
                  >
                    <span>Outreach Pipeline</span>
                    <span className="text-[10px] text-[#666666]">/pipeline</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-[#262626] bg-[#0E0E0E] px-3 py-2 text-[10px] text-[#666666] flex items-center justify-between">
              <span>Press ENTER to jump, ESC to dismiss</span>
              <span className="text-[#FFB000]">Intent Operations Terminal</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
