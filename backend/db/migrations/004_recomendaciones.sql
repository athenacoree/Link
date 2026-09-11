-- 004_recomendaciones.sql
-- Todo aditivo (sin DROP/TRUNCATE): agrega lo necesario para la encuesta
-- inicial de intereses y el sistema de recomendación de "Descubrir
-- personas". No modifica ni borra nada de lo existente.

-- ---------- Encuesta de intereses (opcional) en el propio perfil ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests            JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hobbies              JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discovery_prefs      JSONB NOT NULL DEFAULT '{}'::jsonb; -- ej: {"buscando":"amistad","rango_edad":[18,99]}
ALTER TABLE users ADD COLUMN IF NOT EXISTS encuesta_completada_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encuesta_omitida     BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING gin (interests);
CREATE INDEX IF NOT EXISTS idx_users_hobbies ON users USING gin (hobbies);

-- ---------- Perfiles visitados (señal de comportamiento) ----------
CREATE TABLE IF NOT EXISTS profile_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views (viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON profile_views (viewed_id);

-- ---------- Señales genéricas de interacción entre dos personas ----------
-- (perfil_visto, solicitud_enviada, amistad_aceptada, mensaje, llamada,
--  me_gusta_publicacion, comentario, bloqueo, reporte...). "peso" puede
-- ser negativo (bloqueos/reportes) para que el algoritmo aprenda a NO
-- recomendar a esa persona de nuevo.
CREATE TABLE IF NOT EXISTS discovery_signals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  peso       NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disc_signals_user ON discovery_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_signals_target ON discovery_signals (target_id);

-- ---------- Historial de a quién ya se le mostró cada usuario en el feed ----------
-- Sirve para no repetir siempre a las mismas personas y darle prioridad
-- a los perfiles que todavía no ha visto.
CREATE TABLE IF NOT EXISTS discovery_shown (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shown_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shown_count   INTEGER NOT NULL DEFAULT 1,
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shown_id)
);
CREATE INDEX IF NOT EXISTS idx_disc_shown_user ON discovery_shown (user_id, last_shown_at);
