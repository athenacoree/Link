-- Migración 035: Etiquetas Ocultas y Recomendaciones Personalizadas para Link Video y Reels
ALTER TABLE linkvideo_collections ADD COLUMN IF NOT EXISTS hidden_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE linkvideo_videos ADD COLUMN IF NOT EXISTS hidden_tags JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS user_video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  collection_id TEXT,
  is_reel BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]'::jsonb,
  view_count INT DEFAULT 1,
  last_viewed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_video_views_user ON user_video_views(user_id, last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_video_views_user_reel ON user_video_views(user_id, is_reel);
