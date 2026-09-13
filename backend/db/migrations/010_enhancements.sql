-- 010_enhancements.sql
-- Migración aditiva para soporte de 20 mejoras: reacciones a mensajes, notas de voz, vistos (read_at),
-- respuestas/citar mensajes, borrado de mensajes, visitas a perfiles, visibilidad de publicaciones y marcadores.

-- ---------- Ajustes en Usuarios ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;

-- ---------- Ajustes en Mensajes ----------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_data TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_all BOOLEAN DEFAULT false;

-- ---------- Ajustes en Publicaciones y Guardados ----------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id, saved_at DESC);

-- ---------- Contador de Visitas a Perfil ----------
CREATE TABLE IF NOT EXISTS profile_views (
  profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, viewer_id)
);
