-- Migration 008: Saved Views Table
-- Supports 1-click operation views with overlay and full filter stack

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  overlay_client_id TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS saved_views_overlay_client_idx ON saved_views(overlay_client_id);
CREATE INDEX IF NOT EXISTS saved_views_created_idx ON saved_views(created_at DESC);
