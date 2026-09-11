const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { publicUser } = require('../utils/serialize');
const { emitToUser } = require('../utils/realtime');
const { registrarSenal } = require('../utils/recomendaciones');

const router = express.Router();

function ordenar(x, y) {
  return x < y ? [x, y] : [y, x];
}

async function crearNotificacion({ user_id, actor_id, type, text, data }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [user_id, actor_id, type, text, data || {}]
  );
  emitToUser(user_id, 'notificacion:nueva', rows[0]);
  return rows[0];
}

// ---- Enviar solicitud de amistad ----
router.post('/:id/solicitar', requireAuth, async (req, res) => {
  const otherId = req.params.id;
  if (otherId === req.userId) return res.status(400).json({ error: 'No puedes agregarte a ti mismo.' });

  const bloqueo = await query(
    `SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)) AS hay`,
    [req.userId, otherId]
  );
  if (bloqueo.rows[0].hay) return res.status(403).json({ error: 'No puedes enviar solicitud a esta persona.' });

  const [a, b] = ordenar(req.userId, otherId);

  const existing = await query('SELECT * FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);
  if (existing.rows.length) {
    const f = existing.rows[0];
    if (f.status === 'amigos') return res.status(409).json({ error: 'Ya son amigos.' });
    if (f.status === 'pendiente') return res.status(409).json({ error: 'Ya hay una solicitud pendiente.' });
  }

  const { rows } = await query(
    `INSERT INTO friendships (user_a, user_b, status, requested_by)
     VALUES ($1,$2,'pendiente',$3)
     ON CONFLICT (user_a, user_b) DO UPDATE SET status='pendiente', requested_by=$3, updated_at=now()
     RETURNING *`,
    [a, b, req.userId]
  );

  const yo = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
  await crearNotificacion({
    user_id: otherId,
    actor_id: req.userId,
    type: 'solicitud_amistad',
    text: `${yo.rows[0].name} te envió una solicitud de amistad`,
    data: { friendship_id: rows[0].id },
  });
  registrarSenal(req.userId, otherId, 'solicitud_enviada', 5);

  res.status(201).json({ amistad: rows[0] });
});

// ---- Aceptar / rechazar ----
router.post('/:id/responder', requireAuth, async (req, res) => {
  const otherId = req.params.id;
  const { aceptar } = req.body;
  const [a, b] = ordenar(req.userId, otherId);

  const existing = await query('SELECT * FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);
  if (!existing.rows.length || existing.rows[0].status !== 'pendiente') {
    return res.status(404).json({ error: 'No hay una solicitud pendiente con esta persona.' });
  }
  if (existing.rows[0].requested_by === req.userId) {
    return res.status(400).json({ error: 'No puedes responder tu propia solicitud.' });
  }

  const nuevoEstado = aceptar ? 'amigos' : 'rechazada';
  const { rows } = await query(
    `UPDATE friendships SET status=$1, updated_at=now() WHERE user_a=$2 AND user_b=$3 RETURNING *`,
    [nuevoEstado, a, b]
  );

  if (aceptar) {
    const yo = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
    await crearNotificacion({
      user_id: otherId,
      actor_id: req.userId,
      type: 'amistad_aceptada',
      text: `${yo.rows[0].name} aceptó tu solicitud de amistad 🎉`,
      data: { friendship_id: rows[0].id },
    });
    // Señal fuerte en ambas direcciones: una amistad confirmada es la
    // mejor pista de que ambos perfiles se parecen a "lo que le gusta"
    // a cada uno para futuras recomendaciones.
    registrarSenal(req.userId, otherId, 'amistad_aceptada', 10);
    registrarSenal(otherId, req.userId, 'amistad_aceptada', 10);
  }

  res.json({ amistad: rows[0] });
});

// ---- Mis amigos ----
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, f.status, f.requested_by
       FROM friendships f
       JOIN users u ON u.id = (CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END)
      WHERE (f.user_a = $1 OR f.user_b = $1) AND f.status='amigos'
      ORDER BY u.name ASC`,
    [req.userId]
  );
  res.json({ amigos: rows.map(publicUser) });
});

// ---- Eliminar a alguien de mis amigos ----
router.delete('/:id', requireAuth, async (req, res) => {
  const otherId = req.params.id;
  const [a, b] = ordenar(req.userId, otherId);
  const existing = await query('SELECT * FROM friendships WHERE user_a=$1 AND user_b=$2 AND status=\'amigos\'', [a, b]);
  if (!existing.rows.length) return res.status(404).json({ error: 'No eran amigos.' });
  await query('DELETE FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);
  res.json({ ok: true });
});

// ---- Solicitudes pendientes recibidas ----
router.get('/solicitudes', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, f.id AS friendship_id, f.created_at AS solicitado_en
       FROM friendships f
       JOIN users u ON u.id = (CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END)
      WHERE (f.user_a = $1 OR f.user_b = $1) AND f.status='pendiente' AND f.requested_by <> $1
      ORDER BY f.created_at DESC`,
    [req.userId]
  );
  res.json({ solicitudes: rows.map(r => ({ ...publicUser(r), friendship_id: r.friendship_id, solicitado_en: r.solicitado_en })) });
});

module.exports = router;
