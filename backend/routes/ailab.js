const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { getAISettings, chatCompletion } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();

/**
 * Middleware de seguridad y limites para Laboratorio IA
 */
async function validateAILabLimits(req, res, next) {
  try {
    const settings = await getAISettings();
    const maxMsgLen = parseInt(settings.ailab_max_msg_length, 10) || 2000;
    const maxPersLen = parseInt(settings.ailab_max_personality_length, 10) || 1000;
    const maxImgMb = parseFloat(settings.ailab_max_image_size_mb) || 5;

    if (req.body.message && typeof req.body.message === 'string' && req.body.message.length > maxMsgLen) {
      return res.status(400).json({ error: `El mensaje excede el límite máximo de ${maxMsgLen} caracteres.` });
    }

    if (req.body.personality && typeof req.body.personality === 'string' && req.body.personality.length > maxPersLen) {
      return res.status(400).json({ error: `La personalidad excede el límite de ${maxPersLen} caracteres.` });
    }

    if (req.body.file_data && req.body.file_data.content) {
      const approxMb = (req.body.file_data.content.length * 0.75) / (1024 * 1024);
      if (approxMb > maxImgMb) {
        return res.status(400).json({ error: `El archivo adjunto excede el límite configurado de ${maxImgMb} MB.` });
      }
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

// POST /api/ailab/chat-character - Conversar con personaje o asistente
router.post('/chat-character', requireAuth, validateAILabLimits, async (req, res) => {
  const { character_id, message, history, image_url, file_data } = req.body;
  if (!message && !image_url && !file_data) {
    return res.status(400).json({ error: 'El mensaje, la imagen o el archivo adjunto son obligatorios.' });
  }

  try {
    let charInfo = { name: 'Asistente IA', avatar: '🤖', personality: 'Eres un asistente útil y amable.' };
    if (character_id) {
      const { rows } = await query(`SELECT * FROM ai_characters WHERE id = $1`, [character_id]);
      if (rows.length > 0) charInfo = rows[0];
    }

    const settings = req.aiSettings || await getAISettings();

    let docResult = null;
    let fullUserMsg = message || '';

    if (file_data) {
      docResult = await ToolManager.executeTool('doc.extract', file_data, req.user.id);
      if (docResult && docResult.data && docResult.data.extracted_text) {
        fullUserMsg += `\n\n[Documento Adjunto '${docResult.data.filename}']: ${docResult.data.extracted_text.slice(0, 3000)}`;
      }
    }

    const detectedTool = ToolManager.detectToolIntent(fullUserMsg);

    const maxHistoryCount = parseInt(settings.ailab_max_history, 10) || 10;
    const historyMsgs = Array.isArray(history) ? history.slice(-maxHistoryCount) : [];

    const inputMessages = [
      { role: 'system', content: `Eres ${charInfo.name}. Tu personalidad e instrucciones son: ${charInfo.personality}. Responde manteniendo siempre este personaje en español.` },
      ...historyMsgs,
      { role: 'user', content: fullUserMsg || 'Procesa la información enviada.' }
    ];

    const result = await chatCompletion({
      messages: inputMessages,
      maxTokens: settings.ai_max_tokens,
      visionImage: image_url || null,
    });

    let toolResult = docResult;
    if (detectedTool && !toolResult) {
      toolResult = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, req.user.id);
    }

    return res.json({
      reply: result.reply,
      character: charInfo,
      provider: result.provider,
      finish_reason: result.finish_reason,
      tool_result: toolResult,
      continuations: result.continuations || 0,
    });
  } catch (err) {
    console.error('Error en chat-character:', err);
    res.status(500).json({ error: '⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.' });
  }
});

// ---------------- 2. CONVERSACIÓN IA <-> IA ----------------
// POST /api/ailab/ai-to-ai - Arena / Debate entre 2 personajes
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
    let lastMessage = `Tema de conversación: "${topic || 'La tecnología y el futuro de la sociedad'}"`;

    for (let i = 0; i < numTurns; i++) {
      const currentSpeaker = (i % 2 === 0) ? char1 : char2;
      const otherSpeaker = (i % 2 === 0) ? char2 : char1;

      const sysPrompt = `Eres ${currentSpeaker.name} (${currentSpeaker.personality}). Estás manteniendo un diálogo constructivo con ${otherSpeaker.name} sobre: "${topic || 'el tema actual'}". Responde en 2-3 oraciones concisas dirigiéndote directamente a ${otherSpeaker.name}.`;

      const result = await chatCompletion({
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: lastMessage }
        ],
        maxTokens: settings.ai_max_tokens,
      });

      const replyText = result.reply || `Coincido con tu punto, ${otherSpeaker.name}.`;
      lastMessage = replyText;

      conversation.push({
        speaker_id: currentSpeaker.id,
        speaker_name: currentSpeaker.name,
        speaker_avatar: currentSpeaker.avatar,
        text: replyText,
        turn: i + 1,
        provider: result.provider,
      });
    }

    res.json({ topic: topic || 'Diálogo general', conversation });
  } catch (err) {
    console.error('Error en ai-to-ai:', err);
    res.status(500).json({ error: '⚠️ No se pudo completar esta conversación.' });
  }
});

// ---------------- 3. GENERACIÓN DE IMÁGENES ----------------
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
    res.json(result);
  } catch (err) {
    console.error('Error en image-gen:', err);
    res.status(500).json({ error: '⚠️ No se pudo generar la imagen.' });
  }
});

// ---------------- 4. VISIÓN / ANÁLISIS DE IMÁGENES ----------------
router.post('/vision', requireAuth, validateAILabLimits, async (req, res) => {
  const { image_url, question } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'La URL o imagen en base64 es requerida.' });
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

// ---------------- 5. MODO MISIÓN ----------------
router.post('/mission', requireAuth, validateAILabLimits, async (req, res) => {
  const { goal } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'El objetivo de la misión es requerido.' });
  }

  try {
    const settings = req.aiSettings || await getAISettings();
    const maxSteps = parseInt(settings.ai_max_tool_steps, 10) || 5;

    const missionResult = await ToolManager.executeMission(goal, req.user.id, maxSteps);
    res.json(missionResult);
  } catch (err) {
    console.error('Error en mission mode:', err);
    res.status(500).json({ error: '⚠️ No se pudo completar la misión.' });
  }
});

// ---------------- 6. EJECUCIÓN DIRECTA DE HERRAMIENTAS ----------------
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

// ---------------- 7. TRADUCTOR MULTILENGUAJE ----------------
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

module.exports = router;
