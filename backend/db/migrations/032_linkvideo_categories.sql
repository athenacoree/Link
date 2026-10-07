-- Migración 032: Añadir columna category a linkvideo_collections
ALTER TABLE linkvideo_collections ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
