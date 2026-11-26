"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";

const PRIMARY_NAV = [
  ["/admin/opportunity-intelligence", "Market Overview"],
  ["/admin/opportunity-intelligence/all", "All Opportunities"],
  ["/admin/opportunity-intelligence/atlas", "Intent Atlas"],
  ["/admin/opportunity-intelligence/solicitations", "Active Solicitations"],
  ["/admin/opportunity-intelligence/renewals", "Contract Renewals"],
  ["/admin/opportunity-intelligence/awards", "Historical Awards"],
  ["/admin/opportunity-intelligence/properties", "Properties"],
  ["/admin/opportunity-intelligence/relationships", "Relationships"],
  ["/admin/opportunity-intelligence/management-firms", "Management Firms"],
  ["/admin/opportunity-intelligence/equipment", "Equipment"],
  ["/admin/opportunity-intelligence/permits", "Permits"],
  ["/admin/opportunity-intelligence/analytics", "Market Analytics"],
  ["/admin/opportunity-intelligence/saved", "Saved"],
  ["/admin/opportunity-intelligence/sources", "Sources & Coverage"],
] as const;

const LEGACY_NAV = [
  ["/admin/opportunity-intelligence/pipeline", "Outreach Pipeline"],
  ["/admin/opportunity-intelligence/client-targets", "Client Target Overlay"],
  ["/admin/opportunity-intelligence/jobs", "Ingestion Jobs"],
  ["/admin/opportunity-intelligence/settings", "Settings & Taxonomy"],
] as const;

export default function OpportunityIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    const county = FLORIDA_COUNTIES.find((item) => item.name.toLowerCase() === clean.toLowerCase().replace(/ county$/, ""));
    router.push(county
      ? `/admin/opportunity-intelligence/all?county=${encodeURIComponent(county.name)}`
      : `/admin/opportunity-intelligence/all?search=${encodeURIComponent(clean)}`);
    setPaletteOpen(false);
  };

  const atlas = pathname === "/admin/opportunity-intelligence/atlas";
  return (
    <div className="min-h-screen bg-[#080a0c] text-[#e7eaee] antialiased">
      <AdminHeader />
      <header className="border-b border-white/[0.08] bg-[#0c0f12]">
        <div className="flex min-h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center border border-amber-400/35 bg-amber-400/[0.08] font-mono text-xs font-black text-amber-300">OI</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-white">Opportunity Intelligence Hub</div>
              <div className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-[#747d87]">Florida commercial economy · source-traceable records</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setPaletteOpen(true)} className="hidden border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#aab2ba] transition hover:border-amber-300/40 hover:text-white sm:block">
              Search intelligence <kbd className="ml-3 font-mono text-[10px] text-[#626c76]">Ctrl K</kbd>
            </button>
            <Link href="/admin/opportunity-intelligence/atlas" className="border border-amber-300/30 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/[0.14]">Open Atlas</Link>
          </div>
        </div>
        <nav className="flex overflow-x-auto border-t border-white/[0.05] px-3 lg:px-5" aria-label="Opportunity Intelligence views">
          {PRIMARY_NAV.map(([href, label]) => {
            const active = href === "/admin/opportunity-intelligence" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={`shrink-0 border-b-2 px-3 py-2 text-xs transition ${active ? "border-amber-300 text-amber-200" : "border-transparent text-[#7e8791] hover:text-[#d5d9dd]"}`}>{label}</Link>;
          })}
          <details className="group relative shrink-0">
            <summary className="cursor-pointer list-none border-b-2 border-transparent px-3 py-2 text-xs text-[#7e8791] hover:text-[#d5d9dd]">Operations</summary>
            <div className="fixed right-5 z-[60] mt-1 min-w-48 border border-white/10 bg-[#11151a] p-1 shadow-2xl">
              {LEGACY_NAV.map(([href, label]) => <Link key={href} href={href} className="block px-3 py-2 text-xs text-[#aeb5bd] hover:bg-white/[0.05] hover:text-white">{label}</Link>)}
            </div>
          </details>
        </nav>
      </header>

      <main className={atlas ? "h-[calc(100vh-12.25rem)] min-h-[620px]" : "mx-auto w-full max-w-[1800px] px-4 py-5 lg:px-6"}>{children}</main>

      {paletteOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-black/75 px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && setPaletteOpen(false)}>
          <div className="h-fit w-full max-w-2xl border border-white/10 bg-[#101419] shadow-2xl">
            <form onSubmit={submit} className="flex items-center border-b border-white/10">
              <span className="px-4 text-amber-300" aria-hidden>⌕</span>
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Opportunity, organization, address, county, city, ZIP…" className="h-14 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#56616b]" />
              <button type="button" onClick={() => setPaletteOpen(false)} className="mr-3 border border-white/10 px-2 py-1 text-[10px] text-[#77818a]">ESC</button>
            </form>
            <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
              <button onClick={submit} className="bg-[#101419] p-4 text-left text-xs text-[#adb5bd] hover:bg-white/[0.03] hover:text-white">Search the full opportunity universe</button>
              <Link href="/admin/opportunity-intelligence/atlas" onClick={() => setPaletteOpen(false)} className="bg-[#101419] p-4 text-xs text-[#adb5bd] hover:bg-white/[0.03] hover:text-white">Explore geographically in Intent Atlas</Link>
            </div>
            <div className="px-4 py-3 text-[11px] text-[#66717b]">Client targeting remains available as an optional operations overlay and does not constrain these results.</div>
          </div>
        </div>
      )}
    </div>
  );
}
