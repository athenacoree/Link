const { verifyToken } = require('../utils/jwt');
const { query } = require('../db/postgres');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  if (token) {
    token = String(token).trim().replace(/^["']|["']$/g, '');
  }
  if (!token) return res.status(401).json({ error: 'No autenticado. Falta el token.' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub || payload.id;

    // Se consulta el estado real de la cuenta en cada request si hay DB activa.
    // Si la BD no está configurada o no responde, se usa fallback del payload JWT.
    try {
      const { rows } = await query('SELECT id, name, avatar_data, is_admin, banned, banned_reason FROM users WHERE id = $1', [req.userId]);
      if (rows && rows.length > 0) {
        if (rows[0].banned) {
          return res.status(403).json({
            error: `Tu cuenta fue suspendida por un administrador.${rows[0].banned_reason ? ' Motivo: ' + rows[0].banned_reason : ''}`,
            baneado: true,
          });
        }
        req.user = rows[0];
        req.isAdmin = !!rows[0].is_admin;
        return next();
      }
    } catch (dbErr) {
      // Fallback a claims del token JWT si no hay DB
    }

    req.user = { id: req.userId, name: payload.name || 'Usuario', is_admin: !!payload.is_admin };
    req.isAdmin = !!payload.is_admin || !!payload.isAdmin;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o vencido.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Esta acción requiere permisos de administrador.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
