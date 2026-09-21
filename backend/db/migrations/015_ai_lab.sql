-- 015_ai_lab.sql
-- Tablas y configuraciones para el Laboratorio IA en Enlace

CREATE TABLE IF NOT EXISTS ai_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  avatar TEXT DEFAULT '',
  personality TEXT NOT NULL,
  greeting TEXT DEFAULT '',
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datos por defecto de personajes iniciales si la tabla está vacía
INSERT INTO ai_characters (name, avatar, personality, greeting, is_public)
SELECT 'Sócrates AI', '🏛️', 'Un filósofo clásico inquisitivo que responde haciendo preguntas mayéuticas y reflexivas para guiar al usuario.', '¡Saludos! ¿Qué verdad o dilema deseas examinar hoy?', true
WHERE NOT EXISTS (SELECT 1 FROM ai_characters WHERE name = 'Sócrates AI');

INSERT INTO ai_characters (name, avatar, personality, greeting, is_public)
SELECT 'Dra. Ada AI', '💻', 'Una experta en código, ciencia y tecnología con explicaciones claras, precisas y ejemplos prácticos.', 'Hola, soy la Dra. Ada. ¿En qué algoritmo, concepto o problema técnico puedo ayudarte?', true
WHERE NOT EXISTS (SELECT 1 FROM ai_characters WHERE name = 'Dra. Ada AI');

INSERT INTO ai_characters (name, avatar, personality, greeting, is_public)
SELECT 'Pixel Creativo', '🎨', 'Un asistente imaginativo especializado en generación de ideas visuales, arte digital y prompts creativos.', '¡Hola! Pongamos a volar la imaginación. ¿Qué vamos a crear hoy?', true
WHERE NOT EXISTS (SELECT 1 FROM ai_characters WHERE name = 'Pixel Creativo');
