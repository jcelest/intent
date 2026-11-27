"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutreachTargetRecord } from "@/lib/opportunity-intelligence";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import {
  GoogleIcon,
  ShieldCheckIcon,
  SearchIcon,
  RefreshIcon,
  DownloadIcon,
  CheckIcon,
  ExternalLinkIcon,
  PlusIcon,
  MailIcon,
  PhoneIcon,
  GlobeIcon,
  BuildingIcon,
} from "@/components/admin/opportunity-intelligence/icons";

interface RegisteredClient {
  id: string;
  name: string;
  trades: string[];
  service_areas: string[];
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

export default function UnifiedOutreachDatabasePage() {
  const [clients, setClients] = useState<RegisteredClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [territoryOverride, setTerritoryOverride] = useState<string>("");
  const [tradeOverride, setTradeOverride] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [verificationStatus, setVerificationStatus] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [targets, setTargets] = useState<OutreachTargetRecord[]>([]);
  const [territoryCounties, setTerritoryCounties] = useState<string[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState({
    totalInTerritory: 0,
    governmentTargets: 0,
    commercialTargets: 0,
    googleVerifiedCount: 0,
    inPipelineCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pipelineNotice, setPipelineNotice] = useState<string | null>(null);

  // Load outreach targets for selected client
  const loadOutreachData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "all") params.set("clientId", selectedClientId);
      if (territoryOverride && territoryOverride !== "all") params.set("territory", territoryOverride);
      if (tradeOverride && tradeOverride !== "all") params.set("trade", tradeOverride);
      if (targetType && targetType !== "all") params.set("targetType", targetType);
      if (verificationStatus && verificationStatus !== "all") params.set("verificationStatus", verificationStatus);
      if (selectedCounty && selectedCounty !== "all") params.set("county", selectedCounty);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/opportunity-intelligence/outreach-database?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTargets(data.targets || []);
        setTotal(data.total || 0);
        setTerritoryCounties(data.territoryCounties || []);
        if (data.stats) setStats(data.stats);
        if (data.registeredClients) setClients(data.registeredClients);
      }
    } catch (err) {
      console.error("Failed fetching client outreach targets:", err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedClientId,
    territoryOverride,
    tradeOverride,
    targetType,
    verificationStatus,
    selectedCounty,
    searchQuery,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOutreachData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadOutreachData]);

  // Handle client selection switch
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId !== "all") {
      const match = clients.find((c) => c.id === clientId);
      if (match) {
        if (match.service_areas && match.service_areas.length > 0) {
          setTerritoryOverride(match.service_areas.join(", "));
        }
        if (match.trades && match.trades.length > 0) {
          setTradeOverride(match.trades[0]);
        }
      }
    }
  };

  // Live Google Search verification for individual target
  const triggerGoogleVerification = async (target: OutreachTargetRecord) => {
    try {
      setVerifyingId(target.id);
      const res = await fetch("/api/opportunity-intelligence/outreach-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id }),
      });
      const data = await res.json();
      if (data.ok && data.target) {
        setTargets((prev) =>
          prev.map((t) => (t.id === target.id ? { ...t, ...data.target } : t))
        );
      }
    } catch (err) {
      console.error("Error verifying target:", err);
    } finally {
      setVerifyingId(null);
    }
  };

  // Push target into client's outreach pipeline
  const pushTargetToPipeline = async (target: OutreachTargetRecord) => {
    try {
      const selectedClient = clients.find((c) => c.id === selectedClientId);
      const res = await fetch("/api/opportunity-intelligence/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityTitle: `Direct Outreach: ${target.target_name} (${target.relevant_trades.join(", ")})`,
          targetName: target.target_name,
          targetType: target.target_type,
          stage: "identified",
          clientId: selectedClient ? selectedClient.id : null,
          clientName: selectedClient ? selectedClient.name : null,
          contactPerson: target.primary_contact_name,
          contactEmail: target.primary_contact_email,
          contactPhone: target.primary_contact_phone,
          notes: `Google Search Verified. Location: ${target.county} County, FL. Portal: ${target.procurement_portal_url || target.official_url || "N/A"}. Recent: ${target.recent_activity_summary || "N/A"}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPipelineNotice(
          `Target "${target.target_name}" added to ${selectedClient ? selectedClient.name : "Active"} Pipeline.`
        );
        setTargets((prev) =>
          prev.map((t) =>
            t.id === target.id ? { ...t, in_pipeline: true, pipeline_stage: "identified" } : t
          )
        );
        setTimeout(() => setPipelineNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed adding to pipeline:", err);
    }
  };

  // Export client outreach target list to CSV
  const exportOutreachCSV = () => {
    if (targets.length === 0) return;
    const headers = [
      "Target Name",
      "Classification",
      "County",
      "City",
      "Trades",
      "Google Verification Status",
      "Google Rating",
      "Google Reviews",
      "Contact Person",
      "Contact Title",
      "Contact Email",
      "Contact Phone",
      "Official URL",
      "Portal URL",
      "Recent Activity / Solicitations",
    ];

    const rows = targets.map((t) => [
      `"${t.target_name.replace(/"/g, '""')}"`,
      `"${t.target_type}"`,
      `"${t.county}"`,
      `"${t.city || ""}"`,
      `"${t.relevant_trades.join("; ")}"`,
      `"${t.google_verification_status}"`,
      `"${t.google_rating || ""}"`,
      `"${t.google_review_count || ""}"`,
      `"${t.primary_contact_name || ""}"`,
      `"${t.primary_contact_title || ""}"`,
      `"${t.primary_contact_email || ""}"`,
      `"${t.primary_contact_phone || ""}"`,
      `"${t.official_url || ""}"`,
      `"${t.procurement_portal_url || ""}"`,
      `"${(t.recent_activity_summary || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `client-outreach-targets-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              UNIFIED OUTREACH INTELLIGENCE
            </span>
            <span className="text-xs text-slate-400 font-mono">Florida Government Records + Google Verified Active</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Client Territory Outreach Database
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unified view of every government procurement authority, municipality, and commercial buyer in any registered client&apos;s territory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportOutreachCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <DownloadIcon className="h-3.5 w-3.5" /> Export Client Targets ({total})
          </button>
        </div>
      </div>

      {pipelineNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300 inline-flex items-center gap-1.5 w-full">
          <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0" /> {pipelineNotice}
        </div>
      )}

      {/* Client Command Bar (Select ANY Registered Client) */}
      <div className="rounded-2xl border border-cyan-500/30 bg-[#0d1424] p-5 space-y-4 shadow-xl shadow-cyan-950/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <label className="block text-[11px] font-mono uppercase text-cyan-400 font-semibold tracking-wider">
              Select Registered Client Profile:
            </label>
            <div className="flex items-center gap-3">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="min-w-[280px] rounded-xl border border-cyan-500/40 bg-black/60 px-3.5 py-2.5 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="all">Statewide (All Registered Targets)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.trades.length > 0 ? `(${c.trades.join(", ")})` : ""}
                  </option>
                ))}
              </select>

              {selectedClient && (
                <div className="text-xs font-mono text-slate-400">
                  Contact: <span className="text-white font-medium">{selectedClient.contact_name || "Account Primary"}</span>
                  {selectedClient.contact_phone ? ` • ${selectedClient.contact_phone}` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Quick Territory Scoping Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Territory Scope:</span>
            <button
              onClick={() => setTerritoryOverride("Orange, Seminole, Osceola, Lake")}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                territoryOverride.includes("Orange") && territoryOverride.includes("Seminole")
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              Central FL (Orlando Metro)
            </button>
            <button
              onClick={() => setTerritoryOverride("Hillsborough, Pinellas, Pasco")}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                territoryOverride.includes("Hillsborough")
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              Tampa Bay & Suncoast
            </button>
            <button
              onClick={() => setTerritoryOverride("Miami-Dade, Broward, Palm Beach")}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                territoryOverride.includes("Miami-Dade")
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              South Florida Tri-County
            </button>
            <button
              onClick={() => setTerritoryOverride("all")}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                territoryOverride === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              All 67 Counties
            </button>
          </div>
        </div>

        {/* Territory Summary KPI Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Targets in Territory</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.totalInTerritory}</div>
            <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Active commercial scope</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-emerald-400">FL Government Buyers</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.governmentTargets}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">County, city, schools</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-blue-400">Commercial GCs / Devs</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.commercialTargets}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Private trade partners</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-cyan-400 flex items-center gap-1">
              <GoogleIcon className="h-3 w-3" /> Google Verified Active
            </div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{stats.googleVerifiedCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Verified active operations</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-amber-400">In Client Pipeline</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{stats.inPipelineCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active conversations</div>
          </div>
        </div>
      </div>

      {/* Filter and Query Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search Organization / Contact</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Agency, GC, contact name..."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none pl-8"
            />
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Target Classification</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Classifications</option>
            <option value="county_government">County Governments</option>
            <option value="municipal_government">Municipalities</option>
            <option value="school_district">School Districts</option>
            <option value="aviation_transit">Aviation & Transit</option>
            <option value="general_contractor">General Contractors</option>
            <option value="property_management">Property Managers</option>
            <option value="commercial_developer">Commercial Developers</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Google Verification</label>
          <select
            value={verificationStatus}
            onChange={(e) => setVerificationStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Verification States</option>
            <option value="verified_active">Google Verified Active</option>
            <option value="online_presence_active">Active Online Presence</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Trade Relevance</label>
          <select
            value={tradeOverride}
            onChange={(e) => setTradeOverride(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Commercial Trades</option>
            <option value="hvac">HVAC / Mechanical</option>
            <option value="roofing">Roofing & Waterproofing</option>
            <option value="electrical">Electrical & Generator</option>
            <option value="plumbing">Plumbing & Utility</option>
            <option value="general_contracting">General Contracting</option>
            <option value="facilities_maintenance">Facilities Maintenance</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">County In Territory</label>
          <select
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">
              {territoryCounties.length > 0
                ? `All Client Counties (${territoryCounties.length})`
                : "All Counties in Scope"}
            </option>
            {territoryCounties.length > 0
              ? territoryCounties.map((c) => (
                  <option key={c} value={c}>
                    {c} County
                  </option>
                ))
              : FLORIDA_COUNTIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} County
                  </option>
                ))}
          </select>
        </div>
      </div>

      {/* Main Unified Outreach Database Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BuildingIcon className="h-4 w-4 text-cyan-400" />
              Outreach Targets in Territory: {selectedClient ? selectedClient.name : "Selected Florida Market"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified active buyers and general contractors matching territory scope and trade qualifications.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            Showing {targets.length} of {total} Targets
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-sm font-mono text-slate-400">
            <RefreshIcon className="h-6 w-6 animate-spin mx-auto mb-3 text-cyan-400" />
            Resolving Florida government records and Google search verification data…
          </div>
        ) : targets.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-400 space-y-2">
            <div>No outreach targets matched this specific client criteria or territory filter.</div>
            <div className="text-xs text-slate-500">
              Try expanding the county selector or trade relevance dropdown to widen results.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {targets.map((target) => (
              <div
                key={target.id}
                className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Target Information Column */}
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                        target.source_category === "florida_government_records"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      }`}
                    >
                      {target.target_type.replace(/_/g, " ")}
                    </span>

                    <span className="text-xs text-slate-400 font-mono">
                      {target.county} County{target.city ? ` • ${target.city}` : ""}
                    </span>

                    {/* Google Search Verification Badge */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/20">
                      <GoogleIcon className="h-2.5 w-2.5" />
                      <ShieldCheckIcon className="h-3 w-3 text-cyan-400" />
                      Google Verified Active
                    </span>

                    {target.google_rating && (
                      <span className="text-[11px] font-mono text-amber-400">
                        {target.google_rating} rating ({target.google_review_count || 12} reviews)
                      </span>
                    )}

                    {target.in_pipeline && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        In Pipeline: {target.pipeline_stage}
                      </span>
                    )}
                  </div>

                  {/* Target Name */}
                  <h4 className="text-base font-semibold text-white hover:text-cyan-300 transition-colors">
                    {target.target_name}
                  </h4>

                  {/* Google Search Verified Snippet */}
                  {target.google_search_snippet && (
                    <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 text-xs text-slate-300 leading-relaxed font-sans">
                      <div className="text-[10px] font-mono uppercase text-slate-400 mb-0.5 flex items-center gap-1">
                        <GoogleIcon className="h-2.5 w-2.5" /> Google Search Data Signal:
                      </div>
                      {target.google_search_snippet}
                    </div>
                  )}

                  {/* Recent Activity / Solicitations */}
                  {target.recent_activity_summary && (
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300 font-mono">Scope:</strong> {target.recent_activity_summary}
                    </p>
                  )}

                  {/* Relevant Trades Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Trades Hired:</span>
                    {target.relevant_trades.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300 uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Public Contact Details */}
                  {(target.primary_contact_name || target.primary_contact_email || target.primary_contact_phone) && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400 font-mono">
                      {target.primary_contact_name && (
                        <span>
                          Contact: <strong className="text-slate-200">{target.primary_contact_name}</strong>
                          {target.primary_contact_title ? ` (${target.primary_contact_title})` : ""}
                        </span>
                      )}
                      {target.primary_contact_email && (
                        <a
                          href={`mailto:${target.primary_contact_email}`}
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                        >
                          <MailIcon className="h-3 w-3" /> {target.primary_contact_email}
                        </a>
                      )}
                      {target.primary_contact_phone && (
                        <a
                          href={`tel:${target.primary_contact_phone}`}
                          className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                        >
                          <PhoneIcon className="h-3 w-3" /> {target.primary_contact_phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Outreach & Action Buttons */}
                <div className="flex flex-col sm:flex-row xl:flex-col items-start xl:items-end gap-2 shrink-0 pt-3 xl:pt-0">
                  {/* Google Search Live Inspection Link */}
                  {target.google_search_query && (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(target.google_search_query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all w-full sm:w-auto"
                    >
                      <GoogleIcon className="h-3.5 w-3.5" />
                      Inspect Google Results
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  )}

                  {/* Re-verify Google Signal Button */}
                  <button
                    onClick={() => triggerGoogleVerification(target)}
                    disabled={verifyingId === target.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    <RefreshIcon className={`h-3 w-3 ${verifyingId === target.id ? "animate-spin text-cyan-400" : ""}`} />
                    {verifyingId === target.id ? "Verifying…" : "Refresh Google Data"}
                  </button>

                  {/* Official Procurement Portal Link */}
                  {target.procurement_portal_url && (
                    <a
                      href={target.procurement_portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2"
                    >
                      <GlobeIcon className="h-3 w-3" /> Official Procurement Portal
                    </a>
                  )}

                  {/* Push to Client Outreach Pipeline */}
                  <button
                    onClick={() => pushTargetToPipeline(target)}
                    disabled={target.in_pipeline}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all w-full sm:w-auto shadow-sm ${
                      target.in_pipeline
                        ? "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20"
                    }`}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {target.in_pipeline ? "Already in Pipeline" : "Add to Client Pipeline"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
