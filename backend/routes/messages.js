const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { isUUID } = require('../utils/validation');

const router = express.Router();

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

// ---- Búsqueda global de mensajes ----
router.get('/buscar', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ resultados: [] });
  const { rows } = await query(
    `SELECT m.*, u.name AS sender_name, u.avatar_data AS sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
        AND m.text ILIKE $2
        AND m.deleted_for_all = false
      ORDER BY m.created_at DESC LIMIT 30`,
    [req.userId, `%${q}%`]
  );
  res.json({ resultados: rows });
});

// ---- Silenciar / Desilenciar conversación ----
router.post('/silenciar/:targetId', requireAuth, async (req, res) => {
  if (!isUUID(req.params.targetId)) return res.status(400).json({ error: 'ID no válido.' });
  const existing = await query(
    'SELECT 1 FROM muted_conversations WHERE user_id=$1 AND target_id=$2',
    [req.userId, req.params.targetId]
  );
  if (existing.rows.length) {
    await query('DELETE FROM muted_conversations WHERE user_id=$1 AND target_id=$2', [req.userId, req.params.targetId]);
    return res.json({ silenciado: false });
  }
  await query('INSERT INTO muted_conversations (user_id, target_id) VALUES ($1,$2)', [req.userId, req.params.targetId]);
  res.json({ silenciado: true });
});

// ---- Fijar / Desfijar mensaje en conversación ----
router.post('/fijar/:messageId', requireAuth, async (req, res) => {
  if (!isUUID(req.params.messageId)) return res.status(400).json({ error: 'ID de mensaje no válido.' });
  const msg = await query('SELECT * FROM messages WHERE id=$1', [req.params.messageId]);
  if (!msg.rows.length) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  const message = msg.rows[0];
  if (message.sender_id !== req.userId && message.receiver_id !== req.userId) {
    return res.status(403).json({ error: 'No tienes acceso a este mensaje.' });
  }

  const existingConv = await query(
    'SELECT pinned_message_id FROM conversations WHERE id=$1',
    [message.conversation_id]
  );
  const estaFijado = existingConv.rows[0]?.pinned_message_id === message.id;
  const nuevoPinned = estaFijado ? null : message.id;

  await query(
    `INSERT INTO conversations (id, pinned_message_id) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET pinned_message_id = $2`,
    [message.conversation_id, nuevoPinned]
  );

  res.json({ fijado: !estaFijado, messageId: message.id, text: message.text });
});

// ---- Lista de conversaciones (metadatos rápidos en Postgres) ----
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cm.*, u.id AS otro_id, u.name AS otro_nombre, u.avatar_data AS otro_avatar, u.is_online, u.last_seen
         FROM conversation_meta cm
         JOIN users u ON u.id = (CASE WHEN cm.user_a = $1 THEN cm.user_b ELSE cm.user_a END)
        WHERE cm.user_a = $1 OR cm.user_b = $1
        ORDER BY cm.last_message_at DESC NULLS LAST`,
      [req.userId]
    );
    res.json({ conversaciones: rows });
  } catch (err) {
    console.error('[messages GET /]', err);
    res.status(500).json({ error: 'Error al obtener conversaciones.' });
  }
});

// ---- Historial de mensajes con una persona (PostgreSQL) ----
router.get('/:otroId', requireAuth, async (req, res) => {
  try {
    let targetId = req.params.otroId;
    if (targetId === 'link_ai' || targetId === 'link_ai_bot') {
      targetId = '00000000-0000-0000-0000-0000000000a1';
    }
    if (!isUUID(targetId)) return res.status(400).json({ error: 'ID de usuario no válido.' });
    const convId = conversationId(req.userId, targetId);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : new Date();

    const { rows: mensajes } = await query(
      `SELECT m.id, m.conversation_id AS "conversationId", m.sender_id AS "senderId", m.receiver_id AS "receiverId",
              m.text, m.image_data AS "imageData", m.audio_data AS "audioData", m.audio_duration AS "audioDuration",
              m.reply_to_id AS "replyToId", m.delivered, m.read, m.read_at AS "readAt", m.reactions, m.deleted_for_all AS "deletedForAll",
              m.created_at AS "createdAt",
              r.text AS "replyText", r.image_data AS "replyImageData", r.audio_data AS "replyAudioData", r.sender_id AS "replySenderId"
         FROM messages m
    LEFT JOIN messages r ON m.reply_to_id = r.id
        WHERE m.conversation_id = $1 AND m.created_at < $2
        ORDER BY m.created_at DESC LIMIT $3`,
      [convId, before, limit]
    );

    // Format reply_to structure
    const formatted = mensajes.map((msg) => {
      const { replyText, replyImageData, replyAudioData, replySenderId, ...rest } = msg;
      if (rest.replyToId) {
        rest.replyTo = {
          text: replyText,
          imageData: replyImageData,
          audioData: replyAudioData,
          senderId: replySenderId,
        };
      }
      return rest;
    });

    await query(
      `UPDATE messages SET read = true, read_at = now() WHERE conversation_id = $1 AND receiver_id = $2 AND read = false`,
      [convId, req.userId]
    ).catch(() => {});

    res.json({ mensajes: formatted.reverse() });
  } catch (err) {
    console.error('[messages GET /:otroId]', err);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
});

module.exports = router;
