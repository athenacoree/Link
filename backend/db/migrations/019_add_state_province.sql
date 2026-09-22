-- 019_add_state_province.sql
-- Agrega columna para el estado, provincia o región del usuario.

ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
