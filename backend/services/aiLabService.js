const { query } = require('../db/postgres');
const { getAISettings, chatCompletion } = require('./aiService');
const ToolManager = require('../tools/ToolManager');

let ioInstance = null;
let autoLoopTimer = null;
let retentionJobTimer = null;
let isProcessingAILoop = false;

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
 * Procesar mensaje enviado por un usuario a la sala global y generar respuesta de la IA
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
  const settings = await getAISettings();
  const isPaused = settings.ailab_auto_paused === 'true';

  // 1. Extraer archivo si existe
  let docResult = null;
  let fullUserMsg = messageText || '';

  if (fileData) {
    docResult = await ToolManager.executeTool('doc.extract', fileData, userId);
    if (docResult && docResult.data && docResult.data.extracted_text) {
      fullUserMsg += `\n\n[Documento Adjunto '${docResult.data.filename}']: ${docResult.data.extracted_text.slice(0, 3000)}`;
    }
  }

  // 3. Detectar si hay intención de herramienta (ej. buscar perfil, webcam, clima, etc.)
  const detectedTool = ToolManager.detectToolIntent(fullUserMsg);
  let toolResult = docResult;
  if (detectedTool && !toolResult) {
    toolResult = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, userId);
  }

  // 4. Guardar el mensaje del usuario en la base de datos
  const userMsgObj = await saveGlobalMessage({
    senderType: 'user',
    senderId: userId,
    senderName: userName,
    senderAvatar: userAvatar,
    text: messageText || (imageUrl ? '📷 Imagen adjunta' : '📄 Archivo adjunto'),
    imageUrl,
    attachments: fileData ? [{ filename: fileData.filename, mime: fileData.mimeType }] : null,
    toolResult,
  });

  // Si la IA está pausada por el administrador, se preserva el estado de pausa y no se genera respuesta
  if (isPaused) {
    return { userMessage: userMsgObj, aiMessage: null };
  }

  // Reiniciar contador de respuestas consecutivas de IA (un humano ha intervenido y la IA está activa)
  await query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('ailab_auto_consecutive_counter', '0', NOW())
     ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW()`
  ).catch(() => {});

  // 5. Seleccionar personaje de IA
  let activeChar = null;

  if (characterId) {
    const { rows } = await query(
      `SELECT * FROM ai_characters WHERE id = $1 AND (is_public = true OR user_id = $2)`,
      [characterId, userId]
    );
    if (rows.length > 0) activeChar = rows[0];
  }

  if (!activeChar && fullUserMsg.includes('@')) {
    const mentionMatch = fullUserMsg.match(/@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ\s]+)/);
    if (mentionMatch) {
      const charName = mentionMatch[1].trim();
      const { rows } = await query(
        `SELECT * FROM ai_characters WHERE LOWER(name) LIKE LOWER($1) AND (is_public = true OR user_id = $2) LIMIT 1`,
        [`%${charName}%`, userId]
      );
      if (rows.length > 0) activeChar = rows[0];
    }
  }

  if (!activeChar) {
    const { rows: chars } = await query(`SELECT * FROM ai_characters WHERE is_public = true ORDER BY RANDOM() LIMIT 1`);
    if (chars.length > 0) activeChar = chars[0];
  }

  if (!activeChar) {
    activeChar = {
      id: null,
      name: 'Link AI',
      avatar: '🤖',
      personality: 'Eres Link AI, el asistente inteligente principal de la sala global. Responde en español con precisión y dinamismo.'
    };
  }

  // Avisar estado "Pensando..."
  broadcastToGlobalRoom('ailab:status', {
    isWorking: true,
    text: `${activeChar.avatar || '🤖'} ${activeChar.name} está procesando respuesta...`
  });

  // 6. Obtener contexto reciente de la sala global
  const recentHistory = await getGlobalMessages(12);
  const formattedHistory = recentHistory.map(m => {
    if (m.sender_type === 'ai') {
      return { role: 'assistant', content: `${m.sender_name}: ${m.text}` };
    } else {
      return { role: 'user', content: `${m.sender_name}: ${m.text}` };
    }
  });

  const sysPrompt = `Eres ${activeChar.name} (${activeChar.personality}). Estás en la sala global pública de Enlace con todos los usuarios. Responde amablemente en español manteniendo siempre tu personaje. Puedes usar formato conciso y emojis si aplica.`;

  let toolContextText = '';
  if (toolResult) {
    if (toolResult.error) {
      toolContextText = `\n\n[Información de Herramienta '${detectedTool?.tool || 'desconocida'}']: Ocurrió un error al consultar: ${toolResult.error}`;
    } else if (toolResult.data) {
      toolContextText = `\n\n[Datos obtenidos de la herramienta '${detectedTool?.tool || toolResult.type || 'ejecutada'}']: ${JSON.stringify(toolResult.data)}`;
    }
  }

  try {
    const aiResult = await chatCompletion({
      messages: [
        { role: 'system', content: sysPrompt },
        ...formattedHistory,
        { role: 'user', content: `${userName}: ${fullUserMsg}${toolContextText}` }
      ],
      maxTokens: settings.ai_max_tokens,
      visionImage: imageUrl || null,
    });

    // 7. Guardar y transmitir respuesta de la IA
    const aiMsgObj = await saveGlobalMessage({
      senderType: 'ai',
      senderId: activeChar.id,
      senderName: activeChar.name,
      senderAvatar: activeChar.avatar || '🤖',
      text: aiResult.reply || 'Coincido con tu mensaje.',
      toolResult: toolResult && toolResult.type ? toolResult : null,
    });

    broadcastToGlobalRoom('ailab:status', { isWorking: false });
    return { userMessage: userMsgObj, aiMessage: aiMsgObj };
  } catch (err) {
    broadcastToGlobalRoom('ailab:status', { isWorking: false });
    console.error('Error generando respuesta de IA en sala global:', err);
    throw err;
  }
}

/**
 * Bucle autónomo de conversación IA <-> IA sin requerir usuarios conectados
 */
async function runAutoAIChatLoopTurn() {
  if (isProcessingAILoop) return;
  isProcessingAILoop = true;

  try {
    const settings = await getAISettings();

    const isEnabled = settings.ailab_auto_enabled !== 'false';
    const isPaused = settings.ailab_auto_paused === 'true';

    if (!isEnabled || isPaused) {
      isProcessingAILoop = false;
      return;
    }

    const maxTurnsRaw = settings.ailab_auto_max_consecutive_turns;
    const maxTurns = (maxTurnsRaw === '0' || maxTurnsRaw === 0 || maxTurnsRaw === 'unlimited') ? Infinity : (parseInt(maxTurnsRaw, 10) || 10);
    const currentCounter = parseInt(settings.ailab_auto_consecutive_counter, 10) || 0;

    if (maxTurns !== Infinity && currentCounter >= maxTurns) {
      isProcessingAILoop = false;
      return;
    }

    const { rows: chars } = await query(`SELECT * FROM ai_characters WHERE is_public = true ORDER BY created_at ASC`);
    if (chars.length < 2) {
      isProcessingAILoop = false;
      return;
    }

    const { rows: lastMsgs } = await query(
      `SELECT * FROM ailab_messages WHERE is_deleted = false ORDER BY created_at DESC LIMIT 10`
    );

    const lastSpeakerId = lastMsgs.length > 0 ? lastMsgs[0].sender_id : null;

    let nextSpeaker = chars.find(c => c.id !== lastSpeakerId);
    if (!nextSpeaker) nextSpeaker = chars[0];

    let otherSpeaker = chars.find(c => c.id !== nextSpeaker.id) || chars[1];

    const recentHistory = lastMsgs.slice().reverse();
    const formattedHistory = recentHistory.map(m => ({
      role: m.sender_type === 'ai' ? 'assistant' : 'user',
      content: `${m.sender_name}: ${m.text}`
    }));

    const lastText = recentHistory.length > 0
      ? recentHistory[recentHistory.length - 1].text
      : '¿Qué opinan sobre el avance de la ciencia y la tecnología en la sociedad actual?';

    const sysPrompt = `Eres ${nextSpeaker.name}. Tu personalidad es: "${nextSpeaker.personality}". Estás en un diálogo en vivo en la sala global pública con ${otherSpeaker.name} y la comunidad. Responde de forma concisa (2-3 oraciones en español), natural y amigable dirigiéndote a los demás o continuando la conversación.`;

    broadcastToGlobalRoom('ailab:status', {
      isWorking: true,
      text: `${nextSpeaker.avatar || '🤖'} ${nextSpeaker.name} está conversando...`
    });

    const result = await chatCompletion({
      messages: [
        { role: 'system', content: sysPrompt },
        ...formattedHistory,
        { role: 'user', content: `Tema/Mensaje actual: ${lastText}` }
      ],
      maxTokens: settings.ai_max_tokens
    });

    broadcastToGlobalRoom('ailab:status', { isWorking: false });

    if (result && result.reply && result.reply.trim()) {
      await saveGlobalMessage({
        senderType: 'ai',
        senderId: nextSpeaker.id,
        senderName: nextSpeaker.name,
        senderAvatar: nextSpeaker.avatar || '🤖',
        text: result.reply.trim()
      });

      const newCounter = currentCounter + 1;
      await query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('ailab_auto_consecutive_counter', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [String(newCounter)]
      ).catch(() => {});

      broadcastToGlobalRoom('ailab:auto_status', {
        counter: newCounter,
        maxTurns,
        paused: newCounter >= maxTurns
      });
    }
  } catch (err) {
    broadcastToGlobalRoom('ailab:status', { isWorking: false });
    console.error('Error en bucle autónomo IA <-> IA:', err);
  } finally {
    isProcessingAILoop = false;
  }
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

  let intervalSec = 30;
  try {
    const settings = await getAISettings();
    if (settings.ailab_auto_interval_min) {
      intervalSec = Math.max(5, Math.round((parseFloat(settings.ailab_auto_interval_min) || 0.5) * 60));
    } else {
      intervalSec = Math.max(5, parseInt(settings.ailab_auto_interval_sec, 10) || 30);
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

  scheduleNextAutoLoopTurn();

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
  initAILabBackgroundJobs,
};
