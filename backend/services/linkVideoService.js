/**
 * Servicio Backend para Link Video y Transmisiones Persistentes en Vivo (Link Live)
 */

const { query } = require('../db/postgres');
const videoStreamTool = require('../tools/videoStreamTool');

// Almacén en memoria de respaldo para tests o entornos sin PostgreSQL activo
const inMemoryLiveSessions = new Map();

async function getCatalog(forceRefresh = false) {
  return await videoStreamTool.getVideoCatalog(forceRefresh);
}

async function getStreamById(streamId) {
  const catalog = await getCatalog();
  const found = catalog.find(s => s.id === streamId);
  if (found) return found;

  // Buscar en live_sessions persistentes activas
  return await getLiveSessionById(streamId);
}

/**
 * Crea una sesión de transmisión persistente con un ID único.
 */
async function createLiveSession({ hostId, hostName, title, description, category }) {
  const cleanTitle = (title || 'Transmisión en Vivo').trim();
  const cleanDesc = (description || 'Transmisión en directo con Link Live').trim();
  const cleanCategory = (category || 'general').trim();

  try {
    const { rows } = await query(
      `INSERT INTO live_sessions (host_id, title, description, category, status, last_heartbeat)
       VALUES ($1, $2, $3, $4, 'LIVE', now())
       RETURNING id, host_id AS "hostId", title, description, category, status,
                 viewer_count AS "viewerCount", last_heartbeat AS "lastHeartbeat",
                 created_at AS "createdAt"`,
      [hostId, cleanTitle, cleanDesc, cleanCategory]
    );
    const session = rows[0];
    if (hostName) session.hostName = hostName;
    inMemoryLiveSessions.set(session.id, session);
    return session;
  } catch (err) {
    // Memory fallback
    const id = 'live_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const session = {
      id,
      hostId,
      hostName: hostName || 'Streamer',
      title: cleanTitle,
      description: cleanDesc,
      category: cleanCategory,
      status: 'LIVE',
      viewerCount: 0,
      lastHeartbeat: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    inMemoryLiveSessions.set(id, session);
    return session;
  }
}

/**
 * Obtiene la información de una sesión en vivo por su ID.
 */
async function getLiveSessionById(sessionId) {
  try {
    const { rows } = await query(
      `SELECT ls.id, ls.host_id AS "hostId", ls.title, ls.description, ls.category,
              ls.status, ls.viewer_count AS "viewerCount", ls.last_heartbeat AS "lastHeartbeat",
              ls.created_at AS "createdAt", ls.ended_at AS "endedAt",
              u.nombre AS "hostName", u.avatar AS "hostAvatar"
       FROM live_sessions ls
       LEFT JOIN users u ON ls.host_id = u.id
       WHERE ls.id = $1::uuid`,
      [sessionId]
    );
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    if (inMemoryLiveSessions.has(sessionId)) {
      return inMemoryLiveSessions.get(sessionId);
    }
  }
  return inMemoryLiveSessions.get(sessionId) || null;
}

/**
 * Obtiene el listado de transmisiones activas (LIVE, RECONNECTING, INTERMISSION).
 */
async function getActiveLiveSessions() {
  let dbSessions = [];
  try {
    const { rows } = await query(
      `SELECT ls.id, ls.host_id AS "hostId", ls.title, ls.description, ls.category,
              ls.status, ls.viewer_count AS "viewerCount", ls.last_heartbeat AS "lastHeartbeat",
              ls.created_at AS "createdAt", u.nombre AS "hostName", u.avatar AS "hostAvatar"
       FROM live_sessions ls
       LEFT JOIN users u ON ls.host_id = u.id
       WHERE ls.status IN ('LIVE', 'RECONNECTING', 'INTERMISSION', 'RECONNECTED')
       ORDER BY ls.created_at DESC`
    );
    dbSessions = rows;
  } catch (err) {}

  const memSessions = Array.from(inMemoryLiveSessions.values()).filter(s =>
    ['LIVE', 'RECONNECTING', 'INTERMISSION', 'RECONNECTED'].includes(s.status)
  );

  const combined = [...dbSessions];
  for (const m of memSessions) {
    if (!combined.some(s => s.id === m.id)) {
      combined.push(m);
    }
  }
  return combined;
}

/**
 * Actualiza el estado de una sesión en vivo.
 */
async function updateLiveStatus(sessionId, status) {
  try {
    await query(
      `UPDATE live_sessions SET status = $1, last_heartbeat = now()
       WHERE id = $2::uuid`,
      [status, sessionId]
    );
  } catch (err) {}

  if (inMemoryLiveSessions.has(sessionId)) {
    const s = inMemoryLiveSessions.get(sessionId);
    s.status = status;
    s.lastHeartbeat = new Date().toISOString();
    inMemoryLiveSessions.set(sessionId, s);
  }
}

/**
 * Registra el heartbeat del streamer para mantener la sesión viva.
 */
async function updateLiveHeartbeat(sessionId, hostId, newStatus = null) {
  const session = await getLiveSessionById(sessionId);
  if (!session) return null;
  if (hostId && session.hostId !== hostId) {
    throw new Error('No autorizado para enviar heartbeat a esta sesión.');
  }

  const targetStatus = newStatus || (session.status === 'RECONNECTING' || session.status === 'INTERMISSION' ? 'RECONNECTED' : session.status);

  try {
    const { rows } = await query(
      `UPDATE live_sessions
       SET last_heartbeat = now(), status = $1
       WHERE id = $2::uuid AND host_id = $3::uuid
       RETURNING id, status, last_heartbeat AS "lastHeartbeat"`,
      [targetStatus, sessionId, hostId]
    );
    if (rows.length > 0) {
      if (inMemoryLiveSessions.has(sessionId)) {
        const mem = inMemoryLiveSessions.get(sessionId);
        mem.status = targetStatus;
        mem.lastHeartbeat = rows[0].lastHeartbeat;
      }
      return rows[0];
    }
  } catch (err) {}

  if (inMemoryLiveSessions.has(sessionId)) {
    const mem = inMemoryLiveSessions.get(sessionId);
    mem.status = targetStatus;
    mem.lastHeartbeat = new Date().toISOString();
    return mem;
  }
  return null;
}

/**
 * Intenta reconectar al streamer a su misma live_session_id existente.
 */
async function reconnectLiveSession(sessionId, hostId) {
  const session = await getLiveSessionById(sessionId);
  if (!session) {
    throw new Error('La sesión de transmisión no existe o ya expiró.');
  }
  if (session.hostId !== hostId) {
    throw new Error('No tienes permisos para reconectarte a esta transmisión.');
  }
  if (session.status === 'ENDED') {
    throw new Error('La transmisión ya finalizó explícitamente.');
  }

  await updateLiveHeartbeat(sessionId, hostId, 'RECONNECTED');
  // Breve transición antes de volver a LIVE
  setTimeout(async () => {
    await updateLiveStatus(sessionId, 'LIVE');
  }, 1000);

  return await getLiveSessionById(sessionId);
}

/**
 * Finaliza voluntariamente una transmisión.
 */
async function endLiveSession(sessionId, hostId) {
  try {
    await query(
      `UPDATE live_sessions
       SET status = 'ENDED', ended_at = now()
       WHERE id = $1::uuid AND (host_id = $2::uuid OR $2 IS NULL)`,
      [sessionId, hostId]
    );
  } catch (err) {}

  if (inMemoryLiveSessions.has(sessionId)) {
    const mem = inMemoryLiveSessions.get(sessionId);
    mem.status = 'ENDED';
    mem.endedAt = new Date().toISOString();
  }

  return { ok: true, sessionId, status: 'ENDED' };
}

/**
 * Modifica el contador de espectadores.
 */
async function updateViewerCount(sessionId, delta = 1) {
  try {
    await query(
      `UPDATE live_sessions
       SET viewer_count = GREATEST(0, viewer_count + $1)
       WHERE id = $2::uuid`,
      [delta, sessionId]
    );
  } catch (err) {}

  if (inMemoryLiveSessions.has(sessionId)) {
    const mem = inMemoryLiveSessions.get(sessionId);
    mem.viewerCount = Math.max(0, (mem.viewerCount || 0) + delta);
  }
}

/**
 * Limpieza periódica de sesiones abandonadas (sin heartbeat durante más de timeoutSeconds).
 */
async function cleanupAbandonedSessions(timeoutSeconds = 180) {
  try {
    const { rows } = await query(
      `UPDATE live_sessions
       SET status = 'ENDED', ended_at = now()
       WHERE status IN ('LIVE', 'RECONNECTING', 'INTERMISSION', 'RECONNECTED')
         AND last_heartbeat < (now() - ($1 || ' seconds')::interval)
       RETURNING id`,
      [timeoutSeconds]
    );
    if (rows.length > 0) {
      console.log(`[linkvideo] Se finalizaron automáticamente ${rows.length} sesiones abandonadas por timeout.`);
    }
  } catch (err) {}

  const cutoff = Date.now() - (timeoutSeconds * 1000);
  for (const [id, s] of inMemoryLiveSessions.entries()) {
    if (['LIVE', 'RECONNECTING', 'INTERMISSION', 'RECONNECTED'].includes(s.status)) {
      const hbTime = new Date(s.lastHeartbeat).getTime();
      if (hbTime < cutoff) {
        s.status = 'ENDED';
        s.endedAt = new Date().toISOString();
      }
    }
  }
}

module.exports = {
  getCatalog,
  getStreamById,
  createLiveSession,
  getLiveSessionById,
  getActiveLiveSessions,
  updateLiveStatus,
  updateLiveHeartbeat,
  reconnectLiveSession,
  endLiveSession,
  updateViewerCount,
  cleanupAbandonedSessions,
  getLinkVideoBaseUrl: videoStreamTool.getLinkVideoBaseUrl
};
