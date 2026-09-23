const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { isUUID } = require('../utils/validation');

const router = express.Router();

// GET /api/appointments -> Listar citas del usuario
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*,
              u1.name AS host_name, u1.username AS host_username, u1.avatar_data AS host_avatar,
              u2.name AS guest_name, u2.username AS guest_username, u2.avatar_data AS guest_avatar
         FROM appointments a
         JOIN users u1 ON u1.id = a.host_id
         JOIN users u2 ON u2.id = a.guest_id
        WHERE a.host_id = $1 OR a.guest_id = $1
        ORDER BY a.scheduled_at DESC`,
      [req.userId]
    );
    res.json({ appointments: rows });
  } catch (err) {
    console.error('[appointments GET /]', err);
    res.status(500).json({ error: 'Error al obtener citas.' });
  }
});

// POST /api/appointments -> Crear nueva cita / reunión
router.post('/', requireAuth, async (req, res) => {
  try {
    const { guest_id, title, description, location, scheduled_at } = req.body;
    if (!guest_id || !isUUID(guest_id)) {
      return res.status(400).json({ error: 'ID de invitado no válido.' });
    }

    const { rows } = await query(
      `INSERT INTO appointments (host_id, guest_id, title, description, location, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
       RETURNING *`,
      [req.userId, guest_id, title || 'Cita / Reunión', description || '', location || '', scheduled_at || new Date()]
    );

    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    console.error('[appointments POST /]', err);
    res.status(500).json({ error: 'Error al crear la cita.' });
  }
});

// POST /api/appointments/:id/respond -> Aceptar o Rechazar cita con motivo
router.post('/:id/respond', requireAuth, async (req, res) => {
  try {
    const { action, reject_reason } = req.body;
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de cita no válido.' });

    const status = action === 'accept' ? 'aceptada' : 'rechazada';
    const { rows } = await query(
      `UPDATE appointments
          SET status = $1, reject_reason = $2, updated_at = now()
        WHERE id = $3 AND (guest_id = $4 OR host_id = $4)
        RETURNING *`,
      [status, action === 'reject' ? (reject_reason || 'Sin motivo especificado') : null, req.params.id, req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Cita no encontrada o no tienes autorización.' });
    }

    res.json({ success: true, appointment: rows[0] });
  } catch (err) {
    console.error('[appointments respond]', err);
    res.status(500).json({ error: 'Error al responder a la cita.' });
  }
});

module.exports = router;
