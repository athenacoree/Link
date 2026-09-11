const { query } = require('../db/postgres');
const { calcularReputacion } = require('./serialize');

// Trae las señales reales de un usuario y devuelve { score, nivel, color }.
async function obtenerReputacion(userId) {
  const { rows } = await query(
    `SELECT
        (SELECT COUNT(*) FROM friendships f WHERE (f.user_a=$1 OR f.user_b=$1) AND f.status='amigos') AS amigos,
        (SELECT COUNT(*) FROM posts p WHERE p.user_id=$1) AS publicaciones,
        (SELECT COUNT(*) FROM post_likes pl JOIN posts p ON p.id = pl.post_id WHERE p.user_id=$1) AS likes,
        (SELECT COUNT(*) FROM reports r WHERE r.target_user_id=$1 AND r.status <> 'descartado') AS reportes
    `,
    [userId]
  );
  return calcularReputacion(rows[0] || {});
}

module.exports = { obtenerReputacion };
