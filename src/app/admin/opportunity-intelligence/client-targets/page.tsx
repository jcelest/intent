"use client";

import { useCallback, useEffect, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JSZip from "jszip";
import type { UnifiedClientTargetRow } from "@/lib/client-outreach-engine";
import type { ClientRegistrationRecord } from "@/lib/permits-and-registrations";
import { FLORIDA_COUNTIES } from "@/lib/florida-geo";
import {
  SearchIcon,
  RefreshIcon,
  DownloadIcon,
  CheckIcon,
  PhoneIcon,
  BuildingIcon,
  GoogleIcon,
  ExternalLinkIcon,
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

interface SavedView {
  id: string;
  name: string;
  overlay_client_id: string | null;
  filters: Record<string, string>;
  created_at: string;
}

interface ViewStats {
  totalInView: number;
  verifiedCallableCount: number;
  withPhonePercent: number;
  newPermits30dCount: number;
  inPipelineCount: number;
}

function ClientTerritoryTargetsTerminalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Mode: "call_list" (default) or "browse_all"
  const [mode, setMode] = useState<"call_list" | "browse_all">("call_list");
  const [callListLimit, setCallListLimit] = useState<number>(25);
  const [hasMoreCallList, setHasMoreCallList] = useState<boolean>(false);

  // Client Overlay (Optional Lens - Never Reduces Dataset)
  const [clients, setClients] = useState<RegisteredClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [hideExistingAccounts, setHideExistingAccounts] = useState<boolean>(false);
  const [portfolioScreen, setPortfolioScreen] = useState<"all" | "100_plus" | "200_plus">("all");

  // Saved Views State
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [newViewName, setNewViewName] = useState<string>("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState<boolean>(false);

  // Filter State (Combine via AND)
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [zipFilter, setZipFilter] = useState<string>("");
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

  // Pagination for "browse_all" mode
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Data & Dynamic View Stats
  const [targets, setTargets] = useState<UnifiedClientTargetRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<ViewStats>({
    totalInView: 0,
    verifiedCallableCount: 0,
    withPhonePercent: 0,
    newPermits30dCount: 0,
    inPipelineCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [verifyingTargetId, setVerifyingTargetId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<ClientRegistrationRecord[]>([]);
  const [showRegistrations, setShowRegistrations] = useState<boolean>(false);
  const [exportingSlices, setExportingSlices] = useState<boolean>(false);

  // Load Saved Views
  const loadSavedViews = useCallback(async () => {
    try {
      const res = await fetch("/api/opportunity-intelligence/saved-views");
      const data = await res.json();
      if (data.ok && Array.isArray(data.views)) {
        setSavedViews(data.views);
      }
    } catch (err) {
      console.error("Failed loading saved views:", err);
    }
  }, []);

  useEffect(() => {
    loadSavedViews();
  }, [loadSavedViews]);

  // Sync initial query params on load
  useEffect(() => {
    const qCounty = searchParams.get("county");
    const qCity = searchParams.get("city");
    const qZip = searchParams.get("zip");
    const qChannel = searchParams.get("channel");
    const qTonnage = searchParams.get("tonnageRisk");
    const qVerif = searchParams.get("verificationStatus");
    const qWeb = searchParams.get("hasWebsite");
    const qReviews = searchParams.get("minReviews");
    const qEntity = searchParams.get("entityStatus");
    const qLicense = searchParams.get("licenseType");
    const qPermitDays = searchParams.get("permitWithinDays");
    const qSearch = searchParams.get("search");
    const qClient = searchParams.get("clientId");

    if (qCounty) setCountyFilter(qCounty);
    if (qCity) setCityFilter(qCity);
    if (qZip) setZipFilter(qZip);
    if (qChannel) setChannelFilter(qChannel);
    if (qTonnage) setTonnageRiskFilter(qTonnage);
    if (qVerif) setVerificationFilter(qVerif);
    if (qWeb) setHasWebsiteFilter(qWeb);
    if (qReviews) setMinReviewsFilter(qReviews);
    if (qEntity) setEntityStatusFilter(qEntity);
    if (qLicense) setLicenseTypeFilter(qLicense);
    if (qPermitDays) setPermitWithinDaysFilter(qPermitDays);
    if (qSearch) setSearchQuery(qSearch);
    if (qClient) setSelectedClientId(qClient);
  }, [searchParams]);

  // Main Data Fetch
  const loadTargets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (mode === "call_list") {
        params.set("limit", String(callListLimit));
      } else {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }

      if (selectedClientId && selectedClientId !== "all") params.set("clientId", selectedClientId);
      if (countyFilter !== "all") params.set("county", countyFilter);
      if (cityFilter.trim()) params.set("city", cityFilter.trim());
      if (zipFilter.trim()) params.set("zip", zipFilter.trim());
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
      if (portfolioScreen !== "all") params.set("portfolioScreen", portfolioScreen);

      const res = await fetch(`/api/opportunity-intelligence/client-targets?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTargets(data.targets || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setHasMoreCallList(Boolean(data.hasMore));
        if (data.registeredClients) setClients(data.registeredClients);
        if (data.clientRegistrations) setRegistrations(data.clientRegistrations);
        if (data.stats) {
          setStats({
            totalInView: data.stats.totalInView ?? data.stats.totalInTerritory ?? 0,
            verifiedCallableCount: data.stats.verifiedCallableCount ?? 0,
            withPhonePercent: data.stats.withPhonePercent ?? 0,
            newPermits30dCount: data.stats.newPermits30dCount ?? 0,
            inPipelineCount: data.stats.inPipelineCount ?? 0,
          });
        }
      }
    } catch (err) {
      console.error("Failed loading targets:", err);
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    callListLimit,
    page,
    pageSize,
    selectedClientId,
    countyFilter,
    cityFilter,
    zipFilter,
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
    portfolioScreen,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTargets();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadTargets]);

  // Sync to URL Query String
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedClientId && selectedClientId !== "all") params.set("clientId", selectedClientId);
    if (countyFilter !== "all") params.set("county", countyFilter);
    if (cityFilter.trim()) params.set("city", cityFilter.trim());
    if (zipFilter.trim()) params.set("zip", zipFilter.trim());
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (tonnageRiskFilter !== "all") params.set("tonnageRisk", tonnageRiskFilter);
    if (verificationFilter !== "all") params.set("verificationStatus", verificationFilter);
    if (hasWebsiteFilter !== "all") params.set("hasWebsite", hasWebsiteFilter);
    if (minReviewsFilter) params.set("minReviews", minReviewsFilter);
    if (entityStatusFilter !== "all") params.set("entityStatus", entityStatusFilter);
    if (licenseTypeFilter !== "all") params.set("licenseType", licenseTypeFilter);
    if (permitWithinDaysFilter !== "all") params.set("permitWithinDays", permitWithinDaysFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    const paramStr = params.toString();
    startTransition(() => {
      router.replace(`/admin/opportunity-intelligence/client-targets${paramStr ? `?${paramStr}` : ""}`, {
        scroll: false,
      });
    });
  }, [
    selectedClientId,
    countyFilter,
    cityFilter,
    zipFilter,
    channelFilter,
    tonnageRiskFilter,
    verificationFilter,
    hasWebsiteFilter,
    minReviewsFilter,
    entityStatusFilter,
    licenseTypeFilter,
    permitWithinDaysFilter,
    searchQuery,
    router,
  ]);

  // Quick Action Handlers (in-place row updates, NO page reload)
  const handleMarkContacted = async (target: UnifiedClientTargetRow) => {
    try {
      const res = await fetch("/api/opportunity-intelligence/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "contacted",
          targetId: target.targetId,
          businessName: target.name,
          notes: "Marked contacted via Terminal Call List",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTargets((prev) =>
          prev.map((t) => (t.targetId === target.targetId ? { ...t, outreachStatus: "CONTACTED" } : t))
        );
        setActionNotice(`[CONTACTED] ${target.name} recorded.`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed marking contacted:", err);
    }
  };

  const handlePushToPipeline = async (target: UnifiedClientTargetRow) => {
    try {
      const selectedClient = clients.find((c) => c.id === selectedClientId);
      const res = await fetch("/api/opportunity-intelligence/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pipeline",
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
        setTargets((prev) =>
          prev.map((t) =>
            t.targetId === target.targetId
              ? { ...t, inPipeline: true, pipelineStage: "identified" }
              : t
          )
        );
        setStats((prev) => ({ ...prev, inPipelineCount: prev.inPipelineCount + 1 }));
        setActionNotice(`[PIPELINE] Added "${target.name}" to active pipeline.`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed adding to pipeline:", err);
    }
  };

  const handleExcludeRow = async (target: UnifiedClientTargetRow) => {
    try {
      const activeClientId = selectedClientId !== "all" ? selectedClientId : "GLOBAL";
      const res = await fetch("/api/opportunity-intelligence/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exclude",
          clientId: activeClientId,
          accountName: target.name,
          reason: "Manual exclusion via Terminal Call List",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTargets((prev) =>
          prev.map((t) => (t.targetId === target.targetId ? { ...t, isClientAccount: true } : t))
        );
        setActionNotice(
          `[EXCLUDED] ${target.name} written to exclusions (${
            activeClientId === "GLOBAL" ? "GLOBAL" : "Client scope"
          }).`
        );
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed excluding record:", err);
    }
  };

  // Re-verify search provider signal
  const triggerSearchVerification = async (target: UnifiedClientTargetRow) => {
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
          forceRefresh: true,
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
                }
              : t
          )
        );
        setActionNotice(`[VERIFIED] Google search activity updated for ${target.name}.`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifyingTargetId(null);
    }
  };

  // Saved Views Handlers
  const handleApplySavedView = (view: SavedView) => {
    setActiveSavedViewId(view.id);
    if (view.overlay_client_id) {
      setSelectedClientId(view.overlay_client_id);
    } else {
      setSelectedClientId("all");
    }
    const f = view.filters || {};
    setCountyFilter(f.county || "all");
    setCityFilter(f.city || "");
    setZipFilter(f.zip || "");
    setChannelFilter(f.channel || "all");
    setTonnageRiskFilter(f.tonnageRisk || "all");
    setVerificationFilter(f.verificationStatus || "all");
    setHasWebsiteFilter(f.hasWebsite || "all");
    setMinReviewsFilter(f.minReviews || "");
    setEntityStatusFilter(f.entityStatus || "all");
    setLicenseTypeFilter(f.licenseType || "all");
    setPermitWithinDaysFilter(f.permitWithinDays || "all");
    setSearchQuery(f.search || "");
    setAdvancedFiltersOpen(false); // Collapsed when saved view active
    setCallListLimit(25);
    setPortfolioScreen("all");
    setPage(1);
  };

  const handleSaveCurrentView = async () => {
    if (!newViewName.trim()) return;
    try {
      const filtersToSave: Record<string, string> = {};
      if (countyFilter !== "all") filtersToSave.county = countyFilter;
      if (cityFilter.trim()) filtersToSave.city = cityFilter.trim();
      if (zipFilter.trim()) filtersToSave.zip = zipFilter.trim();
      if (channelFilter !== "all") filtersToSave.channel = channelFilter;
      if (tonnageRiskFilter !== "all") filtersToSave.tonnageRisk = tonnageRiskFilter;
      if (verificationFilter !== "all") filtersToSave.verificationStatus = verificationFilter;
      if (hasWebsiteFilter !== "all") filtersToSave.hasWebsite = hasWebsiteFilter;
      if (minReviewsFilter) filtersToSave.minReviews = minReviewsFilter;
      if (entityStatusFilter !== "all") filtersToSave.entityStatus = entityStatusFilter;
      if (licenseTypeFilter !== "all") filtersToSave.licenseType = licenseTypeFilter;
      if (permitWithinDaysFilter !== "all") filtersToSave.permitWithinDays = permitWithinDaysFilter;
      if (searchQuery.trim()) filtersToSave.search = searchQuery.trim();

      const res = await fetch("/api/opportunity-intelligence/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newViewName.trim(),
          overlayClientId: selectedClientId !== "all" ? selectedClientId : null,
          filters: filtersToSave,
        }),
      });
      const data = await res.json();
      if (data.ok && data.view) {
        setSavedViews((prev) => [data.view, ...prev]);
        setActiveSavedViewId(data.view.id);
        setShowSaveModal(false);
        setNewViewName("");
        setActionNotice(`[SAVED VIEW] "${data.view.name}" saved.`);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Failed saving view:", err);
    }
  };

  const handleDeleteSavedView = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/opportunity-intelligence/saved-views?id=${id}`, { method: "DELETE" });
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      if (activeSavedViewId === id) setActiveSavedViewId(null);
    } catch (err) {
      console.error("Failed deleting saved view:", err);
    }
  };

  const handleResetFilters = () => {
    setActiveSavedViewId(null);
    setCountyFilter("all");
    setCityFilter("");
    setZipFilter("");
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
    setCallListLimit(25);
    setPage(1);
  };

  // Full CSV Export
  const exportFullCSV = () => {
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

  // Export Call Slices: Ranked Call List zipped into 30-record CSVs
  const exportCallSlices = async () => {
    try {
      setExportingSlices(true);
      const zip = new JSZip();
      const sliceSize = 30;
      const headers = [
        "Business Name",
        "Phone",
        "City",
        "County",
        "Channel",
        "Fit Score",
        "Reviews",
        "Website",
        "Permit Signal",
        "Verification Status",
      ];

      for (let i = 0; i < targets.length; i += sliceSize) {
        const sliceChunk = targets.slice(i, i + sliceSize);
        const sliceNum = Math.floor(i / sliceSize) + 1;
        const slicePad = String(sliceNum).padStart(2, "0");
        const rows = sliceChunk.map((t) => [
          `"${t.name.replace(/"/g, '""')}"`,
          `"${t.verifiedPhone || ""}"`,
          `"${t.city}"`,
          `"${t.county}"`,
          `"${t.channel}"`,
          `"${t.fitScore}"`,
          `"${t.reviewCount || 0}"`,
          `"${t.hasWebsite ? "Y" : "N"}"`,
          `"${t.lastMechanicalPermitDate || "NONE"}"`,
          `"${t.verificationStatus}"`,
        ]);
        const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
        zip.file(`slice-${slicePad}.csv`, csvText);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `call-slices-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setActionNotice(`[EXPORT] Created zipped call slices (${Math.ceil(targets.length / sliceSize)} slices).`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error("Export slices failed:", err);
    } finally {
      setExportingSlices(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-3 font-mono text-[13px] text-[#E0E0E0]">
      {/* 1. Header Bar with Mode Toggle & Exports */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#FFB000]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#FFB000] font-bold">
                [CALL LIST MODE]
              </span>
              <span className="text-[11px] text-[#888888]">
                {total.toLocaleString()} ELIGIBLE TARGETS
              </span>
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              TARGETS CALL QUEUE // WHO DO I CALL TODAY
            </h2>
          </div>
        </div>

        {/* View Mode Toggle & Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-[2px] border border-[#262626] bg-[#0A0A0A] p-0.5 text-xs">
            <button
              onClick={() => {
                setMode("call_list");
                setCallListLimit(25);
              }}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                mode === "call_list"
                  ? "bg-[#FFB000] text-black font-bold"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              Next 25 To Work
            </button>
            <button
              onClick={() => setMode("browse_all")}
              className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                mode === "browse_all"
                  ? "bg-[#FFB000] text-black font-bold"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              Browse All
            </button>
          </div>

          {selectedClient && (
            <button
              onClick={() => setShowRegistrations(!showRegistrations)}
              className="inline-flex items-center gap-1 rounded-[2px] border border-[#262626] bg-[#161616] px-2.5 py-1 text-xs text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000]"
            >
              <BuildingIcon className="h-3 w-3 text-[#FFB000]" />
              <span>
                Vendor Portals ({registrations.filter((r) => r.status === "REGISTERED").length}/
                {registrations.length})
              </span>
            </button>
          )}

          <button
            onClick={exportCallSlices}
            disabled={exportingSlices || targets.length === 0}
            className="inline-flex items-center gap-1 rounded-[2px] border border-[#FFB000] bg-[#FFB000]/10 px-2.5 py-1 text-xs text-[#FFB000] hover:bg-[#FFB000] hover:text-black transition-colors disabled:opacity-40"
            title="Download ranked 30-record call slice CSVs inside a zip"
          >
            <DownloadIcon className="h-3 w-3" />
            <span>{exportingSlices ? "Zipping..." : "Export Call Slices (.zip)"}</span>
          </button>

          <button
            onClick={exportFullCSV}
            disabled={targets.length === 0}
            className="inline-flex items-center gap-1 rounded-[2px] border border-[#262626] bg-[#161616] px-2.5 py-1 text-xs text-[#CCCCCC] hover:text-white transition-colors disabled:opacity-40"
          >
            <DownloadIcon className="h-3 w-3" />
            <span>Full CSV ({total})</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-[2px] border border-[#FFB000]/50 bg-[#161309] px-3.5 py-1.5 text-xs text-[#FFB000] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-[#888888] hover:text-white">
            [DISMISS]
          </button>
        </div>
      )}

      {/* 2. Stats Row: Recomputed for Current Active View Only */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-[2px] border border-[#262626] bg-[#111111] px-3 py-2">
          <div className="text-[10px] uppercase text-[#888888]">VERIFIED &amp; CALLABLE</div>
          <div className="text-xl font-bold text-[#FFB000] mt-0.5">
            {stats.verifiedCallableCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#666666]">Google verified active + phone</div>
        </div>

        <div className="rounded-[2px] border border-[#262626] bg-[#111111] px-3 py-2">
          <div className="text-[10px] uppercase text-[#888888]">WITH PHONE</div>
          <div className="text-xl font-bold text-white mt-0.5">{stats.withPhonePercent}%</div>
          <div className="text-[10px] text-[#666666]">Phone available on record</div>
        </div>

        <div className="rounded-[2px] border border-[#262626] bg-[#111111] px-3 py-2">
          <div className="text-[10px] uppercase text-[#888888]">NEW PERMITS 30D</div>
          <div className="text-xl font-bold text-white mt-0.5">{stats.newPermits30dCount.toLocaleString()}</div>
          <div className="text-[10px] text-[#666666]">Mechanical permits in view</div>
        </div>

        <div className="rounded-[2px] border border-[#262626] bg-[#111111] px-3 py-2">
          <div className="text-[10px] uppercase text-[#888888]">IN PIPELINE</div>
          <div className="text-xl font-bold text-white mt-0.5">{stats.inPipelineCount.toLocaleString()}</div>
          <div className="text-[10px] text-[#666666]">Active outreach underway</div>
        </div>
      </div>

      {/* 3. Saved Views Bar & Client Overlay Selector */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] p-3 space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Saved Views 1-Click Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase text-[#888888] mr-1">Saved Views:</span>

            <button
              onClick={handleResetFilters}
              className={`px-2 py-1 text-xs rounded-[2px] border transition-colors ${
                !activeSavedViewId && selectedClientId === "all"
                  ? "border-[#FFB000] text-[#FFB000] bg-[#1A180E] font-bold"
                  : "border-[#262626] bg-[#161616] text-[#888888] hover:text-white"
              }`}
            >
              All Florida (Default)
            </button>

            {savedViews.map((sv) => (
              <div key={sv.id} className="inline-flex items-center">
                <button
                  onClick={() => handleApplySavedView(sv)}
                  className={`px-2 py-1 text-xs rounded-l-[2px] border transition-colors ${
                    activeSavedViewId === sv.id
                      ? "border-[#FFB000] text-[#FFB000] bg-[#1A180E] font-bold"
                      : "border-[#262626] bg-[#161616] text-[#CCCCCC] hover:text-white"
                  }`}
                >
                  {sv.name}
                </button>
                <button
                  onClick={(e) => handleDeleteSavedView(sv.id, e)}
                  className="px-1 py-1 text-xs rounded-r-[2px] border-y border-r border-[#262626] bg-[#161616] text-[#666666] hover:text-[#FFB000]"
                  title="Delete view"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={() => setShowSaveModal(true)}
              className="px-2 py-1 text-xs rounded-[2px] border border-dashed border-[#444444] bg-[#0A0A0A] text-[#888888] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors"
            >
              + Save Current View
            </button>
          </div>

          {/* Client Overlay Selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase text-[#888888] whitespace-nowrap">
              Client Overlay:
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setCallListLimit(25);
                setPage(1);
              }}
              className="rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
            >
              <option value="all">None (Statewide Unscoped)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.trades.length > 0 ? `[${c.trades.join(", ")}]` : ""}
                </option>
              ))}
            </select>

            <div className="inline-flex border border-[#262626] bg-[#0A0A0A] p-0.5 text-[10px]">
              {([['all', 'All'], ['200_plus', '200+'], ['100_plus', '100+']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setPortfolioScreen(value);
                    setCallListLimit(25);
                    setPage(1);
                  }}
                  className={`px-2 py-1 ${portfolioScreen === value ? 'bg-[#FFB000] font-bold text-black' : 'text-[#777777] hover:text-white'}`}
                  title={value === 'all' ? 'No portfolio screen' : `Prioritize firms with a verified portfolio floor of ${label} inside the selected client service area`}
                >
                  {label}
                </button>
              ))}
            </div>

            {selectedClient && (
              <label className="inline-flex items-center gap-1.5 text-xs text-[#888888] ml-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideExistingAccounts}
                  onChange={(e) => {
                    setHideExistingAccounts(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded-[2px] border-[#333333] bg-[#0A0A0A] text-[#FFB000] focus:ring-0"
                />
                <span className="text-[11px]">Hide Owned Accounts</span>
              </label>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Bar */}
        <div className="border-t border-[#262626] pt-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
              className="inline-flex items-center gap-1.5 text-xs text-[#FFB000] hover:underline"
            >
              <span>{advancedFiltersOpen ? "[-] HIDE ADVANCED FILTERS" : "[+] ADVANCED FILTERS"}</span>
              <span className="text-[10px] text-[#666666]">
                (Combine via AND • Showing {total.toLocaleString()} records)
              </span>
            </button>
            <button onClick={handleResetFilters} className="text-[11px] text-[#888888] hover:text-white underline">
              Reset Filters
            </button>
          </div>

          {advancedFiltersOpen && (
            <div className="pt-3 space-y-3">
              {/* Row 1: Geography & Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">County</label>
                  <select
                    value={countyFilter}
                    onChange={(e) => {
                      setCountyFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setCallListLimit(25);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All Florida Counties</option>
                    {FLORIDA_COUNTIES.map((c) => (
                      <option key={c.fips} value={c.name}>
                        {c.name} County
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">City</label>
                  <input
                    type="text"
                    value={cityFilter}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    placeholder="e.g. Orlando, Pensacola..."
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={zipFilter}
                    onChange={(e) => {
                      setZipFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    placeholder="e.g. 32801..."
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] uppercase text-[#888888]">Search Name/Address</label>
                    {searchQuery.trim() && (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`"${searchQuery.trim()}" Florida`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#FFB000] hover:underline inline-flex items-center gap-1 font-mono"
                        title={`Search "${searchQuery}" on Google`}
                      >
                        <GoogleIcon className="h-2.5 w-2.5" />
                        Google Search ↗
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setActiveSavedViewId(null);
                        setPage(1);
                      }}
                      placeholder="Name, address, contractor..."
                      className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] pl-7 pr-2 py-1 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                    />
                    <SearchIcon className="h-3.5 w-3.5 text-[#555555] absolute left-2 top-1.5" />
                  </div>
                </div>
              </div>

              {/* Row 2: Channel, Size, Verification & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Channel</label>
                  <select
                    value={channelFilter}
                    onChange={(e) => {
                      setChannelFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All Channels</option>
                    <option value="office">Office / Professional</option>
                    <option value="retail">Retail / Commercial</option>
                    <option value="medical_clinic">Medical / Clinic</option>
                    <option value="school">School / Educational</option>
                    <option value="warehouse_industrial">Warehouse &amp; Logistics</option>
                    <option value="municipal">Municipal / Govt</option>
                    <option value="association_cam">Association / CAM</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="other">Other Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Tonnage Risk (Screening)</label>
                  <select
                    value={tonnageRiskFilter}
                    onChange={(e) => {
                      setTonnageRiskFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All Size Bands</option>
                    <option value="UNDER_10T_LIKELY">UNDER_10T_LIKELY (&lt;15k sq ft)</option>
                    <option value="OVER_10T_POSSIBLE">OVER_10T_POSSIBLE (15k-100k sq ft)</option>
                    <option value="CHILLER_LIKELY">CHILLER_LIKELY (100k+ sq ft)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Verification Status</label>
                  <select
                    value={verificationFilter}
                    onChange={(e) => {
                      setVerificationFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="VERIFIED_ACTIVE">VERIFIED_ACTIVE</option>
                    <option value="LIKELY_ACTIVE">LIKELY_ACTIVE</option>
                    <option value="AMBIGUOUS">AMBIGUOUS</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Website Available</label>
                  <select
                    value={hasWebsiteFilter}
                    onChange={(e) => {
                      setHasWebsiteFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All</option>
                    <option value="true">Has Official Website</option>
                    <option value="false">No Website</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Entity, License, Permit Signal & Reviews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Entity Status</label>
                  <select
                    value={entityStatusFilter}
                    onChange={(e) => {
                      setEntityStatusFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">All Entity States</option>
                    <option value="Active">Active (Sunbiz)</option>
                    <option value="Inactive">Inactive</option>
                    <option value="UNMATCHED">UNMATCHED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">License Type</label>
                  <select
                    value={licenseTypeFilter}
                    onChange={(e) => {
                      setLicenseTypeFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
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
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Permit Signal</label>
                  <select
                    value={permitWithinDaysFilter}
                    onChange={(e) => {
                      setPermitWithinDaysFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="all">Any Permit History</option>
                    <option value="90">Mechanical Permit &le; 90 Days</option>
                    <option value="180">Mechanical Permit &le; 180 Days</option>
                    <option value="365">Mechanical Permit &le; 365 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">Minimum Reviews</label>
                  <select
                    value={minReviewsFilter}
                    onChange={(e) => {
                      setMinReviewsFilter(e.target.value);
                      setActiveSavedViewId(null);
                      setPage(1);
                    }}
                    className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
                  >
                    <option value="">Any Reviews</option>
                    <option value="5">5+ Reviews</option>
                    <option value="10">10+ Reviews</option>
                    <option value="25">25+ Reviews</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer 5 Vendor Registrations Drawer */}
      {showRegistrations && selectedClient && (
        <div className="rounded-[2px] border border-[#262626] bg-[#111111] p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
            <span className="font-bold text-[#FFB000] uppercase">
              [VENDOR PORTAL REGISTRATIONS: {selectedClient.name}]
            </span>
            <span className="text-[#888888]">
              {registrations.filter((r) => r.status === "REGISTERED").length} of {registrations.length} Active
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {registrations.map((reg) => (
              <div key={reg.portal_name} className="p-2 border border-[#262626] bg-[#0E0E0E] rounded-[2px]">
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">{reg.portal_name}</span>
                  <span
                    className={`text-[10px] font-bold ${
                      reg.status === "REGISTERED" ? "text-[#FFB000]" : "text-[#888888]"
                    }`}
                  >
                    [{reg.status}]
                  </span>
                </div>
                <div className="text-[10px] text-[#666666]">{reg.portal_type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Dense Operations Table (Sticky Header & Sticky First 2 Columns) */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-xs border-collapse">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-20 bg-[#0E0E0E] border-b border-[#262626] text-[11px] text-[#888888] uppercase tracking-wider">
              <tr>
                {/* Column 1: Business Name (Sticky) */}
                <th className="py-2 px-2.5 font-semibold sticky left-0 z-30 bg-[#0E0E0E] min-w-[230px] border-r border-[#222222]">
                  Business Name
                </th>
                {/* Column 2: Phone (Sticky) */}
                <th className="py-2 px-2.5 font-semibold sticky left-[230px] z-30 bg-[#0E0E0E] min-w-[120px] border-r border-[#222222]">
                  Phone
                </th>
                {/* Column 3: City */}
                <th className="py-2 px-2 font-semibold min-w-[100px]">City</th>
                {/* Column 4: County */}
                <th className="py-2 px-2 font-semibold min-w-[90px]">County</th>
                {/* Column 5: Channel */}
                <th className="py-2 px-2 font-semibold min-w-[110px]">Channel</th>
                {/* Column 6: Fit Score */}
                <th className="py-2 px-2 font-semibold min-w-[70px]">Fit</th>
                <th className="py-2 px-2 font-semibold min-w-[150px]">Portfolio</th>
                {/* Column 7: Reviews */}
                <th className="py-2 px-2 font-semibold min-w-[70px]">Reviews</th>
                {/* Column 8: Website (Y/N) */}
                <th className="py-2 px-2 font-semibold min-w-[65px]">Web</th>
                {/* Column 9: Permit Signal */}
                <th className="py-2 px-2 font-semibold min-w-[110px]">Permit Signal</th>
                {/* Column 10: Verification Tag */}
                <th className="py-2 px-2 font-semibold min-w-[110px]">Verification</th>
                {/* Column 11: Quick Actions */}
                <th className="py-2 px-2.5 font-semibold text-right min-w-[210px]">Quick Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1D1D1D]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-[#666666]">
                    <RefreshIcon className="h-5 w-5 animate-spin mx-auto mb-2 text-[#FFB000]" />
                    Loading ranked Call List records from Florida database...
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-[#666666]">
                    No commercial outreach targets match the active filter criteria.
                  </td>
                </tr>
              ) : (
                targets.map((target) => {
                  const isVerified = target.verificationStatus === "VERIFIED_ACTIVE";
                  const fitHigh = target.fitScore >= 80;

                  return (
                    <tr
                      key={target.targetId}
                      className={`hover:bg-[#181818] transition-colors ${
                        isVerified ? "border-l-2 border-l-[#FFB000]" : "opacity-75 hover:opacity-100"
                      } ${portfolioScreen !== "all" && !target.portfolioScreenMatch ? "opacity-35" : ""}`}
                      style={{ height: "34px" }}
                    >
                      {/* 1. Business Name & Google Search Option (Sticky Col 1) */}
                      <td className="py-1.5 px-2.5 font-bold text-white whitespace-nowrap sticky left-0 z-10 bg-[#111111] min-w-[230px] border-r border-[#1F1F1F]">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate max-w-[135px]" title={target.name}>
                              {target.name}
                            </span>
                            {target.scopeWarning && (
                              <span
                                className="text-[10px] text-[#FF5555] font-bold shrink-0"
                                title={target.scopeWarning}
                              >
                                [{target.scopeWarning.includes("10T") ? "<10T" : "CHILLER?"}]
                              </span>
                            )}
                            {target.isClientAccount && (
                              <span className="text-[10px] text-[#FFB000] shrink-0">[OWNED]</span>
                            )}
                          </div>

                          {/* Google Search Live Option */}
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(`"${target.name}" ${target.city} FL`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] border border-[#2E2E2E] bg-[#161616] text-[10px] font-mono text-[#888888] hover:text-[#FFB000] hover:border-[#FFB000]/60 hover:bg-[#FFB000]/10 transition-colors shrink-0"
                            title={`Search "${target.name}" on Google (${target.city}, FL)`}
                          >
                            <GoogleIcon className="h-2.5 w-2.5 text-[#888888]" />
                            <span>Google</span>
                            <ExternalLinkIcon className="h-2 w-2 text-[#666666]" />
                          </a>
                        </div>
                      </td>

                      {/* 2. Phone (Sticky Col 2) */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap sticky left-[230px] z-10 bg-[#111111] border-r border-[#1F1F1F]">
                        {target.verifiedPhone ? (
                          <a
                            href={`tel:${target.verifiedPhone}`}
                            className="text-[#FFB000] hover:underline inline-flex items-center gap-1"
                          >
                            <PhoneIcon className="h-3 w-3" />
                            <span>{target.verifiedPhone}</span>
                          </a>
                        ) : (
                          <span className="text-[#555555]">[NO PHONE]</span>
                        )}
                      </td>

                      {/* 3. City */}
                      <td className="py-1.5 px-2 text-[#CCCCCC] whitespace-nowrap">{target.city}</td>

                      {/* 4. County */}
                      <td className="py-1.5 px-2 text-[#888888] whitespace-nowrap">{target.county}</td>

                      {/* 5. Channel */}
                      <td className="py-1.5 px-2 text-[#CCCCCC] whitespace-nowrap">
                        <span className="uppercase text-[11px]">{target.channel.replace(/_/g, " ")}</span>
                      </td>

                      {/* 6. Fit Score (Amber if >= 80) */}
                      <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                        <span className={`font-bold ${fitHigh ? "text-[#FFB000]" : "text-[#888888]"}`}>
                          {target.fitScore}
                        </span>
                      </td>

                      <td className="py-1.5 px-2 whitespace-nowrap">
                        {target.portfolioTier && target.portfolioTier !== "UNKNOWN" && target.portfolioRangeLow !== null && target.portfolioRangeLow !== undefined ? (
                          <a href={target.recordType === "firm" ? `/admin/opportunity-intelligence/management-firms?firmId=${target.targetId.replace("firm_", "")}` : undefined} className="inline-block border border-[#FFB000]/30 bg-[#FFB000]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#FFB000]">
                            {target.portfolioTier === "OVER_300" ? "300+" : target.portfolioTier === "FROM_100_TO_300" ? "100 to 300" : "Under 100"}
                            {target.portfolioRangeHigh ? ` · est. ${target.portfolioRangeLow} to ${target.portfolioRangeHigh}` : ` · at least ${target.portfolioRangeLow}`}
                          </a>
                        ) : (
                          <span className="font-mono text-[10px] text-[#555555]">No data</span>
                        )}
                      </td>

                      {/* 7. Reviews */}
                      <td className="py-1.5 px-2 text-[#888888] whitespace-nowrap font-mono">
                        {target.reviewCount && target.reviewCount > 0 ? (
                          <span>
                            {target.rating ? `${target.rating}★ ` : ""}
                            {target.reviewCount}
                          </span>
                        ) : (
                          <span className="text-[#444444]">No data</span>
                        )}
                      </td>

                      {/* 8. Website (Y/N Text Tag) */}
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        {target.hasWebsite && target.officialWebsiteUrl ? (
                          <a
                            href={target.officialWebsiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FFB000] hover:underline"
                            title={target.officialWebsiteUrl}
                          >
                            [Y]
                          </a>
                        ) : (
                          <span className="text-[#555555]">[N]</span>
                        )}
                      </td>

                      {/* 9. Permit Signal */}
                      <td className="py-1.5 px-2 whitespace-nowrap font-mono">
                        {target.lastMechanicalPermitDate ? (
                          <span className="text-white" title={target.incumbentContractor || undefined}>
                            {target.lastMechanicalPermitDate}
                          </span>
                        ) : (
                          <span className="text-[#555555]">NONE</span>
                        )}
                      </td>

                      {/* 10. Verification Tag */}
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-1 py-0.5 text-[10px] font-bold rounded-[2px] ${
                            target.verificationStatus === "VERIFIED_ACTIVE"
                              ? "text-[#FFB000] border border-[#FFB000]/40 bg-[#FFB000]/10"
                              : target.verificationStatus === "AMBIGUOUS"
                              ? "text-[#CCCCCC] border border-[#444444] bg-[#161616]"
                              : "text-[#666666] border border-[#262626]"
                          }`}
                        >
                          {target.verificationStatus === "VERIFIED_ACTIVE"
                            ? "[VERIFIED]"
                            : target.verificationStatus === "AMBIGUOUS"
                            ? "[STALE]"
                            : "[UNVERIFIED]"}
                        </span>
                      </td>

                      {/* 11. Row Quick Actions: Contacted, Pipeline, Exclude */}
                      <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Contacted */}
                          <button
                            onClick={() => handleMarkContacted(target)}
                            className="px-1.5 py-0.5 text-[11px] rounded-[2px] border border-[#262626] bg-[#161616] text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors"
                            title="Mark as contacted"
                          >
                            [Contacted]
                          </button>

                          {/* Pipeline */}
                          <button
                            onClick={() => handlePushToPipeline(target)}
                            disabled={target.inPipeline}
                            className={`px-1.5 py-0.5 text-[11px] rounded-[2px] border transition-colors ${
                              target.inPipeline
                                ? "border-[#FFB000]/40 text-[#FFB000] bg-[#FFB000]/10 cursor-default"
                                : "border-[#262626] bg-[#161616] text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000]"
                            }`}
                            title="Add to active pipeline"
                          >
                            {target.inPipeline ? "[In Pipe]" : "[Pipeline]"}
                          </button>

                          {/* Exclude */}
                          <button
                            onClick={() => handleExcludeRow(target)}
                            className="px-1.5 py-0.5 text-[11px] rounded-[2px] border border-[#262626] bg-[#161616] text-[#888888] hover:border-[#FF5555] hover:text-[#FF5555] transition-colors"
                            title="Exclude from outreach target list"
                          >
                            [Exclude]
                          </button>

                          {/* Re-verify Search */}
                          <button
                            onClick={() => triggerSearchVerification(target)}
                            disabled={verifyingTargetId === target.targetId}
                            className="px-1 py-0.5 text-[11px] text-[#666666] hover:text-[#FFB000]"
                            title="Verify Google search signal"
                          >
                            <RefreshIcon
                              className={`h-3 w-3 ${
                                verifyingTargetId === target.targetId ? "animate-spin text-[#FFB000]" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination / Load More Footer */}
        <div className="border-t border-[#262626] px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="text-[#888888]">
            {mode === "call_list" ? (
              <span>
                Showing Next {Math.min(targets.length, 25)} To Work of {total.toLocaleString()} Total
              </span>
            ) : (
              <span>
                Page {page} of {totalPages} ({total.toLocaleString()} Total Records)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === "call_list" ? (
              hasMoreCallList ? (
                <button
                  onClick={() => setCallListLimit((l) => l + 50)}
                  disabled={loading}
                  className="rounded-[2px] border border-[#FFB000] bg-[#FFB000] px-3 py-1 text-xs font-bold text-black hover:bg-[#FFC033] transition-colors disabled:opacity-40"
                >
                  Load More (+50 Targets)
                </button>
              ) : (
                <span className="text-[#666666]">[END OF RANKED LIST]</span>
              )
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[#888888] mr-1">Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-1.5 py-0.5 text-xs text-white"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-[2px] border border-[#262626] bg-[#161616] px-2 py-0.5 text-xs text-[#CCCCCC] hover:text-white disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[#888888] px-1">
                  {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-[2px] border border-[#262626] bg-[#161616] px-2 py-0.5 text-xs text-[#CCCCCC] hover:text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save View Modal Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-[2px] border border-[#262626] bg-[#111111] p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-bold text-[#FFB000] uppercase">[SAVE CURRENT VIEW]</span>
              <button onClick={() => setShowSaveModal(false)} className="text-[#888888] hover:text-white">
                [X]
              </button>
            </div>
            <div>
              <label className="block text-[10px] text-[#888888] uppercase mb-1">View Name</label>
              <input
                type="text"
                autoFocus
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. Orange County HVAC Qualified"
                className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
              />
            </div>
            <div className="text-[10px] text-[#666666]">
              Saves current filters + overlay client ({selectedClientId !== "all" ? selectedClient?.name : "None"}) for 1-click access.
            </div>
            <div className="pt-2 border-t border-[#262626] flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="rounded-[2px] border border-[#262626] bg-[#161616] px-2.5 py-1 text-xs text-[#CCCCCC] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentView}
                disabled={!newViewName.trim()}
                className="rounded-[2px] border border-[#FFB000] bg-[#FFB000] px-3 py-1 text-xs font-bold text-black hover:bg-[#FFC033] disabled:opacity-40"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientTerritoryTargetsTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] p-6 text-xs text-[#FFB000] font-mono flex items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FFB000] animate-ping" />
            INITIALIZING WORK-FIRST TERMINAL...
          </div>
        </div>
      }
    >
      <ClientTerritoryTargetsTerminalContent />
    </Suspense>
  );
}
