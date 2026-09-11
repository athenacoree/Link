-- 008_creador_phone_links.sql
-- Agrega columnas para creador, código de país, teléfono internacional y redes sociales.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_creador BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+53';
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS other_links JSONB DEFAULT '{}'::jsonb;

-- Marca cuentas admin existentes como creadores y verificadas
UPDATE users SET is_creador = true, verified = true WHERE is_admin = true;
