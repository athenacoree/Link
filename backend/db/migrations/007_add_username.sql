-- 007_add_username.sql
-- Agrega la columna username a la tabla users y su índice único insensible a mayúsculas/minúsculas.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username)) WHERE username IS NOT NULL;
