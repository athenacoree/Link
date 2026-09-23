const { verifyToken } = require('../utils/jwt');
const { query } = require('../db/postgres');
const { setIO, registerSocket, unregisterSocket, isOnline, emitToUser } = require('../utils/realtime');
const { registrarSenal } = require('../utils/recomendaciones');
const { initAILabBackgroundJobs } = require('../services/aiLabService');

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

async function hayBloqueoEntre(a, b) {
  const { rows } = await query(
    `SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)) AS hay`,
    [a, b]
  );
  return rows[0].hay;
}

function initSockets(io) {
  setIO(io);
  initAILabBackgroundJobs(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Falta token de autenticación'));
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch (e) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    registerSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    await query('UPDATE users SET is_online=true WHERE id=$1', [userId]).catch(() => {});
    broadcastPresencia(io, userId, true);

    // ---------------- SALA GLOBAL DE LABORATORIO IA ----------------
    socket.on('ailab:unirse', () => {
      socket.join('room:ailab');
    });

    socket.on('ailab:salir', () => {
      socket.leave('room:ailab');
    });

    // ---------------- MENSAJERÍA PRIVADA (persistida en PostgreSQL) ----------------
    socket.on('mensaje:enviar', async ({ receiverId, text, imageData, audioData, audioDuration, replyToId }, ack) => {
      try {
        if (!receiverId || (!text && !imageData && !audioData)) {
          return ack && ack({ ok: false, error: 'Mensaje vacío.' });
        }
        if (await hayBloqueoEntre(userId, receiverId)) {
          return ack && ack({ ok: false, error: 'No puedes enviar mensajes a esta persona.' });
        }
        const convId = conversationId(userId, receiverId);
        const isDelivered = isOnline(receiverId);

        const { rows } = await query(
          `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, image_data, audio_data, audio_duration, reply_to_id, delivered)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId",
                     text, image_data AS "imageData", audio_data AS "audioData", audio_duration AS "audioDuration",
                     reply_to_id AS "replyToId", delivered, read, read_at AS "readAt", reactions, deleted_for_all AS "deletedForAll",
                     created_at AS "createdAt"`,
          [convId, userId, receiverId, text || '', imageData || null, audioData || null, audioDuration || 0, replyToId || null, isDelivered]
        );
        const doc = rows[0];

        // Fetch reply_to details if present
        if (doc.replyToId) {
          const { rows: rRows } = await query(
            `SELECT text, image_data AS "imageData", audio_data AS "audioData", sender_id AS "senderId" FROM messages WHERE id = $1`,
            [doc.replyToId]
          );
          if (rRows.length) doc.replyTo = rRows[0];
        }

        const [a, b] = [userId, receiverId].sort();
        const preview = audioData ? '🎤 Nota de voz' : text ? text.slice(0, 80) : '📷 Foto';
        await query(
          `INSERT INTO conversation_meta (user_a, user_b, last_message_at, last_message_preview)
           VALUES ($1,$2, now(), $3)
           ON CONFLICT (user_a, user_b) DO UPDATE SET last_message_at = now(), last_message_preview = $3`,
          [a, b, preview]
        );

        emitToUser(receiverId, 'mensaje:nuevo', doc);
        ack && ack({ ok: true, mensaje: doc });
        registrarSenal(userId, receiverId, 'mensaje', 3);

        // Interceptor de mención @ai en chats de terceros
        if (text && (text.includes('@ai') || text.includes('@LinkAI') || text.includes('@linkai'))) {
          const LINK_AI_UUID = '00000000-0000-0000-0000-0000000000a1';
          const { chatCompletion } = require('../services/aiService');
          const ToolManager = require('../tools/ToolManager');

          setTimeout(async () => {
            try {
              const queryText = text.replace(/@(ai|LinkAI|linkai)/gi, '').trim() || 'Hola';
              const attachedImage = imageData || (doc.replyTo ? doc.replyTo.imageData : null);

              const detectedTool = ToolManager.detectToolIntent(queryText);
              let toolRes = null;
              if (detectedTool) {
                if (detectedTool.tool === 'image.edit') {
                  detectedTool.params.image_base64 = detectedTool.params.image_base64 || attachedImage;
                }
                toolRes = await ToolManager.executeTool(detectedTool.tool, detectedTool.params, userId);
              }

              const sysPrompt = `Eres Link AI integrándote temporalmente en un chat de terceros. Responde de forma breve, amigable y natural al usuario. Tienes la capacidad de editar imágenes. Si el usuario te envía o señala una foto sin dar instrucciones de qué editar, pregúntale de forma natural qué cambios desea hacerle. Al final de tu mensaje, aclara amablemente que te retiras del chat hasta que te vuelvan a mencionar con @ai.`;
              const aiComp = await chatCompletion({
                messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: queryText }],
                visionImage: attachedImage || null,
              });

              const replyText = aiComp.reply || '🤖 Hola, aquí estoy. Me retiro por ahora hasta que me vuelvas a mencionar con @ai.';

              const { rows: aiRows } = await query(
                `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, delivered)
                 VALUES ($1, $2, $3, $4, true)
                 RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId",
                           text, delivered, read, created_at AS "createdAt"`,
                [convId, LINK_AI_UUID, receiverId, replyText]
              );
              const aiDoc = aiRows[0];
              aiDoc.isAiMentionCard = true;
              aiDoc.tool_result = toolRes;

              emitToUser(userId, 'mensaje:nuevo', aiDoc);
              emitToUser(receiverId, 'mensaje:nuevo', aiDoc);
            } catch (errAi) {
              console.error('[socket] error en integración @ai:', errAi.message);
            }
          }, 600);
        }
      } catch (err) {
        console.error('[socket] error enviando mensaje:', err.message);
        ack && ack({ ok: false, error: 'No se pudo enviar el mensaje.' });
      }
    });

    socket.on('mensaje:escribiendo', ({ receiverId }) => {
      emitToUser(receiverId, 'mensaje:escribiendo', { de: userId });
    });

    socket.on('mensaje:detener_escribiendo', ({ receiverId }) => {
      emitToUser(receiverId, 'mensaje:detener_escribiendo', { de: userId });
    });

    socket.on('mensaje:leido', async ({ messageIds, senderId }) => {
      try {
        if (!Array.isArray(messageIds) || !messageIds.length) return;
        const { rows } = await query(
          `UPDATE messages SET read = true, read_at = now()
           WHERE id = ANY($1::uuid[]) AND receiver_id = $2
           RETURNING id, read_at AS "readAt", sender_id AS "senderId"`,
          [messageIds, userId]
        );
        if (rows.length && senderId) {
          emitToUser(senderId, 'mensaje:leido_confirmacion', { messageIds: rows.map(r => r.id), readAt: rows[0].readAt });
        }
      } catch (err) {
        console.error('[socket] error marcando leido:', err.message);
      }
    });

    socket.on('mensaje:reaccionar', async ({ messageId, receiverId, emoji }, ack) => {
      try {
        const { rows: mRows } = await query(`SELECT reactions FROM messages WHERE id = $1`, [messageId]);
        if (!mRows.length) return ack && ack({ ok: false });
        let reactions = mRows[0].reactions || {};
        if (emoji) {
          reactions[userId] = emoji;
        } else {
          delete reactions[userId];
        }
        await query(`UPDATE messages SET reactions = $1 WHERE id = $2`, [reactions, messageId]);
        emitToUser(receiverId, 'mensaje:reaccion', { messageId, reactions });
        ack && ack({ ok: true, reactions });
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    socket.on('mensaje:eliminar', async ({ messageId, receiverId }, ack) => {
      try {
        await query(`UPDATE messages SET deleted_for_all = true, text = '', image_data = NULL, audio_data = NULL WHERE id = $1 AND sender_id = $2`, [messageId, userId]);
        emitToUser(receiverId, 'mensaje:eliminado', { messageId });
        ack && ack({ ok: true });
      } catch (err) {
        ack && ack({ ok: false, error: err.message });
      }
    });

    // ---------------- LLAMADAS: señalización WebRTC ----------------
    socket.on('llamada:invitar', async ({ calleeId, callType }) => {
      if (await hayBloqueoEntre(userId, calleeId)) {
        socket.emit('llamada:no-disponible', { calleeId });
        return;
      }
      if (!isOnline(calleeId)) {
        socket.emit('llamada:no-disponible', { calleeId });
        return;
      }

      let callId = null;
      try {
        const { rows } = await query(
          `INSERT INTO calls (caller_id, callee_id, call_type, status, started_at)
           VALUES ($1, $2, $3, 'iniciada', now()) RETURNING id`,
          [userId, calleeId, callType || 'audio']
        );
        callId = rows[0]?.id;
      } catch (e) {
        console.error('[calls] error registrando llamada iniciada:', e.message);
      }

      emitToUser(calleeId, 'llamada:entrante', { callerId: userId, callType, callId });
      registrarSenal(userId, calleeId, 'llamada', 4);
    });

    socket.on('llamada:responder', async ({ callerId, callId, aceptar }) => {
      const status = aceptar ? 'conectada' : 'rechazada';
      if (callId) {
        query(
          `UPDATE calls SET status = $1, ended_at = CASE WHEN $2 = false THEN now() ELSE NULL END WHERE id = $3`,
          [status, aceptar, callId]
        ).catch(() => {});
      }
      emitToUser(callerId, 'llamada:respondida', { calleeId: userId, aceptar, callId });
    });

    socket.on('llamada:colgar', async ({ destinoId, callId, duracionSegundos }) => {
      if (callId) {
        query(
          `UPDATE calls SET status = 'finalizada', ended_at = now(), duration_seconds = $1 WHERE id = $2`,
          [Number(duracionSegundos) || 0, callId]
        ).catch(() => {});
      }
      emitToUser(destinoId, 'llamada:colgar', { deId: userId });
    });

    socket.on('llamada:oferta', ({ calleeId, sdp }) => {
      emitToUser(calleeId, 'llamada:oferta', { callerId: userId, sdp });
    });

    socket.on('llamada:respuesta-sdp', ({ callerId, sdp }) => {
      emitToUser(callerId, 'llamada:respuesta-sdp', { calleeId: userId, sdp });
    });

    socket.on('llamada:ice-candidate', ({ destinoId, candidate }) => {
      emitToUser(destinoId, 'llamada:ice-candidate', { deId: userId, candidate });
    });

    socket.on('llamada:chat', ({ destinoId, text }) => {
      emitToUser(destinoId, 'llamada:chat', { deId: userId, text });
    });

    // ---------------- GRUPOS Y TIEMPO REAL EXTRA ----------------
    socket.on('grupo:mensaje', ({ groupId, members, text, imageData, audioData }) => {
      if (Array.isArray(members)) {
        members.forEach(memberId => {
          if (memberId !== userId) {
            emitToUser(memberId, 'grupo:mensaje', {
              groupId,
              senderId: userId,
              text,
              imageData,
              audioData,
              createdAt: new Date().toISOString()
            });
          }
        });
      }
    });

    socket.on('post:live_reaction', ({ postId, reaction, authorId }) => {
      if (authorId && authorId !== userId) {
        emitToUser(authorId, 'post:live_reaction', { postId, reaction, fromUserId: userId });
      }
    });

    // ---------------- DESCONEXIÓN ----------------
    socket.on('disconnect', async () => {
      unregisterSocket(userId, socket.id);
      if (!isOnline(userId)) {
        await query('UPDATE users SET is_online=false, last_seen=now() WHERE id=$1', [userId]).catch(() => {});
        broadcastPresencia(io, userId, false);
      }
    });
  });
}

function broadcastPresencia(io, userId, online) {
  io.emit('presencia:cambio', { userId, online });
}

module.exports = { initSockets };
