-- Migración 033: Añadir columna audio_description a linkvideo_collections y linkvideo_videos
ALTER TABLE linkvideo_collections ADD COLUMN IF NOT EXISTS audio_description TEXT DEFAULT NULL;
ALTER TABLE linkvideo_videos ADD COLUMN IF NOT EXISTS audio_description TEXT DEFAULT NULL;
