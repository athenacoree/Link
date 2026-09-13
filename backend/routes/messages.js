const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

// ---- Lista de conversaciones (metadatos rápidos en Postgres) ----
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cm.*, u.id AS otro_id, u.name AS otro_nombre, u.avatar_data AS otro_avatar, u.is_online
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
    const convId = conversationId(req.userId, req.params.otroId);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : new Date();

    const { rows: mensajes } = await query(
      `SELECT id, conversation_id AS "conversationId", sender_id AS "senderId", receiver_id AS "receiverId",
              text, image_data AS "imageData", delivered, read, created_at AS "createdAt"
         FROM messages
        WHERE conversation_id = $1 AND created_at < $2
        ORDER BY created_at DESC LIMIT $3`,
      [convId, before, limit]
    );

    await query(
      `UPDATE messages SET read = true WHERE conversation_id = $1 AND receiver_id = $2 AND read = false`,
      [convId, req.userId]
    ).catch(() => {});

    res.json({ mensajes: mensajes.reverse() });
  } catch (err) {
    console.error('[messages GET /:otroId]', err);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
});

module.exports = router;
