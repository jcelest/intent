"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

export function AtlasPreview() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let disposed = false;
    import("maplibre-gl").then(async (maplibre) => {
      if (disposed || !container.current) return;
      const map = new maplibre.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/dark", center: [-82.15, 28.05], zoom: 5.25, minZoom: 4, maxZoom: 16, attributionControl: {}, cooperativeGestures: true });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-left");
      map.on("load", async () => {
        const [atlasResponse, boundaryResponse] = await Promise.all([
          fetch("/api/opportunity-intelligence/hub/atlas?layers=opportunities,solicitations,renewals,relationships", { cache: "no-store" }),
          fetch("/api/opportunity-intelligence/hub/boundaries", { cache: "force-cache" }),
        ]);
        const atlas = atlasResponse.ok ? (await atlasResponse.json()).data : { type: "FeatureCollection", features: [] };
        const boundaries = boundaryResponse.ok ? await boundaryResponse.json() : { type: "FeatureCollection", features: [] };
        if (!map.getSource("counties")) map.addSource("counties", { type: "geojson", data: boundaries });
        map.addLayer({ id: "preview-counties", type: "line", source: "counties", paint: { "line-color": "#8b98a5", "line-opacity": 0.32, "line-width": 0.8 } });
        const opportunities = { type: "FeatureCollection", features: atlas.features.filter((feature: { properties?: { featureType?: string } }) => feature.properties?.featureType === "opportunity") } as GeoJSON.FeatureCollection;
        const regional = { type: "FeatureCollection", features: atlas.features.filter((feature: { properties?: { featureType?: string } }) => feature.properties?.featureType === "regional_aggregate") } as GeoJSON.FeatureCollection;
        map.addSource("preview-opportunities", { type: "geojson", data: opportunities, cluster: true, clusterRadius: 55 });
        map.addLayer({ id: "preview-heat", type: "heatmap", source: "preview-opportunities", maxzoom: 9, paint: { "heatmap-weight": 1, "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.5], "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.25, "#64748b", 0.5, "#0ea5e9", 0.75, "#f59e0b", 1, "#34d399"], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 9, 30], "heatmap-opacity": 0.76 } });
        map.addSource("preview-regional", { type: "geojson", data: regional });
        map.addLayer({ id: "preview-regional-points", type: "circle", source: "preview-regional", paint: { "circle-radius": ["interpolate", ["linear"], ["get", "opportunityCount"], 1, 5, 100, 16], "circle-color": ["match", ["get", "classification"], "confirmed", "#34d399", "timing_based", "#fbbf24", "asset_based", "#38bdf8", "relationship", "#a78bfa", "#94a3b8"], "circle-opacity": 0.75, "circle-stroke-color": "#0b0e11", "circle-stroke-width": 1.5 } });
      });
    });
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  return <div ref={container} className="h-[430px] w-full" aria-label="Interactive Florida opportunity map preview" />;
}
