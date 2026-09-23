CREATE TABLE IF NOT EXISTS google_services_state (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'current',
  bootstrap_version INT NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT false,
  project_id VARCHAR(255),
  services JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
