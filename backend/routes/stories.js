const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MAX_IMAGE_LEN = 1_800_000;

// ---- Crear estado (dura 24h, se borra solo) ----
router.post('/', requireAuth, async (req, res) => {
  const { text, image_base64 } = req.body;
  if (!text && !image_base64) return res.status(400).json({ error: 'El estado necesita texto o imagen.' });
  if (image_base64 && image_base64.length > MAX_IMAGE_LEN) return res.status(413).json({ error: 'Imagen demasiado grande.' });
  const { rows } = await query(
    `INSERT INTO stories (user_id, text, image_data) VALUES ($1,$2,$3) RETURNING *`,
    [req.userId, text || null, image_base64 || null]
  );
  await query('UPDATE users SET status_text=$1, status_updated_at=now() WHERE id=$2', [text || '📷', req.userId]);
  res.status(201).json({ estado: rows[0] });
});

// ---- Ver estados vigentes de mis amigos + los míos ----
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT s.*, u.name AS autor_nombre, u.avatar_data AS autor_avatar
       FROM stories s JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > now()
        AND (s.user_id = $1 OR s.user_id IN (
              SELECT CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END
              FROM friendships f WHERE (f.user_a=$1 OR f.user_b=$1) AND f.status='amigos'
            ))
      ORDER BY s.created_at DESC`,
    [req.userId]
  );
  res.json({ estados: rows });
});

// ---- Ver estados vigentes de un usuario específico ----
router.get('/usuario/:userId', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, u.name AS autor_nombre, u.avatar_data AS autor_avatar
         FROM stories s JOIN users u ON u.id = s.user_id
        WHERE s.user_id = $1 AND s.expires_at > now()
        ORDER BY s.created_at DESC`,
      [req.params.userId]
    );
    res.json({ estados: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estados.' });
  }
});

// ---- Borrar un estado ----
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: story } = await query('SELECT * FROM stories WHERE id = $1', [req.params.id]);
    if (!story.length) return res.status(404).json({ error: 'Estado no encontrado.' });

    const { rows: user } = await query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    const esDueno = story[0].user_id === req.userId;
    const esAdmin = user[0]?.is_admin;

    if (!esDueno && !esAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para borrar este estado.' });
    }

    await query('DELETE FROM stories WHERE id = $1', [req.params.id]);

    const { rows: vigentes } = await query(
      'SELECT text FROM stories WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 1',
      [story[0].user_id]
    );
    if (vigentes.length) {
      await query('UPDATE users SET status_text = $1 WHERE id = $2', [vigentes[0].text || '📷', story[0].user_id]);
    } else {
      await query('UPDATE users SET status_text = NULL, status_updated_at = NULL WHERE id = $1', [story[0].user_id]);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo borrar el estado.' });
  }
});

router.post('/:id/visto', requireAuth, async (req, res) => {
  await query(
    `INSERT INTO story_views (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.params.id, req.userId]
  );
  res.json({ ok: true });
});

module.exports = router;
