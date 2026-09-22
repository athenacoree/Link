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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Falta email o contraseña.' });
    const emailNorm = String(email).trim().toLowerCase();
    const result = await query('SELECT * FROM users WHERE email = $1', [emailNorm]);
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

router.get('/yo', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const reputacion = await obtenerReputacion(req.userId);
  res.json({ user: { ...meUser(result.rows[0]), reputacion } });
});

module.exports = router;
