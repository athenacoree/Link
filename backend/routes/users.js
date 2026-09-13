const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { publicUser } = require('../utils/serialize');
const { obtenerReputacion } = require('../utils/reputacion');
const { isUUID } = require('../utils/validation');
const {
  registrarSenal, registrarSenalBusqueda, registrarTiempoPerfil,
  construirFeedDescubrir, explicarRecomendacion,
  TIPOS_REACCION, registrarReaccion, quitarReaccion, obtenerMiReaccion, obtenerMisReaccionesPara,
} = require('../utils/recomendaciones');

const router = express.Router();

const MAX_IMAGE_LEN = 1_800_000;

function amistadEntre(userA, userB) {
  return [userA, userB].sort();
}

// ---- Feed de personas para descubrir ----
router.get('/', requireAuth, async (req, res) => {
  const rows = await construirFeedDescubrir(req.userId, { limite: 30 });
  const misReacciones = await obtenerMisReaccionesPara(req.userId, rows.map((r) => r.id));
  res.json({
    personas: rows.map(r => ({
      ...publicUser(r),
      estado_amistad: r.estado_amistad || 'ninguno',
      solicitud_de_mi: r.requested_by === req.userId,
      origen: r._origen,
      localidad_bloque: r._localidad_bloque,
      mi_reaccion: misReacciones.get(r.id) || null,
    })),
  });
});

// ---- Buscar personas por nombre / ciudad ----
router.get('/buscar', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ personas: [] });
  const { rows } = await query(
    `SELECT * FROM users
      WHERE id <> $1 AND (name ILIKE $2 OR city ILIKE $2 OR profession ILIKE $2 OR username ILIKE $2)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=id) OR (b.blocker_id=id AND b.blocked_id=$1))
      ORDER BY name ASC LIMIT 40`,
    [req.userId, `%${q}%`]
  );
  registrarSenalBusqueda(req.userId, q, rows.map((r) => r.city));
  const misReacciones = await obtenerMisReaccionesPara(req.userId, rows.map((r) => r.id));
  res.json({ personas: rows.map((r) => ({ ...publicUser(r), mi_reaccion: misReacciones.get(r.id) || null })) });
});

// ---- Mis bloqueados ----
router.get('/bloqueados', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC`,
    [req.userId]
  );
  res.json({ bloqueados: rows.map(publicUser) });
});

// ---- Guardar configuraciones del usuario ----
router.put('/me/configuraciones', requireAuth, async (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Configuraciones no válidas.' });
  }
  const { rows } = await query(
    `UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
    [JSON.stringify(settings), req.userId]
  );
  res.json({ user: publicUser(rows[0]), settings: rows[0].settings });
});

// ---- Exportar datos personales (JSON) ----
router.get('/me/exportar-datos', requireAuth, async (req, res) => {
  const userRes = await query('SELECT * FROM users WHERE id=$1', [req.userId]);
  if (!userRes.rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const me = userRes.rows[0];
  delete me.password_hash;

  const [posts, comments, friends, stories] = await Promise.all([
    query('SELECT * FROM posts WHERE user_id=$1 ORDER BY created_at DESC', [req.userId]),
    query('SELECT * FROM post_comments WHERE user_id=$1 ORDER BY created_at DESC', [req.userId]),
    query('SELECT * FROM friendships WHERE user_a=$1 OR user_b=$1', [req.userId]),
    query('SELECT * FROM stories WHERE user_id=$1 ORDER BY created_at DESC', [req.userId]),
  ]);

  const datos = {
    exportado_en: new Date().toISOString(),
    usuario: me,
    publicaciones: posts.rows,
    comentarios: comments.rows,
    amistades: friends.rows,
    historias: stories.rows,
  };

  res.set({
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="enlace_mis_datos_${req.userId}.json"`,
  });
  return res.send(JSON.stringify(datos, null, 2));
});

// ---- Perfil de una persona concreta ----
router.get('/:id', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });

  const user = rows[0];

  // Limpiar estado efímero si ya pasaron 24 horas
  if (user.status_text && user.status_updated_at) {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (new Date(user.status_updated_at) < hace24h) {
      user.status_text = null;
      user.status_updated_at = null;
      query('UPDATE users SET status_text = NULL, status_updated_at = NULL WHERE id = $1', [req.params.id]).catch(() => {});
    }
  }

  if (req.params.id !== req.userId) {
    registrarSenal(req.userId, req.params.id, 'perfil_visto', 2);
    await query('INSERT INTO profile_views (profile_id, viewed_id, viewer_id) VALUES ($1,$1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.userId]).catch(() => {});
    const countRes = await query('SELECT COUNT(*) FROM profile_views WHERE profile_id = $1 OR viewed_id = $1', [req.params.id]).catch(() => ({ rows: [{ count: '0' }] }));
    const newViews = parseInt(countRes.rows[0]?.count || '0') || 0;
    user.views_count = newViews;
    query('UPDATE users SET views_count = $1 WHERE id = $2', [newViews, req.params.id]).catch(() => {});
  }

  const bloqueo = await query(
    `SELECT
        EXISTS(SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=$2) AS yo_la_bloquee,
        EXISTS(SELECT 1 FROM blocks WHERE blocker_id=$2 AND blocked_id=$1) AS ella_me_bloqueo`,
    [req.userId, req.params.id]
  );

  const [a, b] = amistadEntre(req.userId, req.params.id);
  const fr = await query('SELECT * FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);
  const cv = await query('SELECT verified FROM contact_verifications WHERE user_id=$1 AND target_id=$2', [req.userId, req.params.id]);
  const posts = await query(
    `SELECT p.*,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS total_likes,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS total_comentarios,
        EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = $2) AS me_gusta,
        EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) AS guardada
       FROM posts p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC LIMIT 30`,
    [req.params.id, req.userId]
  );
  const reputacion = await obtenerReputacion(req.params.id);

  res.json({
    persona: { ...publicUser(user), views_count: user.views_count || 0 },
    estado_amistad: fr.rows[0]?.status || 'ninguno',
    solicitud_de_mi: fr.rows[0]?.requested_by === req.userId,
    contacto_verificado: cv.rows[0]?.verified || false,
    yo_la_bloquee: bloqueo.rows[0].yo_la_bloquee,
    ella_me_bloqueo: bloqueo.rows[0].ella_me_bloqueo,
    reputacion,
    publicaciones: posts.rows.map((p) => ({ ...p, autor_nombre: user.name, autor_avatar: user.avatar_data })),
  });
});

// ---- Tiempo viendo un perfil ----
router.post('/:id/tiempo-perfil', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  const segundos = Number(req.body?.segundos);
  if (req.params.id !== req.userId) {
    registrarTiempoPerfil(req.userId, req.params.id, segundos);
  }
  res.json({ ok: true });
});

// ---- Reacciones privadas ----
router.put('/:id/reaccion', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'No puedes reaccionar a tu propio perfil.' });
  }
  const tipo = String(req.body?.tipo || 'me_interesa').trim();
  if (!TIPOS_REACCION[tipo]) return res.status(400).json({ error: 'Tipo de reacción no válido.' });
  try {
    const reaccion = await registrarReaccion(req.userId, req.params.id, tipo);
    res.json({ ok: true, reaccion: reaccion ? { tipo: reaccion.tipo, actualizada_en: reaccion.updated_at } : null });
  } catch (e) {
    res.status(400).json({ error: e.message || 'No se pudo guardar la reacción.' });
  }
});

router.get('/:id/reaccion', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  const reaccion = await obtenerMiReaccion(req.userId, req.params.id);
  res.json({ reaccion: reaccion ? { tipo: reaccion.tipo, actualizada_en: reaccion.updated_at } : null });
});

router.delete('/:id/reaccion', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  await quitarReaccion(req.userId, req.params.id);
  res.json({ ok: true });
});

// ---- Encuesta inicial de intereses ----
router.put('/me/encuesta', requireAuth, async (req, res) => {
  const { interests, hobbies, discovery_prefs, profession, city, omitir } = req.body;

  if (omitir) {
    const { rows } = await query(
      `UPDATE users SET encuesta_omitida = true, updated_at = now() WHERE id=$1 RETURNING *`,
      [req.userId]
    );
    return res.json({ user: publicUser(rows[0]) });
  }

  const sets = ['interests = $1', 'hobbies = $2', 'discovery_prefs = $3', 'encuesta_completada_at = now()', 'encuesta_omitida = false', 'updated_at = now()'];
  const values = [
    JSON.stringify(Array.isArray(interests) ? interests.slice(0, 20) : []),
    JSON.stringify(Array.isArray(hobbies) ? hobbies.slice(0, 20) : []),
    JSON.stringify(discovery_prefs && typeof discovery_prefs === 'object' ? discovery_prefs : {}),
  ];
  let i = values.length + 1;
  if (profession !== undefined) { sets.push(`profession = $${i++}`); values.push(profession); }
  if (city !== undefined) { sets.push(`city = $${i++}`); values.push(city); }
  values.push(req.userId);

  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  res.json({ user: publicUser(rows[0]) });
});

router.get('/:id/porque-recomendado', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Este es tu propio perfil.' });
  }
  const explicacion = await explicarRecomendacion(req.userId, req.params.id);
  if (!explicacion) return res.status(404).json({ error: 'Persona no encontrada.' });
  res.json(explicacion);
});

// ---- Descargar vCard (.vcf) ----
router.get('/:id/vcard', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });
    const user = rows[0];
    const fullPhone = user.phone ? `${user.country_code || '+53'}${user.phone.replace(/\D/g, '')}` : '';
    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${user.name}`,
      fullPhone ? `TEL;TYPE=CELL:${fullPhone}` : '',
      `NOTE:Contacto de Link — ${user.city || ''}`,
      'END:VCARD'
    ].filter(Boolean);

    const vcardString = vcardLines.join('\r\n');
    res.set({
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${user.name.replace(/\s+/g, '_')}.vcf"`,
    });
    return res.send(vcardString);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ---- Editar mi perfil ----
router.put('/me/perfil', requireAuth, async (req, res) => {
  const campos = [
    'name', 'phone', 'country_code', 'instagram', 'other_links', 'birthdate', 'gender', 'skin_color', 'relationship_status',
    'profession', 'bio', 'city', 'country', 'flag_emoji', 'status_text',
  ];
  const sets = [];
  const values = [];
  let i = 1;
  for (const campo of campos) {
    if (Object.prototype.hasOwnProperty.call(req.body, campo)) {
      sets.push(`${campo} = $${i++}`);
      values.push(req.body[campo]);
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'status_text')) {
    sets.push(`status_updated_at = now()`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar.' });
  sets.push('updated_at = now()');
  values.push(req.userId);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  res.json({ user: publicUser(rows[0]) });
});

// ---- Subir avatar / portada ----
router.put('/me/avatar', requireAuth, async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Falta la imagen en base64.' });
  if (image_base64.length > MAX_IMAGE_LEN) return res.status(413).json({ error: 'Imagen demasiado grande. Usa una foto más liviana.' });
  const { rows } = await query('UPDATE users SET avatar_data=$1, updated_at=now() WHERE id=$2 RETURNING *', [image_base64, req.userId]);
  res.json({ user: publicUser(rows[0]) });
});

router.put('/me/portada', requireAuth, async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Falta la imagen en base64.' });
  if (image_base64.length > MAX_IMAGE_LEN) return res.status(413).json({ error: 'Imagen demasiado grande. Usa una foto más liviana.' });
  const { rows } = await query('UPDATE users SET cover_data=$1, updated_at=now() WHERE id=$2 RETURNING *', [image_base64, req.userId]);
  res.json({ user: publicUser(rows[0]) });
});

// ---- Verificación de contacto real ----
router.post('/:id/verificar-contacto', requireAuth, async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(400).json({ error: 'ID de usuario no válido.' });
  const { coincide } = req.body;
  await query(
    `INSERT INTO contact_verifications (user_id, target_id, verified, verified_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (user_id, target_id) DO UPDATE SET verified = EXCLUDED.verified, verified_at = now()`,
    [req.userId, req.params.id, !!coincide]
  );
  res.json({ ok: true, verificado: !!coincide });
});

module.exports = router;
