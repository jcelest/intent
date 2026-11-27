"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PortfolioTier = "UNDER_100" | "FROM_100_TO_300" | "OVER_300" | "UNKNOWN";

type Firm = {
  id: string;
  name: string;
  dba: string | null;
  firm_type: string;
  license_number: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  phone: string | null;
  website: string | null;
  evidence_url: string | null;
  portfolio_floor: number | null;
  portfolio_range_low: number | null;
  portfolio_range_high: number | null;
  portfolio_tier: PortfolioTier;
  parcels_matched_by_mailing_address: number | null;
  eviction_filings_trailing_12mo: number | null;
  permit_properties_trailing_12mo: number | null;
  sunbiz_associations_managed: number | null;
  association_units_total: number | null;
  claimed_doors?: number | null;
  portfolio_calculated_at: string | null;
  portfolio_types: string[];
  maintenance_trades: string[];
  maintenance_delivery_model: string;
  vendor_onboarding_status: string;
  vendor_registration_url: string | null;
  purchasing_contact_name: string | null;
  purchasing_contact_email: string | null;
  purchasing_contact_phone: string | null;
  documented_maintenance_contracts: number;
  documented_purchasing_activities: number;
  documented_contractor_relationships: number;
};

type Evidence = {
  evidence_layer: string;
  evidence_count: number;
  range_low: number | null;
  range_high: number | null;
  source_name: string;
  source_url: string | null;
  as_of_date: string;
  methodology: string;
};

type PurchasingIntelligence = {
  id: string;
  intelligence_type: string;
  verification_class: string;
  fact_status: string;
  portfolio_type: string | null;
  trade_category: string | null;
  service_category: string | null;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  source_as_of_date: string;
  vendor_registration_url: string | null;
};

const PORTFOLIO_TYPES = ["multifamily", "single_family_rental", "commercial", "hoa", "condominium", "hospitality", "vacation_rental", "other"];
const MAINTENANCE_TRADES = ["general_maintenance", "hvac", "building_automation", "controls", "remote_monitoring", "refrigeration", "energy_optimization", "electrical", "plumbing", "mechanical", "roofing", "landscaping", "janitorial", "fire_protection", "security", "elevators", "pest_control", "pool", "fencing", "restoration", "construction", "other"];

const TIERS: Array<{ key: PortfolioTier; label: string }> = [
  { key: "OVER_300", label: "300+" },
  { key: "FROM_100_TO_300", label: "100 to 300" },
  { key: "UNDER_100", label: "Under 100" },
  { key: "UNKNOWN", label: "No data" },
];

const LAYERS = [
  ["tax_mailing_address", "Tax mailing address", "Parcels matched by mailing address"],
  ["eviction_filings", "County clerk filings", "Eviction filings, trailing 12 months"],
  ["permit_contact", "Permit records", "Permit properties, trailing 12 months"],
  ["sunbiz_associations", "Florida Division of Corporations", "Sunbiz associations managed"],
  ["association_units", "Association parcel records", "Association units"],
  ["claimed_doors", "Firm-provided statement", "Self-reported"],
  ["verified_managed_properties", "Published management records", "Verified managed properties"],
  ["verified_association_units", "Florida DBPR with corroboration", "Verified association units"],
  ["published_portfolio", "Published portfolio report", "Published or self-reported size"],
  ["management_responsibilities", "Management evidence", "Documented management responsibilities"],
  ["maintenance_responsibilities", "Maintenance evidence", "Documented maintenance responsibilities"],
  ["vendor_accessible_portfolio", "Vendor-access evidence", "Confirmed vendor-accessible portfolio"],
] as const;

function tierLabel(tier: PortfolioTier) {
  return TIERS.find((item) => item.key === tier)?.label || "No data";
}

function portfolioDisplay(firm: Firm) {
  if (firm.portfolio_tier === "UNKNOWN" || firm.portfolio_range_low === null) return "No data";
  const prefix = tierLabel(firm.portfolio_tier);
  return firm.portfolio_range_high !== null
    ? `${prefix} · est. ${firm.portfolio_range_low.toLocaleString()} to ${firm.portfolio_range_high.toLocaleString()}`
    : `${prefix} · at least ${firm.portfolio_range_low.toLocaleString()}`;
}

function PortfolioBadge({ firm }: { firm: Firm }) {
  const unknown = firm.portfolio_tier === "UNKNOWN";
  return (
    <span className={`inline-flex items-center border px-2 py-1 font-mono text-[10px] ${unknown ? "border-white/10 text-[#6d7680]" : "border-amber-300/30 bg-amber-300/[0.07] text-amber-200"}`}>
      {portfolioDisplay(firm)}
    </span>
  );
}

export default function ManagementFirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [total, setTotal] = useState(0);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [firmType, setFirmType] = useState("");
  const [tier, setTier] = useState("");
  const [sort, setSort] = useState<"portfolio" | "name">("portfolio");
  const [county, setCounty] = useState("");
  const [portfolioType, setPortfolioType] = useState("");
  const [maintenanceTrade, setMaintenanceTrade] = useState("");
  const [deliveryModel, setDeliveryModel] = useState("");
  const [vendorOnboarding, setVendorOnboarding] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Firm | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [purchasingIntelligence, setPurchasingIntelligence] = useState<PurchasingIntelligence[]>([]);
  const [manualType, setManualType] = useState("maintenance_responsibility");
  const [manualTrade, setManualTrade] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualSourceName, setManualSourceName] = useState("");
  const [manualSourceUrl, setManualSourceUrl] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualNotice, setManualNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "5000", sort });
      if (search.trim()) params.set("search", search.trim());
      if (firmType) params.set("type", firmType);
      if (tier) params.set("portfolioTier", tier);
      if (county) params.set("county", county);
      if (portfolioType) params.set("portfolioType", portfolioType);
      if (maintenanceTrade) params.set("maintenanceTrade", maintenanceTrade);
      if (deliveryModel) params.set("deliveryModel", deliveryModel);
      if (vendorOnboarding) params.set("vendorOnboarding", vendorOnboarding);
      const response = await fetch(`/api/opportunity-intelligence/management-firms?${params}`);
      const data = await response.json();
      if (data.ok) {
        setFirms(data.firms || []);
        setTotal(data.total || 0);
        setTierCounts(data.tierCounts || {});
      }
    } finally {
      setLoading(false);
    }
  }, [county, deliveryModel, firmType, maintenanceTrade, portfolioType, search, sort, tier, vendorOnboarding]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const firmId = new URLSearchParams(window.location.search).get("firmId");
    if (!firmId) return;
    fetch(`/api/opportunity-intelligence/management-firms?id=${encodeURIComponent(firmId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) {
          setSelected(data.firm);
          setEvidence(data.evidence || []);
          setPurchasingIntelligence(data.purchasingIntelligence || []);
        }
      })
      .catch(() => undefined);
  }, []);

  const openFirm = async (firm: Firm) => {
    setSelected(firm);
    setEvidence([]);
    setPurchasingIntelligence([]);
    const response = await fetch(`/api/opportunity-intelligence/management-firms?id=${firm.id}`);
    const data = await response.json();
    if (data.ok) {
      setSelected(data.firm);
      setEvidence(data.evidence || []);
      setPurchasingIntelligence(data.purchasingIntelligence || []);
    }
  };

  const evidenceByLayer = useMemo(
    () => new Map(evidence.map((item) => [item.evidence_layer, item])),
    [evidence],
  );

  const saveManualIntelligence = async () => {
    if (!selected) return;
    setManualSaving(true);
    setManualNotice(null);
    try {
      const response = await fetch("/api/opportunity-intelligence/management-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId: selected.id, intelligenceType: manualType, tradeCategory: manualTrade || null, title: manualTitle, summary: manualSummary, sourceName: manualSourceName, sourceUrl: manualSourceUrl, sourceAsOfDate: new Date().toISOString().slice(0, 10) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save intelligence");
      const detail = await fetch(`/api/opportunity-intelligence/management-firms?id=${selected.id}`, { cache: "no-store" }).then((item) => item.json());
      if (detail.ok) {
        setSelected(detail.firm);
        setEvidence(detail.evidence || []);
        setPurchasingIntelligence(detail.purchasingIntelligence || []);
      }
      setManualTitle(""); setManualSummary(""); setManualSourceName(""); setManualSourceUrl(""); setManualTrade("");
      setManualNotice("Permanent source-attributed record saved.");
    } catch (error) {
      setManualNotice(error instanceof Error ? error.message : "Could not save intelligence");
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Property manager and CAM intelligence</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Management firms</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#818b95]">Portfolio screens use documented parcel, permit, association, and future filing evidence. Review counts, firm age, and license counts are never used.</p>
        </div>
        <div className="font-mono text-xs text-[#9aa3ab]">{total.toLocaleString()} firms in view</div>
      </div>

      <div className="grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4">
        {TIERS.map((item) => (
          <button key={item.key} onClick={() => setTier(tier === item.key ? "" : item.key)} className={`bg-[#101419] p-3 text-left ${tier === item.key ? "ring-1 ring-inset ring-amber-300/50" : ""}`}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#68727c]">{item.label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{(tierCounts[item.key] || 0).toLocaleString()}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 border border-white/[0.08] bg-[#0e1216] p-3 md:grid-cols-4 xl:grid-cols-8">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firm, license, city, address" className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/40" />
        <select value={firmType} onChange={(event) => setFirmType(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white">
          <option value="">PM and CAM firms</option>
          <option value="commercial_property_management">Property managers</option>
          <option value="community_association_management">CAM firms</option>
          <option value="asset_management">Asset managers</option>
        </select>
        <select value={tier} onChange={(event) => setTier(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white">
          <option value="">All portfolio tiers</option>
          {TIERS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <input value={county} onChange={(event) => setCounty(event.target.value)} placeholder="County" className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-amber-300/40" />
        <select value={portfolioType} onChange={(event) => setPortfolioType(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="">All portfolio types</option>{PORTFOLIO_TYPES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <select value={maintenanceTrade} onChange={(event) => setMaintenanceTrade(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="">All maintenance trades</option>{MAINTENANCE_TRADES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <select value={deliveryModel} onChange={(event) => setDeliveryModel(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="">Any delivery model</option><option value="in_house">In house</option><option value="outsourced">Outsourced</option><option value="mixed">Mixed</option><option value="unknown">Unknown</option></select>
        <select value={vendorOnboarding} onChange={(event) => setVendorOnboarding(event.target.value)} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"><option value="">Any vendor access</option><option value="public">Public registration</option><option value="invitation_required">Invitation required</option><option value="unknown">Unknown</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as "portfolio" | "name")} className="border border-white/10 bg-black/30 px-3 py-2 text-xs text-white">
          <option value="portfolio">Portfolio floor, high to low</option>
          <option value="name">Firm name</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-white/[0.08]">
        <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
          <thead className="bg-[#0d1115] font-mono text-[9px] uppercase tracking-wider text-[#69737d]">
            <tr><th className="px-3 py-2.5">Firm</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Location</th><th className="px-3 py-2.5">License</th><th className="px-3 py-2.5">Portfolio</th><th className="px-3 py-2.5">Maintenance</th><th className="px-3 py-2.5 text-right">Evidence</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] bg-[#101419]">
            {loading ? <tr><td colSpan={7} className="p-8 text-center text-[#69737d]">Loading firms...</td></tr> : firms.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-[#69737d]">No firms match this view.</td></tr> : firms.map((firm) => (
              <tr key={firm.id} className="hover:bg-white/[0.025]">
                <td className="px-3 py-3"><div className="font-semibold text-white">{firm.name}</div>{firm.dba && <div className="mt-0.5 text-[10px] text-[#6f7982]">{firm.dba}</div>}</td>
                <td className="px-3 py-3 text-[#9aa3ac]">{firm.firm_type.replaceAll("_", " ")}</td>
                <td className="px-3 py-3 text-[#9aa3ac]">{[firm.city, firm.county && `${firm.county} County`].filter(Boolean).join(" · ") || "Unknown"}</td>
                <td className="px-3 py-3 font-mono text-[#87919a]">{firm.license_number || "No license recorded"}</td>
                <td className="px-3 py-3"><PortfolioBadge firm={firm} /></td>
                <td className="max-w-64 px-3 py-3 text-[10px] text-[#8f99a2]"><div>{firm.portfolio_types?.length ? firm.portfolio_types.map((item) => item.replaceAll("_", " ")).join(", ") : "Type unknown"}</div><div className="mt-1 text-[#65707a]">{firm.maintenance_trades?.length ? firm.maintenance_trades.map((item) => item.replaceAll("_", " ")).join(", ") : "No documented trade scope"}</div></td>
                <td className="px-3 py-3 text-right"><button onClick={() => openFirm(firm)} className="border border-white/10 px-2.5 py-1.5 text-[10px] text-[#aeb6be] hover:border-amber-300/35 hover:text-amber-200">View evidence</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {firms.length < total && <div className="text-center text-[10px] text-[#626c75]">Showing the first {firms.length.toLocaleString()} of {total.toLocaleString()} records. Refine filters to narrow the view.</div>}

      {selected && (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/65" onMouseDown={(event) => event.currentTarget === event.target && setSelected(null)}>
          <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0c1014] p-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div><div className="font-mono text-[9px] uppercase tracking-wider text-amber-300">Portfolio size</div><h2 className="mt-2 text-xl font-semibold text-white">{selected.name}</h2><div className="mt-2"><PortfolioBadge firm={selected} /></div></div>
              <button onClick={() => setSelected(null)} className="text-xs text-[#8b949d]">Close</button>
            </div>
            <div className="mt-5 space-y-2">
              {LAYERS.map(([key, fallbackSource, label]) => {
                const item = evidenceByLayer.get(key);
                const directCount = item?.evidence_count ?? null;
                return <div key={key} className="border border-white/[0.08] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold text-[#d6dbe0]">{label}</div><div className="mt-1 text-[10px] text-[#69737d]">{item?.source_name || fallbackSource}{item?.as_of_date ? ` · as of ${new Date(item.as_of_date).toLocaleDateString()}` : " · not yet populated"}</div></div><div className={`font-mono text-sm ${directCount === null || directCount === undefined ? "text-[#56606a]" : "text-white"}`}>{directCount === null || directCount === undefined ? "No data" : Number(directCount).toLocaleString()}</div></div>{item?.methodology && <p className="mt-2 text-[10px] leading-4 text-[#77818a]">{item.methodology}</p>}{item?.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-amber-200 hover:underline">Open source evidence</a>}</div>;
              })}
            </div>
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h3 className="text-sm font-semibold text-white">Maintenance purchasing intelligence</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="border border-white/[0.08] p-3"><div className="text-[9px] uppercase tracking-wider text-[#69737d]">Delivery</div><div className="mt-1 text-xs text-white">{selected.maintenance_delivery_model?.replaceAll("_", " ") || "unknown"}</div></div><div className="border border-white/[0.08] p-3"><div className="text-[9px] uppercase tracking-wider text-[#69737d]">Vendor access</div><div className="mt-1 text-xs text-white">{selected.vendor_onboarding_status?.replaceAll("_", " ") || "unknown"}</div></div><div className="border border-white/[0.08] p-3"><div className="text-[9px] uppercase tracking-wider text-[#69737d]">Purchasing records</div><div className="mt-1 text-xs text-white">{Number(selected.documented_purchasing_activities || 0).toLocaleString()}</div></div></div>
              <div className="mt-3 space-y-2">{purchasingIntelligence.length ? purchasingIntelligence.map((item) => <div key={item.id} className="border border-white/[0.08] bg-white/[0.02] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-semibold text-[#d6dbe0]">{item.title}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-amber-200">{item.verification_class.replaceAll("_", " ")} · {item.intelligence_type.replaceAll("_", " ")}</div></div><div className="text-[9px] text-[#65707a]">{new Date(item.source_as_of_date).toLocaleDateString()}</div></div><p className="mt-2 text-[10px] leading-4 text-[#858f98]">{item.summary}</p><div className="mt-2 flex gap-3"><a href={item.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-amber-200 hover:underline">Source evidence</a>{item.vendor_registration_url && <a href={item.vendor_registration_url} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-200 hover:underline">Vendor registration</a>}</div></div>) : <div className="border border-white/[0.08] p-4 text-xs text-[#65707a]">No source-attributed maintenance purchasing facts yet.</div>}</div>
              <div className="mt-5 border border-white/[0.08] bg-black/20 p-3">
                <div className="text-xs font-semibold text-white">Add confirmed intelligence</div>
                <p className="mt-1 text-[10px] leading-4 text-[#65707a]">Manual records are permanent and require a public evidence URL. They remain labeled administrator confirmed.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={manualType} onChange={(event) => setManualType(event.target.value)} className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white"><option value="maintenance_responsibility">Maintenance responsibility</option><option value="maintenance_delivery_model">Delivery model</option><option value="vendor_onboarding">Vendor onboarding</option><option value="vendor_requirement">Vendor requirement</option><option value="purchasing_contact">Purchasing contact</option><option value="maintenance_contract">Maintenance contract</option><option value="purchasing_activity">Purchasing activity</option><option value="contractor_relationship">Contractor relationship</option><option value="service_volume">Service volume</option><option value="geographic_portfolio">Geographic portfolio</option></select>
                  <select value={manualTrade} onChange={(event) => setManualTrade(event.target.value)} className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white"><option value="">No trade category</option>{MAINTENANCE_TRADES.map((trade) => <option key={trade} value={trade}>{trade.replaceAll("_", " ")}</option>)}</select>
                  <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Fact title" className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white" />
                  <input value={manualSourceName} onChange={(event) => setManualSourceName(event.target.value)} placeholder="Source name" className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white" />
                  <input value={manualSourceUrl} onChange={(event) => setManualSourceUrl(event.target.value)} placeholder="https://public-evidence-url" className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white sm:col-span-2" />
                  <textarea value={manualSummary} onChange={(event) => setManualSummary(event.target.value)} placeholder="What the source proves" rows={3} className="border border-white/10 bg-[#090c10] px-2 py-2 text-[10px] text-white sm:col-span-2" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-[#77818a]">{manualNotice || "Facts are never promoted to active demand without procurement evidence."}</span><button disabled={manualSaving} onClick={() => void saveManualIntelligence()} className="border border-amber-300/30 px-3 py-2 text-[10px] text-amber-100 disabled:opacity-50">{manualSaving ? "Saving..." : "Save confirmed fact"}</button></div>
              </div>
            </div>
            <p className="mt-5 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-[#65707a]">The portfolio floor uses directly documented properties, associations, or units only. Filing-rate estimates can widen the range but never increase the verified floor. Self-reported doors never set the verified tier.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
