-- 001_init.sql
-- Crea el esquema base de Enlace. Totalmente aditivo: todo usa
-- "IF NOT EXISTS" para poder correr de forma segura sobre una base
-- de datos que Render crea automáticamente y que puede o no tener
-- ya algo de esquema previo.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Usuarios / perfiles ----------
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  name               TEXT NOT NULL,
  phone              TEXT,
  birthdate          DATE,
  gender             TEXT,
  skin_color         TEXT,
  relationship_status TEXT,
  profession         TEXT,
  bio                TEXT,
  city               TEXT,
  country            TEXT DEFAULT 'Cuba',
  flag_emoji         TEXT DEFAULT '🇨🇺',
  avatar_data        TEXT,        -- imagen en base64 (data URL), vive en Postgres
  cover_data         TEXT,        -- imagen de portada en base64
  status_text        TEXT,        -- "pensando en..." etc.
  status_updated_at  TIMESTAMPTZ,
  is_online          BOOLEAN NOT NULL DEFAULT false,
  last_seen_at       TIMESTAMPTZ,
  extra              JSONB NOT NULL DEFAULT '{}'::jsonb, -- campos flexibles futuros
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_name ON users USING gin (to_tsvector('spanish', coalesce(name,'')));
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city);

-- ---------- Amistades ----------
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | amigos | rechazada
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_pair UNIQUE (user_a, user_b),
  CONSTRAINT ordered_pair CHECK (user_a < user_b)
);
CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships (user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships (user_b);

-- ---------- Publicaciones ----------
CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT,
  image_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments (post_id, created_at);

-- ---------- Estados / historias (se autodestruyen a las 24h) ----------
CREATE TABLE IF NOT EXISTS stories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT,
  image_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_expira ON stories (expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_views (
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

-- ---------- Notificaciones (usa JSONB para datos flexibles por tipo) ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT NOT NULL, -- solicitud_amistad | amistad_aceptada | like | comentario | llamada_perdida | mensaje
  text       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, created_at DESC);

-- ---------- Registro de llamadas (metadata en JSONB) ----------
CREATE TABLE IF NOT EXISTS calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type   TEXT NOT NULL DEFAULT 'audio', -- audio | video
  status      TEXT NOT NULL DEFAULT 'iniciada', -- iniciada | conectada | rechazada | perdida | finalizada
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls (callee_id, created_at DESC);

-- ---------- Sesiones de contacto verificado (vCard / contactos reales) ----------
CREATE TABLE IF NOT EXISTS contact_verifications (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified    BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);
