-- Migración 036: Unificación de Contenido Externo (external_content) para Link Video
CREATE TABLE IF NOT EXISTS external_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  url TEXT NOT NULL,
  content_id TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  thumbnail TEXT DEFAULT NULL,
  collection_id UUID REFERENCES linkvideo_collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_content_user ON external_content(user_id);
CREATE INDEX IF NOT EXISTS idx_external_content_provider ON external_content(provider);
CREATE INDEX IF NOT EXISTS idx_external_content_status ON external_content(status);
