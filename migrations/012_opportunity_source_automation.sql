-- Migration 012: source health alerts, scheduler state, and additional authoritative feeds.

CREATE TABLE IF NOT EXISTS oi_source_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(140) NOT NULL REFERENCES oi_data_sources(id) ON DELETE CASCADE,
  alert_code VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS oi_source_alerts_open_unique
  ON oi_source_alerts(source_id, alert_code) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS oi_source_alerts_active_idx
  ON oi_source_alerts(resolved_at, severity, last_seen_at DESC);

INSERT INTO oi_data_sources (
  id, source_name, source_url, source_category, access_method, data_format,
  update_frequency, geographic_coverage, license_notes, status, is_operational, limitations
) VALUES
  ('ucf-solicitations', 'University of Central Florida Solicitations', 'https://procurement.ucf.edu/solicitations/', 'procurement', 'official_html', 'HTML_and_documents', 'every_6_hours', '{"state":"FL","county":"Orange","institution_type":"university"}'::jsonb, 'Official UCF Procurement Services public solicitation page and attachments.', 'not_connected', FALSE, 'Only rows with a future published bid date are treated as active solicitations. Submission still occurs through the method stated in the original documents.'),
  ('broward-college-forecast', 'Broward College Procurement Forecast', 'https://www.broward.edu/about/community/vendor/forecast-opportunities.html', 'contract_renewals', 'official_html', 'HTML_and_documents', 'daily', '{"state":"FL","county":"Broward","institution_type":"college"}'::jsonb, 'Official Broward College six-month procurement forecast.', 'not_connected', FALSE, 'Forecast dates are estimates. Draft procurements and contract expirations are timing signals, not confirmed open solicitations.')
  ,('fl-administrative-register-bids', 'Florida Administrative Register Section XI', 'https://flrules.org/bigDoc/Default.asp', 'procurement', 'official_html_and_pdf', 'HTML_and_PDF', 'daily', '{"state":"FL","level":"statewide","notice_types":["public_procurement","subcontractor_invitation"]}'::jsonb, 'Official Florida Department of State daily register and Section XI bid notices.', 'not_connected', FALSE, 'The adapter ingests only notices with an explicit future response deadline. Portal registration and referenced agency documents may still be required for submission.')
ON CONFLICT (id) DO UPDATE SET
  source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
  source_category=EXCLUDED.source_category, access_method=EXCLUDED.access_method,
  data_format=EXCLUDED.data_format, update_frequency=EXCLUDED.update_frequency,
  geographic_coverage=EXCLUDED.geographic_coverage, license_notes=EXCLUDED.license_notes,
  limitations=EXCLUDED.limitations, updated_at=CURRENT_TIMESTAMP;

INSERT INTO oi_source_sync_state (source_id, adapter_key, schedule_minutes, stale_after_minutes) VALUES
  ('ucf-solicitations', 'ucf-solicitations', 360, 720),
  ('broward-college-forecast', 'broward-college-forecast', 1440, 2880)
  ,('fl-administrative-register-bids', 'fl-administrative-register-bids', 1440, 2880)
ON CONFLICT (source_id) DO UPDATE SET
  adapter_key=EXCLUDED.adapter_key, schedule_minutes=EXCLUDED.schedule_minutes,
  stale_after_minutes=EXCLUDED.stale_after_minutes, enabled=TRUE, updated_at=CURRENT_TIMESTAMP;
