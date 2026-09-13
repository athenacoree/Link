const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/chat', requireAuth, async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.json({
      available: false,
      message: 'La función de inteligencia artificial no está configurada aún (falta OPENROUTER_API_KEY). Todo el sistema sigue funcionando normalmente.',
    });
  }

  const { messages, prompt } = req.body;
  const inputMessages = messages || [
    { role: 'system', content: 'Eres Link AI, un asistente inteligente integrado en la plataforma social Link. Responde siempre en español, con amabilidad y precisión.' },
    { role: 'user', content: prompt || 'Hola' },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
        'X-Title': 'Link App',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        messages: inputMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status( response.status ).json({ error: `Error de OpenRouter AI: ${errText}` });
    }

    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content || 'No pude procesar la respuesta.';

    res.json({
      available: true,
      reply: replyContent,
      usage: data.usage || null,
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: 'No se pudo contactar al servicio de Inteligencia Artificial.' });
  }
});

module.exports = router;
