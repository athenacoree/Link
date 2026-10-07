-- Migración 034: Caché persistente de subtítulos para Link Video
CREATE TABLE IF NOT EXISTS video_subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR(255) NOT NULL,
  language_code VARCHAR(32) NOT NULL DEFAULT 'es',
  status VARCHAR(32) NOT NULL DEFAULT 'ready',
  cues JSONB NOT NULL DEFAULT '[]'::jsonb,
  source VARCHAR(64) NOT NULL DEFAULT 'youtube_extractor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_subtitles_video_lang_key UNIQUE (video_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_video_subtitles_video_id ON video_subtitles(video_id);
