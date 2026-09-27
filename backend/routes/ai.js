const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { getAISettings, chatCompletion } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

const router = express.Router();
const LINK_AI_UUID = '00000000-0000-0000-0000-0000000000a1';

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

// Simple in-memory rate limiting map for AI requests
const aiRateLimitMap = new Map();

function aiRateLimiter(req, res, next) {
  const key = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 40; // Límite máximo de peticiones por minuto

  let record = aiRateLimitMap.get(key);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, startTime: now };
  } else {
    record.count++;
  }
  aiRateLimitMap.set(key, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Has alcanzado el límite de peticiones de IA por minuto. Por favor espera un momento.',
        retryable: true,
      }
    });
  }
  next();
}

// GET /api/ai/config -> Configuración pública y herramientas
router.get('/config', requireAuth, async (req, res) => {
  try {
    const settings = await getAISettings();
    const available = true;

    res.json({
      available,
      provider: 'gemini',
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      personality: settings.ai_personality,
      model: settings.gemini_model,
      max_tokens: parseInt(settings.ai_max_tokens, 10) || 1000,
      context_tokens: parseInt(settings.ai_context_tokens, 10) || 4000,
      tools: ToolManager.getToolDefinitions(),
    });
  } catch (err) {
    console.error('Error en /api/ai/config:', err);
    res.status(500).json({ error: 'No se pudo obtener la configuración de IA.' });
  }
});

// POST /api/ai/chat -> Chat principal con el Asistente de IA
router.post('/chat', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const settings = await getAISettings();
    const { messages, prompt, tool_name, tool_params, vision_image, file_data, image_base64, image_data } = req.body;
    const currentImage = image_base64 || image_data || vision_image || null;

    // Ejecución explícita de herramienta si fue solicitada
    if (tool_name) {
      const toolResult = await ToolManager.executeTool(tool_name, tool_params || {}, req.user.id);
      return res.json({
        available: true,
        tool_result: toolResult,
        reply: toolResult.error ? `⚠️ ${toolResult.error}` : null
      });
    }

    let userPrompt = prompt || (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.content : '');

    // Si se adjunta un archivo/documento, procesar extracción de texto
    let docResult = null;
    if (file_data) {
      docResult = await ToolManager.executeTool('doc.extract', file_data, req.user.id);
      if (docResult && docResult.data && docResult.data.extracted_text) {
        userPrompt += `\n\n[Contenido del documento adjunto '${docResult.data.filename}']: ${docResult.data.extracted_text.slice(0, 3000)}`;
      }
    }

    // Obtener contexto del usuario actual (rol, verificado, intereses, ubicación, fecha/hora real, etapa de vida y foto)
    let userCityCountry = '';
    let userContextText = '';
    const dateObj = new Date();
    const nowRealTime = dateObj.toLocaleString('es-ES', { timeZone: 'America/Havana', dateStyle: 'full', timeStyle: 'medium' });

    // Determinar periodo del día (Mañana / Tarde / Noche)
    const currentHour = parseInt(dateObj.toLocaleString('es-ES', { timeZone: 'America/Havana', hour: '2-digit', hour12: false }), 10);
    let periodoDia = 'Mañana';
    if (currentHour >= 12 && currentHour < 18) {
      periodoDia = 'Tarde';
    } else if (currentHour >= 18 || currentHour < 6) {
      periodoDia = 'Noche';
    }
    try {
      const { rows: uRows } = await query(
        `SELECT id, name, username, is_admin, verified, role, interests, hobbies, city, country, profession, avatar_data, age, birthdate, gender FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (uRows.length > 0) {
        const u = uRows[0];
        userCityCountry = [u.city, u.country].filter(Boolean).join(', ') || 'La Habana, Cuba';
        const esAdmin = u.is_admin || u.role === 'admin';
        const esVerificado = !!u.verified;
        const tieneFotoPerfil = !!(u.avatar_data && u.avatar_data.length > 50);

        // Determinar etapa de vida (niño, adolescente, adulto)
        let etapaVida = 'Adulto';
        const edadNum = parseInt(u.age, 10);
        if (!isNaN(edadNum)) {
          if (edadNum < 12) etapaVida = 'Niño/Niña';
          else if (edadNum < 18) etapaVida = 'Adolescente';
          else etapaVida = 'Adulto';
        }

        let ints = [];
        try { ints = typeof u.interests === 'string' ? JSON.parse(u.interests) : (u.interests || []); } catch (e) {}
        userContextText = `\n[Contexto del Usuario interactuando contigo]:
- Nombre: ${u.name} (@${u.username})
- Rol en la plataforma: ${esAdmin ? 'Administrador Principal 👑' : (u.role || 'Usuario Común')}
- Verificado: ${esVerificado ? 'Sí ✓' : 'No'}
- Etapa de vida / Edad: ${etapaVida} ${u.age ? `(${u.age} años)` : ''}
- Género / Identidad: ${u.gender || 'No especificado'}
- Foto de Perfil activa: ${tieneFotoPerfil ? 'Sí (El usuario posee foto de perfil en la plataforma, pero los datos binarios no son enviados directamente a la IA por privacidad)' : 'No tiene foto personalizada'}
- Ubicación: ${u.city || ''} ${u.country || ''}
- Profesión: ${u.profession || 'N/A'}
- Intereses: ${Array.isArray(ints) ? ints.join(', ') : ''}`;
      }
    } catch (e) {}

    let toolResult = docResult;
    let detectedIntent = null;

    // Detectar intención explícita en lenguaje natural antes de invocar la IA y responder directamente sin pasar por Gemini
    if (!toolResult && userPrompt) {
      detectedIntent = ToolManager.detectToolIntent(userPrompt);
      if (detectedIntent && detectedIntent.tool) {
        try {
          toolResult = await ToolManager.executeTool(detectedIntent.tool, detectedIntent.params || {}, req.user.id);
        } catch (tErr) {
          console.error(`[AI Route] Error al ejecutar herramienta por intención '${detectedIntent.tool}':`, tErr);
          toolResult = { error: tErr.message };
        }

        // Retorno directo sin invocar la API de Gemini (Bypass Gemini para intenciones locales)
        let replyText = 'He procesado tu solicitud localmente en la plataforma.';
        if (toolResult && toolResult.message) {
          replyText = toolResult.message;
        } else if (toolResult && toolResult.reply) {
          replyText = toolResult.reply;
        } else if (toolResult && toolResult.title) {
          replyText = `Aquí tienes la opción solicitada: ${toolResult.title}`;
        }

        let aiMessageObj = null;
        try {
          const convId = conversationId(req.user.id, LINK_AI_UUID);
          const rawUserPrompt = prompt || userPrompt || '';

          await query(
            `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, delivered, read, created_at)
             VALUES ($1, $2, $3, $4, true, true, now())`,
            [convId, req.user.id, LINK_AI_UUID, rawUserPrompt]
          );

          const aiMsgRes = await query(
            `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, delivered, read, created_at)
             VALUES ($1, $2, $3, $4, true, true, now())
             RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId", text, delivered, read, created_at AS "createdAt"`,
            [convId, LINK_AI_UUID, req.user.id, replyText]
          );
          aiMessageObj = aiMsgRes.rows[0];

          const [userA, userB] = [req.user.id, LINK_AI_UUID].sort();
          await query(
            `INSERT INTO conversation_meta (id, user_a, user_b, last_message_at, last_message_preview)
             VALUES ($1, $2, $3, now(), $4)
             ON CONFLICT (id) DO UPDATE SET last_message_at = now(), last_message_preview = $4`,
            [convId, userA, userB, replyText.slice(0, 150)]
          );
        } catch (e) {
          console.warn('[AI Local Chat Save Error]', e.message);
        }

        return res.json({
          available: true,
          reply: replyText,
          name: settings.ai_name || 'Link AI',
          avatar: settings.ai_avatar || '',
          model_used: 'local_intent_parser',
          provider: 'local',
          finish_reason: 'stop',
          tool_result: toolResult,
          executed_tools: [detectedIntent.tool],
          continuations: 0,
          ai_message: aiMessageObj,
        });
      }
    }

    let toolContextText = '';
    if (toolResult) {
      if (toolResult.error) {
        toolContextText = `\n\n[Información de Herramienta Adjunta]: Ocurrió un error al consultar: ${toolResult.error}`;
      } else {
        const payload = toolResult.data !== undefined ? toolResult.data : toolResult;
        toolContextText = `\n\n[Resultado de Herramienta Ejecutada Localmente]: ${JSON.stringify(payload)}`;
      }
    }


    const rulesPrompt = `\n[Reglas del Asistente]:
- Saludo según Horario: Activa actualmente la ${periodoDia.toUpperCase()} (${nowRealTime}). Si saludas, utiliza un saludo acorde ("¡Buenos días!", "¡Buenas tardes!" o "¡Buenas noches!").
- PRIVACIDAD ESTRICTA: NUNCA revelas mensajes privados, conversaciones ni información confidencial.
- Respuestas ajustadas: Mensajes normales y cortos por defecto para una conversación fluida.`;

    const fullSystemPrompt = `${settings.ai_personality}\n[Fecha y Hora en tiempo real]: ${nowRealTime}${userContextText}${rulesPrompt}`;

    let inputMessages = [];
    if (Array.isArray(messages) && messages.length > 0) {
      inputMessages = [...messages];
    } else {
      inputMessages.push({ role: 'system', content: fullSystemPrompt });
      // Cargar únicamente el último mensaje previo de la IA para un contexto mínimo y liviano
      try {
        const convId = conversationId(req.user.id, LINK_AI_UUID);
        const { rows: historyRows } = await query(
          `SELECT text FROM messages WHERE conversation_id = $1 AND sender_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [convId, LINK_AI_UUID]
        );
        if (historyRows.length > 0 && historyRows[0].text) {
          inputMessages.push({
            role: 'assistant',
            content: historyRows[0].text
          });
        }
      } catch (e) {
        // Ignorar si falla lectura de historial
      }
      inputMessages.push({ role: 'user', content: (userPrompt || 'Hola') + toolContextText });
    }

    if (messages && toolContextText && inputMessages.length > 0) {
      const lastMsg = { ...inputMessages[inputMessages.length - 1] };
      if (lastMsg.role === 'user') {
        lastMsg.content = (lastMsg.content || '') + toolContextText;
        inputMessages[inputMessages.length - 1] = lastMsg;
      } else {
        inputMessages.push({ role: 'user', content: toolContextText });
      }
    }

    const result = await chatCompletion({
      messages: inputMessages,
      systemPrompt: fullSystemPrompt,
      maxTokens: settings.ai_max_tokens,
      visionImage: currentImage || vision_image || null,
    });

    let finalToolResult = toolResult;

    // Guardar la conversación en la base de datos PostgreSQL
    let aiMessageObj = null;
    if (userPrompt || prompt) {
      try {
        const convId = conversationId(req.user.id, LINK_AI_UUID);
        const rawUserPrompt = prompt || userPrompt || '';

        await query(
          `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, delivered, read, created_at)
           VALUES ($1, $2, $3, $4, true, true, now())`,
          [convId, req.user.id, LINK_AI_UUID, rawUserPrompt]
        );

        const aiMsgRes = await query(
          `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, delivered, read, created_at)
           VALUES ($1, $2, $3, $4, true, true, now())
           RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId", text, delivered, read, created_at AS "createdAt"`,
          [convId, LINK_AI_UUID, req.user.id, result.reply]
        );
        aiMessageObj = aiMsgRes.rows[0];

        const [userA, userB] = [req.user.id, LINK_AI_UUID].sort();
        await query(
          `INSERT INTO conversation_meta (id, user_a, user_b, last_message_at, last_message_preview)
           VALUES ($1, $2, $3, now(), $4)
           ON CONFLICT (id) DO UPDATE SET last_message_at = now(), last_message_preview = $4`,
          [convId, userA, userB, result.reply.slice(0, 150)]
        );
      } catch (e) {
        console.warn('[AI Chat Save Error]', e.message);
      }
    }

    res.json({
      available: result.available,
      reply: result.reply,
      name: settings.ai_name || 'Link AI',
      avatar: settings.ai_avatar || '',
      model_used: result.model_used,
      provider: result.provider,
      finish_reason: result.finish_reason,
      usage: result.usage,
      tool_result: finalToolResult,
      executed_tools: result.executed_tools || [],
      continuations: result.continuations || 0,
      ai_message: aiMessageObj,
    });
  } catch (err) {
    console.error('Error en /api/ai/chat:', err);
    res.status(500).json({ error: `⚠️ No se pudo completar esta acción. El proveedor no respondió correctamente.` });
  }
});

// GET /api/ai/download-zip -> Descargar un ZIP generado por la IA
router.get('/download-zip', async (req, res) => {
  try {
    const filename = req.query.filename || 'paquete_link_ai.zip';
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('Info_Link_AI.txt', Buffer.from('Archivo comprimido ZIP generado por Link AI en la red social Link.\n¡Gracias por utilizar Link AI!', 'utf8'));

    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(zipBuffer);
  } catch (err) {
    console.error('Error en download-zip:', err);
    res.status(500).json({ error: 'No se pudo generar el archivo ZIP.' });
  }
});

module.exports = router;
