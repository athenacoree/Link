const { verifyToken } = require('../utils/jwt');
const { query } = require('../db/postgres');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado. Falta el token.' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;

    // Se consulta el estado real de la cuenta en cada request: así, si un
    // administrador banea a alguien, esa persona queda bloqueada de
    // inmediato aunque su token todavía sea válido.
    const { rows } = await query('SELECT id, name, avatar_data, is_admin, banned, banned_reason FROM users WHERE id = $1', [req.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Token inválido o vencido.' });
    if (rows[0].banned) {
      return res.status(403).json({
        error: `Tu cuenta fue suspendida por un administrador.${rows[0].banned_reason ? ' Motivo: ' + rows[0].banned_reason : ''}`,
        baneado: true,
      });
    }
    req.user = rows[0];
    req.isAdmin = !!rows[0].is_admin;
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
