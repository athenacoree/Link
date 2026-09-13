-- 012_fix_conversations_and_views.sql
-- Garantiza consistencia en conversaciones, profile_views y metadatos de mensajería.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  pinned_message_id UUID DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compatibilidad de columnas en profile_views
ALTER TABLE profile_views ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE profile_views ADD COLUMN IF NOT EXISTS viewed_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE profile_views ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Columna Live Photo y metadatos extra en mensajes y publicaciones
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_live_photo BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_live_photo BOOLEAN DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_live_photo BOOLEAN DEFAULT false;
