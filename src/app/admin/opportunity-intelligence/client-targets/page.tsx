"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnifiedClientTargetRow } from "@/lib/client-outreach-engine";
import type { ClientRegistrationRecord } from "@/lib/permits-and-registrations";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import {
  GoogleIcon,
  ShieldCheckIcon,
  SearchIcon,
  RefreshIcon,
  DownloadIcon,
  CheckIcon,
  ExternalLinkIcon,
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

interface CountyCoverage {
  county: string;
  count: number;
}

export default function ClientTerritoryTargetsPage() {
  const [clients, setClients] = useState<RegisteredClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");

  // Manual Filter State (All Optional, Defaults Unscoped)
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [zipFilter, setZipFilter] = useState<string>("");
  const [territoryInput, setTerritoryInput] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [tonnageRiskFilter, setTonnageRiskFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState<string>("all");
  const [minReviewsFilter, setMinReviewsFilter] = useState<string>("");
  const [entityStatusFilter, setEntityStatusFilter] = useState<string>("all");
  const [licenseTypeFilter, setLicenseTypeFilter] = useState<string>("all");
  const [permitWithinDaysFilter, setPermitWithinDaysFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState<boolean>(false);
  const [hideExistingAccounts, setHideExistingAccounts] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Data & KPI State
  const [targets, setTargets] = useState<UnifiedClientTargetRow[]>([]);
  const [coverage, setCoverage] = useState<CountyCoverage[]>([]);
  const [registrations, setRegistrations] = useState<ClientRegistrationRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState({
    totalInTerritory: 0,
    inClientTerritoryCount: 0,
    existingAccountsCount: 0,
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
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestionNotice, setIngestionNotice] = useState<string | null>(null);

  const triggerIngestion = async (mode: "step" | "all_67") => {
    try {
      setIngesting(true);
      const res = await fetch("/api/opportunity-intelligence/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.ok) {
        if (mode === "all_67") {
          setIngestionNotice(`Statewide Ingestion Complete: Processed 67 counties, added ${data.result?.totalAdded || 0} commercial parcels.`);
        } else {
          setIngestionNotice(`Continuous Cycle Complete: Ingested counties [${data.result?.countiesProcessed?.join(", ")}], added ${data.result?.totalRecordsAdded || 0} parcels. Next: ${data.result?.nextCounty}.`);
        }
        await loadTargets();
        setTimeout(() => setIngestionNotice(null), 6000);
      } else {
        setIngestionNotice(`Ingestion error: ${data.error || "Failed to run ingestion"}`);
        setTimeout(() => setIngestionNotice(null), 6000);
      }
    } catch (err) {
      console.error("Ingestion failed:", err);
      setIngestionNotice("Ingestion request failed.");
      setTimeout(() => setIngestionNotice(null), 6000);
    } finally {
      setIngesting(false);
    }
  };

  const loadTargets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClientId && selectedClientId !== "all") params.set("clientId", selectedClientId);
      if (countyFilter !== "all") params.set("county", countyFilter);
      if (cityFilter.trim()) params.set("city", cityFilter.trim());
      if (zipFilter.trim()) params.set("zip", zipFilter.trim());
      if (territoryInput.trim()) params.set("territory", territoryInput.trim());
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (tonnageRiskFilter !== "all") params.set("tonnageRisk", tonnageRiskFilter);
      if (verificationFilter !== "all") params.set("verificationStatus", verificationFilter);
      if (hasWebsiteFilter !== "all") params.set("hasWebsite", hasWebsiteFilter);
      if (minReviewsFilter && Number(minReviewsFilter) > 0) params.set("minReviews", minReviewsFilter);
      if (entityStatusFilter !== "all") params.set("entityStatus", entityStatusFilter);
      if (licenseTypeFilter !== "all") params.set("licenseType", licenseTypeFilter);
      if (permitWithinDaysFilter !== "all") params.set("permitWithinDays", permitWithinDaysFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (needsReviewOnly) params.set("needsReviewOnly", "true");
      if (hideExistingAccounts) params.set("hideExistingAccounts", "true");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/opportunity-intelligence/client-targets?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTargets(data.targets || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.coverage) setCoverage(data.coverage);
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
    countyFilter,
    cityFilter,
    zipFilter,
    territoryInput,
    channelFilter,
    tonnageRiskFilter,
    verificationFilter,
    hasWebsiteFilter,
    minReviewsFilter,
    entityStatusFilter,
    licenseTypeFilter,
    permitWithinDaysFilter,
    searchQuery,
    needsReviewOnly,
    hideExistingAccounts,
    page,
    pageSize,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTargets();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadTargets]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setPage(1);
    // Never reduce base dataset by territory when client is selected!
  };

  const handleResetFilters = () => {
    setCountyFilter("all");
    setCityFilter("");
    setZipFilter("");
    setTerritoryInput("");
    setChannelFilter("all");
    setTonnageRiskFilter("all");
    setVerificationFilter("all");
    setHasWebsiteFilter("all");
    setMinReviewsFilter("");
    setEntityStatusFilter("all");
    setLicenseTypeFilter("all");
    setPermitWithinDaysFilter("all");
    setSearchQuery("");
    setNeedsReviewOnly(false);
    setHideExistingAccounts(false);
    setPage(1);
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
          targetId: target.parcelId || target.targetId,
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
      "Record Type",
      "Channel",
      "Situs Address",
      "City",
      "County",
      "ZIP",
      "SqFt",
      "Tonnage Risk (Est)",
      "Sunbiz Status",
      "Sunbiz Doc #",
      "License Type",
      "License #",
      "Last Mechanical Permit",
      "Incumbent Contractor",
      "Verification Status",
      "Has Website",
      "Official Website",
      "Rating",
      "Reviews",
      "Verified Phone",
      "Fit Score",
      "In Client Territory",
      "Is Client Account",
      "Scope Warning",
      "Evidence URLs",
    ];

    const rows = targets.map((t) => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.recordType}"`,
      `"${t.channel}"`,
      `"${t.situsAddress.replace(/"/g, '""')}"`,
      `"${t.city}"`,
      `"${t.county}"`,
      `"${t.zip || ""}"`,
      `"${t.buildingSqft || ""}"`,
      `"${t.tonnageRisk}"`,
      `"${t.entityStatus}"`,
      `"${t.sunbizDocNumber || ""}"`,
      `"${(t.licenseType || "").replace(/"/g, '""')}"`,
      `"${t.licenseNumber || ""}"`,
      `"${t.lastMechanicalPermitDate || ""}"`,
      `"${(t.incumbentContractor || "").replace(/"/g, '""')}"`,
      `"${t.verificationStatus}"`,
      `"${t.hasWebsite}"`,
      `"${t.officialWebsiteUrl || ""}"`,
      `"${t.rating || ""}"`,
      `"${t.reviewCount || ""}"`,
      `"${t.verifiedPhone || ""}"`,
      `"${t.fitScore}"`,
      `"${t.inClientTerritory ? "YES" : "NO"}"`,
      `"${t.isClientAccount ? "YES" : "NO"}"`,
      `"${t.scopeWarning || ""}"`,
      `"${t.evidence.map((e) => e.url).join("; ")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `florida-commercial-outreach-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Check if selected county has data
  const isSelectedCountyIngested = countyFilter === "all" || coverage.some((c) => c.county.toLowerCase() === countyFilter.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              COMMERCIAL OPPORTUNITY INTELLIGENCE
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Parcels • Businesses • DBPR Licensees • Commercial Networks
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Florida Commercial Outreach Database
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete database of Florida commercial properties, licensees, networks, and timing permits verified with Google search data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedClient && (
            <button
              onClick={() => setShowRegistrations(!showRegistrations)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/30 transition-colors"
            >
              <BuildingIcon className="h-3.5 w-3.5" />
              Vendor Registrations ({registrations.filter((r) => r.status === "REGISTERED").length}/{registrations.length})
            </button>
          )}

          <button
            onClick={() => triggerIngestion("step")}
            disabled={ingesting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${ingesting ? "animate-spin" : ""}`} />
            {ingesting ? "Ingesting…" : "Run Ingestion Cycle"}
          </button>

          <button
            onClick={() => triggerIngestion("all_67")}
            disabled={ingesting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400 bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {ingesting ? "Ingesting All 67…" : "Ingest All 67 Counties"}
          </button>

          <button
            onClick={exportTargetsCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
          >
            <DownloadIcon className="h-3.5 w-3.5" /> Export ({total})
          </button>
        </div>
      </div>

      {ingestionNotice && (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-4 py-3 text-xs font-medium text-cyan-200 inline-flex items-center gap-1.5 w-full">
          <RefreshIcon className="h-4 w-4 text-cyan-400 shrink-0" /> {ingestionNotice}
        </div>
      )}

      {/* Coverage Honesty Banner */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-xs space-y-1">
        <div className="flex items-center justify-between font-mono">
          <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheckIcon className="h-4 w-4 text-cyan-400" />
            County Coverage Status ({coverage.length} Ingested Florida Counties):
          </span>
          <span className="text-slate-400 text-[11px]">
            {total} Total Active Commercial Records
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-300 font-mono text-[11px] pt-1">
          {coverage.map((c) => (
            <span key={c.county} className="inline-flex items-center gap-1">
              <span className="text-white font-semibold">{c.county}:</span>
              <span className="text-cyan-300">{c.count} records</span>
            </span>
          ))}
          <span className="text-slate-500 italic">
            • All other {67 - coverage.length} Florida counties are queued for ingestion.
          </span>
        </div>
      </div>

      {pipelineNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300 inline-flex items-center gap-1.5 w-full">
          <CheckIcon className="h-4 w-4 text-emerald-400 shrink-0" /> {pipelineNotice}
        </div>
      )}

      {/* Client Overlay Lens Card */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-mono uppercase text-cyan-400 font-semibold">
                Client Overlay Lens (Optional — Does not reduce dataset):
              </label>
            </div>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full rounded-xl border border-cyan-500/40 bg-black/60 px-3.5 py-2.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="all">None — Full Florida Market View (Unscoped)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.trades.length > 0 ? `• [${c.trades.join(", ")}]` : ""}
                </option>
              ))}
            </select>
            {selectedClient && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                <span>Territory: {selectedClient.service_areas.length > 0 ? selectedClient.service_areas.join(", ") : "Statewide"}</span>
                {selectedClient.trades.length > 0 && <span>Trades: {selectedClient.trades.join(", ")}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-end">
            {selectedClient ? (
              <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-2">
                <div className="text-[11px] font-mono uppercase text-slate-300 font-semibold">
                  Client Account Settings:
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={hideExistingAccounts}
                    onChange={(e) => {
                      setHideExistingAccounts(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-white/20 bg-black/40 text-amber-500 focus:ring-0"
                  />
                  <span>
                    Hide Existing Client Accounts ({stats.existingAccountsCount} Owned Accounts)
                  </span>
                </label>
              </div>
            ) : (
              <div className="rounded-xl bg-black/20 border border-white/5 p-3 text-xs text-slate-400 font-mono">
                Select a client to evaluate compatibility fit scores, capacity limits (chiller vs light commercial), and manage owned accounts.
              </div>
            )}
          </div>
        </div>

        {/* Territory & Six-Layer KPI Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
          <div className="rounded-xl bg-black/40 p-3 border border-white/5">
            <div className="text-[10px] font-mono uppercase text-slate-400">Total Matching Targets</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.totalInTerritory}</div>
            <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Real database count</div>
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
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : reg.status === "IN_PROGRESS"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
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

      {/* Manual Filter Controls Toolbar (All Combine via AND) */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <SearchIcon className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
              Manual Filtering Engine (All Filters Combine via AND)
            </h3>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
          >
            Reset All Filters
          </button>
        </div>

        {/* Row 1: Geography & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">County</label>
            <select
              value={countyFilter}
              onChange={(e) => {
                setCountyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Florida Counties ({coverage.length} Ingested)</option>
              {FLORIDA_COUNTIES.map((c) => {
                const cov = coverage.find((cv) => cv.county.toLowerCase() === c.name.toLowerCase());
                return (
                  <option key={c.fips} value={c.name}>
                    {c.name} County {cov ? `(${cov.count} records)` : "(Not ingested yet)"}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">City</label>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. Orlando, Pensacola..."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">ZIP Code</label>
            <input
              type="text"
              value={zipFilter}
              onChange={(e) => {
                setZipFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. 32801, 32501..."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Free-Text Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Name, address, incumbent GC..."
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none pl-8"
              />
              <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Row 2: Trade & Technical Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Outreach Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Channels</option>
              <option value="office">Office / Professional</option>
              <option value="retail">Retail / Commercial Centers</option>
              <option value="medical_clinic">Medical & Clinic</option>
              <option value="school">School / Educational</option>
              <option value="warehouse_industrial">Warehouse & Logistics</option>
              <option value="municipal">Municipal / Government</option>
              <option value="association_cam">Association / CAM</option>
              <option value="hospitality">Hospitality</option>
              <option value="other">Other Commercial</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Tonnage Risk (Screening)</label>
            <select
              value={tonnageRiskFilter}
              onChange={(e) => {
                setTonnageRiskFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Size Bands</option>
              <option value="UNDER_10T_LIKELY">UNDER_10T_LIKELY (&lt;15k sq ft)</option>
              <option value="OVER_10T_POSSIBLE">OVER_10T_POSSIBLE (15k-100k sq ft)</option>
              <option value="CHILLER_LIKELY">CHILLER_LIKELY (100k+ sq ft)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Verification Status</label>
            <select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="VERIFIED_ACTIVE">VERIFIED_ACTIVE (Name + Signal)</option>
              <option value="LIKELY_ACTIVE">LIKELY_ACTIVE</option>
              <option value="AMBIGUOUS">AMBIGUOUS (Needs Review)</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Website Available</label>
            <select
              value={hasWebsiteFilter}
              onChange={(e) => {
                setHasWebsiteFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All (With & Without Website)</option>
              <option value="true">Has Official Website</option>
              <option value="false">No Website Found</option>
            </select>
          </div>
        </div>

        {/* Row 3: Entity, License, Timing & Review Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Entity Status</label>
            <select
              value={entityStatusFilter}
              onChange={(e) => {
                setEntityStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Entity States</option>
              <option value="Active">Active (Sunbiz / License)</option>
              <option value="Inactive">Inactive</option>
              <option value="UNMATCHED">UNMATCHED</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">License Type</label>
            <select
              value={licenseTypeFilter}
              onChange={(e) => {
                setLicenseTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All License Types</option>
              <option value="Mechanical">Mechanical / HVAC</option>
              <option value="General Contractor">General Contractor</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Roofing">Roofing</option>
              <option value="Community Association">CAM / Management</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Permit Timing Signal</label>
            <select
              value={permitWithinDaysFilter}
              onChange={(e) => {
                setPermitWithinDaysFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Any Permit History</option>
              <option value="90">Mechanical Permit within 90 days</option>
              <option value="180">Mechanical Permit within 180 days</option>
              <option value="365">Mechanical Permit within 365 days</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Minimum Reviews</label>
            <select
              value={minReviewsFilter}
              onChange={(e) => {
                setMinReviewsFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Any Review Count</option>
              <option value="5">5+ Reviews</option>
              <option value="10">10+ Reviews</option>
              <option value="25">25+ Reviews</option>
              <option value="50">50+ Reviews</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setNeedsReviewOnly(!needsReviewOnly);
                setPage(1);
              }}
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
      </div>

      {/* Main Outreach Deliverable Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">
              Florida Commercial Targets ({total} Total Records)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} records across ingested counties
            </p>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-sm font-mono text-slate-400">
            <RefreshIcon className="h-6 w-6 animate-spin mx-auto mb-3 text-cyan-400" />
            Loading commercial property appraiser parcels, Sunbiz matches, permits, and Google verifications…
          </div>
        ) : !isSelectedCountyIngested ? (
          <div className="p-16 text-center text-sm text-slate-400 space-y-2">
            <div className="text-amber-400 font-bold font-mono">
              {countyFilter} County has not been ingested yet.
            </div>
            <div className="text-xs text-slate-500 max-w-md mx-auto">
              Data collection is currently active for {coverage.map((c) => c.county).join(", ")}. When {countyFilter} is ingested, records will appear here automatically.
            </div>
          </div>
        ) : targets.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-400 space-y-2">
            <div>No commercial targets match the active filter criteria.</div>
            <div className="text-xs text-slate-500">
              Try clearing active filters or selecting &quot;All Florida Counties&quot;.
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
                    {/* Record Type Pill */}
                    <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-500/20 uppercase">
                      {target.recordType}
                    </span>

                    {/* Channel */}
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wide border border-cyan-500/20">
                      {target.channel.replace(/_/g, " ")}
                    </span>

                    {/* Location */}
                    <span className="text-xs text-slate-400 font-mono">
                      {target.county} County • {target.city} {target.zip ? `(ZIP: ${target.zip})` : ""} {target.parcelId ? `(APN: ${target.parcelId})` : ""}
                    </span>

                    {/* Fit Score (Visible for all, dynamically tuned if client selected) */}
                    <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                      Fit: {target.fitScore}/100
                    </span>

                    {/* Sunbiz / Entity Status */}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                        target.entityStatus === "Active"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      Entity: {target.entityStatus} {target.sunbizDocNumber ? `(${target.sunbizDocNumber})` : ""}
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
                      {target.tonnageRisk} {target.buildingSqft ? `(${target.buildingSqft.toLocaleString()} sqft)` : ""}
                    </span>

                    {/* Client Territory Alignment (Overlay) */}
                    {selectedClient && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-mono border ${
                          target.inClientTerritory
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {target.inClientTerritory ? "In Client Territory" : "Outside Territory"}
                      </span>
                    )}

                    {/* Existing Account Badge (Overlay) */}
                    {target.isClientAccount && (
                      <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                        Existing Client Account
                      </span>
                    )}

                    {/* Client Scope Warning Screen (No emojis!) */}
                    {target.scopeWarning && (
                      <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300 flex items-center gap-1">
                        <ShieldCheckIcon className="h-3 w-3 text-rose-300" />
                        {target.scopeWarning}
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

                  {/* License Info (if licensee or network) */}
                  {target.licenseType && (
                    <div className="text-xs text-slate-400 font-mono">
                      License: {target.licenseType} {target.licenseNumber ? `(#${target.licenseNumber})` : ""}
                    </div>
                  )}

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

                {/* Actions Column */}
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/30 transition-all w-full sm:w-auto disabled:opacity-50"
                  >
                    <RefreshIcon className={`h-3.5 w-3.5 ${verifyingTargetId === target.targetId ? "animate-spin" : ""}`} />
                    {verifyingTargetId === target.targetId ? "Verifying..." : "Verify Search Signal"}
                  </button>

                  {/* Pipeline Action */}
                  <button
                    onClick={() => pushToPipeline(target)}
                    disabled={target.inPipeline}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all w-full sm:w-auto border ${
                      target.inPipeline
                        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400 cursor-default"
                        : "border-indigo-500/40 bg-indigo-600/30 text-white hover:bg-indigo-600/50"
                    }`}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    {target.inPipeline ? `In Pipeline (${target.pipelineStage || "Active"})` : "Add to Client Pipeline"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="border-t border-white/10 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-mono">
              Page {page} of {totalPages} ({total} Total Records)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`h-8 w-8 rounded-lg font-mono font-semibold transition-colors ${
                        page === pNum
                          ? "bg-cyan-500 text-black"
                          : "border border-white/10 bg-black/40 text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span className="text-slate-500 px-1">…</span>}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
