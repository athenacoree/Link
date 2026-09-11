-- 005_localidad_dinamica.sql
-- Todo aditivo (sin DROP/TRUNCATE/ALTER destructivo): agrega lo necesario
-- para que la localidad sea una señal fuerte pero dinámica (con memoria y
-- decaimiento), y para poder explicar honestamente en "¿por qué se
-- recomienda?" cuándo una persona NO fue elegida por el algoritmo.

-- ---------- Señales de comportamiento agregadas por localidad ----------
-- Ledger de eventos que alimentan la preferencia dinámica de localidad:
-- búsquedas (incluye buscar directamente por nombre de ciudad), perfiles
-- visitados, tiempo viendo perfiles, likes, solicitudes, mensajes y
-- conexiones. Se guarda cada evento por separado (no se pisa un valor
-- acumulado) para poder calcular un decaimiento exponencial por
-- antigüedad en el momento de leer: así el peso de una localidad baja
-- solo si el usuario deja de interactuar con ella, y sube de nuevo en
-- cuanto vuelve a mostrar interés, sin borrarse de golpe.
CREATE TABLE IF NOT EXISTS discovery_locality_signals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  localidad  TEXT NOT NULL,
  tipo       TEXT NOT NULL, -- 'busqueda' | 'perfil_visto' | 'tiempo_perfil' | 'me_gusta_publicacion'
                             -- | 'comentario' | 'solicitud_enviada' | 'amistad_aceptada' | 'mensaje' | 'llamada'
  peso       NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disc_loc_signals_user ON discovery_locality_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_loc_signals_localidad ON discovery_locality_signals (user_id, localidad);

-- ---------- Metadatos de origen en el historial de "ya te lo mostré" ----------
-- Guardamos de qué bloque salió cada persona mostrada (local / afinidad de
-- otra localidad / exploración aleatoria / cuenta nueva) y qué localidad
-- representaba en ese momento. Esto es lo que le permite a
-- "¿por qué se recomienda?" distinguir a alguien que sí fue elegido por
-- el algoritmo de alguien que apareció en el feed por un cupo fijo
-- (aleatorio o cuenta nueva) o que ni siquiera vino del feed.
ALTER TABLE discovery_shown ADD COLUMN IF NOT EXISTS origen    TEXT;
ALTER TABLE discovery_shown ADD COLUMN IF NOT EXISTS localidad TEXT;

-- ---------- Tiempo visto en cada perfil (para saber cuánto pesar la señal) ----------
CREATE TABLE IF NOT EXISTS profile_view_durations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segundos   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_durations_viewer ON profile_view_durations (viewer_id, created_at DESC);
