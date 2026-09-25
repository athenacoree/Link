-- 026_multimedia_experiences.sql
-- Experiencias Multimedia e Interactivas con Timeline de IA en Enlace

CREATE TABLE IF NOT EXISTS ailab_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  content_type VARCHAR(50) NOT NULL DEFAULT 'video', -- 'video' | 'audio' | 'book'
  content_url TEXT DEFAULT '',
  raw_text TEXT DEFAULT '',
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ailab_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES ailab_experiences(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT DEFAULT 300,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled' | 'live' | 'ended' | 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ailab_event_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ailab_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(100) DEFAULT 'Usuario',
  interaction_type VARCHAR(50) NOT NULL, -- 'poll_vote' | 'question_answer' | 'reaction'
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ailab_events_scheduled ON ailab_events(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ailab_events_status ON ailab_events(status);
CREATE INDEX IF NOT EXISTS idx_ailab_interactions_event ON ailab_event_interactions(event_id);
