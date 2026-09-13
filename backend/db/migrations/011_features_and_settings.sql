-- 011_features_and_settings.sql
-- Migración aditiva para 20 nuevas funciones, 20 mejoras y 10 configuraciones del usuario.

-- ---------- Configuraciones del Usuario y Perfil ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "privacy_profile": "public",
  "privacy_requests": "everyone",
  "show_online_status": true,
  "notification_sounds": true,
  "read_receipts": true,
  "autoplay_voice_notes": false,
  "visual_density": "normal",
  "default_story_duration": 24,
  "date_format": "es-CU",
  "language": "es"
}'::jsonb;

-- ---------- Favoritos en Amigos ----------
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- ---------- Duración personalizable de Historias / Estados ----------
ALTER TABLE stories ADD COLUMN IF NOT EXISTS duration_hours INT DEFAULT 24;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours');

-- ---------- Reacciones Multiemoji en Publicaciones ----------
CREATE TABLE IF NOT EXISTS post_emoji_reactions (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '👍',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_emoji_reactions_post ON post_emoji_reactions(post_id);

-- ---------- Respuestas a Comentarios (Hilos) ----------
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id UUID DEFAULT NULL REFERENCES post_comments(id) ON DELETE CASCADE;

-- ---------- Mensajes Fijados y Silenciar Conversaciones ----------
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  pinned_message_id UUID DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id UUID DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS muted_conversations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);
