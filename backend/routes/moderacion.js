const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { registrarSenal } = require('../utils/recomendaciones');

const router = express.Router();

const MOTIVOS_VALIDOS = ['spam', 'acoso', 'contenido_inapropiado', 'suplantacion', 'estafa', 'otro'];

function ordenar(x, y) {
  return x < y ? [x, y] : [y, x];
}

// ---- Bloquear a una persona: rompe la amistad si existía, cancela
//      solicitudes pendientes entre ambos y evita que se vuelvan a ver ----
router.post('/:id/bloquear', requireAuth, async (req, res) => {
  const otherId = req.params.id;
  if (otherId === req.userId) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo.' });

  await query(
    `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.userId, otherId]
  );
  const [a, b] = ordenar(req.userId, otherId);
  await query('DELETE FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);

  res.json({ ok: true, bloqueado: true });
});

// ---- Desbloquear ----
router.post('/:id/desbloquear', requireAuth, async (req, res) => {
  await query('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.userId, req.params.id]);
  res.json({ ok: true, bloqueado: false });
});

// ---- Reportar a una persona y/o una publicación puntual ----
router.post('/reportar', requireAuth, async (req, res) => {
  const { target_user_id, target_post_id, reason, details } = req.body;
  if (!target_user_id && !target_post_id) {
    return res.status(400).json({ error: 'Falta indicar qué se reporta (persona o publicación).' });
  }
  if (!reason || !MOTIVOS_VALIDOS.includes(reason)) {
    return res.status(400).json({ error: `Motivo inválido. Usa uno de: ${MOTIVOS_VALIDOS.join(', ')}.` });
  }
  if (target_user_id === req.userId) {
    return res.status(400).json({ error: 'No puedes reportarte a ti mismo.' });
  }
  const { rows } = await query(
    `INSERT INTO reports (reporter_id, target_user_id, target_post_id, reason, details)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.userId, target_user_id || null, target_post_id || null, reason, (details || '').slice(0, 500) || null]
  );
  if (target_user_id) registrarSenal(req.userId, target_user_id, 'reporte', -15);
  res.status(201).json({ reporte: rows[0] });
});

module.exports = router;
