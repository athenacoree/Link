-- Migración 031: Colecciones y Videos para Link Video
CREATE TABLE IF NOT EXISTS linkvideo_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cover_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkvideo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES linkvideo_collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_id TEXT NOT NULL,
  original_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkvideo_videos_collection ON linkvideo_videos(collection_id, position ASC);
