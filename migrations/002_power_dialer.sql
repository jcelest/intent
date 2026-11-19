CREATE TABLE IF NOT EXISTS dialer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(80) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  email VARCHAR(320),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'agent')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS dialer_users_username_unique_idx
  ON dialer_users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS dialer_users_email_unique_idx
  ON dialer_users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS dialer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dialer_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_agent_hash VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dialer_sessions_user_idx ON dialer_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS dialer_sessions_expiry_idx ON dialer_sessions (expires_at);

CREATE TABLE IF NOT EXISTS dialer_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL DEFAULT '#14b8a6',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dialer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(160),
  last_name VARCHAR(160),
  company VARCHAR(240),
  title VARCHAR(180),
  phone_e164 VARCHAR(32) NOT NULL,
  phone_raw VARCHAR(80),
  email VARCHAR(320),
  city VARCHAR(160),
  state VARCHAR(80),
  postal_code VARCHAR(30),
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/New_York',
  status VARCHAR(30) NOT NULL DEFAULT 'to_call'
    CHECK (status IN ('to_call', 'try_again', 'follow_up', 'closed')),
  disposition VARCHAR(40)
    CHECK (disposition IS NULL OR disposition IN (
      'no_answer', 'voicemail', 'busy', 'failed', 'contacted', 'interested',
      'callback', 'appointment', 'not_interested', 'wrong_number', 'dnc', 'converted'
    )),
  assigned_user_id UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  source VARCHAR(160),
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  call_attempts INTEGER NOT NULL DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  next_call_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  do_not_call BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dialer_leads_queue_idx
  ON dialer_leads (do_not_call, status, next_call_at, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS dialer_leads_assignee_idx
  ON dialer_leads (assigned_user_id, status, next_call_at);
CREATE INDEX IF NOT EXISTS dialer_leads_phone_idx ON dialer_leads (phone_e164);
CREATE INDEX IF NOT EXISTS dialer_leads_company_idx ON dialer_leads (LOWER(company));

CREATE TABLE IF NOT EXISTS dialer_list_members (
  list_id UUID NOT NULL REFERENCES dialer_lists(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES dialer_leads(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, lead_id)
);

CREATE TABLE IF NOT EXISTS dialer_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES dialer_leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  from_number VARCHAR(32),
  to_number VARCHAR(32) NOT NULL,
  twilio_parent_call_sid VARCHAR(64),
  twilio_call_sid VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  disposition VARCHAR(40),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_sid VARCHAR(64),
  recording_url TEXT,
  callback_sequence INTEGER NOT NULL DEFAULT -1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS dialer_calls_twilio_call_unique_idx
  ON dialer_calls (twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS dialer_calls_lead_idx ON dialer_calls (lead_id, started_at DESC);
CREATE INDEX IF NOT EXISTS dialer_calls_user_idx ON dialer_calls (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS dialer_calls_status_idx ON dialer_calls (status, started_at DESC);

CREATE TABLE IF NOT EXISTS dialer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES dialer_leads(id) ON DELETE CASCADE,
  assigned_user_id UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  task_type VARCHAR(30) NOT NULL DEFAULT 'follow_up'
    CHECK (task_type IN ('follow_up', 'callback', 'general')),
  title VARCHAR(240) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'canceled')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dialer_tasks_queue_idx
  ON dialer_tasks (assigned_user_id, status, due_at);

CREATE TABLE IF NOT EXISTS dialer_dnc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 VARCHAR(32) NOT NULL UNIQUE,
  reason TEXT,
  source VARCHAR(80) NOT NULL DEFAULT 'manual',
  requested_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dialer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES dialer_leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  activity_type VARCHAR(60) NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dialer_activities_lead_idx
  ON dialer_activities (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dialer_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dialer_settings (
  key VARCHAR(120) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES dialer_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO dialer_settings (key, value)
VALUES
  ('workspace', '{"name":"Intent Dialer","timezone":"America/New_York","callWindowStart":"08:00","callWindowEnd":"20:00","maxDailyAttempts":3}'::jsonb),
  ('twilio', '{"recordingEnabled":false,"inboundMode":"ring_agents"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

