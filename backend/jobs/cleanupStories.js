const { query } = require('../db/postgres');

/**
 * Borra estados (stories) cuyo expires_at ya pasó. Esto es limpieza de
 * DATOS que el propio usuario pidió explícitamente ("los estados que
 * se borran"), no una migración destructiva de esquema: la tabla y sus
 * columnas nunca se tocan, solo se eliminan filas vencidas.
 */
async function limpiarEstadosVencidos() {
  try {
    const { rowCount } = await query('DELETE FROM stories WHERE expires_at <= now()');
    if (rowCount) console.log(`[limpieza] ${rowCount} estado(s) vencido(s) eliminado(s).`);
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
