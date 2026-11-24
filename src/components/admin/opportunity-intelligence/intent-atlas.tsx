"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { FLORIDA_COUNTIES, calculateDistanceMiles } from "@/lib/florida-geo";
import { classificationMeta } from "./hub-ui";

type AtlasFeature = GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>;
type AtlasCollection = GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;

const EMPTY: AtlasCollection = { type: "FeatureCollection", features: [] };
const STYLE = { dark: "https://tiles.openfreemap.org/styles/dark", light: "https://tiles.openfreemap.org/styles/liberty" } as const;

const LAYER_GROUPS = [
  { title: "Opportunities", items: [
    ["confirmed", "Confirmed opportunities", "#34d399"], ["solicitations", "Active solicitations", "#22c55e"], ["renewals", "Contract renewals", "#fbbf24"], ["awards", "Historical awards", "#eab308"], ["inferred", "Inferred service opportunities", "#94a3b8"],
  ] },
  { title: "Property & relationships", items: [
    ["properties", "Commercial properties", "#e5e7eb"], ["partnerships", "Commercial partnerships", "#a78bfa"], ["portfolios", "Property management portfolios", "#c084fc"], ["operators", "Multi-location operators", "#8b5cf6"],
  ] },
  { title: "Permits", items: [
    ["mechanical_permits", "Mechanical permits", "#f97316"], ["roofing_permits", "Roofing permits", "#fb923c"], ["electrical_permits", "Electrical permits", "#fdba74"], ["plumbing_permits", "Plumbing permits", "#f59e0b"], ["new_construction", "New commercial construction", "#ea580c"],
  ] },
  { title: "Equipment & services", items: [
    ["automation", "Building automation systems", "#38bdf8"], ["hvac_equipment", "HVAC equipment intelligence", "#0ea5e9"], ["refrigeration", "Commercial refrigeration", "#0284c7"], ["monitoring", "Remote monitoring", "#06b6d4"], ["energy", "Energy optimization", "#14b8a6"], ["maintenance", "Preventive maintenance", "#2dd4bf"],
  ] },
] as const;

const DEFAULT_LAYERS = new Set(["confirmed", "solicitations", "renewals", "inferred", "properties", "mechanical_permits", "new_construction", "automation", "hvac_equipment", "partnerships"]);

function asCollection(features: AtlasFeature[]): AtlasCollection { return { type: "FeatureCollection", features }; }
function stringProperty(feature: AtlasFeature, key: string) { return String(feature.properties?.[key] || "").toLowerCase(); }

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    const intersect = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function matchesOpportunity(feature: AtlasFeature, active: Set<string>) {
  const classification = stringProperty(feature, "classification");
  const status = stringProperty(feature, "status");
  const trade = stringProperty(feature, "tradeSlug") || stringProperty(feature, "trade_slug");
  const service = stringProperty(feature, "serviceCategory");
  return (active.has("confirmed") && classification === "confirmed")
    || (active.has("solicitations") && classification === "confirmed" && status === "active")
    || (active.has("renewals") && (classification === "timing_based" || Boolean(feature.properties?.contractExpirationDate)))
    || (active.has("awards") && status === "awarded")
    || (active.has("inferred") && classification === "inferred")
    || (active.has("partnerships") && classification === "relationship")
    || (active.has("portfolios") && classification === "relationship" && (service.includes("portfolio") || service.includes("property management")))
    || (active.has("operators") && classification === "relationship" && (service.includes("multi") || service.includes("operator")))
    || (active.has("automation") && (trade.includes("automation") || service.includes("automation") || service.includes("controls")))
    || (active.has("hvac_equipment") && (classification === "asset_based" && trade.includes("hvac")))
    || (active.has("refrigeration") && (trade.includes("refrigeration") || service.includes("refrigeration")))
    || (active.has("monitoring") && (trade.includes("monitoring") || service.includes("monitoring")))
    || (active.has("energy") && (trade.includes("energy") || service.includes("energy")))
    || (active.has("maintenance") && service.includes("maintenance"));
}

function matchesPermit(feature: AtlasFeature, active: Set<string>) {
  const type = stringProperty(feature, "permit_type") || stringProperty(feature, "permitType");
  return (active.has("mechanical_permits") && type.includes("mechanical"))
    || (active.has("roofing_permits") && type.includes("roof"))
    || (active.has("electrical_permits") && type.includes("electrical"))
    || (active.has("plumbing_permits") && type.includes("plumb"))
    || (active.has("new_construction") && (type.includes("new") || type.includes("construction")));
}

export function IntentAtlas() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rawData = useRef<AtlasCollection>(EMPTY);
  const drawPoints = useRef<Array<[number, number]>>([]);
  const drawModeRef = useRef(false);
  const polygonRef = useRef<Array<[number, number]>>([]);
  const radiusMilesRef = useRef("");
  const fetchTimer = useRef<number | null>(null);
  const [theme, setTheme] = useState<keyof typeof STYLE>("dark");
  const [mode, setMode] = useState("markers");
  const [activeLayers, setActiveLayers] = useState<Set<string>>(() => new Set(DEFAULT_LAYERS));
  const activeLayersRef = useRef(activeLayers);
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const selectedCountiesRef = useRef(selectedCounties);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordCount, setRecordCount] = useState(0);
  const [regionalCount, setRegionalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("Statewide view · move the map to query the visible area");
  const [drawMode, setDrawMode] = useState(false);
  const [polygon, setPolygon] = useState<Array<[number, number]>>([]);
  const [radiusMiles, setRadiusMiles] = useState("");

  useEffect(() => { activeLayersRef.current = activeLayers; }, [activeLayers]);
  useEffect(() => { selectedCountiesRef.current = selectedCounties; }, [selectedCounties]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { polygonRef.current = polygon; }, [polygon]);
  useEffect(() => { radiusMilesRef.current = radiusMiles; }, [radiusMiles]);

  const applyData = useCallback(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const active = activeLayersRef.current;
    const radius = Number(radiusMilesRef.current);
    const center = map.getCenter();
    const area = polygonRef.current;
    const withinGeoFilter = (feature: AtlasFeature) => {
      const point = feature.geometry.coordinates as [number, number];
      if (area.length >= 3 && !pointInPolygon(point, area)) return false;
      if (Number.isFinite(radius) && radius > 0 && calculateDistanceMiles(center.lat, center.lng, point[1], point[0]) > radius) return false;
      return true;
    };
    const all = rawData.current.features as AtlasFeature[];
    const opportunities = all.filter((feature) => feature.properties?.featureType === "opportunity" && matchesOpportunity(feature, active) && withinGeoFilter(feature));
    const regional = all.filter((feature) => feature.properties?.featureType === "regional_aggregate" && matchesOpportunity(feature, active) && withinGeoFilter(feature));
    const properties = active.has("properties") ? all.filter((feature) => feature.properties?.featureType === "property" && withinGeoFilter(feature)) : [];
    const permits = all.filter((feature) => feature.properties?.featureType === "permit" && matchesPermit(feature, active) && withinGeoFilter(feature));
    const equipment = all.filter((feature) => feature.properties?.featureType === "equipment" && (active.has("automation") || active.has("hvac_equipment") || active.has("refrigeration")) && withinGeoFilter(feature));
    (map.getSource("oi-opportunities") as GeoJSONSource | undefined)?.setData(asCollection(opportunities));
    (map.getSource("oi-density") as GeoJSONSource | undefined)?.setData(asCollection(opportunities));
    (map.getSource("oi-regional") as GeoJSONSource | undefined)?.setData(asCollection(regional));
    (map.getSource("oi-properties") as GeoJSONSource | undefined)?.setData(asCollection(properties));
    (map.getSource("oi-permits") as GeoJSONSource | undefined)?.setData(asCollection(permits));
    (map.getSource("oi-equipment") as GeoJSONSource | undefined)?.setData(asCollection(equipment));
    setRecordCount(opportunities.length + properties.length + permits.length + equipment.length);
    setRegionalCount(regional.length);
  }, []);

  const installDataLayers = useCallback((map: MapLibreMap) => {
    const source = (id: string, clustered = false) => { if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY, ...(clustered ? { cluster: true, clusterRadius: 52, clusterMaxZoom: 12 } : {}) }); };
    source("oi-opportunities", true); source("oi-density"); source("oi-regional"); source("oi-properties", true); source("oi-permits", true); source("oi-equipment", true);
    if (!map.getSource("oi-drawn-area")) map.addSource("oi-drawn-area", { type: "geojson", data: EMPTY });
    const add = (layer: Parameters<MapLibreMap["addLayer"]>[0]) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({ id: "oi-density-heat", type: "heatmap", source: "oi-density", layout: { visibility: "none" }, paint: { "heatmap-weight": 1, "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 13, 2.2], "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#475569", 0.45, "#0ea5e9", 0.72, "#f59e0b", 1, "#34d399"], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 13, 13, 45], "heatmap-opacity": 0.82 } });
    add({ id: "oi-value-heat", type: "heatmap", source: "oi-density", layout: { visibility: "none" }, paint: { "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "documentedValue"], 0], 0, 0.05, 100000, 0.2, 1000000, 0.65, 10000000, 1], "heatmap-intensity": 1.1, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#1d4ed8", 0.5, "#0891b2", 0.75, "#f59e0b", 1, "#22c55e"], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 15, 13, 50], "heatmap-opacity": 0.84 } });
    add({ id: "oi-property-clusters", type: "circle", source: "oi-properties", filter: ["has", "point_count"], paint: { "circle-color": "#cbd5e1", "circle-radius": 13, "circle-opacity": 0.42, "circle-stroke-color": "#0b0e11", "circle-stroke-width": 2 } });
    add({ id: "oi-properties-points", type: "circle", source: "oi-properties", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#e2e8f0", "circle-radius": 2.5, "circle-opacity": 0.42 } });
    add({ id: "oi-clusters", type: "circle", source: "oi-opportunities", filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#64748b", 10, "#0ea5e9", 50, "#f59e0b", 200, "#34d399"], "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 50, 27, 200, 34], "circle-stroke-color": "#0a0d10", "circle-stroke-width": 2, "circle-opacity": 0.88 } });
    add({ id: "oi-cluster-count", type: "symbol", source: "oi-opportunities", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });
    add({ id: "oi-points", type: "circle", source: "oi-opportunities", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "classification"], "confirmed", "#34d399", "timing_based", "#fbbf24", "asset_based", "#38bdf8", "relationship", "#a78bfa", "#94a3b8"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 14, 8], "circle-stroke-color": "#0a0d10", "circle-stroke-width": 1.5, "circle-opacity": 0.95 } });
    add({ id: "oi-regional-points", type: "circle", source: "oi-regional", paint: { "circle-color": ["match", ["get", "classification"], "confirmed", "#34d399", "timing_based", "#fbbf24", "asset_based", "#38bdf8", "relationship", "#a78bfa", "#94a3b8"], "circle-radius": ["interpolate", ["linear"], ["get", "opportunityCount"], 1, 7, 200, 23], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": 0.55, "circle-opacity": 0.58 } });
    add({ id: "oi-regional-labels", type: "symbol", source: "oi-regional", layout: { "text-field": ["to-string", ["get", "opportunityCount"]], "text-size": 10 }, paint: { "text-color": "#ffffff" } });
    add({ id: "oi-permit-points", type: "circle", source: "oi-permits", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#f97316", "circle-radius": 5, "circle-stroke-color": "#431407", "circle-stroke-width": 1 } });
    add({ id: "oi-equipment-points", type: "circle", source: "oi-equipment", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#38bdf8", "circle-radius": 6, "circle-stroke-color": "#082f49", "circle-stroke-width": 1.2 } });
    add({ id: "oi-drawn-fill", type: "fill", source: "oi-drawn-area", paint: { "fill-color": "#fbbf24", "fill-opacity": 0.1 } });
    add({ id: "oi-drawn-line", type: "line", source: "oi-drawn-area", paint: { "line-color": "#fbbf24", "line-width": 2, "line-dasharray": [2, 2] } });
  }, []);

  const fetchVisible = useCallback(async (fit = false) => {
    const map = mapRef.current;
    if (!map) return;
    setLoading(true);
    const bounds = map.getBounds();
    const params = new URLSearchParams({ bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(","), layers: "opportunities,solicitations,renewals,relationships,properties,permits,equipment" });
    selectedCountiesRef.current.forEach((county) => params.append("county", county));
    try {
      const response = await fetch(`/api/opportunity-intelligence/hub/atlas?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Atlas query failed");
      rawData.current = payload.data;
      applyData();
      setNotice(`${payload.data.metadata.documentedLocations.toLocaleString()} documented locations · ${payload.data.metadata.regionalAggregates.toLocaleString()} regional aggregates`);
      if (fit && payload.data.features.length) {
        const maplibre = await import("maplibre-gl");
        const fitBounds = new maplibre.LngLatBounds();
        payload.data.features.forEach((feature: AtlasFeature) => fitBounds.extend(feature.geometry.coordinates as [number, number]));
        if (!fitBounds.isEmpty()) map.fitBounds(fitBounds, { padding: 80, maxZoom: 13 });
      }
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Atlas data query failed");
    } finally { setLoading(false); }
  }, [applyData]);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    import("maplibre-gl").then((maplibre) => {
      if (disposed || !container.current) return;
      const map = new maplibre.Map({ container: container.current, style: STYLE[theme], center: [-82.15, 28.05], zoom: 5.35, minZoom: 4, maxZoom: 19, attributionControl: {}, hash: false });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(new maplibre.ScaleControl({ unit: "imperial" }), "bottom-right");
      map.on("load", async () => {
        installDataLayers(map);
        try {
          const response = await fetch("/api/opportunity-intelligence/hub/boundaries", { cache: "force-cache" });
          if (response.ok) {
            const boundaries = await response.json();
            map.addSource("fl-counties", { type: "geojson", data: boundaries });
            map.addLayer({ id: "fl-county-fill", type: "fill", source: "fl-counties", paint: { "fill-color": "#fbbf24", "fill-opacity": 0.015 } }, "oi-density-heat");
            map.addLayer({ id: "fl-county-lines", type: "line", source: "fl-counties", paint: { "line-color": theme === "dark" ? "#8a96a2" : "#334155", "line-opacity": 0.38, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.65, 10, 1.6] } });
          }
        } catch { setNotice("County boundaries unavailable; opportunity layers remain active."); }
        fetchVisible();
      });
      map.on("moveend", () => {
        if (fetchTimer.current) window.clearTimeout(fetchTimer.current);
        fetchTimer.current = window.setTimeout(() => fetchVisible(), 350);
      });
      map.on("click", (event: MapMouseEvent) => {
        if (drawModeRef.current) return;
        const layers = ["oi-points", "oi-regional-points", "oi-properties-points", "oi-permit-points", "oi-equipment-points", "oi-clusters", "oi-property-clusters"].filter((id) => map.getLayer(id));
        const features = map.queryRenderedFeatures(event.point, { layers });
        const feature = features[0];
        if (!feature) { setSelected(null); setInspectorCollapsed(true); return; }
        if (feature.properties?.cluster) { map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom: Math.min(16, map.getZoom() + 2) }); return; }
        setSelected(feature.properties || {}); setInspectorCollapsed(false);
      });
      map.on("mouseenter", "oi-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "oi-points", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", (event) => {
        if (!drawModeRef.current) return;
        drawPoints.current = [...drawPoints.current, [event.lngLat.lng, event.lngLat.lat]];
        setPolygon(drawPoints.current);
        const coordinates = drawPoints.current.length >= 3 ? [[...drawPoints.current, drawPoints.current[0]]] : [];
        (map.getSource("oi-drawn-area") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: coordinates.length ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } }] : [] });
      });
    });
    return () => { disposed = true; if (fetchTimer.current) window.clearTimeout(fetchTimer.current); mapRef.current?.remove(); mapRef.current = null; };
  }, [fetchVisible, installDataLayers, theme]);

  useEffect(() => { applyData(); }, [activeLayers, applyData, polygon, radiusMiles]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const visibility = (id: string, visible: boolean) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    visibility("oi-density-heat", mode === "density"); visibility("oi-value-heat", mode === "value");
    ["oi-clusters", "oi-cluster-count", "oi-points"].forEach((id) => visibility(id, mode === "markers"));
    ["oi-regional-points", "oi-regional-labels"].forEach((id) => visibility(id, mode === "county" || mode === "markers"));
    visibility("oi-properties-points", mode !== "density" && mode !== "value");
  }, [mode, recordCount]);

  const toggleLayer = (id: string) => setActiveLayers((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleCounty = (county: string) => setSelectedCounties((current) => current.includes(county) ? current.filter((item) => item !== county) : [...current, county]);

  const searchLocation = async () => {
    const clean = search.trim(); if (!clean) return;
    const county = FLORIDA_COUNTIES.find((item) => item.name.toLowerCase() === clean.toLowerCase().replace(/ county$/, ""));
    if (county) { mapRef.current?.flyTo({ center: [county.lng, county.lat], zoom: 8 }); if (!selectedCounties.includes(county.name)) setSelectedCounties((current) => [...current, county.name]); return; }
    const response = await fetch(`/api/opportunity-intelligence/hub/opportunities?search=${encodeURIComponent(clean)}&limit=10`);
    const data = await response.json();
    const mapped = data.records?.find((record: { latitude: number | null; longitude: number | null }) => record.latitude !== null && record.longitude !== null);
    if (mapped) mapRef.current?.flyTo({ center: [mapped.longitude, mapped.latitude], zoom: 15 });
    else setNotice(data.total ? `${data.total} matching records have regional or unknown geography; no property pin was fabricated.` : "No indexed address or opportunity matched this search.");
  };

  const clearArea = () => { drawPoints.current = []; setPolygon([]); setRadiusMiles(""); (mapRef.current?.getSource("oi-drawn-area") as GeoJSONSource | undefined)?.setData(EMPTY); };
  const saveArea = async () => {
    if (polygon.length < 3) return;
    await fetch("/api/opportunity-intelligence/hub/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "item", itemType: "region", title: `Atlas area ${new Date().toLocaleDateString()}`, regionGeojson: { type: "Polygon", coordinates: [[...polygon, polygon[0]]] } }) });
    setNotice("Geographic search area saved.");
  };

  const layerCount = useMemo(() => activeLayers.size, [activeLayers]);
  return <div className="relative h-full overflow-hidden bg-[#090c0f]">
    <div ref={container} className="absolute inset-0" aria-label="Intent Atlas interactive Florida opportunity map" />

    <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex min-h-11 items-center justify-between gap-3 border-b border-white/10 bg-[#0a0d10]/92 px-3 backdrop-blur">
      <div className="pointer-events-auto flex items-center gap-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.17em] text-amber-200">Intent Atlas</span><span className="hidden text-[10px] text-[#69737c] sm:inline">{notice}</span></div>
      <div className="pointer-events-auto flex items-center gap-1 overflow-x-auto py-1.5">
        {[['markers','Markers'],['density','Density'],['value','Contract value'],['county','County distribution']].map(([id,label]) => <button key={id} onClick={() => setMode(id)} className={`shrink-0 border px-2.5 py-1 text-[10px] ${mode === id ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-[#101419]/90 text-[#87919a]"}`}>{label}</button>)}
        <button onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} className="border border-white/10 bg-[#101419]/90 px-2.5 py-1 text-[10px] text-[#a7afb6]">{theme === "dark" ? "Light" : "Dark"}</button>
        <button onClick={() => container.current?.parentElement?.requestFullscreen()} className="border border-white/10 bg-[#101419]/90 px-2.5 py-1 text-[10px] text-[#a7afb6]">Full screen</button>
      </div>
    </div>

    <aside className={`absolute bottom-3 left-3 top-14 z-20 flex flex-col border border-white/10 bg-[#0b0f13]/95 shadow-2xl backdrop-blur transition-[width] ${filterCollapsed ? "w-10" : "w-[290px]"}`}>
      <button onClick={() => setFilterCollapsed((value) => !value)} className="flex h-10 items-center justify-between border-b border-white/[0.08] px-3 text-xs text-white"><span className={filterCollapsed ? "hidden" : "block"}>Layers & geography</span><span>{filterCollapsed ? "›" : "‹"}</span></button>
      {!filterCollapsed && <div className="flex-1 overflow-y-auto">
        <div className="border-b border-white/[0.07] p-3"><div className="flex gap-1"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchLocation()} placeholder="Address, ZIP, county…" className="min-w-0 flex-1 border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-300/40" /><button onClick={searchLocation} className="border border-white/10 px-2 text-xs text-amber-200">Find</button></div></div>
        <div className="border-b border-white/[0.07] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-[#727c85]">Geographic controls</span><button onClick={() => setSelectedCounties([])} className="text-[9px] text-[#66717a]">Clear</button></div><details><summary className="cursor-pointer text-xs text-[#a7afb7]">Counties {selectedCounties.length ? `· ${selectedCounties.length} selected` : "· statewide"}</summary><div className="mt-2 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto">{FLORIDA_COUNTIES.map((county) => <label key={county.fips} className="flex items-center gap-1.5 text-[10px] text-[#8f99a1]"><input type="checkbox" checked={selectedCounties.includes(county.name)} onChange={() => toggleCounty(county.name)} className="accent-amber-300" />{county.name}</label>)}</div></details><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => { selectedCountiesRef.current = selectedCounties; fetchVisible(true); }} className="border border-white/10 px-2 py-1.5 text-[10px] text-[#aab2b9]">Apply & fit</button><button onClick={() => fetchVisible()} className="border border-white/10 px-2 py-1.5 text-[10px] text-[#aab2b9]">Visible area</button></div><label className="mt-3 block"><span className="text-[10px] text-[#6f7982]">Radius from map center (miles)</span><input type="number" value={radiusMiles} onChange={(event) => setRadiusMiles(event.target.value)} placeholder="No radius" className="mt-1 w-full border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-white outline-none" /></label><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => { setDrawMode((value) => !value); if (!drawMode) drawPoints.current = []; }} className={`border px-2 py-1.5 text-[10px] ${drawMode ? "border-amber-300/40 text-amber-100" : "border-white/10 text-[#aab2b9]"}`}>{drawMode ? "Finish polygon" : "Draw polygon"}</button><button onClick={clearArea} className="border border-white/10 px-2 py-1.5 text-[10px] text-[#aab2b9]">Clear area</button></div>{polygon.length >= 3 && <button onClick={saveArea} className="mt-2 w-full border border-amber-300/30 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] text-amber-100">Save geographic area</button>}</div>
        {LAYER_GROUPS.map((group) => <div key={group.title} className="border-b border-white/[0.07] p-3"><div className="mb-2 text-[10px] uppercase tracking-wider text-[#727c85]">{group.title}</div><div className="space-y-1.5">{group.items.map(([id,label,color]) => <label key={id} className="flex cursor-pointer items-center justify-between gap-2 text-[11px] text-[#a3abb2]"><span className="flex items-center gap-2"><span className="h-2 w-2" style={{ background: color }} />{label}</span><input type="checkbox" checked={activeLayers.has(id)} onChange={() => toggleLayer(id)} className="accent-amber-300" /></label>)}</div></div>)}
      </div>}
      {!filterCollapsed && <div className="border-t border-white/[0.08] px-3 py-2 font-mono text-[9px] text-[#606a73]">{layerCount} layers · {recordCount.toLocaleString()} mapped · {regionalCount.toLocaleString()} regional</div>}
    </aside>

    <aside className={`absolute bottom-3 right-3 top-14 z-20 border border-white/10 bg-[#0b0f13]/96 shadow-2xl backdrop-blur transition-[width] ${inspectorCollapsed ? "w-10" : "w-[370px]"}`}>
      <button onClick={() => setInspectorCollapsed((value) => !value)} className="flex h-10 w-full items-center justify-between border-b border-white/[0.08] px-3 text-xs text-white"><span>{inspectorCollapsed ? "‹" : selected ? "Record inspector" : "Map inspector"}</span>{!inspectorCollapsed && <span>›</span>}</button>
      {!inspectorCollapsed && <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-4">{selected ? <AtlasInspector selected={selected} /> : <div className="text-xs leading-5 text-[#7a858e]">Select a marker, property, permit, equipment record, or county aggregation to inspect its source-backed details without leaving the map.</div>}</div>}
    </aside>

    {loading && <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 border border-white/10 bg-[#0b0f13]/95 px-3 py-2 font-mono text-[10px] text-amber-100 shadow-xl"><span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse bg-amber-300" />Querying visible geography…</div>}
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-3 border border-white/10 bg-[#0b0f13]/88 px-3 py-2 text-[9px] text-[#a0a8af] backdrop-blur">{Object.entries(classificationMeta).map(([key,value]) => <span key={key} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: value.color }} />{value.label}</span>)}</div>
  </div>;
}

function AtlasInspector({ selected }: { selected: Record<string, unknown> }) {
  const title = String(selected.title || selected.name || selected.situs_address || selected.permit_number || selected.equipment_type || "Selected map record");
  const address = [selected.address || selected.situs_address, selected.city, selected.county, selected.zipCode || selected.zip_code].filter(Boolean).join(", ");
  const sourceUrl = String(selected.sourceUrl || selected.source_url || selected.evidence_url || "");
  const keys = ["classification", "status", "tradeSlug", "serviceCategory", "opportunityCount", "documentedValue", "owner_name_raw", "property_use_description", "building_sqft", "year_built", "equipment_type", "manufacturer", "model", "unit_count", "individual_capacity_tons", "aggregate_capacity_tons", "permit_type", "permit_status", "issue_date", "contractor_name"];
  return <div><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">{String(selected.featureType || "record").replaceAll("_", " ")}</div><h3 className="mt-2 text-lg font-semibold leading-6 text-white">{title}</h3>{address && <p className="mt-2 text-xs leading-5 text-[#939da5]">{address}</p>}<dl className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.07]">{keys.filter((key) => selected[key] !== null && selected[key] !== undefined && selected[key] !== "").map((key) => <div key={key} className="flex justify-between gap-4 py-2 text-[11px]"><dt className="capitalize text-[#69737c]">{key.replaceAll("_", " ")}</dt><dd className="max-w-[55%] text-right text-[#c3c9ce]">{key.toLowerCase().includes("value") && Number(selected[key]) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(selected[key])) : String(selected[key])}</dd></div>)}</dl>{Boolean(selected.classificationRationale) && <div className="mt-4 border-l-2 border-amber-300/35 pl-3 text-xs leading-5 text-[#959fa7]">{String(selected.classificationRationale)}</div>}<div className="mt-5 flex flex-wrap gap-2">{address && <button onClick={() => navigator.clipboard.writeText(address)} className="border border-white/10 px-2.5 py-1.5 text-[10px] text-[#abb3ba]">Copy address</button>}{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="border border-white/10 px-2.5 py-1.5 text-[10px] text-[#abb3ba]">Google Maps</a>}<a href={`https://www.google.com/search?q=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" className="border border-white/10 px-2.5 py-1.5 text-[10px] text-[#abb3ba]">Google Search</a>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="border border-amber-300/30 px-2.5 py-1.5 text-[10px] text-amber-100">Original source</a>}</div><p className="mt-5 text-[9px] leading-4 text-[#59636c]">Property markers use documented coordinates. County-centered symbols are explicitly labeled regional aggregates and never represent a fabricated property location.</p></div>;
}
