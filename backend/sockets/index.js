const { verifyToken } = require('../utils/jwt');
const { query } = require('../db/postgres');
const { setIO, registerSocket, unregisterSocket, isOnline, emitToUser } = require('../utils/realtime');
const { registrarSenal } = require('../utils/recomendaciones');

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

    // ---------------- MENSAJERÍA (persistida en PostgreSQL) ----------------
    socket.on('mensaje:enviar', async ({ receiverId, text, imageData }, ack) => {
      try {
        if (!receiverId || (!text && !imageData)) {
          return ack && ack({ ok: false, error: 'Mensaje vacío.' });
        }
        if (await hayBloqueoEntre(userId, receiverId)) {
          return ack && ack({ ok: false, error: 'No puedes enviar mensajes a esta persona.' });
        }
        const convId = conversationId(userId, receiverId);
        const isDelivered = isOnline(receiverId);

        const { rows } = await query(
          `INSERT INTO messages (conversation_id, sender_id, receiver_id, text, image_data, delivered)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId",
                     text, image_data AS "imageData", delivered, read, created_at AS "createdAt"`,
          [convId, userId, receiverId, text || '', imageData || null, isDelivered]
        );
        const doc = rows[0];

        const [a, b] = [userId, receiverId].sort();
        const preview = text ? text.slice(0, 80) : '📷 Foto';
        await query(
          `INSERT INTO conversation_meta (user_a, user_b, last_message_at, last_message_preview)
           VALUES ($1,$2, now(), $3)
           ON CONFLICT (user_a, user_b) DO UPDATE SET last_message_at = now(), last_message_preview = $3`,
          [a, b, preview]
        );

        emitToUser(receiverId, 'mensaje:nuevo', doc);
        ack && ack({ ok: true, mensaje: doc });
        registrarSenal(userId, receiverId, 'mensaje', 3);
      } catch (err) {
        console.error('[socket] error enviando mensaje:', err.message);
        ack && ack({ ok: false, error: 'No se pudo enviar el mensaje.' });
      }
    });

    socket.on('mensaje:escribiendo', ({ receiverId }) => {
      emitToUser(receiverId, 'mensaje:escribiendo', { de: userId });
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

    // ---------------- DESCONEXIÓN ----------------
    socket.on('disconnect', async () => {
      unregisterSocket(userId, socket.id);
      if (!isOnline(userId)) {
        await query('UPDATE users SET is_online=false, last_seen_at=now() WHERE id=$1', [userId]).catch(() => {});
        broadcastPresencia(io, userId, false);
      }
    });
  });
}

function broadcastPresencia(io, userId, online) {
  io.emit('presencia:cambio', { userId, online });
}

module.exports = { initSockets };
