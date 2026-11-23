"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnifiedClientTargetRow } from "@/lib/client-outreach-engine";
import type { ClientRegistrationRecord } from "@/lib/permits-and-registrations";
import {
  GoogleIcon,
  ShieldCheckIcon,
  SearchIcon,
  RefreshIcon,
  DownloadIcon,
  CheckIcon,
  ExternalLinkIcon,
  PlusIcon,
  PhoneIcon,
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

export default function ClientTerritoryTargetsPage() {
  const [clients, setClients] = useState<RegisteredClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [territoryInput, setTerritoryInput] = useState<string>("Orange, Osceola, Seminole, Escambia, Santa Rosa");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [sqftFilter, setSqftFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);

  const [targets, setTargets] = useState<UnifiedClientTargetRow[]>([]);
  const [territoryCounties, setTerritoryCounties] = useState<string[]>([]);
  const [registrations, setRegistrations] = useState<ClientRegistrationRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState({
    totalInTerritory: 0,
    verifiedActiveCount: 0,
    chillerCount: 0,
    under10tCount: 0,
    permitsFoundCount: 0,
    inPipelineCount: 0,
    reviewQueueCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [verifyingTargetId, setVerifyingTargetId] = useState<string | null>(null);
  const [pipelineNotice, setPipelineNotice] = useState<string | null>(null);
  const [showRegistrations, setShowRegistrations] = useState<boolean>(false);

  const loadTargets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "all") params.set("clientId", selectedClientId);
      if (territoryInput.trim()) params.set("territory", territoryInput.trim());
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (verificationFilter !== "all") params.set("verificationStatus", verificationFilter);
      if (sqftFilter !== "all") params.set("sqftBand", sqftFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (needsReviewOnly) params.set("needsReviewOnly", "true");

      const res = await fetch(`/api/opportunity-intelligence/client-targets?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTargets(data.targets || []);
        setTotal(data.total || 0);
        setTerritoryCounties(data.territoryCounties || []);
        if (data.stats) setStats(data.stats);
        if (data.registeredClients) setClients(data.registeredClients);
        if (data.clientRegistrations) setRegistrations(data.clientRegistrations);
      }
    } catch (err) {
      console.error("Failed loading client targets:", err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedClientId,
    territoryInput,
    channelFilter,
    verificationFilter,
    sqftFilter,
    searchQuery,
    needsReviewOnly,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTargets();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadTargets]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId !== "all") {
      const match = clients.find((c) => c.id === clientId);
      if (match && match.service_areas && match.service_areas.length > 0) {
        setTerritoryInput(match.service_areas.join(", "));
      }
    }
  };

  // Layer 6 Search Verification Trigger
  const triggerSearchVerification = async (target: UnifiedClientTargetRow, forceRefresh: boolean = false) => {
    try {
      setVerifyingTargetId(target.targetId);
      const res = await fetch("/api/opportunity-intelligence/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          businessName: target.name,
          city: target.city,
          county: target.county,
          targetType: target.channel,
          targetId: target.parcelId,
          streetAddress: target.situsAddress,
          phone: target.verifiedPhone,
          forceRefresh,
        }),
      });
      const data = await res.json();
      if (data.ok && data.verification) {
        setTargets((prev) =>
          prev.map((t) =>
            t.targetId === target.targetId
              ? {
                  ...t,
                  verificationStatus: data.verification.verification_status,
                  officialWebsiteUrl: data.verification.official_website_url,
                  hasWebsite: data.verification.has_website,
                  gbpSignal: data.verification.gbp_signal,
                  rating: data.verification.rating,
                  reviewCount: data.verification.review_count,
                  verifiedPhone: data.verification.phone || t.verifiedPhone,
                  evidence: data.verification.evidence || t.evidence,
                  needsReview: data.verification.needs_review,
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Error verifying target:", err);
    } finally {
      setVerifyingTargetId(null);
    }
  };

  // One-click Add to Outreach Pipeline carrying full evidence trail
  const pushToPipeline = async (target: UnifiedClientTargetRow) => {
    try {
      const selectedClient = clients.find((c) => c.id === selectedClientId);
      const res = await fetch("/api/opportunity-intelligence/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_pipeline",
          clientId: selectedClient ? selectedClient.id : null,
          clientName: selectedClient ? selectedClient.name : null,
          parcelId: target.parcelId,
          county: target.county,
          businessName: target.name,
          channel: target.channel,
          situsAddress: target.situsAddress,
          incumbentContractor: target.incumbentContractor,
          lastPermitDate: target.lastMechanicalPermitDate,
          evidenceUrls: target.evidence.map((e) => e.url),
          officialWebsite: target.officialWebsiteUrl,
          phone: target.verifiedPhone,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPipelineNotice(`Added "${target.name}" to outreach pipeline with full evidence trail.`);
        setTargets((prev) =>
          prev.map((t) =>
            t.targetId === target.targetId ? { ...t, inPipeline: true, pipelineStage: "identified" } : t
          )
        );
        setTimeout(() => setPipelineNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed adding to pipeline:", err);
    }
  };

  // Export full targets to CSV
  const exportTargetsCSV = () => {
    if (targets.length === 0) return;
    const headers = [
      "Target Name",
      "Channel",
      "Situs Address",
      "City",
      "County",
      "SqFt",
      "Tonnage Risk (Est)",
      "Sunbiz Status",
      "Sunbiz Doc #",
      "Last Mechanical Permit",
      "Incumbent Contractor",
      "Verification Status",
      "Has Website",
      "Official Website",
      "Rating",
      "Reviews",
      "Verified Phone",
      "Fit Score",
      "Scope Warning",
      "Evidence URLs",
    ];

    const rows = targets.map((t) => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.channel}"`,
      `"${t.situsAddress.replace(/"/g, '""')}"`,
      `"${t.city}"`,
      `"${t.county}"`,
      `"${t.buildingSqft || ""}"`,
      `"${t.tonnageRisk}"`,
      `"${t.entityStatus}"`,
      `"${t.sunbizDocNumber || ""}"`,
      `"${t.lastMechanicalPermitDate || ""}"`,
      `"${(t.incumbentContractor || "").replace(/"/g, '""')}"`,
      `"${t.verificationStatus}"`,
      `"${t.hasWebsite}"`,
      `"${t.officialWebsiteUrl || ""}"`,
      `"${t.rating || ""}"`,
      `"${t.reviewCount || ""}"`,
      `"${t.verifiedPhone || ""}"`,
      `"${t.fitScore}"`,
      `"${t.scopeWarning || ""}"`,
      `"${t.evidence.map((e) => e.url).join("; ")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `client-territory-targets-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              SIX-LAYER COMMERCIAL INTELLIGENCE
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Parcels • Sunbiz • DBPR • Permits • Registrations • Google Search Verified
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Client Territory Commercial Outreach Database
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive commercial outreach targets in client territory across property appraiser parcels, timing permits, and Google-verified active entities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedClient && (
            <button
              onClick={() => setShowRegistrations(!showRegistrations)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              <BuildingIcon className="h-3.5 w-3.5" />
              {showRegistrations ? "Hide Vendor Portals" : "Client Vendor Portals (Layer 5)"}
            </button>
          )}
          <button
            onClick={exportTargetsCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <DownloadIcon className="h-3.5 w-3.5" /> Export Targets ({total})
          </button>
        </div>
      </div>

      {pipelineNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300 inline-flex items-center gap-1.5 w-full">
          <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0" /> {pipelineNotice}
        </div>
      )}

      {/* Client Selector & Territory Input Card */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-white/10">
          <div>
            <label className="block text-[11px] font-mono uppercase text-cyan-400 font-semibold mb-1.5">
              Client Profile (from trade_demand_clients):
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full rounded-xl border border-cyan-500/40 bg-black/60 px-3.5 py-2.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="all">Priority Counties Market (Orange, Osceola, Seminole, Escambia, Santa Rosa)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.trades.length > 0 ? `• [${c.trades.join(", ")}]` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 font-semibold mb-1.5">
              Territory Input (Counties, Cities, ZIPs resolved by florida-geo):
            </label>
            <input
              type="text"
              value={territoryInput}
              onChange={(e) => setTerritoryInput(e.target.value)}
              placeholder="e.g. Orange, Osceola, Seminole, Escambia, Santa Rosa..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
            />
            {territoryCounties.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {territoryCounties.map((c) => (
                  <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    {c} County
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Territory & Six-Layer KPI Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Total in Territory</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.totalInTerritory}</div>
            <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Commercial parcels</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-cyan-400 flex items-center gap-1">
              <GoogleIcon className="h-3 w-3" /> Verified Active
            </div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{stats.verifiedActiveCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Google search verified</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-emerald-400">Permits Found</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{stats.permitsFoundCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Incumbent contractor</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-purple-400">Chiller Likely (Est)</div>
            <div className="text-xl font-bold text-purple-400 mt-0.5">{stats.chillerCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">100k+ sq ft screening</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-blue-400">Under 10T Likely (Est)</div>
            <div className="text-xl font-bold text-blue-400 mt-0.5">{stats.under10tCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">&lt;15k sq ft screening</div>
          </div>

          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-amber-400">In Pipeline</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{stats.inPipelineCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Outreach initiated</div>
          </div>
        </div>
      </div>

      {/* Layer 5: Client Vendor Portal Registrations Drawer */}
      {showRegistrations && selectedClient && (
        <div className="rounded-2xl border border-cyan-500/30 bg-[#0d1424] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BuildingIcon className="h-4 w-4 text-cyan-400" />
                Layer 5: Vendor Portal & Aggregator Registration Tracker for {selectedClient.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Track compliance on official county vendor portals, school districts, ServiceChannel, Lessen, and DMG Pro.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">
              {registrations.filter((r) => r.status === "REGISTERED").length} of {registrations.length} Active Registrations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {registrations.map((reg) => (
              <div key={reg.portal_name} className="rounded-xl border border-white/5 bg-black/30 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{reg.portal_name}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      reg.status === "REGISTERED"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : reg.status === "IN_PROGRESS"
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    }`}
                  >
                    {reg.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Type: {reg.portal_type.replace(/_/g, " ")}</div>
                {reg.vendor_number && <div className="text-[11px] text-cyan-400 font-mono">Vendor #: {reg.vendor_number}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search Property / Owner / GC</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Owner, address, incumbent GC..."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none pl-8"
            />
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Outreach Channel</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="office">Office / Professional</option>
            <option value="retail">Retail / Community Centers</option>
            <option value="medical_clinic">Medical & Clinic</option>
            <option value="school">School / Educational</option>
            <option value="warehouse_industrial">Warehouse & Logistics</option>
            <option value="municipal">Municipal / Government</option>
            <option value="association_cam">Association / CAM</option>
            <option value="hospitality">Hospitality</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Verification Status (Layer 6)</label>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Verification States</option>
            <option value="VERIFIED_ACTIVE">VERIFIED_ACTIVE (Name + City + Signal)</option>
            <option value="LIKELY_ACTIVE">LIKELY_ACTIVE</option>
            <option value="AMBIGUOUS">AMBIGUOUS (Needs Review)</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">SqFt / Tonnage (Screening Est)</label>
          <select
            value={sqftFilter}
            onChange={(e) => setSqftFilter(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Size Bands</option>
            <option value="UNDER_10T_LIKELY">UNDER_10T_LIKELY (&lt;15k sq ft)</option>
            <option value="OVER_10T_POSSIBLE">OVER_10T_POSSIBLE (15k-100k sq ft)</option>
            <option value="CHILLER_LIKELY">CHILLER_LIKELY (100k+ sq ft)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setNeedsReviewOnly(!needsReviewOnly)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all border ${
              needsReviewOnly
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
          >
            {needsReviewOnly ? "✓ Showing Review Queue" : "Human Review Queue"}
          </button>
        </div>
      </div>

      {/* Main Outreach Deliverable Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Commercial Outreach Targets: {selectedClient ? selectedClient.name : "Territory Market"}
          </h3>
          <span className="text-xs font-mono text-cyan-400">
            Showing {targets.length} of {total} Targets
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-sm font-mono text-slate-400">
            <RefreshIcon className="h-6 w-6 animate-spin mx-auto mb-3 text-cyan-400" />
            Loading commercial property appraiser parcels, Sunbiz matches, permits, and Google verifications…
          </div>
        ) : targets.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-400 space-y-2">
            <div>No outreach targets matched this client&apos;s territory or filter settings.</div>
            <div className="text-xs text-slate-500">
              Try adjusting the territory input or clearing active filters.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {targets.map((target) => (
              <div
                key={target.targetId}
                className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Information Column */}
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Channel */}
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wide border border-cyan-500/20">
                      {target.channel.replace(/_/g, " ")}
                    </span>

                    {/* Location */}
                    <span className="text-xs text-slate-400 font-mono">
                      {target.county} County • {target.city} (APN: {target.parcelId})
                    </span>

                    {/* Fit Score */}
                    <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                      Fit: {target.fitScore}/100
                    </span>

                    {/* Sunbiz Status */}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                        target.entityStatus === "Active"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      Sunbiz: {target.entityStatus} {target.sunbizDocNumber ? `(${target.sunbizDocNumber})` : ""}
                    </span>

                    {/* Tonnage Risk / Sqft Band (Screening Estimate) */}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                        target.tonnageRisk === "CHILLER_LIKELY"
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                          : target.tonnageRisk === "OVER_10T_POSSIBLE"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      }`}
                    >
                      {target.tonnageRisk} (Screening Est: {target.buildingSqft ? `${target.buildingSqft.toLocaleString()} sqft` : "Unknown sqft"})
                    </span>

                    {/* Client Scope Warning Screen */}
                    {target.scopeWarning && (
                      <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        ⚠ {target.scopeWarning}
                      </span>
                    )}
                  </div>

                  {/* Target Name */}
                  <h4 className="text-base font-semibold text-white">
                    {target.name}
                  </h4>
                  <div className="text-xs text-slate-300 font-mono">
                    Situs: {target.situsAddress}, {target.city}, FL
                  </div>

                  {/* Layer 4: Permit & Incumbent Contractor Signal */}
                  {target.incumbentContractor && (
                    <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-2 text-xs text-emerald-300 flex items-center gap-2">
                      <span className="font-bold uppercase font-mono text-[10px]">Timing Permit Signal:</span>
                      <span>
                        Serviced by <strong>{target.incumbentContractor}</strong> (Mechanical Permit: {target.lastMechanicalPermitDate || "Recorded"}).
                      </span>
                    </div>
                  )}

                  {/* Layer 6: Google Search Verification Signals */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        target.verificationStatus === "VERIFIED_ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : target.verificationStatus === "AMBIGUOUS"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      }`}
                    >
                      <GoogleIcon className="h-2.5 w-2.5" />
                      <ShieldCheckIcon className="h-3 w-3 text-cyan-400" />
                      {target.verificationStatus}
                    </span>

                    {target.hasWebsite && target.officialWebsiteUrl && (
                      <a
                        href={target.officialWebsiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-mono text-[11px]"
                      >
                        Official Website <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    )}

                    {!target.hasWebsite && target.gbpSignal === "LISTING_PRESENT" && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-mono">
                        No Website Lead Profile (GBP Present)
                      </span>
                    )}

                    {target.rating && (
                      <span className="text-[11px] font-mono text-amber-400">
                        {target.rating} ★ ({target.reviewCount || 0} reviews)
                      </span>
                    )}

                    {target.verifiedPhone && (
                      <a
                        href={`tel:${target.verifiedPhone}`}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-mono text-[11px]"
                      >
                        <PhoneIcon className="h-3 w-3" /> {target.verifiedPhone}
                      </a>
                    )}

                    {target.evidence.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {target.evidence.length} Evidence Source URLs
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row xl:flex-col items-start xl:items-end gap-2 shrink-0 pt-3 xl:pt-0">
                  {/* Google Search Live Inspection */}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`"${target.name}" ${target.city} FL`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all w-full sm:w-auto"
                  >
                    <GoogleIcon className="h-3.5 w-3.5" />
                    Inspect Search Results
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>

                  {/* Re-verify Layer 6 Search Provider */}
                  <button
                    onClick={() => triggerSearchVerification(target, true)}
                    disabled={verifyingTargetId === target.targetId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    <RefreshIcon className={`h-3 w-3 ${verifyingTargetId === target.targetId ? "animate-spin text-cyan-400" : ""}`} />
                    {verifyingTargetId === target.targetId ? "Searching…" : "Refresh Search Signals"}
                  </button>

                  {/* Add to Pipeline Carrying Full Evidence Trail */}
                  <button
                    onClick={() => pushToPipeline(target)}
                    disabled={target.inPipeline}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all w-full sm:w-auto shadow-sm ${
                      target.inPipeline
                        ? "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20"
                    }`}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {target.inPipeline ? `In Pipeline (${target.pipelineStage})` : "Add to Outreach Pipeline"}
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
