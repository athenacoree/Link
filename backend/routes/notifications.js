const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT n.*, u.name AS actor_nombre, u.avatar_data AS actor_avatar
       FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json({ notificaciones: rows });
});

router.post('/marcar-leidas', requireAuth, async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE user_id=$1 AND read=false', [req.userId]);
  res.json({ ok: true });
});

module.exports = router;
