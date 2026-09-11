const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const Message = require('../models/Message');

const router = express.Router();

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

// ---- Lista de conversaciones (metadatos rápidos en Postgres) ----
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT cm.*, u.id AS otro_id, u.name AS otro_nombre, u.avatar_data AS otro_avatar, u.is_online
       FROM conversation_meta cm
       JOIN users u ON u.id = (CASE WHEN cm.user_a = $1 THEN cm.user_b ELSE cm.user_a END)
      WHERE cm.user_a = $1 OR cm.user_b = $1
      ORDER BY cm.last_message_at DESC NULLS LAST`,
    [req.userId]
  );
  res.json({ conversaciones: rows });
});

// ---- Historial de mensajes con una persona (Mongo Atlas) ----
router.get('/:otroId', requireAuth, async (req, res) => {
  const convId = conversationId(req.userId, req.params.otroId);
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const before = req.query.before ? new Date(req.query.before) : new Date();

  const mensajes = await Message.find({ conversationId: convId, createdAt: { $lt: before } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  await Message.updateMany(
    { conversationId: convId, receiverId: req.userId, read: false },
    { $set: { read: true } }
  );

  res.json({ mensajes: mensajes.reverse() });
});

module.exports = router;
