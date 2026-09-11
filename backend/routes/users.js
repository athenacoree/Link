const express = require('express');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { publicUser } = require('../utils/serialize');
const { obtenerReputacion } = require('../utils/reputacion');
const {
  registrarSenal, registrarSenalBusqueda, registrarTiempoPerfil,
  construirFeedDescubrir, explicarRecomendacion,
  TIPOS_REACCION, registrarReaccion, quitarReaccion, obtenerMiReaccion, obtenerMisReaccionesPara,
} = require('../utils/recomendaciones');

const router = express.Router();

// Límite razonable para imágenes en base64 guardadas en Postgres (~1.3MB)
const MAX_IMAGE_LEN = 1_800_000;

function amistadEntre(userA, userB) {
  return [userA, userB].sort();
}

// ---- Feed de personas para descubrir (excluye al propio usuario y a
//      cualquiera con quien haya un bloqueo, en cualquier sentido).
//      Usa el motor de recomendación: bloques de 6 personas (2 locales,
//      2 de otra localidad por afinidad, 1 de exploración al azar y 1
//      cuenta nueva — o 1 local + 3 de una localidad "explorada" si el
//      comportamiento reciente la volvió dominante). Ver
//      backend/utils/recomendaciones.js. ----
router.get('/', requireAuth, async (req, res) => {
  const rows = await construirFeedDescubrir(req.userId, { limite: 30 });
  // Mis propias reacciones privadas hacia esta gente (para pintar un
  // indicador solo visible para mí, p. ej. si ya toqué dos veces a
  // alguien). Nunca se calcula ni se expone la reacción de nadie más.
  const misReacciones = await obtenerMisReaccionesPara(req.userId, rows.map((r) => r.id));
  res.json({
    personas: rows.map(r => ({
      ...publicUser(r),
      estado_amistad: r.estado_amistad || 'ninguno',
      solicitud_de_mi: r.requested_by === req.userId,
      // 'local' | 'afinidad_otra_localidad' | 'exploracion_aleatoria' | 'cuenta_nueva' (solo informativo, para el badge)
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
      WHERE id <> $1 AND (name ILIKE $2 OR city ILIKE $2 OR profession ILIKE $2)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=id) OR (b.blocker_id=id AND b.blocked_id=$1))
      ORDER BY name ASC LIMIT 40`,
    [req.userId, `%${q}%`]
  );
  // Señal para la preferencia dinámica de localidad: si el texto buscado
  // coincide con la ciudad de los resultados, cuenta como interés real
  // en esa localidad (no solo en la persona que se termine visitando).
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

// ---- Perfil de una persona concreta ----
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Persona no encontrada.' });

  // Señal de comportamiento: visitar un perfil es la señal más directa
  // de interés en esa persona. Se usa para mejorar futuras recomendaciones.
  if (req.params.id !== req.userId) {
    registrarSenal(req.userId, req.params.id, 'perfil_visto', 2);
    query('INSERT INTO profile_views (viewer_id, viewed_id) VALUES ($1,$2)', [req.userId, req.params.id]).catch(() => {});
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
        EXISTS(SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = $2) AS me_gusta
       FROM posts p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC LIMIT 30`,
    [req.params.id, req.userId]
  );
  const reputacion = await obtenerReputacion(req.params.id);

  res.json({
    persona: publicUser(rows[0]),
    estado_amistad: fr.rows[0]?.status || 'ninguno',
    solicitud_de_mi: fr.rows[0]?.requested_by === req.userId,
    contacto_verificado: cv.rows[0]?.verified || false,
    yo_la_bloquee: bloqueo.rows[0].yo_la_bloquee,
    ella_me_bloqueo: bloqueo.rows[0].ella_me_bloqueo,
    reputacion,
    publicaciones: posts.rows.map((p) => ({ ...p, autor_nombre: rows[0].name, autor_avatar: rows[0].avatar_data })),
  });
});

// ---- Tiempo viendo un perfil (señal de comportamiento para el feed) ----
// El frontend llama esto al salir del perfil de otra persona, con los
// segundos que estuvo viéndolo. Alimenta tanto la afinidad implícita con
// esa persona como la preferencia dinámica de su localidad.
router.post('/:id/tiempo-perfil', requireAuth, async (req, res) => {
  const segundos = Number(req.body?.segundos);
  if (req.params.id !== req.userId) {
    registrarTiempoPerfil(req.userId, req.params.id, segundos);
  }
  res.json({ ok: true });
});

// ---- Reacciones privadas del feed "Descubrir" (doble toque + mini
//      encuesta opcional de matices). SIEMPRE privadas: solo las ve
//      quien las puso, y solo alimentan SU PROPIO algoritmo de
//      recomendación. Nunca se muestran al perfil evaluado ni generan
//      por sí solas ninguna acción de moderación -- para "estafador",
//      acoso u otras acusaciones graves está /moderacion/reportar
//      (siempre con revisión humana, ver routes/moderacion.js). ----
router.put('/:id/reaccion', requireAuth, async (req, res) => {
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

// ---- Mi reacción hacia una persona (solo la mía; para pintar el estado
//      del corazón/badge si vuelvo a esa tarjeta o perfil) ----
router.get('/:id/reaccion', requireAuth, async (req, res) => {
  const reaccion = await obtenerMiReaccion(req.userId, req.params.id);
  res.json({ reaccion: reaccion ? { tipo: reaccion.tipo, actualizada_en: reaccion.updated_at } : null });
});

// ---- Quitar mi reacción (deshacer el doble toque) ----
router.delete('/:id/reaccion', requireAuth, async (req, res) => {
  await quitarReaccion(req.userId, req.params.id);
  res.json({ ok: true });
});

// ---- Encuesta inicial de intereses (breve y opcional) ----
// Se puede llamar una vez al crear la cuenta y también luego desde
// Ajustes para actualizar intereses/hobbies/preferencias cuando quiera.
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

// ---- ¿Por qué se recomienda a esta persona? (botón "Ver por qué" del
//      perfil). Devuelve el desglose de puntos +/- de forma que la
//      persona pueda entender el algoritmo, no una caja negra. ----
router.get('/:id/porque-recomendado', requireAuth, async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Este es tu propio perfil.' });
  }
  const explicacion = await explicarRecomendacion(req.userId, req.params.id);
  if (!explicacion) return res.status(404).json({ error: 'Persona no encontrada.' });
  res.json(explicacion);
});

// ---- Editar mi perfil ----
router.put('/me/perfil', requireAuth, async (req, res) => {
  const campos = [
    'name', 'phone', 'birthdate', 'gender', 'skin_color', 'relationship_status',
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

// ---- Subir avatar / portada (base64, se guarda directo en Postgres) ----
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

// ---- Verificación de contacto real (vCard del teléfono ya coincidido en el navegador) ----
router.post('/:id/verificar-contacto', requireAuth, async (req, res) => {
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
