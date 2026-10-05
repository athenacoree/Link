-- 028_missions_and_quick_auth.sql
-- Migración para soporte de Onboarding Obligatorio y Sistema de Misiones / Retos

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;

-- Tabla para seguimiento individual de misiones por usuario
CREATE TABLE IF NOT EXISTS user_missions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_key  TEXT NOT NULL,
  progress     INT NOT NULL DEFAULT 0,
  target       INT NOT NULL DEFAULT 1,
  completed    BOOLEAN NOT NULL DEFAULT false,
  claimed      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_user_mission UNIQUE (user_id, mission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions (user_id);

-- Configuración por defecto en system_settings para habilitar misiones a nivel global
INSERT INTO system_settings (key, value, updated_at)
VALUES ('missions_enabled', 'true', now())
ON CONFLICT (key) DO NOTHING;
