const { query } = require('../db/postgres');
const { cleanupExpiredCache } = require('../services/videoService');

/**
 * Borra estados (stories) cuyo expires_at ya pasó, limpia textos de perfil vencidos,
 * y purga la caché de búsqueda de videos expirada (> 10 minutos).
 */
async function limpiarEstadosVencidos() {
  try {
    const { rowCount } = await query('DELETE FROM stories WHERE expires_at <= now()');
    if (rowCount) console.log(`[limpieza] ${rowCount} estado(s) vencido(s) eliminado(s).`);

    const { rowCount: usersCleaned } = await query(
      `UPDATE users SET status_text = NULL, status_updated_at = NULL WHERE status_updated_at <= (now() - interval '24 hours')`
    );
    if (usersCleaned) console.log(`[limpieza] ${usersCleaned} estado(s) de perfil limpiado(s) de usuarios.`);

    const cleanedVideoCache = await cleanupExpiredCache();
    if (cleanedVideoCache) console.log(`[limpieza] ${cleanedVideoCache} resultado(s) de video en caché purgado(s).`);
  } catch (err) {
    console.error('[limpieza] Error durante la tarea de limpieza periódica:', err.message);
  }
}

function startCleanupJob() {
  const minutos = parseInt(process.env.STORY_CLEANUP_INTERVAL_MIN) || 15;
  limpiarEstadosVencidos();
  setInterval(limpiarEstadosVencidos, minutos * 60 * 1000);
  console.log(`[limpieza] Job de limpieza periódica activo (cada ${minutos} min).`);
}

module.exports = { startCleanupJob, limpiarEstadosVencidos };
