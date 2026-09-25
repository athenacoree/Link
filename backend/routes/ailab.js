const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getAISettings } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');
const {
  getGlobalMessages,
  deleteGlobalMessage,
  processUserMessageInGlobalRoom,
  runAutoAIChatLoopTurn,
  stopAILabConversation,
  generateExperienceTimelineAI,
  getExperiences,
  createExperience,
  getExperienceById,
  updateExperienceTimeline,
  setExperiencePublished,
  deleteExperience,
  getEvents,
  createEvent,
  getEventById,
  getActiveEvent,
  cancelEvent,
  recordEventInteraction,
  getEventSyncInfo,
} = require('../services/aiLabService');

const router = express.Router();

/**
 * Middleware de seguridad y límites para Laboratorio IA
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

// ---------------- 1. SALA GLOBAL DE MENSAJES ----------------

// GET /api/ailab/messages - Obtener el historial global de la sala
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 60;
    const before = req.query.before || null;
    const messages = await getGlobalMessages(limit, before);
    res.json({ messages });
  } catch (err) {
    console.error('Error al obtener mensajes de la sala global:', err);
    res.status(500).json({ error: 'Error al obtener mensajes del Laboratorio IA.' });
  }
});

// POST /api/ailab/messages - Enviar mensaje a la sala global
router.post('/messages', requireAuth, validateAILabLimits, async (req, res) => {
  const { message, image_url, file_data, character_id } = req.body;
  if (!message && !image_url && !file_data) {
    return res.status(400).json({ error: 'Debes enviar un mensaje, imagen o archivo.' });
  }

  try {
    const result = await processUserMessageInGlobalRoom({
      userId: req.user.id,
      userName: req.user.name || 'Usuario',
      userAvatar: req.user.avatar_data || '',
      messageText: message,
      imageUrl: image_url || null,
      fileData: file_data || null,
      characterId: character_id || null,
    });

    res.json(result);
  } catch (err) {
    console.error('Error procesando mensaje global:', err);
    res.status(500).json({ error: '⚠️ Ocurrió un error al procesar tu mensaje en el Laboratorio IA.' });
  }
});

// DELETE /api/ailab/messages/:id - Borrar un mensaje de la sala global
router.delete('/messages/:id', requireAuth, async (req, res) => {
  try {
    const result = await deleteGlobalMessage(req.params.id, req.user.id, !!req.user.is_admin);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ ok: true, message: 'Mensaje eliminado correctamente.' });
  } catch (err) {
    console.error('Error al borrar mensaje:', err);
    res.status(500).json({ error: 'No se pudo eliminar el mensaje.' });
  }
});

// POST /api/ailab/trigger-auto - Forzar turno de conversación IA <-> IA (Solo administradores)
router.post('/trigger-auto', requireAuth, requireAdmin, async (req, res) => {
  try {
    await runAutoAIChatLoopTurn();
    res.json({ ok: true, mensaje: 'Turno de IA ejecutado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error ejecutando turno de IA.' });
  }
});

// POST /api/ailab/stop - Detener inmediatamente cualquier conversación activa de la IA
router.post('/stop', requireAuth, async (req, res) => {
  try {
    const result = await stopAILabConversation();
    res.json(result);
  } catch (err) {
    console.error('Error al detener la IA:', err);
    res.status(500).json({ error: 'No se pudo detener la conversación.' });
  }
});

// ---------------- 2. PERSONAJES IA ----------------

// GET /api/ailab/characters - Listar personajes disponibles
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

// ---------------- 3. GENERACIÓN DE IMÁGENES Y HERRAMIENTAS ----------------
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

router.post('/tool', requireAuth, validateAILabLimits, async (req, res) => {
  const { name, params } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre de la herramienta es requerido.' });
  }

  // Restringir herramientas de administración / código si no es admin
  const isAdmin = !!req.user?.is_admin;
  if (!isAdmin && (name.startsWith('dev.') || name.startsWith('code.') || name.startsWith('archive.'))) {
    return res.status(403).json({ error: 'No tienes permisos para ejecutar esta herramienta directamente.' });
  }

  try {
    const result = await ToolManager.executeTool(name, params || {}, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Error al ejecutar herramienta:', err);
    res.status(500).json({ error: '⚠️ Ocurrió un error al ejecutar la herramienta.' });
  }
});

// ---------------- 4. EXPERIENCIAS MULTIMEDIA Y EVENTOS IA ----------------

// GET /api/ailab/experiences - Listar todas las experiencias
router.get('/experiences', requireAuth, async (req, res) => {
  try {
    const list = await getExperiences();
    res.json(list);
  } catch (err) {
    console.error('Error al listar experiencias:', err);
    res.status(500).json({ error: 'No se pudieron obtener las experiencias.' });
  }
});

// POST /api/ailab/experiences - Crear nueva experiencia (Solo Administradores)
router.post('/experiences', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, content_type, content_url, raw_text, timeline, is_published } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'El título de la experiencia es requerido.' });
  }

  try {
    const exp = await createExperience({
      title,
      description,
      contentType: content_type || 'video',
      contentUrl: content_url,
      rawText: raw_text,
      timeline,
      userId: req.user.id,
      isPublished: is_published,
    });
    res.json(exp);
  } catch (err) {
    console.error('Error al crear experiencia:', err);
    res.status(500).json({ error: 'Error interno al crear experiencia.' });
  }
});

// POST /api/ailab/experiences/analyze - Generar Timeline mediante IA Gemini (Solo Administradores)
router.post('/experiences/analyze', requireAuth, requireAdmin, async (req, res) => {
  const { content_type, content_url, raw_text, title, description } = req.body;
  if (!title && !raw_text && !content_url) {
    return res.status(400).json({ error: 'Debes proporcionar un título, texto o URL para analizar.' });
  }

  try {
    const result = await generateExperienceTimelineAI({
      contentType: content_type || 'video',
      contentUrl: content_url || '',
      rawText: raw_text || '',
      title: title || 'Experiencia Multimedia',
      description: description || '',
    });
    res.json(result);
  } catch (err) {
    console.error('Error al analizar contenido con IA:', err);
    res.status(500).json({ error: 'No se pudo generar la timeline con la IA.' });
  }
});

// PUT /api/ailab/experiences/:id/timeline - Actualizar Timeline JSON (Solo Administradores)
router.put('/experiences/:id/timeline', requireAuth, requireAdmin, async (req, res) => {
  const { timeline } = req.body;
  if (!Array.isArray(timeline)) {
    return res.status(400).json({ error: 'El timeline debe ser un arreglo de eventos.' });
  }

  try {
    const updated = await updateExperienceTimeline(req.params.id, timeline);
    if (!updated) {
      return res.status(404).json({ error: 'Experiencia no encontrada.' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error al actualizar timeline:', err);
    res.status(500).json({ error: 'Error al actualizar el timeline.' });
  }
});

// POST /api/ailab/experiences/:id/publish - Publicar / Despublicar Experiencia (Solo Administradores)
router.post('/experiences/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  const { is_published } = req.body;
  try {
    const updated = await setExperiencePublished(req.params.id, is_published);
    if (!updated) {
      return res.status(404).json({ error: 'Experiencia no encontrada.' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error al cambiar publicación:', err);
    res.status(500).json({ error: 'Error al cambiar estado de publicación.' });
  }
});

// DELETE /api/ailab/experiences/:id - Eliminar Experiencia (Solo Administradores)
router.delete('/experiences/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await deleteExperience(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Experiencia no encontrada.' });
    }
    res.json({ ok: true, message: 'Experiencia eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar experiencia:', err);
    res.status(500).json({ error: 'Error al eliminar experiencia.' });
  }
});

// GET /api/ailab/events - Listar eventos multimedia
router.get('/events', requireAuth, async (req, res) => {
  try {
    const events = await getEvents();
    res.json(events);
  } catch (err) {
    console.error('Error al listar eventos:', err);
    res.status(500).json({ error: 'Error al obtener eventos.' });
  }
});

// POST /api/ailab/events - Programar evento multimedia (Solo Administradores)
router.post('/events', requireAuth, requireAdmin, async (req, res) => {
  const { experience_id, title, scheduled_at, duration_seconds } = req.body;
  if (!experience_id || !scheduled_at) {
    return res.status(400).json({ error: 'experience_id y scheduled_at son requeridos.' });
  }

  try {
    const evt = await createEvent({
      experienceId: experience_id,
      title: title || 'Evento Multimedia',
      scheduledAt: scheduled_at,
      durationSeconds: duration_seconds || 300,
    });
    res.json(evt);
  } catch (err) {
    console.error('Error al programar evento:', err);
    res.status(500).json({ error: 'Error al programar evento.' });
  }
});

// GET /api/ailab/events/active - Obtener el evento actualmente activo o próximo
router.get('/events/active', requireAuth, async (req, res) => {
  try {
    const evt = await getActiveEvent();
    res.json({ active_event: evt });
  } catch (err) {
    console.error('Error al obtener evento activo:', err);
    res.status(500).json({ error: 'Error al obtener evento activo.' });
  }
});

// GET /api/ailab/events/:id/sync - Obtener posición sincronizada y timestamp oficial
router.get('/events/:id/sync', requireAuth, async (req, res) => {
  try {
    const syncData = await getEventSyncInfo(req.params.id);
    if (!syncData) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }
    res.json(syncData);
  } catch (err) {
    console.error('Error al sincronizar evento:', err);
    res.status(500).json({ error: 'Error al sincronizar evento.' });
  }
});

// POST /api/ailab/events/:id/interaction - Registrar votación, respuesta o reacción
router.post('/events/:id/interaction', requireAuth, async (req, res) => {
  const { interaction_type, data } = req.body;
  if (!interaction_type) {
    return res.status(400).json({ error: 'El tipo de interacción es requerido.' });
  }

  try {
    const interaction = await recordEventInteraction({
      eventId: req.params.id,
      userId: req.user.id,
      userName: req.user.name || 'Usuario',
      interactionType: interaction_type,
      data: data || {},
    });
    res.json({ ok: true, interaction });
  } catch (err) {
    console.error('Error al registrar interacción:', err);
    res.status(500).json({ error: 'Error al registrar interacción.' });
  }
});

// DELETE /api/ailab/events/:id - Cancelar o eliminar evento (Solo Administradores)
router.delete('/events/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await cancelEvent(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }
    res.json({ ok: true, message: 'Evento cancelado correctamente.' });
  } catch (err) {
    console.error('Error al cancelar evento:', err);
    res.status(500).json({ error: 'Error al cancelar evento.' });
  }
});

module.exports = router;
