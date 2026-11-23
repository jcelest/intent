"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FLORIDA_REGIONS } from "@/lib/florida-geo";
import {
  RefreshIcon,
  SearchIcon,
  CheckIcon,
  ExternalLinkIcon,
  DownloadIcon,
  ShieldCheckIcon,
  PlayIcon,
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
  fieldMapping: Record<string, string>;
  status: "INGESTED" | "DIRECT_DOWNLOAD" | "RECORDS_REQUEST_REQUIRED" | "STALE";
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

export default function FloridaCoveragePage() {
  const [counties, setCounties] = useState<CountyCoverageDetail[]>([]);
  const [summary, setSummary] = useState<CoverageSummaryData>({
    totalCounties: 67,
    ingestedCounties: 0,
    directDownloadCounties: 0,
    recordsRequestRequiredCounties: 0,
    staleCounties: 0,
    totalParcels: 0,
    totalEntitiesMatched: 0,
    totalLicenses: 0,
    totalPermits: 0,
    totalVerified: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [recordsRequestCounty, setRecordsRequestCounty] = useState<CountyCoverageDetail | null>(null);

  // Queue runner state
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

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
      console.error("Failed loading coverage:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const handleTriggerQueueBatch = async () => {
    try {
      setRunningBatch(true);
      setBatchNotice("Executing continuous queue batch across layers...");
      const res = await fetch("/api/opportunity-intelligence/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      });
      const data = await res.json();
      if (data.ok) {
        const processedCount = data.batchResult?.processed || 0;
        setBatchNotice(
          `Queue batch completed: Processed ${processedCount} tasks across layers. Active jobs: ${data.status?.processing || 0}, Next in queue: ${data.status?.nextScheduledJob?.county || "None"}.`
        );
        await loadCoverage();
      } else {
        setBatchNotice(`Queue error: ${data.error || "Batch execution failed"}`);
      }
    } catch (err) {
      console.error(err);
      setBatchNotice("Queue batch trigger failed.");
    } finally {
      setRunningBatch(false);
      setTimeout(() => setBatchNotice(null), 7000);
    }
  };

  const filteredCounties = counties.filter((c) => {
    if (selectedRegion !== "all" && c.region !== selectedRegion) return false;
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              STATEWIDE 67-COUNTY GIS & MULTI-LAYER REGISTRY
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Parcels • Sunbiz • DBPR Licenses • Permits • Activity Verification
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">Florida Coverage & Continuous Ingestion</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Official Property Appraiser source endpoints, full-depth commercial parcel status, and continuous scheduled layer queue across all 67 Florida counties. Zero fabrication: all counts computed directly from real database rows.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerQueueBatch}
            disabled={runningBatch}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            {runningBatch ? "Processing Batch..." : "Run Queue Batch"}
          </button>

          <button
            onClick={loadCoverage}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {batchNotice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>{batchNotice}</span>
          </div>
          <button onClick={() => setBatchNotice(null)} className="text-slate-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-white/10 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-slate-400">Total FL Counties</div>
          <div className="text-2xl font-bold text-white mt-1">67</div>
          <div className="text-[11px] text-cyan-400 mt-0.5 font-mono">100% Territorial Scope</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-emerald-400">Ingested to Full Depth</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.ingestedCounties}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Orange, Osceola, Seminole, Escambia, Santa Rosa</div>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-cyan-400">Direct GIS Downloads</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{summary.directDownloadCounties}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Automated queue processing</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-[#0d1424] p-4">
          <div className="text-[10px] font-mono uppercase text-amber-400">Records Request Req.</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{summary.recordsRequestRequiredCounties}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rural counties (F.S. 119)</div>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-[#0d1424] p-4 col-span-2 md:col-span-1">
          <div className="text-[10px] font-mono uppercase text-purple-400">Commercial Parcels</div>
          <div className="text-2xl font-bold text-purple-300 mt-1">{summary.totalParcels.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Real statewide database rows</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-white/10 bg-[#0d1424] p-4">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Search County or Appraiser</label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search e.g. Orange, Escambia, Amy Mercado, 12093..."
              className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
            />
            <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Filter Region</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
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
          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Filter Registry Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Registry Statuses</option>
            <option value="INGESTED">Ingested to Full Depth ({summary.ingestedCounties})</option>
            <option value="DIRECT_DOWNLOAD">Direct GIS Download ({summary.directDownloadCounties})</option>
            <option value="RECORDS_REQUEST_REQUIRED">Records Request Required ({summary.recordsRequestRequiredCounties})</option>
            <option value="STALE">Stale / Needs Cadence Refresh ({summary.staleCounties})</option>
          </select>
        </div>
      </div>

      {/* 67-County Registry Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1424] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Florida County Parcel & Layer Registry</h3>
            <span className="text-xs font-mono text-cyan-400">
              (All 67 Counties in Ingestion Queue Order)
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {filteredCounties.length} of 67 Counties
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-sm font-mono text-slate-400">
            <RefreshIcon className="h-6 w-6 animate-spin mx-auto text-cyan-400 mb-3" />
            Loading real 67-county registry and layer metrics from database...
          </div>
        ) : filteredCounties.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-400">
            No Florida counties matched this filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3">County & Appraiser</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Commercial Parcels</th>
                  <th className="px-3 py-3 text-center">Sunbiz Matched</th>
                  <th className="px-3 py-3 text-center">DBPR Licenses</th>
                  <th className="px-3 py-3 text-center">Permits</th>
                  <th className="px-3 py-3 text-center">Verified Active</th>
                  <th className="px-4 py-3">Last Pull</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCounties.map((c) => {
                  const percent = Math.min(100, Math.round((c.commercialParcelsCount / c.fullDepthThreshold) * 100));
                  return (
                    <tr key={c.fips} className="hover:bg-white/[0.02] transition-colors">
                      {/* County & Appraiser */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{c.county}</span>
                          {c.isPriorityCounty && (
                            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 border border-cyan-500/30 uppercase">
                              Priority #{c.populationRank <= 5 ? c.populationRank : "1-5"}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.appraiserName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          FIPS 12{c.fips} • Pop: {c.population.toLocaleString()} (Rank #{c.populationRank})
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {c.status === "INGESTED" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                            <CheckIcon className="h-3 w-3 text-emerald-400" />
                            INGESTED
                          </span>
                        ) : c.status === "DIRECT_DOWNLOAD" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-400 border border-cyan-500/30">
                            <DownloadIcon className="h-3 w-3 text-cyan-400" />
                            DIRECT DOWNLOAD
                          </span>
                        ) : c.status === "RECORDS_REQUEST_REQUIRED" ? (
                          <button
                            onClick={() => setRecordsRequestCounty(c)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                          >
                            <ShieldCheckIcon className="h-3 w-3 text-amber-400" />
                            RECORDS REQ. (F.S. 119)
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-400 border border-purple-500/30">
                            STALE
                          </span>
                        )}
                      </td>

                      {/* Commercial Parcels Count & Progress */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-between text-xs font-mono mb-1">
                          <span className="font-bold text-white">
                            {c.commercialParcelsCount.toLocaleString()}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            target {c.fullDepthThreshold.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 w-32 rounded-full bg-black/60 overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              c.status === "INGESTED"
                                ? "bg-emerald-400"
                                : c.commercialParcelsCount > 0
                                ? "bg-cyan-400"
                                : "bg-slate-700"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>

                      {/* Sunbiz Matched */}
                      <td className="px-3 py-3.5 text-center font-mono">
                        {c.entitiesMatchedCount > 0 ? (
                          <div>
                            <span className="text-cyan-300 font-semibold">{c.entitiesMatchedCount}</span>
                            <span className="text-[10px] text-slate-500 block">({c.entitiesMatchedPercent}%)</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* DBPR Licenses */}
                      <td className="px-3 py-3.5 text-center font-mono">
                        {c.licensesCount > 0 ? (
                          <span className="font-semibold text-white">{c.licensesCount}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Mechanical Permits */}
                      <td className="px-3 py-3.5 text-center font-mono">
                        {c.permitsCount > 0 ? (
                          <span className="font-semibold text-white">{c.permitsCount}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Verified Active */}
                      <td className="px-3 py-3.5 text-center font-mono">
                        {c.verifiedCount > 0 ? (
                          <span className="text-emerald-400 font-semibold">{c.verifiedCount}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Last Pull */}
                      <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {c.lastParcelsPullAt ? (
                          <div>
                            <span className="text-slate-300">
                              {new Date(c.lastParcelsPullAt).toLocaleDateString()}
                            </span>
                            <span className="text-slate-500 block">Parcels</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                        {c.status === "RECORDS_REQUEST_REQUIRED" ? (
                          <button
                            onClick={() => setRecordsRequestCounty(c)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline"
                          >
                            Request Docs
                          </button>
                        ) : (
                          <a
                            href={c.officialPortalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-white"
                          >
                            Appraiser Portal <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        )}
                        <span className="text-slate-700">|</span>
                        <Link
                          href={`/admin/opportunity-intelligence/client-targets?county=${encodeURIComponent(c.county)}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
                        >
                          Targets
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chapter 119 Formal Records Request Modal */}
      {recordsRequestCounty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-[#0d1424] p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-400 border border-amber-500/20">
                  FLORIDA STATUTE § 119 PUBLIC RECORDS PROCEDURE
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {recordsRequestCounty.county} County Property Appraiser
                </h3>
              </div>
              <button
                onClick={() => setRecordsRequestCounty(null)}
                className="text-slate-400 hover:text-white text-sm font-mono px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2">
                <div className="font-semibold text-white">Appraiser Office & Custodian Details:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Appraiser:</span>{" "}
                    <span className="text-white font-medium">{recordsRequestCounty.appraiserName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Contact:</span>{" "}
                    <span className="text-white font-medium">{recordsRequestCounty.recordsRequestContact || "Public Records Custodian"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Official Portal:</span>{" "}
                    <a
                      href={recordsRequestCounty.officialPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      {recordsRequestCounty.officialPortalUrl} <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 space-y-2">
                <div className="font-semibold text-amber-300">Chapter 119 Request Procedure:</div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {recordsRequestCounty.recordsRequestProcedure ||
                    `Direct open GIS polygon downloads are not published online by ${recordsRequestCounty.county} County. Under Chapter 119, Florida Statutes, the property appraiser is legally obligated to provide the real property assessment roll (NAL data) and GIS parcel shapefile/GeoJSON upon request.`}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/60 p-3.5 space-y-1.5">
                <div className="font-mono text-[10px] uppercase text-slate-400">Recommended Email Template:</div>
                <div className="font-mono text-[11px] text-slate-300 bg-black/40 p-2.5 rounded border border-white/5 whitespace-pre-wrap select-all">
{`Subject: Public Records Request (F.S. 119) - Commercial Parcel Data & GIS Layer

Dear Records Custodian,

Pursuant to Chapter 119, Florida Statutes (Public Records Law), I am requesting electronic copies of the following public records from the ${recordsRequestCounty.county} County Property Appraiser's Office:

1. The most recent Florida Department of Revenue Name-Address-Legal (NAL) assessment data file or commercial parcel export, including parcel ID, situs address, owner name, owner mailing address, DOR use code, building square footage, and year built.
2. The current GIS parcel cadastral polygon layer in ESRI Shapefile or GeoJSON format.

Please provide these records in electronic format via email or secure download link. If any fees apply under F.S. 119.07, please notify us in advance.

Thank you for your assistance.`}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setRecordsRequestCounty(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
