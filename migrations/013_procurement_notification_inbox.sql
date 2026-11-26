-- Migration 013: durable inbound procurement notifications from vendor portals.

CREATE TABLE IF NOT EXISTS oi_inbound_procurement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL DEFAULT 'resend',
  provider_message_id TEXT NOT NULL,
  webhook_event_id TEXT,
  internet_message_id TEXT,
  portal_source VARCHAR(40) NOT NULL DEFAULT 'unknown'
    CHECK (portal_source IN ('opengov', 'demandstar', 'unknown')),
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  body_text TEXT,
  body_html TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  webhook_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  opportunity_ids UUID[] NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'needs_review', 'ignored', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  alert_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (alert_status IN ('pending', 'sent', 'not_configured', 'failed', 'not_applicable')),
  alert_provider_id TEXT,
  alert_attempt_count INTEGER NOT NULL DEFAULT 0,
  alert_last_error TEXT,
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_message_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS oi_inbound_procurement_webhook_event_unique
  ON oi_inbound_procurement_messages(webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oi_inbound_procurement_processing_idx
  ON oi_inbound_procurement_messages(status, next_attempt_at, lease_until);
CREATE INDEX IF NOT EXISTS oi_inbound_procurement_alert_idx
  ON oi_inbound_procurement_messages(alert_status, processed_at)
  WHERE status = 'processed';
CREATE INDEX IF NOT EXISTS oi_inbound_procurement_received_idx
  ON oi_inbound_procurement_messages(received_at DESC);

INSERT INTO oi_data_sources (
  id, source_name, source_url, source_category, access_method, data_format,
  update_frequency, geographic_coverage, license_notes, status, is_operational, limitations
) VALUES
  (
    'portal-notice-opengov', 'OpenGov Vendor Notifications',
    'https://procurement.opengov.com/', 'procurement', 'authenticated_vendor_notification',
    'email_and_attachments', 'event_driven',
    '{"state":"FL","coverage":"subscribed_public_agencies"}'::jsonb,
    'Vendor notifications are ingested only from allowed senders through a signature-verified email webhook.',
    'not_connected', FALSE,
    'Coverage depends on the agencies and commodity categories selected in the vendor account. A notice is not a substitute for checking the linked official portal before submission.'
  ),
  (
    'portal-notice-demandstar', 'DemandStar Vendor Notifications',
    'https://www.demandstar.com/', 'procurement', 'authenticated_vendor_notification',
    'email_and_attachments', 'event_driven',
    '{"state":"FL","coverage":"subscribed_public_agencies"}'::jsonb,
    'Vendor notifications are ingested only from allowed senders through a signature-verified email webhook.',
    'not_connected', FALSE,
    'Coverage depends on the agencies, plan, and commodity categories selected in the vendor account. A notice is not a substitute for checking the linked official portal before submission.'
  )
ON CONFLICT (id) DO UPDATE SET
  source_name=EXCLUDED.source_name,
  source_url=EXCLUDED.source_url,
  source_category=EXCLUDED.source_category,
  access_method=EXCLUDED.access_method,
  data_format=EXCLUDED.data_format,
  update_frequency=EXCLUDED.update_frequency,
  geographic_coverage=EXCLUDED.geographic_coverage,
  license_notes=EXCLUDED.license_notes,
  limitations=EXCLUDED.limitations,
  updated_at=CURRENT_TIMESTAMP;

COMMENT ON TABLE oi_inbound_procurement_messages IS
  'Durable, idempotent queue of signature-verified inbound procurement emails. Email content is parsed deterministically and never treated as executable instructions.';
