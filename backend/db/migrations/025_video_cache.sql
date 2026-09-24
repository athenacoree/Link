-- Migración para la caché de resultados y metadatos de búsqueda de videos (Pexels, etc.)

CREATE TABLE IF NOT EXISTS video_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'pexels',
  query TEXT NOT NULL,
  orientation TEXT,
  category TEXT,
  results_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_video_search_cache_key ON video_search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_video_search_cache_expires_at ON video_search_cache(expires_at);
