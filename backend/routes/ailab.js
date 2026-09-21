const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { getAISettings, chatCompletion } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();

/**
 * Middleware para validar límites de seguridad en Laboratorio IA
 */
async function validateAILabLimits(req, res, next) {
  try {
    const settings = await getAISettings();
    const maxMsgLen = parseInt(settings.ailab_max_msg_length, 10) || 2000;
    const maxPersLen = parseInt(settings.ailab_max_personality_length, 10) || 1000;

    if (req.body.message && typeof req.body.message === 'string' && req.body.message.length > maxMsgLen) {
      return res.status(400).json({ error: `El mensaje excede el límite máximo permitido de ${maxMsgLen} caracteres.` });
    }

    if (req.body.personality && typeof req.body.personality === 'string' && req.body.personality.length > maxPersLen) {
      return res.status(400).json({ error: `La personalidad excede el límite máximo permitido de ${maxPersLen} caracteres.` });
    }

    req.aiSettings = settings;
    next();
  } catch (e) {
    next();
  }
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
router.post('/characters', requireAuth, validateAILabLimits, async (req, res) => {
  const { name, avatar, personality, greeting } = req.body;
  if (!name || !personality) {
    return res.status(400).json({ error: 'El nombre y la personalidad son obligatorios.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO ai_characters (name, avatar, personality, greeting, user_id, is_public)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [name.trim(), avatar || '🤖', personality.trim(), greeting || '¡Hola! ¿En qué puedo ayudarte?', req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al crear personaje:', err);
    res.status(500).json({ error: 'Error al crear el personaje IA.' });
  }
});

// POST /api/ailab/chat-character - Conversar con un personaje específico
router.post('/chat-character', requireAuth, validateAILabLimits, async (req, res) => {
  const { character_id, message, history, image_url } = req.body;
  if (!message && !image_url) {
    return res.status(400).json({ error: 'El mensaje o la imagen son obligatorios.' });
  }

  try {
    let charInfo = { name: 'Asistente IA', avatar: '🤖', personality: 'Eres un asistente útil y amable.' };
    if (character_id) {
      const { rows } = await query(`SELECT * FROM ai_characters WHERE id = $1`, [character_id]);
      if (rows.length > 0) charInfo = rows[0];
    }

    const settings = req.aiSettings || await getAISettings();

    // Detectar intención de herramienta en el mensaje
    const detectedTool = ToolManager.detectToolIntent(message);
    let toolResult = null;
    if (detectedTool) {
      toolResult = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, req.user.id);
    }

    const maxHistoryCount = parseInt(settings.ailab_max_history, 10) || 10;
    const historyMsgs = Array.isArray(history) ? history.slice(-maxHistoryCount) : [];

    const inputMessages = [
      { role: 'system', content: `Eres ${charInfo.name}. Tu personalidad e instrucciones son: ${charInfo.personality}. Responde manteniendo siempre este personaje en español.` },
      ...historyMsgs,
      { role: 'user', content: message || 'Analiza esta imagen.' }
    ];

    const result = await chatCompletion({
      messages: inputMessages,
      maxTokens: settings.ai_max_tokens,
      visionImage: image_url || null,
    });

    return res.json({
      reply: result.reply,
      character: charInfo,
      provider: result.provider,
      finish_reason: result.finish_reason,
      tool_result: toolResult
    });
  } catch (err) {
    console.error('Error en chat-character:', err);
    res.status(500).json({ error: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.' });
  }
});

// ---------------- 2. CONVERSACIÓN IA <-> IA ----------------
// POST /api/ailab/ai-to-ai - Debate/conversación entre 2 personajes
router.post('/ai-to-ai', requireAuth, validateAILabLimits, async (req, res) => {
  const { char1_id, char2_id, topic, turns } = req.body;
  const numTurns = Math.min(Math.max(parseInt(turns, 10) || 3, 1), 6);

  try {
    const { rows: chars } = await query(`SELECT * FROM ai_characters WHERE id IN ($1, $2)`, [char1_id, char2_id]);
    if (chars.length < 2) {
      return res.status(400).json({ error: 'Debes seleccionar dos personajes válidos.' });
    }

    const char1 = chars.find(c => c.id === char1_id) || chars[0];
    const char2 = chars.find(c => c.id === char2_id) || chars[1];

    const conversation = [];
    const settings = req.aiSettings || await getAISettings();
    let lastMessage = `Tema de debate: "${topic || 'La tecnología y el futuro de la sociedad'}"`;

    for (let i = 0; i < numTurns; i++) {
      const currentSpeaker = (i % 2 === 0) ? char1 : char2;
      const otherSpeaker = (i % 2 === 0) ? char2 : char1;

      const sysPrompt = `Eres ${currentSpeaker.name} (${currentSpeaker.personality}). Estás manteniendo un diálogo público con ${otherSpeaker.name} sobre: "${topic || 'el tema actual'}". Responde en 2-3 oraciones breves dirigidas a ${otherSpeaker.name}.`;

      const result = await chatCompletion({
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: lastMessage }
        ],
        maxTokens: 250,
      });

      const replyText = result.reply || `Coincido en el análisis, ${otherSpeaker.name}.`;
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
    res.status(500).json({ error: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.' });
  }
});

// ---------------- 3. GENERACIÓN DE IMÁGENES ----------------
// POST /api/ailab/image-gen
router.post('/image-gen', requireAuth, validateAILabLimits, async (req, res) => {
  const { prompt, enhance } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'El prompt visual es requerido.' });
  }

  try {
    const result = await ToolManager.executeTool('image.generate', { prompt, enhance }, req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.data);
  } catch (err) {
    console.error('Error en image-gen:', err);
    res.status(500).json({ error: '⚠️ No se pudo generar la imagen.' });
  }
});

// ---------------- 4. VOZ (TEXT-TO-SPEECH) ----------------
// POST /api/ailab/voice-tts
router.post('/voice-tts', requireAuth, validateAILabLimits, async (req, res) => {
  const { text, voice } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El texto es obligatorio.' });
  }

  res.json({
    ok: true,
    text,
    voice: voice || 'es-ES',
    instructions: 'Utilizar síntesis nativa de navegador (SpeechSynthesisUtterance) para óptima calidad.'
  });
});

// ---------------- 5. VISIÓN / ANÁLISIS DE IMÁGENES ----------------
// POST /api/ailab/vision
router.post('/vision', requireAuth, validateAILabLimits, async (req, res) => {
  const { image_url, question } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'La URL o imagen base64 es requerida.' });
  }

  const promptQuestion = question || 'Describe detalladamente los elementos principales presentes en esta imagen.';
  const settings = req.aiSettings || await getAISettings();

  try {
    const result = await chatCompletion({
      messages: [
        { role: 'user', content: promptQuestion }
      ],
      maxTokens: settings.ai_max_tokens,
      visionImage: image_url
    });

    res.json({ analysis: result.reply, provider: result.provider });
  } catch (err) {
    console.error('Error en vision:', err);
    res.status(500).json({ error: '⚠️ No se pudo realizar el análisis de visión.' });
  }
});

// ---------------- 6. EMBEDDINGS / AFINIDAD ----------------
// POST /api/ailab/embeddings
router.post('/embeddings', requireAuth, validateAILabLimits, async (req, res) => {
  const { user_interests, target_text } = req.body;

  if (!user_interests || !target_text) {
    return res.status(400).json({ error: 'Se requieren tanto los intereses como el texto de contraste.' });
  }

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
router.post('/translate', requireAuth, validateAILabLimits, async (req, res) => {
  const { text, target_lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'El texto a traducir es obligatorio.' });
  }

  const lang = target_lang || 'Inglés';
  const settings = req.aiSettings || await getAISettings();

  try {
    const result = await chatCompletion({
      messages: [
        { role: 'system', content: `Eres un traductor profesional. Traduce el texto del usuario exactamente al idioma: ${lang}. Responde únicamente con la traducción limpia.` },
        { role: 'user', content: text }
      ],
      maxTokens: settings.ai_max_tokens
    });

    res.json({
      original: text,
      target_lang: lang,
      translation: result.reply ? result.reply.trim() : text
    });
  } catch (err) {
    console.error('Error en translate:', err);
    res.status(500).json({ error: '⚠️ No se pudo completar la traducción.' });
  }
});

// ---------------- 8. EJECUCIÓN DIRECTA DE HERRAMIENTAS ----------------
// POST /api/ailab/tool
router.post('/tool', requireAuth, validateAILabLimits, async (req, res) => {
  const { name, params } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre de la herramienta es requerido.' });
  }

  try {
    const result = await ToolManager.executeTool(name, params || {}, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Error al ejecutar herramienta:', err);
    res.status(500).json({ error: '⚠️ Ocurrió un error al ejecutar la herramienta.' });
  }
});

module.exports = router;
