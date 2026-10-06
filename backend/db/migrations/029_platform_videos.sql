-- Migración aditiva: Tabla de Videos de la Plataforma (Pantalla de Carga / Splash Screen, Intermisiones, etc.)
CREATE TABLE IF NOT EXISTS platform_videos (
  id SERIAL PRIMARY KEY,
  slot VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  video_data BYTEA,
  mime_type VARCHAR(50) NOT NULL DEFAULT 'video/mp4',
  filename VARCHAR(255),
  file_size BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_videos_slot ON platform_videos(slot);
