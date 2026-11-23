import { sql } from "@/lib/db";

export interface SavedViewRecord {
  id: string;
  name: string;
  overlay_client_id: string | null;
  filters: Record<string, unknown>;
  created_at: string;
}

/**
 * Auto-generates or refreshes one default home territory view per registered client.
 */
export async function ensureAutoClientSavedViews(): Promise<void> {
  try {
    const clients = await sql`
      SELECT id, name, trades, service_areas, capacity_notes
      FROM trade_demand_clients
      ORDER BY name ASC
    `;

    for (const c of clients as Array<Record<string, unknown>>) {
      const clientId = String(c.id);
      const clientName = String(c.name);
      const viewName = `${clientName}: Home Territory`;
      const serviceAreas = Array.isArray(c.service_areas) ? (c.service_areas as string[]).join(", ") : "";

      const defaultFilters = {
        county: "all",
        city: "",
        zip: "",
        territory: serviceAreas,
        channel: "all",
        tonnageRisk: "all",
        verification: "all",
        hasWebsite: "all",
        minReviews: "",
        entityStatus: "all",
        licenseType: "all",
        permitWithinDays: "all",
        searchQuery: "",
        needsReviewOnly: false,
        hideExistingAccounts: false,
        mode: "call_list",
      };

      // Check if view already exists for this client's home territory
      const existing = await sql`
        SELECT id FROM saved_views
        WHERE overlay_client_id = ${clientId} AND name = ${viewName}
        LIMIT 1
      `;

      if (existing.length === 0) {
        await sql`
          INSERT INTO saved_views (name, overlay_client_id, filters, created_at, updated_at)
          VALUES (${viewName}, ${clientId}, ${JSON.stringify(defaultFilters)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      } else {
        // Keep filters updated with latest service areas
        await sql`
          UPDATE saved_views
          SET filters = jsonb_set(filters, '{territory}', to_jsonb(${serviceAreas}::text)),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${String(existing[0].id)}
        `;
      }
    }
  } catch (err) {
    console.error("Failed auto-generating client saved views:", err);
  }
}

/**
 * Retrieves all saved views (auto-client views first, then custom saved views)
 */
export async function getSavedViews(): Promise<SavedViewRecord[]> {
  await ensureAutoClientSavedViews();

  const rows = await sql`
    SELECT id, name, overlay_client_id, filters, created_at
    FROM saved_views
    ORDER BY overlay_client_id NULLS LAST, created_at DESC
  `;

  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    overlay_client_id: r.overlay_client_id ? String(r.overlay_client_id) : null,
    filters: (r.filters as Record<string, unknown>) || {},
    created_at: new Date(String(r.created_at)).toISOString(),
  }));
}

/**
 * Saves a new custom view
 */
export async function createSavedView(params: {
  name: string;
  overlayClientId?: string | null;
  filters: Record<string, unknown>;
}): Promise<SavedViewRecord> {
  const rows = await sql`
    INSERT INTO saved_views (name, overlay_client_id, filters, created_at, updated_at)
    VALUES (${params.name}, ${params.overlayClientId || null}, ${JSON.stringify(params.filters)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id, name, overlay_client_id, filters, created_at
  `;

  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    name: String(r.name),
    overlay_client_id: r.overlay_client_id ? String(r.overlay_client_id) : null,
    filters: (r.filters as Record<string, unknown>) || {},
    created_at: new Date(String(r.created_at)).toISOString(),
  };
}

/**
 * Deletes a saved view
 */
export async function deleteSavedView(id: string): Promise<boolean> {
  const res = await sql`DELETE FROM saved_views WHERE id = ${id}`;
  return res.length >= 0;
}
