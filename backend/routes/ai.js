const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function getAISettings() {
  const config = {
    openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
    openrouter_model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    ai_name: 'Link AI',
    ai_avatar: '',
    ai_personality: 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión.',
    ai_max_tokens: '1000',
    ai_context_tokens: '4000',
  };

  try {
    const { rows } = await query(`SELECT key, value FROM system_settings WHERE key IN ('openrouter_api_key', 'openrouter_model', 'ai_name', 'ai_avatar', 'ai_personality', 'ai_max_tokens', 'ai_context_tokens')`);
    rows.forEach(r => {
      if (r.value) config[r.key] = r.value;
    });
  } catch (err) {
    // Si no se puede leer system_settings (ej. antes de migración), usa defaults / env
  }

  return config;
}

// GET /api/ai/config -> Devuelve disponibilidad y configuración pública del bot
router.get('/config', requireAuth, async (req, res) => {
  try {
    const settings = await getAISettings();
    const available = !!(settings.openrouter_api_key && settings.openrouter_api_key.trim());
    res.json({
      available,
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      personality: settings.ai_personality,
      model: settings.openrouter_model,
      max_tokens: parseInt(settings.ai_max_tokens) || 1000,
      context_tokens: parseInt(settings.ai_context_tokens) || 4000,
    });
  } catch (err) {
    console.error('Error en /api/ai/config:', err);
    res.status(500).json({ error: 'No se pudo obtener la configuración de IA.' });
  }
});

router.post('/chat', requireAuth, async (req, res) => {
  const settings = await getAISettings();
  const apiKey = settings.openrouter_api_key;

  if (!apiKey || !apiKey.trim()) {
    return res.json({
      available: false,
      message: 'La función de inteligencia artificial no está configurada aún (falta configurar la clave de OpenRouter desde el panel de administrador). Todo el sistema sigue funcionando normalmente.',
    });
  }

  const { messages, prompt } = req.body;
  const inputMessages = messages || [
    { role: 'system', content: settings.ai_personality || 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link.' },
    { role: 'user', content: prompt || 'Hola' },
  ];

  // Si enviaron mensajes pero ninguno tiene rol 'system', anteponer la personalidad configurada
  if (Array.isArray(inputMessages) && !inputMessages.some(m => m.role === 'system')) {
    inputMessages.unshift({ role: 'system', content: settings.ai_personality });
  }

  try {
    const payload = {
      model: settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: inputMessages,
    };

    if (settings.ai_max_tokens) {
      payload.max_tokens = parseInt(settings.ai_max_tokens) || 1000;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
        'X-Title': 'Link App',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Error de OpenRouter AI: ${errText}` });
    }

    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content || 'No pude procesar la respuesta.';

    res.json({
      available: true,
      reply: replyContent,
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: 'No se pudo contactar al servicio de Inteligencia Artificial.' });
  }
});

module.exports = router;
