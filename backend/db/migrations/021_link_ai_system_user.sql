-- 021_link_ai_system_user.sql
-- Inserción del usuario de sistema Link AI para persistencia de chats con el asistente

INSERT INTO users (id, name, username, email, password_hash, verified, is_online, bio)
VALUES (
  '00000000-0000-0000-0000-0000000000a1',
  'Link AI',
  'link_ai',
  'ai@link.internal',
  'SYSTEM_BOT_NO_LOGIN',
  true,
  true,
  'Asistente Inteligente de Link'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_online = true;
