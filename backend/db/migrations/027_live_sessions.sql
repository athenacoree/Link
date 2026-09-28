-- 027_live_sessions.sql
-- Tabla para gestionar transmisiones en vivo persistentes de Link Video/Live

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  status VARCHAR(30) NOT NULL DEFAULT 'LIVE',
  viewer_count INT NOT NULL DEFAULT 0,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON live_sessions(host_id);
