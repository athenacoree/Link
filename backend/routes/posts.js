const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { emitToUser } = require('../utils/realtime');
const { registrarSenal } = require('../utils/recomendaciones');

const router = express.Router();
const MAX_IMAGE_LEN = 1_800_000;

// ---- Editar una publicación (el dueño, o un administrador moderando) ----
router.put('/:id', requireAuth, async (req, res) => {
  const post = await query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!post.rows.length) return res.status(404).json({ error: 'Publicación no encontrada.' });
  const esDueno = post.rows[0].user_id === req.userId;
  if (!esDueno && !req.isAdmin) return res.status(403).json({ error: 'No puedes editar esta publicación.' });

  const { text } = req.body;
  if (text === undefined) return res.status(400).json({ error: 'Falta el texto nuevo.' });

  const sets = ['text = $1'];
  const values = [text];
  let i = 2;
  if (!esDueno && req.isAdmin) {
    sets.push(`edited_at = now()`, `edited_by_admin = $${i++}`);
    values.push(req.userId);
  }
  values.push(req.params.id);
  const { rows } = await query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  res.json({ publicacion: rows[0], editado_por_admin: !esDueno });
});

// ---- Borrar una publicación (el dueño, o un administrador moderando) ----
router.delete('/:id', requireAuth, async (req, res) => {
  const post = await query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!post.rows.length) return res.status(404).json({ error: 'Publicación no encontrada.' });
  const esDueno = post.rows[0].user_id === req.userId;
  if (!esDueno && !req.isAdmin) return res.status(403).json({ error: 'No puedes borrar esta publicación.' });
  await query('DELETE FROM posts WHERE id=$1', [req.params.id]);
  res.json({ ok: true, borrado_por_admin: !esDueno });
});

// ---- Crear publicación ----
router.post('/', requireAuth, async (req, res) => {
  const { text, image_base64 } = req.body;
  if (!text && !image_base64) return res.status(400).json({ error: 'La publicación necesita texto o imagen.' });
  if (image_base64 && image_base64.length > MAX_IMAGE_LEN) return res.status(413).json({ error: 'Imagen demasiado grande.' });
  const { rows } = await query(
    `INSERT INTO posts (user_id, text, image_data) VALUES ($1,$2,$3) RETURNING *`,
    [req.userId, text || null, image_base64 || null]
  );
  res.status(201).json({ publicacion: rows[0] });
});

// ---- Feed: publicaciones de amigos + propias ----
router.get('/feed', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, u.name AS autor_nombre, u.avatar_data AS autor_avatar,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS total_likes,
            (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS total_comentarios,
            EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = $1) AS me_gusta
       FROM posts p
       JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1
         OR p.user_id IN (
              SELECT CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
              FROM friendships f WHERE (f.user_a=$1 OR f.user_b=$1) AND f.status='amigos'
            )
      ORDER BY p.created_at DESC
      LIMIT 50`,
    [req.userId]
  );
  res.json({ publicaciones: rows });
});

// ---- Dar/quitar like ----
router.post('/:id/like', requireAuth, async (req, res) => {
  const post = await query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!post.rows.length) return res.status(404).json({ error: 'Publicación no encontrada.' });

  const existing = await query('SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (existing.rows.length) {
    await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.userId]);
    return res.json({ me_gusta: false });
  }
  await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, req.userId]);
  if (post.rows[0].user_id !== req.userId) {
    registrarSenal(req.userId, post.rows[0].user_id, 'me_gusta_publicacion', 2);
    const yo = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
    const notif = await query(
      `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1,$2,'like',$3,$4) RETURNING *`,
      [post.rows[0].user_id, req.userId, `A ${yo.rows[0].name} le gustó tu publicación`, { post_id: req.params.id }]
    );
    emitToUser(post.rows[0].user_id, 'notificacion:nueva', notif.rows[0]);
  }
  res.json({ me_gusta: true });
});

// ---- Comentar ----
router.post('/:id/comentarios', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  const post = await query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
  if (!post.rows.length) return res.status(404).json({ error: 'Publicación no encontrada.' });

  const { rows } = await query(
    `INSERT INTO post_comments (post_id, user_id, text) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, req.userId, text.trim()]
  );

  if (post.rows[0].user_id !== req.userId) {
    registrarSenal(req.userId, post.rows[0].user_id, 'comentario', 3);
    const yo = await query('SELECT name FROM users WHERE id=$1', [req.userId]);
    const notif = await query(
      `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1,$2,'comentario',$3,$4) RETURNING *`,
      [post.rows[0].user_id, req.userId, `${yo.rows[0].name} comentó tu publicación`, { post_id: req.params.id }]
    );
    emitToUser(post.rows[0].user_id, 'notificacion:nueva', notif.rows[0]);
  }

  res.status(201).json({ comentario: rows[0] });
});

router.get('/:id/comentarios', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, u.name AS autor_nombre, u.avatar_data AS autor_avatar
       FROM post_comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  res.json({ comentarios: rows });
});

module.exports = router;
