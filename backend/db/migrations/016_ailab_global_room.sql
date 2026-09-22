-- 016_ailab_global_room.sql
-- Tabla y configuraciones de sistema para la sala global y permanente de Laboratorio IA

CREATE TABLE IF NOT EXISTS ailab_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_type VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' | 'ai'
  sender_id UUID NULL,
  sender_name VARCHAR(100) NOT NULL,
  sender_avatar TEXT DEFAULT '',
  text TEXT DEFAULT '',
  image_url TEXT DEFAULT NULL,
  attachments JSONB DEFAULT NULL,
  tool_result JSONB DEFAULT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ailab_messages_created ON ailab_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ailab_messages_not_deleted ON ailab_messages(is_deleted);

-- Configuraciones iniciales en system_settings para el Laboratorio IA Global
INSERT INTO system_settings (key, value, updated_at)
VALUES
  ('ailab_room_title', '🧪 Laboratorio IA Global', NOW()),
  ('ailab_room_subtitle', 'Sala viva de interacción continua, herramientas y multimedia', NOW()),
  ('ailab_auto_enabled', 'true', NOW()),
  ('ailab_auto_paused', 'false', NOW()),
  ('ailab_auto_interval_sec', '30', NOW()),
  ('ailab_auto_max_consecutive_turns', '10', NOW()),
  ('ailab_auto_consecutive_counter', '0', NOW()),
  ('ailab_retention_days', '0', NOW())
ON CONFLICT (key) DO NOTHING;
