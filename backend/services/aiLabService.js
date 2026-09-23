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

module.exports = {
  setAILabIO,
  getGlobalMessages,
  saveGlobalMessage,
  deleteGlobalMessage,
  processUserMessageInGlobalRoom,
  runAutoAIChatLoopTurn,
  stopAILabConversation,
  initAILabBackgroundJobs,
};
