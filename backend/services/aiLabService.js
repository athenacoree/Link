const { query } = require('../db/postgres');
const { getAISettings, chatCompletion } = require('./aiService');
const ToolManager = require('../tools/ToolManager');

let ioInstance = null;
let autoLoopTimer = null;
let retentionJobTimer = null;
let isProcessingAILoop = false;
let activeAbortController = null;

async function stopAILabConversation() {
  await query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ailab_auto_paused', 'true', NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
  ).catch(() => {});

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch (e) {}
    activeAbortController = null;
  }

  isProcessingAILoop = false;

  broadcastToGlobalRoom('ailab:status', {
    isWorking: false,
    text: 'Conversación de IA detenida.'
  });

  return { ok: true, message: 'Conversación detenida correctamente.' };
}

function setAILabIO(io) {
  ioInstance = io;
}

function broadcastToGlobalRoom(event, data) {
  if (ioInstance) {
    ioInstance.to('room:ailab').emit(event, data);
  }
}

/**
 * Obtener mensajes de la sala global (con filtro is_deleted = false)
 */
async function getGlobalMessages(limit = 60, before = null) {
  try {
    let sql = `SELECT * FROM ailab_messages WHERE is_deleted = false `;
    const params = [];

    if (before) {
      params.push(before);
      sql += `AND created_at < $${params.length} `;
    }

    params.push(Math.min(Math.max(1, limit), 100));
    sql += `ORDER BY created_at DESC LIMIT $${params.length}`;

    const { rows } = await query(sql, params);
    return rows.reverse();
  } catch (err) {
    console.error('Error al obtener mensajes globales de AILab:', err);
    return [];
  }
}

/**
 * Guardar y transmitir un mensaje en la sala global
 */
async function saveGlobalMessage({
  senderType = 'user',
  senderId = null,
  senderName,
  senderAvatar = '',
  text = '',
  imageUrl = null,
  attachments = null,
  toolResult = null,
}) {
  try {
    const { rows } = await query(
      `INSERT INTO ailab_messages
       (sender_type, sender_id, sender_name, sender_avatar, text, image_url, attachments, tool_result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        senderType,
        senderId || null,
        senderName || 'Usuario',
        senderAvatar || '',
        text || '',
        imageUrl || null,
        attachments ? JSON.stringify(attachments) : null,
        toolResult ? JSON.stringify(toolResult) : null,
      ]
    );

    const msg = rows[0];
    broadcastToGlobalRoom('ailab:nuevo_mensaje', msg);
    return msg;
  } catch (err) {
    console.error('Error al guardar mensaje global en AILab:', err);
    throw err;
  }
}

/**
 * Eliminar un mensaje global (soft delete)
 */
async function deleteGlobalMessage(messageId, userId, isAdmin = false) {
  try {
    let sql = `UPDATE ailab_messages SET is_deleted = true WHERE id = $1 `;
    const params = [messageId];

    if (!isAdmin) {
      params.push(userId);
      sql += `AND sender_id = $2 AND sender_type = 'user' `;
    }

    sql += `RETURNING *`;

    const { rows } = await query(sql, params);
    if (rows.length === 0) {
      return { success: false, error: 'Mensaje no encontrado o sin permisos.' };
    }

    broadcastToGlobalRoom('ailab:mensaje_eliminado', { id: messageId });
    return { success: true, message: rows[0] };
  } catch (err) {
    console.error('Error al eliminar mensaje global de AILab:', err);
    return { success: false, error: 'Error interno al eliminar mensaje.' };
  }
}

/**
 * Procesar mensaje enviado por un usuario a la sala global (sin respuesta de IA)
 */
async function processUserMessageInGlobalRoom({
  userId,
  userName,
  userAvatar,
  messageText,
  imageUrl = null,
  fileData = null,
  characterId = null,
}) {
  // Guardar el mensaje del usuario en la base de datos
  const userMsgObj = await saveGlobalMessage({
    senderType: 'user',
    senderId: userId,
    senderName: userName,
    senderAvatar: userAvatar,
    text: messageText || (imageUrl ? '📷 Imagen adjunta' : '📄 Archivo adjunto'),
    imageUrl,
    attachments: fileData ? [{ filename: fileData.filename, mime: fileData.mimeType }] : null,
    toolResult: null,
  });

  return { userMessage: userMsgObj, aiMessage: null };
}

/**
 * Bucle autónomo de conversación IA <-> IA (Deshabilitado: no genera respuestas)
 */
async function runAutoAIChatLoopTurn() {
  return;
}

/**
 * Tarea periódica de limpieza según retención de días configurada por el admin
 */
async function runRetentionCleanupJob() {
  try {
    const settings = await getAISettings();
    const retentionDays = parseInt(settings.ailab_retention_days, 10) || 0;

    if (retentionDays > 0) {
      const { rowCount } = await query(
        `DELETE FROM ailab_messages
         WHERE created_at < NOW() - ($1 || ' days')::interval`,
        [String(retentionDays)]
      );
      if (rowCount > 0) {
        console.log(`[AILab Cleanup] Se eliminaron ${rowCount} mensajes con más de ${retentionDays} días de antigüedad.`);
      }
    }
  } catch (err) {
    console.error('Error en tarea de limpieza de mensajes:', err);
  }
}

/**
 * Programar la siguiente ejecución del bucle autómata usando el intervalo configurado en ailab_auto_interval_sec
 */
async function scheduleNextAutoLoopTurn() {
  if (autoLoopTimer) {
    clearTimeout(autoLoopTimer);
    autoLoopTimer = null;
  }

  let intervalSec = 20 * 60; // 20 minutos por defecto
  try {
    const settings = await getAISettings();
    if (settings.ailab_auto_interval_min) {
      const parsedMin = parseFloat(settings.ailab_auto_interval_min);
      if (!isNaN(parsedMin) && parsedMin > 0) {
        intervalSec = Math.max(10, Math.round(parsedMin * 60));
      }
    }
  } catch (e) {}

  autoLoopTimer = setTimeout(async () => {
    try {
      await runAutoAIChatLoopTurn();
    } catch (e) {
      console.error('Error en turno de bucle IA:', e);
    } finally {
      scheduleNextAutoLoopTurn();
    }
  }, intervalSec * 1000);
}

/**
 * Iniciar contadores y tareas en segundo plano
 */
function initAILabBackgroundJobs(io) {
  if (io) setAILabIO(io);

  if (autoLoopTimer) clearTimeout(autoLoopTimer);
  if (retentionJobTimer) clearInterval(retentionJobTimer);

  retentionJobTimer = setInterval(() => {
    runRetentionCleanupJob();
  }, 6 * 3600 * 1000);

  runRetentionCleanupJob();
}

/**
 * GENERACIÓN DE TIMELINE DE IA Y EXPERIENCIAS MULTIMEDIA
 */

/**
 * Utiliza Gemini API para analizar un contenido (video, audio o libro/texto)
 * y generar un timeline interactivo estructurado en JSON.
 */
async function generateExperienceTimelineAI({ contentType = 'video', contentUrl = '', rawText = '', title = '', description = '' }) {
  const sysPrompt = `Eres un motor de Inteligencia Artificial especializado en análisis de experiencias multimedia e interactivas para Enlace Lab AI.
Tu tarea es analizar el contenido proporcionado (${contentType}) y generar una línea de tiempo (timeline) estructurada en JSON puro.

REGLAS DE SALIDA:
1. Responde ÚNICAMENTE con una estructura JSON válida, sin bloques de código Markdown ni texto introductorio.
2. El JSON debe contener la clave principal "timeline", que es un arreglo ordenado por el campo "time" (en segundos).
3. Cada elemento de "timeline" representa un evento en la línea de tiempo con la siguiente estructura:
{
  "time": 10,
  "type": "tension", // "scene_change" | "tension" | "surprise" | "action" | "danger" | "humor" | "dialogue" | "emotion" | "ambient"
  "effects": [
    { "type": "dim", "duration": 2 },
    { "type": "blur", "duration": 1 },
    { "type": "shake", "duration": 0.5 },
    { "type": "zoom", "duration": 2 },
    { "type": "flash", "duration": 0.3 },
    { "type": "vignette", "duration": 3 }
  ],
  "overlay": {
    "text": "Frase impactante o subtítulo",
    "image_url": null
  },
  "interaction": {
    "type": "poll", // "poll" | "question" | "reaction_prompt"
    "question": "¿Qué harías en esta situación?",
    "options": ["Afrontar el peligro", "Buscar refugio", "Pedir ayuda"],
    "duration": 15
  },
  "mia_host": {
    "message": "¡Atentos a lo que está por ocurrir!",
    "speak_tts": true
  }
}

4. Genera entre 5 y 12 puntos clave a lo largo del tiempo según la duración o la extensión del texto/historia.
5. Para contenidos de tipo "book" o texto, estructura el timeline de manera progresiva (tiempos en segundos donde cada párrafo o frase clave se proyecta sincronizadamente).`;

  let contentInfo = `Título: ${title || 'Experiencia Multimedia'}\nDescripción: ${description || 'Sin descripción'}\nTipo: ${contentType}\n`;
  if (contentType === 'book') {
    contentInfo += `Texto/Capítulo:\n${rawText.slice(0, 4000)}`;
  } else {
    contentInfo += `URL o fuente: ${contentUrl}`;
  }

  try {
    const aiRes = await chatCompletion({
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `Analiza este contenido y genera su timeline interactiva:\n\n${contentInfo}` }
      ],
      enableTools: false,
      maxTokens: 2500,
      temperature: 0.5,
    });

    let rawReply = (aiRes.reply || '').trim();
    if (rawReply.startsWith('```')) {
      rawReply = rawReply.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    let parsedTimeline = [];
    try {
      const parsedObj = JSON.parse(rawReply);
      if (Array.isArray(parsedObj)) parsedTimeline = parsedObj;
      else if (parsedObj && Array.isArray(parsedObj.timeline)) parsedTimeline = parsedObj.timeline;
    } catch (parseErr) {
      console.warn('[AILab] No se pudo parsear el JSON directo de la IA. Usando extractor regex...', parseErr.message);
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsedObj = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedObj.timeline)) parsedTimeline = parsedObj.timeline;
        } catch (e) {}
      }
    }

    if (!parsedTimeline || parsedTimeline.length === 0) {
      // Timeline por defecto si la respuesta de IA no fue JSON parseable
      parsedTimeline = [
        {
          time: 0,
          type: "ambient",
          effects: [{ type: "dim", duration: 2 }],
          overlay: { text: `Comenzando "${title || 'Experiencia Multimedia'}"` },
          mia_host: { message: "¡Bienvenidos todos! La experiencia está a punto de comenzar.", speak_tts: true }
        },
        {
          time: 15,
          type: "tension",
          effects: [{ type: "blur", duration: 1 }],
          overlay: { text: "¿Sientes el cambio de ambiente?" },
          interaction: {
            type: "poll",
            question: "¿Qué opinas de este momento?",
            options: ["Me impresiona", "Me genera curiosidad", "Quiero saber más"],
            duration: 12
          }
        },
        {
          time: 45,
          type: "surprise",
          effects: [{ type: "shake", duration: 0.5 }, { type: "flash", duration: 0.3 }],
          overlay: { text: "¡Momento crucial de la historia!" },
          mia_host: { message: "¿Ustedes habrían reaccionado de la misma manera?", speak_tts: false }
        }
      ];
    }

    return { ok: true, timeline: parsedTimeline, raw_reply: rawReply };
  } catch (err) {
    console.error('Error al generar timeline con IA:', err);
    return { ok: false, error: 'Error generando la línea de tiempo con la IA.', timeline: [] };
  }
}

/**
 * Operaciones CRUD de Experiencias
 */
async function getExperiences() {
  try {
    const { rows } = await query(`SELECT * FROM ailab_experiences ORDER BY created_at DESC`);
    return rows;
  } catch (err) {
    console.error('Error al obtener experiencias:', err);
    return [];
  }
}

async function createExperience({ title, description = '', contentType = 'video', contentUrl = '', rawText = '', timeline = [], userId = null, isPublished = false }) {
  const { rows } = await query(
    `INSERT INTO ailab_experiences (title, description, content_type, content_url, raw_text, timeline, is_published, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      title.trim(),
      description.trim(),
      contentType,
      contentUrl.trim(),
      rawText.trim(),
      JSON.stringify(timeline || []),
      Boolean(isPublished),
      userId || null
    ]
  );
  return rows[0];
}

async function getExperienceById(id) {
  const { rows } = await query(`SELECT * FROM ailab_experiences WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function updateExperienceTimeline(id, timeline) {
  const { rows } = await query(
    `UPDATE ailab_experiences
     SET timeline = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(timeline || []), id]
  );
  return rows[0] || null;
}

async function setExperiencePublished(id, isPublished) {
  const { rows } = await query(
    `UPDATE ailab_experiences
     SET is_published = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [Boolean(isPublished), id]
  );
  return rows[0] || null;
}

async function deleteExperience(id) {
  const { rows } = await query(`DELETE FROM ailab_experiences WHERE id = $1 RETURNING *`, [id]);
  return rows.length > 0;
}

/**
 * Operaciones CRUD de Eventos Multimedia Programados
 */
async function getEvents() {
  try {
    const { rows } = await query(
      `SELECT e.*, ex.title AS experience_title, ex.content_type, ex.content_url, ex.raw_text, ex.timeline
       FROM ailab_events e
       JOIN ailab_experiences ex ON e.experience_id = ex.id
       ORDER BY e.scheduled_at DESC`
    );
    return rows;
  } catch (err) {
    console.error('Error al obtener eventos:', err);
    return [];
  }
}

async function createEvent({ experienceId, title, scheduledAt, durationSeconds = 300 }) {
  const { rows } = await query(
    `INSERT INTO ailab_events (experience_id, title, scheduled_at, duration_seconds, status)
     VALUES ($1, $2, $3, $4, 'scheduled')
     RETURNING *`,
    [experienceId, title.trim(), new Date(scheduledAt).toISOString(), parseInt(durationSeconds, 10) || 300]
  );

  const newEvt = rows[0];
  broadcastToGlobalRoom('ailab:evento_cambio', { action: 'created', event: newEvt });
  return newEvt;
}

async function getEventById(id) {
  const { rows } = await query(
    `SELECT e.*, ex.title AS experience_title, ex.description AS experience_description,
            ex.content_type, ex.content_url, ex.raw_text, ex.timeline
     FROM ailab_events e
     JOIN ailab_experiences ex ON e.experience_id = ex.id
     WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getActiveEvent() {
  try {
    // Buscar evento 'live' o el evento 'scheduled' más próximo
    const { rows } = await query(
      `SELECT e.*, ex.title AS experience_title, ex.description AS experience_description,
              ex.content_type, ex.content_url, ex.raw_text, ex.timeline,
              NOW() AS server_now,
              EXTRACT(EPOCH FROM (NOW() - e.scheduled_at)) AS elapsed_seconds
       FROM ailab_events e
       JOIN ailab_experiences ex ON e.experience_id = ex.id
       WHERE e.status IN ('live', 'scheduled')
       ORDER BY CASE WHEN e.status = 'live' THEN 1 ELSE 2 END, e.scheduled_at ASC
       LIMIT 1`
    );

    if (rows.length === 0) return null;

    const evt = rows[0];
    const elapsed = parseFloat(evt.elapsed_seconds) || 0;

    // Actualizar estado si ya superó el tiempo programado y no estaba como 'live'
    if (evt.status === 'scheduled' && elapsed >= 0 && elapsed <= (evt.duration_seconds || 300)) {
      await query(`UPDATE ailab_events SET status = 'live' WHERE id = $1`, [evt.id]);
      evt.status = 'live';
    } else if (elapsed > (evt.duration_seconds || 300) && evt.status !== 'ended') {
      await query(`UPDATE ailab_events SET status = 'ended' WHERE id = $1`, [evt.id]);
      evt.status = 'ended';
    }

    return evt;
  } catch (err) {
    console.error('Error al obtener evento activo:', err);
    return null;
  }
}

async function cancelEvent(id) {
  const { rows } = await query(`UPDATE ailab_events SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id]);
  if (rows.length > 0) {
    broadcastToGlobalRoom('ailab:evento_cambio', { action: 'cancelled', eventId: id });
  }
  return rows.length > 0;
}

async function recordEventInteraction({ eventId, userId = null, userName = 'Usuario', interactionType, data = {} }) {
  const { rows } = await query(
    `INSERT INTO ailab_event_interactions (event_id, user_id, user_name, interaction_type, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [eventId, userId || null, userName, interactionType, JSON.stringify(data || {})]
  );

  const interaction = rows[0];

  // Transmitir la interacción a todos en la sala global para conteos y reacciones en vivo
  broadcastToGlobalRoom('ailab:interaccion_nueva', { eventId, interaction });

  return interaction;
}

async function getEventSyncInfo(eventId) {
  const { rows } = await query(
    `SELECT e.*, ex.title AS experience_title, ex.description AS experience_description,
            ex.content_type, ex.content_url, ex.raw_text, ex.timeline,
            NOW() AS server_now,
            EXTRACT(EPOCH FROM (NOW() - e.scheduled_at)) AS elapsed_seconds
     FROM ailab_events e
     JOIN ailab_experiences ex ON e.experience_id = ex.id
     WHERE e.id = $1`,
    [eventId]
  );

  if (rows.length === 0) return null;

  const eventData = rows[0];

  // Obtener resumen de interacciones (conteo de respuestas)
  const { rows: intRows } = await query(
    `SELECT interaction_type, data, COUNT(*) as total
     FROM ailab_event_interactions
     WHERE event_id = $1
     GROUP BY interaction_type, data`,
    [eventId]
  );

  return {
    event: eventData,
    server_now: eventData.server_now,
    elapsed_seconds: parseFloat(eventData.elapsed_seconds) || 0,
    interactions_summary: intRows,
  };
}

module.exports = {
  setAILabIO,
  getGlobalMessages,
  saveGlobalMessage,
  deleteGlobalMessage,
  processUserMessageInGlobalRoom,
  runAutoAIChatLoopTurn,
  stopAILabConversation,
  initAILabBackgroundJobs,
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
};
