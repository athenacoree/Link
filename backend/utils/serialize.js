// Campos que solo debe ver el propio dueño de la cuenta (nunca otro
// usuario que consulta ese perfil desde /api/usuarios/:id, la lista de
// descubrir, amigos, etc.)
const CAMPOS_PRIVADOS = ['password_hash', 'is_admin', 'banned', 'banned_reason', 'banned_at', 'banned_by', 'verified_by'];

// Usuario "público": lo que puede ver cualquier otra persona de la app.
function publicUser(row) {
  if (!row) return null;
  const copia = { ...row };
  for (const campo of CAMPOS_PRIVADOS) delete copia[campo];
  return copia;
}

// Usuario "privado": lo que ve la propia persona sobre sí misma (incluye
// si es administrador, para mostrarle el panel, y su estado real).
function meUser(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

// Calcula un nivel de reputación sencillo y explicable a partir de
// señales reales: amigos, publicaciones, likes recibidos y reportes
// recibidos. No es una fórmula "de verdad" bancaria, es una señal
// visible para que la comunidad se autorregule un poco.
function calcularReputacion({ amigos = 0, publicaciones = 0, likes = 0, reportes = 0 }) {
  const score = Number(amigos) * 3 + Number(publicaciones) * 1 + Number(likes) * 1 - Number(reportes) * 15;
  let nivel = 'Nuevo';
  let color = 'gris';
  if (score < 0) { nivel = 'En observación'; color = 'rojo'; }
  else if (score >= 150) { nivel = 'Destacado'; color = 'oro'; }
  else if (score >= 60) { nivel = 'Confiable'; color = 'morado'; }
  else if (score >= 20) { nivel = 'Activo'; color = 'verde'; }
  return { score, nivel, color };
}

module.exports = { publicUser, meUser, calcularReputacion };
