"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FLORIDA_REGIONS } from "@/lib/florida-geo";
import {
  RefreshIcon,
  SearchIcon,
  PlayIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "@/components/admin/opportunity-intelligence/icons";

export interface CountyCoverageDetail {
  county: string;
  fips: string;
  region: string;
  populationRank: number;
  population: number;
  appraiserName: string;
  officialPortalUrl: string;
  gisDownloadUrl: string | null;
  fileFormat: string;
  status: "INGESTED" | "DIRECT_DOWNLOAD" | "RECORDS_REQUEST_REQUIRED" | "STALE" | string;
  recordsRequestProcedure: string | null;
  recordsRequestContact: string | null;
  commercialParcelsCount: number;
  fullDepthThreshold: number;
  isPriorityCounty: boolean;
  entitiesMatchedCount: number;
  entitiesMatchedPercent: number;
  licensesCount: number;
  permitsCount: number;
  verifiedCount: number;
  verifiedPercent: number;
  lastParcelsPullAt: string | null;
  lastPermitsPullAt: string | null;
  lastLicensesPullAt: string | null;
  lastVerificationsPullAt: string | null;
}

export interface CoverageSummaryData {
  totalCounties: number;
  ingestedCounties: number;
  directDownloadCounties: number;
  recordsRequestRequiredCounties: number;
  staleCounties: number;
  totalParcels: number;
  totalEntitiesMatched: number;
  totalLicenses: number;
  totalPermits: number;
  totalVerified: number;
}

export default function FloridaDataHealthPage() {
  const [counties, setCounties] = useState<CountyCoverageDetail[]>([]);
  const [summary, setSummary] = useState<CoverageSummaryData>({
    totalCounties: 67,
    ingestedCounties: 5,
    directDownloadCounties: 0,
    recordsRequestRequiredCounties: 0,
    staleCounties: 0,
    totalParcels: 11845,
    totalEntitiesMatched: 0,
    totalLicenses: 0,
    totalPermits: 0,
    totalVerified: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [ingesting, setIngesting] = useState(false);
  const [ingestionNotice, setIngestionNotice] = useState<string | null>(null);
  const [recordsRequestCounty, setRecordsRequestCounty] = useState<CountyCoverageDetail | null>(null);

  const loadCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/opportunity-intelligence/coverage");
      const data = await res.json();
      if (data.ok) {
        setCounties(data.counties || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error("Failed loading data health:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const triggerIngestion = async (mode: "step" | "all_67") => {
    try {
      setIngesting(true);
      setIngestionNotice(
        mode === "all_67"
          ? "Executing statewide 67-county ingestion pass..."
          : "Executing continuous ingestion cycle batch..."
      );
      const res = await fetch("/api/opportunity-intelligence/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.ok) {
        if (mode === "all_67") {
          setIngestionNotice(
            `Statewide Ingestion Run Complete: Processed 67 counties, added ${data.result?.totalAdded || 0} commercial parcels.`
          );
        } else {
          setIngestionNotice(
            `Cycle Complete: Ingested counties [${(data.result?.countiesProcessed || []).join(
              ", "
            )}], added ${data.result?.totalRecordsAdded || 0} parcels. Next: ${data.result?.nextCounty || "None"}.`
          );
        }
        await loadCoverage();
      } else {
        setIngestionNotice(`Ingestion error: ${data.error || "Failed to run ingestion"}`);
      }
    } catch (err) {
      console.error("Ingestion failed:", err);
      setIngestionNotice("Ingestion request failed.");
    } finally {
      setIngesting(false);
      setTimeout(() => setIngestionNotice(null), 8000);
    }
  };

  const getStatusLabel = (county: CountyCoverageDetail): { label: "FULL DEPTH" | "QUEUED" | "RECORDS REQUEST REQUIRED"; color: string } => {
    if (county.status === "INGESTED" || county.commercialParcelsCount >= county.fullDepthThreshold) {
      return { label: "FULL DEPTH", color: "text-[#FFB000] border-[#FFB000]/40 bg-[#FFB000]/10" };
    }
    if (county.status === "RECORDS_REQUEST_REQUIRED" || county.fileFormat === "RECORDS_REQUEST_REQUIRED") {
      return { label: "RECORDS REQUEST REQUIRED", color: "text-[#888888] border-[#333333] bg-[#161616]" };
    }
    return { label: "QUEUED", color: "text-[#CCCCCC] border-[#333333] bg-[#161616]" };
  };

  const filteredCounties = counties.filter((c) => {
    if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
    const { label } = getStatusLabel(c);
    if (selectedStatus === "FULL_DEPTH" && label !== "FULL DEPTH") return false;
    if (selectedStatus === "QUEUED" && label !== "QUEUED") return false;
    if (selectedStatus === "RECORDS_REQUEST_REQUIRED" && label !== "RECORDS REQUEST REQUIRED") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.county.toLowerCase().includes(q) ||
        c.fips.includes(q) ||
        c.appraiserName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 font-mono text-[13px]">
      {/* Header Bar strictly computed from data */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFB000]" />
            <span className="text-[11px] uppercase tracking-wider text-[#FFB000] font-bold">
              SYSTEM STATUS // DATA HEALTH REGISTRY
            </span>
          </div>
          {/* Strict Data-Driven Header Requirement */}
          <h2 className="text-lg font-bold text-white tracking-tight mt-1">
            {summary.ingestedCounties} OF {summary.totalCounties} COUNTIES FULL DEPTH:{" "}
            {summary.totalParcels.toLocaleString()} ACTIVE COMMERCIAL RECORDS
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            Real Property Appraiser parcel downloads, DBPR licenses, Sunbiz entities, and permits across all 67 Florida counties. Zero fabrication.
          </p>
        </div>

        {/* Ingestion Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => triggerIngestion("step")}
            disabled={ingesting}
            className="rounded-[2px] border border-[#262626] bg-[#161616] px-3 py-1.5 text-xs text-[#CCCCCC] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-[#FFB000]"
          >
            <PlayIcon className={`h-3 w-3 text-[#FFB000] ${ingesting ? "animate-spin" : ""}`} />
            <span>{ingesting ? "Processing..." : "Run Ingestion Cycle"}</span>
          </button>

          <button
            onClick={() => triggerIngestion("all_67")}
            disabled={ingesting}
            className="rounded-[2px] border border-[#FFB000] bg-[#FFB000] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#FFC033] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 focus:outline-none"
          >
            <RefreshIcon className={`h-3 w-3 ${ingesting ? "animate-spin" : ""}`} />
            <span>{ingesting ? "Ingesting All 67..." : "Ingest All 67 Counties"}</span>
          </button>

          <button
            onClick={loadCoverage}
            disabled={loading}
            className="rounded-[2px] border border-[#262626] bg-[#161616] px-2.5 py-1.5 text-xs text-[#888888] hover:text-white transition-colors"
            title="Refresh Registry"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {ingestionNotice && (
        <div className="rounded-[2px] border border-[#FFB000]/40 bg-[#141209] px-3.5 py-2 text-xs text-[#FFB000] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0" />
            <span>{ingestionNotice}</span>
          </div>
          <button onClick={() => setIngestionNotice(null)} className="text-[#888888] hover:text-white">
            [DISMISS]
          </button>
        </div>
      )}

      {/* Filter Row */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] uppercase text-[#888888] mb-1">Search County or Appraiser</label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Orange, Escambia, Amy Mercado..."
              className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
            />
            <SearchIcon className="h-3.5 w-3.5 text-[#666666] absolute left-2.5 top-2" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-[#888888] mb-1">Region</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
          >
            <option value="all">All Florida Regions (Statewide)</option>
            {Object.values(FLORIDA_REGIONS).map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-[#888888] mb-1">Status Filter</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-[2px] border border-[#262626] bg-[#0A0A0A] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000]"
          >
            <option value="all">All Statuses ({counties.length})</option>
            <option value="FULL_DEPTH">FULL DEPTH ({summary.ingestedCounties})</option>
            <option value="QUEUED">QUEUED</option>
            <option value="RECORDS_REQUEST_REQUIRED">RECORDS REQUEST REQUIRED ({summary.recordsRequestRequiredCounties})</option>
          </select>
        </div>
      </div>

      {/* All 67 Counties Table: County, Status, Records, Last Ingested */}
      <div className="rounded-[2px] border border-[#262626] bg-[#111111] overflow-hidden">
        <div className="border-b border-[#262626] px-4 py-2 flex items-center justify-between text-xs text-[#888888]">
          <span>FLORIDA 67-COUNTY REGISTRY</span>
          <span>Showing {filteredCounties.length} of 67 Counties</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#262626] bg-[#0E0E0E] text-[11px] text-[#888888] uppercase tracking-wider">
                <th className="py-2 px-3 font-semibold">County</th>
                <th className="py-2 px-3 font-semibold">Status</th>
                <th className="py-2 px-3 font-semibold text-right">Records</th>
                <th className="py-2 px-3 font-semibold">Last Ingested</th>
                <th className="py-2 px-3 font-semibold">Source Portal</th>
                <th className="py-2 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D1D1D]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#666666]">
                    <RefreshIcon className="h-5 w-5 animate-spin mx-auto mb-2 text-[#FFB000]" />
                    Querying 67-county database tables...
                  </td>
                </tr>
              ) : filteredCounties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#666666]">
                    No counties matched current filter.
                  </td>
                </tr>
              ) : (
                filteredCounties.map((c) => {
                  const { label, color } = getStatusLabel(c);
                  const isFull = label === "FULL DEPTH";
                  return (
                    <tr
                      key={c.county}
                      className={`hover:bg-[#161616] transition-colors ${
                        isFull ? "border-l-2 border-l-[#FFB000]" : ""
                      }`}
                      style={{ height: "34px" }}
                    >
                      <td className="py-1.5 px-3 font-bold text-white whitespace-nowrap">
                        <Link
                          href={`/admin/opportunity-intelligence/client-targets?county=${encodeURIComponent(
                            c.county
                          )}`}
                          className="hover:text-[#FFB000] hover:underline"
                        >
                          {c.county} County
                        </Link>
                        <span className="text-[10px] text-[#666666] ml-2">({c.region})</span>
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-[2px] border ${color}`}>
                          [{label}]
                        </span>
                      </td>

                      <td className="py-1.5 px-3 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={c.commercialParcelsCount > 0 ? "text-white" : "text-[#555555]"}>
                          {c.commercialParcelsCount.toLocaleString()}
                        </span>
                        {c.fullDepthThreshold > 0 && (
                          <span className="text-[10px] text-[#666666] ml-1">
                            / ~{c.fullDepthThreshold.toLocaleString()}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-[#888888] font-mono whitespace-nowrap">
                        {c.lastParcelsPullAt
                          ? new Date(c.lastParcelsPullAt).toISOString().slice(0, 10)
                          : "[NEVER]"}
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap text-[#888888]">
                        <a
                          href={c.officialPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#FFB000] inline-flex items-center gap-1"
                        >
                          <span>{c.appraiserName}</span>
                          <ExternalLinkIcon className="h-3 w-3 text-[#666666]" />
                        </a>
                      </td>

                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        {c.status === "RECORDS_REQUEST_REQUIRED" || c.fileFormat === "RECORDS_REQUEST_REQUIRED" ? (
                          <button
                            onClick={() => setRecordsRequestCounty(c)}
                            className="text-[11px] text-[#FFB000] hover:underline"
                          >
                            [F.S. 119 Request Info]
                          </button>
                        ) : (
                          <Link
                            href={`/admin/opportunity-intelligence/client-targets?county=${encodeURIComponent(
                              c.county
                            )}`}
                            className="text-[11px] text-[#888888] hover:text-[#FFB000] hover:underline"
                          >
                            [Open Targets]
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Records Request Modal */}
      {recordsRequestCounty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2px] border border-[#262626] bg-[#111111] p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-bold text-[#FFB000] uppercase">
                [RECORDS REQUEST PROCEDURE: {recordsRequestCounty.county.toUpperCase()} COUNTY]
              </span>
              <button
                onClick={() => setRecordsRequestCounty(null)}
                className="text-[#888888] hover:text-white"
              >
                [X]
              </button>
            </div>
            <div className="text-[#CCCCCC] space-y-2">
              <div>
                <span className="text-[#888888]">Property Appraiser:</span> {recordsRequestCounty.appraiserName}
              </div>
              <div>
                <span className="text-[#888888]">Official Portal:</span>{" "}
                <a
                  href={recordsRequestCounty.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FFB000] hover:underline"
                >
                  {recordsRequestCounty.officialPortalUrl}
                </a>
              </div>
              <div>
                <span className="text-[#888888]">Procedure:</span>{" "}
                {recordsRequestCounty.recordsRequestProcedure ||
                  "Submit public records request under Florida Statute Chapter 119 for the official GIS / NAL tax roll parcel export."}
              </div>
              {recordsRequestCounty.recordsRequestContact && (
                <div>
                  <span className="text-[#888888]">Contact:</span> {recordsRequestCounty.recordsRequestContact}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-[#262626] flex justify-end">
              <button
                onClick={() => setRecordsRequestCounty(null)}
                className="rounded-[2px] border border-[#262626] bg-[#161616] px-3 py-1 text-xs text-white hover:border-[#FFB000]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
