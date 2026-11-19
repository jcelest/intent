ALTER TABLE dialer_leads ADD COLUMN IF NOT EXISTS reserved_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL;
ALTER TABLE dialer_leads ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ;
ALTER TABLE dialer_leads ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS dialer_leads_reservation_idx
  ON dialer_leads (reservation_expires_at, reserved_by)
  WHERE reserved_by IS NOT NULL;
