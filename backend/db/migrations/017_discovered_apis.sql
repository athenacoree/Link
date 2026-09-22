-- 017_discovered_apis.sql
-- Tabla para registrar APIs dinámicas descubiertas

CREATE TABLE IF NOT EXISTS discovered_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  source VARCHAR(100) DEFAULT 'Dynamic Engine',
  description TEXT DEFAULT '',
  base_url TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  params_schema JSONB DEFAULT '{}'::jsonb,
  auth_type VARCHAR(50) DEFAULT 'none',
  auth_key_header VARCHAR(100) DEFAULT NULL,
  auth_key_value TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  call_count INTEGER DEFAULT 0,
  last_called_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_discovered_apis_name_endpoint UNIQUE (name, endpoint_path)
);

CREATE INDEX IF NOT EXISTS idx_discovered_apis_active ON discovered_apis(is_active);
