-- Migración 020: Sistema de Enlace Bridge para sincronización de dispositivos Android y acciones nativas
CREATE TABLE IF NOT EXISTS bridge_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_token_hash TEXT NOT NULL,
  bridge_version TEXT DEFAULT '1.0.0',
  capabilities JSONB DEFAULT '{}'::jsonb,
  permissions JSONB DEFAULT '{}'::jsonb,
  push_token TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bridge_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pairing_code VARCHAR(8) NOT NULL UNIQUE,
  device_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bridge_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES bridge_devices(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  target_route TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signature TEXT,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bridge_devices_user ON bridge_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_bridge_pairing_code ON bridge_pairing_codes(pairing_code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_bridge_actions_user_device ON bridge_actions(user_id, device_id);
