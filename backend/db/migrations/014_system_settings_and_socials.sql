-- 014_system_settings_and_socials.sql
-- Tablas y columnas para configuración del sistema (AI OpenRouter) y redes sociales / juegos del usuario.

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{
  "whatsapp": "",
  "telegram": "",
  "instagram": "",
  "discord": "",
  "freefire": "",
  "clashofclans": "",
  "callofduty": "",
  "otros": ""
}'::jsonb;
