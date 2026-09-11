-- 002_conversations_meta.sql
-- Ejemplo de migración futura puramente aditiva: agrega una tabla
-- ligera en Postgres para llevar metadatos de conversaciones
-- (los MENSAJES en sí viven en MongoDB Atlas; aquí solo guardamos
-- quién conversa con quién y cuándo fue el último mensaje, para
-- poder listar rápido la bandeja de entrada sin pegarle a Mongo
-- en cada carga del feed).

CREATE TABLE IF NOT EXISTS conversation_meta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uniq_conv_pair UNIQUE (user_a, user_b),
  CONSTRAINT ordered_conv_pair CHECK (user_a < user_b)
);
CREATE INDEX IF NOT EXISTS idx_conv_meta_a ON conversation_meta (user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_meta_b ON conversation_meta (user_b, last_message_at DESC);

-- Si en el futuro un usuario ya tiene la columna, esto no falla:
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
