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

    const appt = rows[0];

    // Generar notificación al usuario invitado
    try {
      const hostRes = await query(`SELECT name, username, avatar_data FROM users WHERE id = $1`, [req.userId]);
      const hostUser = hostRes.rows[0];
      const hostName = hostUser ? hostUser.name : 'Un usuario';

      await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'appointment_invite', $2, $3, $4)`,
        [
          guest_id,
          '📅 Nueva invitación de Cita / Compromiso',
          `${hostName} te ha invitado a: ${appt.title}`,
          JSON.stringify({ appointment_id: appt.id, host_id: req.userId, host_name: hostName })
        ]
      );

      // Si existe Socket.io global, notificar en tiempo real
      if (req.io) {
        req.io.to(`user_${guest_id}`).emit('notificacion:nueva', {
          type: 'appointment_invite',
          title: '📅 Nueva invitación de Cita / Compromiso',
          body: `${hostName} te ha invitado a: ${appt.title}`,
          appointment: appt
        });
      }
    } catch (e) {
      console.warn('[Appointments Notification Error]', e.message);
    }

    res.json({ success: true, appointment: appt });
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
