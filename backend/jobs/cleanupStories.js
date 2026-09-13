const { query } = require('../db/postgres');

/**
 * Borra estados (stories) cuyo expires_at ya pasó y limpia los textos
 * de estado efímeros en la tabla users cuando han superado las 24 horas.
 */
async function limpiarEstadosVencidos() {
  try {
    const { rowCount } = await query('DELETE FROM stories WHERE expires_at <= now()');
    if (rowCount) console.log(`[limpieza] ${rowCount} estado(s) vencido(s) eliminado(s).`);

    const { rowCount: usersCleaned } = await query(
      `UPDATE users SET status_text = NULL, status_updated_at = NULL WHERE status_updated_at <= (now() - interval '24 hours')`
    );
    if (usersCleaned) console.log(`[limpieza] ${usersCleaned} estado(s) de perfil limpiado(s) de usuarios.`);
  } catch (err) {
    console.error('[limpieza] Error borrando estados vencidos:', err.message);
  }
}

function startCleanupJob() {
  const minutos = parseInt(process.env.STORY_CLEANUP_INTERVAL_MIN) || 15;
  limpiarEstadosVencidos();
  setInterval(limpiarEstadosVencidos, minutos * 60 * 1000);
  console.log(`[limpieza] Job de limpieza de estados activo (cada ${minutos} min).`);
}

module.exports = { startCleanupJob, limpiarEstadosVencidos };
