const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { isUUID } = require('../utils/validation');

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

// Notificar a un usuario que alguien descargó su contacto
router.post('/descarga-contacto', requireAuth, async (req, res) => {
  const { target_id } = req.body;
  if (!target_id || !isUUID(target_id)) return res.status(400).json({ error: 'ID de destino inválido.' });
  if (target_id === req.userId) return res.json({ ok: true });

  try {
    const actorRes = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
    const actorName = actorRes.rows[0]?.name || 'Un usuario';

    const text = `${actorName} descargó tu información de contacto.`;
    const dataObj = { type: 'contacto_descargado', actor_id: req.userId };

    const { rows } = await query(
      `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1, $2, 'contacto_descargado', $3, $4) RETURNING *`,
      [target_id, req.userId, text, JSON.stringify(dataObj)]
    );

    res.json({ ok: true, notificacion: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Notificar a un usuario que alguien quiere solicitarle/intercambiar contacto
router.post('/solicitar-contacto', requireAuth, async (req, res) => {
  const { target_id, red_social } = req.body;
  if (!target_id || !isUUID(target_id)) return res.status(400).json({ error: 'ID de destino inválido.' });
  if (target_id === req.userId) return res.json({ ok: true });

  try {
    const actorRes = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
    const actorName = actorRes.rows[0]?.name || 'Un usuario';
    const redStr = red_social ? `en ${red_social}` : 'en sus contactos';

    const text = `${actorName} quiere agregarte ${redStr} y te solicita tu contacto. Toca aquí para ver su perfil.`;
    const dataObj = { type: 'solicitud_contacto', actor_id: req.userId, red_social };

    const { rows } = await query(
      `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1, $2, 'solicitud_contacto', $3, $4) RETURNING *`,
      [target_id, req.userId, text, JSON.stringify(dataObj)]
    );

    res.json({ ok: true, notificacion: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
