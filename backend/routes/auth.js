const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/postgres');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { meUser } = require('../utils/serialize');
const { esCorreoDeAdmin } = require('../utils/adminEmails');
const { obtenerReputacion } = require('../utils/reputacion');

const router = express.Router();

function ordenar(x, y) {
  return x < y ? [x, y] : [y, x];
}

router.post('/registro', async (req, res) => {
  try {
    const { email, password, name, username, birthdate, gender, phone, city, state, country, country_code, flag_emoji } = req.body;
    if (!email || !password || !name || !username) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: email, password, name, username.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const usernameNorm = String(username).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!usernameNorm || usernameNorm.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const existingEmail = await query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existingEmail.rows.length) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const existingUsername = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [usernameNorm]);
    if (existingUsername.rows.length) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso. Elige otro.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const esAdmin = esCorreoDeAdmin(emailNorm);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, birthdate, gender, phone, city, is_admin, country, state, country_code, flag_emoji)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        emailNorm, hash, name, usernameNorm, birthdate || null, gender || null, phone || null, city || null, esAdmin,
        country || 'Cuba', state || null, country_code || '+53', flag_emoji || '🇨🇺'
      ]
    );
    const user = result.rows[0];

    // Hacer amigo automáticamente del administrador al crear una cuenta nueva
    const admins = await query('SELECT id FROM users WHERE is_admin = true');
    for (const admin of admins.rows) {
      if (admin.id !== user.id) {
        const [a, b] = ordenar(user.id, admin.id);
        await query(
          `INSERT INTO friendships (user_a, user_b, status, requested_by)
           VALUES ($1, $2, 'amigos', $3)
           ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'amigos'`,
          [a, b, admin.id]
        ).catch((e) => console.error('[registro] Error asociando amigo admin:', e.message));
      }
    }

    const token = signToken({ sub: user.id });
    res.status(201).json({ token, user: meUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo crear la cuenta.' });
  }
});

// Registro Rápido (solo requiere teléfono/usuario, nombre y contraseña)
router.post('/registro-rapido', async (req, res) => {
  try {
    const { phone, name, password, username } = req.body;
    if (!phone || !name || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: teléfono/usuario, nombre y contraseña.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const phoneClean = String(phone).trim().replace(/[^0-9+]/g, '');
    const userSeed = phoneClean || String(phone).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const emailNorm = `phone_${userSeed}_${Date.now()}@link.app`;
    let usernameNorm = username ? String(username).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '') : `u_${userSeed.slice(-8) || Math.floor(100000 + Math.random() * 900000)}`;

    if (usernameNorm.length < 3) {
      usernameNorm = `u_${Date.now().toString().slice(-6)}`;
    }

    // Verificar teléfono o usuario existente
    const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phoneClean]);
    if (existingPhone.rows.length && phoneClean) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este número de teléfono.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, phone, onboarding_complete)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [emailNorm, hash, name, usernameNorm, phoneClean || phone]
    );
    const user = result.rows[0];

    // Amigo automático con admins
    const admins = await query('SELECT id FROM users WHERE is_admin = true');
    for (const admin of admins.rows) {
      if (admin.id !== user.id) {
        const [a, b] = ordenar(user.id, admin.id);
        await query(
          `INSERT INTO friendships (user_a, user_b, status, requested_by)
           VALUES ($1, $2, 'amigos', $3)
           ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'amigos'`,
          [a, b, admin.id]
        ).catch((e) => console.error('[registro-rapido] Error asociando amigo admin:', e.message));
      }
    }

    const token = signToken({ sub: user.id });
    res.status(201).json({ token, user: meUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo procesar el registro rápido.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Falta email o contraseña.' });
    const emailNorm = String(email).trim().toLowerCase();
    // Permite login por email, teléfono o nombre de usuario
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR phone = $2',
      [emailNorm, String(email).trim()]
    );
    let user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    if (user.banned) {
      return res.status(403).json({
        error: `Tu cuenta fue suspendida.${user.banned_reason ? ' Motivo: ' + user.banned_reason : ''}`,
        baneado: true,
      });
    }
    // Promueve a administrador si el correo está en ADMIN_EMAILS y todavía no lo es.
    if (esCorreoDeAdmin(emailNorm) && !user.is_admin) {
      const promo = await query('UPDATE users SET is_admin=true WHERE id=$1 RETURNING *', [user.id]);
      user = promo.rows[0];
    }
    const token = signToken({ sub: user.id });
    res.json({ token, user: meUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

router.post('/completar-onboarding', requireAuth, async (req, res) => {
  try {
    const { username, birthdate, gender, city, country, interests } = req.body;
    if (!username || !gender) {
      return res.status(400).json({ error: 'El nombre de usuario y el género son obligatorios.' });
    }

    const usernameNorm = String(username).trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!usernameNorm || usernameNorm.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.' });
    }

    // Verificar si el username ya está tomado por otro usuario
    const existingUsername = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [usernameNorm, req.userId]);
    if (existingUsername.rows.length) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está ocupado. Elige otro.' });
    }

    const formattedInterests = Array.isArray(interests) ? JSON.stringify(interests) : JSON.stringify([]);

    const updated = await query(
      `UPDATE users
       SET username = $1,
           birthdate = COALESCE($2, birthdate),
           gender = $3,
           city = COALESCE($4, city),
           country = COALESCE($5, country),
           interests = $6::jsonb,
           onboarding_complete = true,
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        usernameNorm,
        birthdate || null,
        gender,
        city || 'La Habana',
        country || 'Cuba',
        formattedInterests,
        req.userId
      ]
    );

    const user = updated.rows[0];
    const reputacion = await obtenerReputacion(req.userId);
    res.json({ ok: true, user: { ...meUser(user), reputacion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al completar el registro obligatorio.' });
  }
});

router.get('/yo', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const user = result.rows[0];
  const reputacion = await obtenerReputacion(req.userId);

  // Evaluar si falta algún dato mandatory para marcar onboarding_complete
  const esCompleto = Boolean(
    user.onboarding_complete ||
    (user.username && !user.username.startsWith('u_') && user.gender && (user.city || user.country))
  );

  res.json({ user: { ...meUser(user), onboarding_complete: esCompleto, reputacion } });
});

module.exports = router;
