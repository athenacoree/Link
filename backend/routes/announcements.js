const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---- Obtener el anuncio activo que este usuario aún NO ha visto ----
router.get('/activo', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*
         FROM announcements a
        WHERE a.expires_at > now()
          AND NOT EXISTS (
            SELECT 1 FROM announcement_views av
             WHERE av.announcement_id = a.id AND av.user_id = $1
          )
        ORDER BY a.created_at DESC
        LIMIT 1`,
      [req.userId]
    );
    res.json({ anuncio: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar anuncios.' });
  }
});

// ---- Marcar un anuncio como visto ----
router.post('/:id/visto', requireAuth, async (req, res) => {
  try {
    await query(
      `INSERT INTO announcement_views (announcement_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar anuncio como visto.' });
  }
});

module.exports = router;
