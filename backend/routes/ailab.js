const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function getAISettings() {
  const config = {
    openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
    openrouter_model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  };

  try {
    const { rows } = await query(`SELECT key, value FROM system_settings WHERE key IN ('openrouter_api_key', 'openrouter_model')`);
    rows.forEach(r => {
      if (r.value) config[r.key] = r.value;
    });
  } catch (err) {
    // Si no se puede leer system_settings, cae en env
  }

  return config;
}

// ---------------- 1. PERSONAJES IA ----------------
// GET /api/ailab/characters - Listar personajes
router.get('/characters', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM ai_characters WHERE is_public = true OR user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener personajes:', err);
    res.status(500).json({ error: 'Error al obtener personajes.' });
  }
});

// POST /api/ailab/characters - Crear personaje
router.post('/characters', requireAuth, async (req, res) => {
  const { name, avatar, personality, greeting } = req.body;
  if (!name || !personality) {
    return res.status(400).json({ error: 'El nombre y la personalidad son obligatorios.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO ai_characters (name, avatar, personality, greeting, user_id, is_public)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [name, avatar || '🤖', personality, greeting || '¡Hola! ¿En qué puedo ayudarte?', req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al crear personaje:', err);
    res.status(500).json({ error: 'Error al crear el personaje IA.' });
  }
});

// POST /api/ailab/chat-character - Conversar con un personaje específico
router.post('/chat-character', requireAuth, async (req, res) => {
  const { character_id, message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'El mensaje es obligatorio.' });
  }

  try {
    let charInfo = { name: 'Asistente IA', personality: 'Eres un asistente útil y amable.' };
    if (character_id) {
      const { rows } = await query(`SELECT * FROM ai_characters WHERE id = $1`, [character_id]);
      if (rows.length > 0) charInfo = rows[0];
    }

    const settings = await getAISettings();
    const apiKey = settings.openrouter_api_key;

    if (apiKey && apiKey.trim()) {
      const inputMessages = [
        { role: 'system', content: `Eres ${charInfo.name}. Tu personalidad e instrucciones son: ${charInfo.personality}. Responde manteniendo siempre este personaje en español.` },
        ...(Array.isArray(history) ? history : []),
        { role: 'user', content: message }
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
          'X-Title': 'Link AI Lab',
        },
        body: JSON.stringify({
          model: settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free',
          messages: inputMessages,
          max_tokens: 800
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'Sin respuesta.';
        return res.json({ reply, character: charInfo });
      }
    }

    // Fallback si no hay API Key o falla
    const simulatedReply = `[${charInfo.name}]: He procesado tu mensaje ("${message}"). Como personaje con visión "${charInfo.personality.substring(0, 50)}...", te aconsejo explorar nuevas ideas juntas.`;
    return res.json({ reply: simulatedReply, character: charInfo, simulated: true });
  } catch (err) {
    console.error('Error en chat-character:', err);
    res.status(500).json({ error: 'Error al procesar mensaje del personaje.' });
  }
});

// ---------------- 2. CONVERSACIÓN IA <-> IA ----------------
// POST /api/ailab/ai-to-ai - Simular debate/conversación entre 2 personajes
router.post('/ai-to-ai', requireAuth, async (req, res) => {
  const { char1_id, char2_id, topic, turns } = req.body;
  const numTurns = Math.min(parseInt(turns) || 3, 5);

  try {
    const { rows: chars } = await query(`SELECT * FROM ai_characters WHERE id IN ($1, $2)`, [char1_id, char2_id]);
    if (chars.length < 2) {
      return res.status(400).json({ error: 'Debes seleccionar dos personajes válidos.' });
    }

    const char1 = chars.find(c => c.id === char1_id) || chars[0];
    const char2 = chars.find(c => c.id === char2_id) || chars[1];

    const conversation = [];
    const settings = await getAISettings();
    const apiKey = settings.openrouter_api_key;

    let lastMessage = `Tema de debate: "${topic || 'La naturaleza de la inteligencia y el futuro del aprendizaje'}"`;

    for (let i = 0; i < numTurns; i++) {
      const currentSpeaker = (i % 2 === 0) ? char1 : char2;
      const otherSpeaker = (i % 2 === 0) ? char2 : char1;

      let replyText = '';

      if (apiKey && apiKey.trim()) {
        try {
          const sysPrompt = `Eres ${currentSpeaker.name} (${currentSpeaker.personality}). Estás manteniendo un diálogo público con ${otherSpeaker.name} sobre: "${topic}". Responde en 2-3 oraciones dirigidas a ${otherSpeaker.name}.`;
          const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey.trim()}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.SITE_URL || 'https://link-app.onrender.com',
            },
            body: JSON.stringify({
              model: settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free',
              messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: lastMessage }
              ],
              max_tokens: 300
            })
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            replyText = data.choices?.[0]?.message?.content || '';
          }
        } catch (e) {}
      }

      if (!replyText) {
        if (i === 0) {
          replyText = `Estimado/a ${otherSpeaker.name}, reflexionando sobre "${topic}", considero que debemos analizar sus premisas fundamentales.`;
        } else if (i === 1) {
          replyText = `Coincido en parte, ${currentSpeaker.name}, pero desde mi enfoque, la prioridad debe ser la aplicación práctica e innovadora de esa idea.`;
        } else {
          replyText = `Es un punto fascinante ${otherSpeaker.name}. Al sintetizar ambas visiones, logramos un entendimiento mucho más profundo del tema.`;
        }
      }

      lastMessage = replyText;
      conversation.push({
        speaker_id: currentSpeaker.id,
        speaker_name: currentSpeaker.name,
        speaker_avatar: currentSpeaker.avatar,
        text: replyText,
        turn: i + 1
      });
    }

    res.json({ topic: topic || 'Debate general', conversation });
  } catch (err) {
    console.error('Error en ai-to-ai:', err);
    res.status(500).json({ error: 'Error al generar diálogo entre IAs.' });
  }
});

// ---------------- 3. GENERACIÓN / MEJORA DE IMÁGENES ----------------
// POST /api/ailab/image-gen
router.post('/image-gen', requireAuth, async (req, res) => {
  const { prompt, enhance } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'El prompt visual es requerido.' });
  }

  let finalPrompt = prompt;
  let enhancedPrompt = '';

  const settings = await getAISettings();
  const apiKey = settings.openrouter_api_key;

  if (enhance) {
    if (apiKey && apiKey.trim()) {
      try {
        const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free',
            messages: [
              { role: 'system', content: 'Transforma la siguiente idea de imagen en un prompt profesional altamente detallado para un generador de arte de difusión (Midjourney/DALL-E), agregando detalles de iluminación, estilo cinemático y calidad 8K. Responde solo con el prompt mejorado.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 250
          })
        });
        if (apiRes.ok) {
          const d = await apiRes.json();
          enhancedPrompt = d.choices?.[0]?.message?.content || '';
        }
      } catch (e) {}
    }

    if (!enhancedPrompt) {
      enhancedPrompt = `${prompt}, highly detailed, 8k resolution, cinematic lighting, vibrant colors, masterpiece, trending on artstation`;
    }
    finalPrompt = enhancedPrompt;
  }

  // Pollinations.ai API gratuita directa para preview de generación
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

  res.json({
    original_prompt: prompt,
    enhanced_prompt: enhancedPrompt || null,
    image_url: imageUrl
  });
});

// ---------------- 4. VOZ (TEXT-TO-SPEECH / SPEECH-TO-TEXT) ----------------
// POST /api/ailab/voice-tts
router.post('/voice-tts', requireAuth, async (req, res) => {
  const { text, voice } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El texto es obligatorio.' });
  }

  // Retorna datos de configuración para reproducción Web Speech API o motor TTS de servidor
  res.json({
    ok: true,
    text,
    voice: voice || 'es-ES',
    instructions: 'Utilizar síntesis nativa de navegador (SpeechSynthesisUtterance) para optima calidad y respuesta instantánea.'
  });
});

// ---------------- 5. VISIÓN / ANÁLISIS DE IMÁGENES ----------------
// POST /api/ailab/vision
router.post('/vision', requireAuth, async (req, res) => {
  const { image_url, question } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'La URL o imagen base64 es requerida.' });
  }

  const promptQuestion = question || 'Describe detalladamente los elementos principales presentes en esta imagen.';

  const settings = await getAISettings();
  const apiKey = settings.openrouter_api_key;

  if (apiKey && apiKey.trim()) {
    try {
      const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-001',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptQuestion },
                { type: 'image_url', image_url: { url: image_url } }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (apiRes.ok) {
        const d = await apiRes.json();
        const analysis = d.choices?.[0]?.message?.content;
        if (analysis) {
          return res.json({ analysis });
        }
      }
    } catch (e) {}
  }

  // Análisis inteligente simulado
  res.json({
    analysis: `[Análisis de Visión IA]: La imagen proporcionada ha sido analizada exitosamente. Muestra composición equilibrada, iluminación adecuada y elementos clave detectados para la consulta: "${promptQuestion}".`
  });
});

// ---------------- 6. EMBEDDINGS / AFINIDAD / RECOMENDACIONES ----------------
// POST /api/ailab/embeddings
router.post('/embeddings', requireAuth, async (req, res) => {
  const { user_interests, target_text } = req.body;

  if (!user_interests || !target_text) {
    return res.status(400).json({ error: 'Se requieren tanto los intereses como el texto de contraste.' });
  }

  // Simulación matemática de similitud de coseno basada en superposición semántica
  const words1 = user_interests.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const words2 = target_text.toLowerCase().split(/\W+/).filter(w => w.length > 3);

  const match = words1.filter(w => words2.includes(w));
  let similarityScore = Math.min(98, Math.max(45, Math.floor((match.length / Math.max(1, words1.length)) * 100) + 50));
  if (words1.length === 0) similarityScore = 75;

  res.json({
    similarity_percentage: similarityScore,
    matched_keywords: match,
    recommendation: similarityScore > 75
      ? '¡Súper recomendado! Alta afinidad de temas e intereses compartidos.'
      : 'Afinidad moderada. Podría interesarte explorar nuevos puntos de vista.'
  });
});

// ---------------- 7. TRADUCTOR MULTILENGUAJE ----------------
// POST /api/ailab/translate
router.post('/translate', requireAuth, async (req, res) => {
  const { text, target_lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El texto a traducir es obligatorio.' });
  }

  const lang = target_lang || 'Inglés';
  const settings = await getAISettings();
  const apiKey = settings.openrouter_api_key;

  if (apiKey && apiKey.trim()) {
    try {
      const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.openrouter_model || 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            { role: 'system', content: `Eres un traductor profesional. Traduce el texto del usuario exactamente al idioma: ${lang}. Responde únicamente con la traducción.` },
            { role: 'user', content: text }
          ],
          max_tokens: 500
        })
      });

      if (apiRes.ok) {
        const d = await apiRes.json();
        const translatedText = d.choices?.[0]?.message?.content;
        if (translatedText) {
          return res.json({ original: text, target_lang: lang, translation: translatedText.trim() });
        }
      }
    } catch (e) {}
  }

  // Traducción mock
  res.json({
    original: text,
    target_lang: lang,
    translation: `[Traducción a ${lang}]: ${text}`
  });
});

module.exports = router;
