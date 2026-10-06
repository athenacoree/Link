-- 030_youtube_channels.sql
-- Tabla para la gestión de canales de YouTube incrustados en Link Video

CREATE TABLE IF NOT EXISTS youtube_channels (
  channel_id VARCHAR(50) PRIMARY KEY,
  channel_name VARCHAR(100) NOT NULL,
  video_id VARCHAR(50) NULL,
  title TEXT DEFAULT '',
  started_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Canales por defecto
INSERT INTO youtube_channels (channel_id, channel_name, is_active)
VALUES
  ('principal', 'Canal Principal', false),
  ('musica', 'Canal Música', false),
  ('cine', 'Canal Cine', false),
  ('entretenimiento', 'Canal Entretenimiento', false)
ON CONFLICT (channel_id) DO NOTHING;
