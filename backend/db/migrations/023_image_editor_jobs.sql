-- Migración para persistencia de trabajos del editor de imágenes externo

CREATE TABLE IF NOT EXISTS image_editor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  result_data TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_editor_jobs_user_id ON image_editor_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_image_editor_jobs_request_id ON image_editor_jobs(request_id);
