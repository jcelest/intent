import {
  getAtlasData,
  getHubOverview,
  getMarketAnalytics,
  getSourceCoverage,
  getTaxonomy,
  queryOpportunities,
} from "../src/lib/opportunity-hub";

async function main() {
  const [overview, opportunities, atlas, portfolioAtlas, maintenanceRecords, taxonomy, sources, analytics] = await Promise.all([
    getHubOverview(),
    queryOpportunities({ limit: 10 }),
    getAtlasData({ layers: ["opportunities", "properties", "permits", "equipment"] }),
    getAtlasData({ layers: ["portfolios"] }),
    queryOpportunities({ search: "maintenance", classifications: ["relationship"], limit: 25 }),
    getTaxonomy(),
    getSourceCoverage(),
    getMarketAnalytics(),
  ]);

  if (overview.commercialProperties < 1) throw new Error("Existing commercial properties were not preserved in overview analytics.");
  if (taxonomy.length < 50) throw new Error("Taxonomy API returned incomplete reference data.");
  if (sources.countyRegistry.length !== 67) throw new Error("Source coverage did not return all 67 counties.");
  if (opportunities.total !== 0 && opportunities.records.length === 0) throw new Error("Opportunity pagination returned an inconsistent total.");
  if (atlas.type !== "FeatureCollection") throw new Error("Atlas did not return GeoJSON.");
  if (atlas.metadata.documentedLocations < 1) throw new Error("Atlas did not return any documented map locations.");
  const portfolioSample = portfolioAtlas.features.find((feature) => {
    const properties = feature.properties as Record<string, unknown>;
    return properties.featureType === "portfolio" && Number(properties.portfolioFloor || 0) > 0;
  });
  if (!portfolioSample) throw new Error("Atlas portfolio layer did not return a source-backed portfolio size.");
  const portfolioProperties = portfolioSample.properties as Record<string, unknown>;
  if (!maintenanceRecords.records.some((record) => record.sourceType === "maintenance_intelligence" && record.classification === "relationship")) throw new Error("Explorer did not return maintenance intelligence as relationship evidence.");
  if (overview.mappedRecords < 1) throw new Error("Overview did not report any mapped opportunity records.");
  if (!analytics.overview) throw new Error("Market analytics did not return overview statistics.");

  console.log(JSON.stringify({
    ok: true,
    overview,
    opportunityPage: { total: opportunities.total, returned: opportunities.records.length },
    atlas: atlas.metadata,
    portfolioInspectorSample: { title: portfolioProperties.title, portfolioFloor: portfolioProperties.portfolioFloor, portfolioTier: portfolioProperties.portfolioTier },
    maintenanceExplorer: { total: maintenanceRecords.total, returned: maintenanceRecords.records.length },
    taxonomy: taxonomy.length,
    countyCoverage: sources.countyRegistry.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
