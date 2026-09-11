-- 006_reacciones_privadas.sql
-- Todo aditivo (sin DROP/TRUNCATE): reacciones privadas del feed de
-- "Descubrir personas". Se activan con doble toque sobre el bloque de una
-- persona y, opcionalmente, con la mini encuesta de matices que se abre
-- después (😍 🙂 🧠 🎨 😂 💬 🤝 ⚠️ 👎).
--
-- Son SIEMPRE privadas: solo las ve quien las puso (para saber si ya
-- reaccionó a alguien) y el motor de recomendación de ESE mismo usuario.
-- Nunca se muestran al perfil evaluado ni a nadie más, y nunca generan
-- por sí solas una etiqueta pública ni una acción de moderación -- eso
-- sigue viviendo aparte, en "reports" (ver 003_moderacion.sql), y
-- siempre pasa por revisión humana.
--
-- Una fila por (user_id, target_id): tocar dos veces de nuevo o responder
-- la mini encuesta actualiza la reacción existente en vez de acumular
-- filas sueltas; el aprendizaje del algoritmo sobre esa reacción decae
-- con el tiempo a partir de "updated_at" (ver
-- backend/utils/recomendaciones.js, VIDA_MEDIA_AFINIDAD_PERSONAL_DIAS).
CREATE TABLE IF NOT EXISTS profile_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'me_interesa',
  peso        NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_user ON profile_reactions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_target ON profile_reactions (target_id);
