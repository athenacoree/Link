/**
 * Servicio Backend para Link Video (Colecciones, Álbumes y Videos) y Transmisiones Persistentes en Vivo (Link Live)
 */

const { query } = require('../db/postgres');
const videoStreamTool = require('../tools/videoStreamTool');
const { fetchYouTubeInfo, extractYouTubeId, fetchYouTubeSubtitles } = require('../utils/youtube');
const { crypto } = require('crypto');

// Lista estática y predefinida de categorías para la plataforma Link Video
const PREDEFINED_CATEGORIES = [
  'General',
  'Música',
  'Álbumes',
  'Películas',
  'Series',
  'Telenovelas',
  'Documentales',
  'Animes'
];

function sanitizeCategory(cat) {
  if (!cat) return 'General';
  const clean = String(cat).trim();
  const found = PREDEFINED_CATEGORIES.find(c => c.toLowerCase() === clean.toLowerCase());
  return found || 'General';
}

// Almacén en memoria de respaldo para tests o entornos sin PostgreSQL activo
const inMemoryLiveSessions = new Map();
const inMemoryCollections = new Map(); // id -> collection object
const inMemoryVideos = new Map(); // id -> video object
const inMemorySubtitles = new Map(); // videoId_lang -> subtitle object

// Colecciones por defecto en memoria
const DEFAULT_MEM_COLLECTIONS = [
  {
    id: 'col_musica_destacada',
    name: 'Música & Videos Destacados',
    cover_url: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Música',
    audio_description: 'Colección oficial de éxitos musicales y clips de video en alta definición.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'col_cine_trailers',
    name: 'Cine & Estrenos',
    cover_url: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Películas',
    audio_description: 'Tráilers cinematográficos, películas destacadas y estrenos mundiales.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const DEFAULT_MEM_VIDEOS = [
  {
    id: 'vid_default_1',
    collection_id: 'col_musica_destacada',
    title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
    video_id: 'dQw4w9WgXcQ',
    original_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    position: 0,
    status: 'active',
    audio_description: 'Hit musical de los 80s interpretado por Rick Astley.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Inicializar memoria por defecto
for (const col of DEFAULT_MEM_COLLECTIONS) {
  inMemoryCollections.set(col.id, col);
}
for (const vid of DEFAULT_MEM_VIDEOS) {
  inMemoryVideos.set(vid.id, vid);
}

// ---------------- GESTIÓN DE COLECCIONES Y VIDEOS ----------------

async function getCollections(userId = null) {
  let userInterests = [];
  if (userId) {
    try {
      const uRes = await query(`SELECT interests, hobbies FROM users WHERE id = $1`, [userId]);
      if (uRes.rows && uRes.rows[0]) {
        const raw = [...(uRes.rows[0].interests || []), ...(uRes.rows[0].hobbies || [])];
        userInterests = raw.map(i => String(i).toLowerCase().trim()).filter(Boolean);
      }
    } catch (e) {}
  }

  let collections = [];

  try {
    const { rows } = await query(
      `SELECT c.id, c.name, c.cover_url, c.category, c.audio_description, c.created_at, c.updated_at,
              COUNT(v.id)::int AS video_count
       FROM linkvideo_collections c
       LEFT JOIN linkvideo_videos v ON c.id = v.collection_id AND v.status = 'active'
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    if (rows && rows.length > 0) {
      collections = rows.map(col => ({ ...col, category: sanitizeCategory(col.category) }));
    }
  } catch (err) {
    // Fallback in-memory
  }

  if (!collections.length) {
    collections = Array.from(inMemoryCollections.values()).map(col => {
      const count = Array.from(inMemoryVideos.values()).filter(v => v.collection_id === col.id && v.status === 'active').length;
      return {
        ...col,
        category: col.category || 'General',
        video_count: count
      };
    });
  }

  if (userInterests.length > 0) {
    // Alimentar el algoritmo: ordenar o ponderar según coincidencia con las categorías de la colección
    collections.sort((a, b) => {
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();
      const matchA = userInterests.some(interest => catA.includes(interest) || interest.includes(catA)) ? 1 : 0;
      const matchB = userInterests.some(interest => catB.includes(interest) || interest.includes(catB)) ? 1 : 0;
      return matchB - matchA;
    });
  }

  return collections;
}

async function getCollectionById(collectionId) {
  let collection = null;
  let videos = [];

  try {
    const colRes = await query(
      `SELECT id, name, cover_url, category, audio_description, created_at, updated_at
       FROM linkvideo_collections
       WHERE id::text = $1::text`,
      [collectionId]
    );
    if (colRes.rows && colRes.rows.length > 0) {
      collection = colRes.rows[0];
      const vidRes = await query(
        `SELECT id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, created_at, updated_at
         FROM linkvideo_videos
         WHERE collection_id::text = $1::text AND status = 'active'
         ORDER BY position ASC, created_at ASC`,
        [collectionId]
      );
      videos = vidRes.rows || [];
      return {
        ...collection,
        videos
      };
    }
  } catch (err) {
    // Fallback in-memory
  }

  if (inMemoryCollections.has(collectionId)) {
    collection = inMemoryCollections.get(collectionId);
    videos = Array.from(inMemoryVideos.values())
      .filter(v => v.collection_id === collectionId && v.status === 'active')
      .sort((a, b) => (a.position - b.position));
    return {
      ...collection,
      videos
    };
  }

  return null;
}

async function createCollection({ name, cover_url, category, audio_description }) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    throw new Error('El nombre de la colección es obligatorio.');
  }

  const cleanCover = cover_url || null;
  const cleanCategory = sanitizeCategory(category);
  const cleanAudioDesc = audio_description ? audio_description.trim() : null;
  const nowIso = new Date().toISOString();

  try {
    const { rows } = await query(
      `INSERT INTO linkvideo_collections (name, cover_url, category, audio_description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, name, cover_url, category, audio_description, created_at, updated_at`,
      [cleanName, cleanCover, cleanCategory, cleanAudioDesc]
    );
    if (rows && rows.length > 0) {
      const created = { ...rows[0], video_count: 0, videos: [] };
      inMemoryCollections.set(created.id, created);
      return created;
    }
  } catch (err) {
    // Memory fallback
  }

  const id = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const created = {
    id,
    name: cleanName,
    cover_url: cleanCover,
    category: cleanCategory,
    audio_description: cleanAudioDesc,
    created_at: nowIso,
    updated_at: nowIso,
    video_count: 0,
    videos: []
  };
  inMemoryCollections.set(id, created);
  return created;
}

async function updateCollection(collectionId, { name, cover_url, category, audio_description }) {
  const cleanName = name ? name.trim() : undefined;
  const cleanCategory = category ? sanitizeCategory(category) : undefined;
  const cleanAudioDesc = audio_description !== undefined ? (audio_description ? audio_description.trim() : null) : undefined;
  const nowIso = new Date().toISOString();

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (cleanName !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(cleanName);
    }
    if (cover_url !== undefined) {
      fields.push(`cover_url = $${idx++}`);
      values.push(cover_url);
    }
    if (cleanCategory !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(cleanCategory);
    }
    if (cleanAudioDesc !== undefined) {
      fields.push(`audio_description = $${idx++}`);
      values.push(cleanAudioDesc);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(collectionId);
      const queryStr = `UPDATE linkvideo_collections SET ${fields.join(', ')} WHERE id::text = $${idx} RETURNING id, name, cover_url, category, audio_description, created_at, updated_at`;
      const { rows } = await query(queryStr, values);
      if (rows && rows.length > 0) {
        const updated = rows[0];
        inMemoryCollections.set(collectionId, updated);
        return await getCollectionById(collectionId);
      }
    }
  } catch (err) {
    // Memory fallback
  }

  if (inMemoryCollections.has(collectionId)) {
    const col = inMemoryCollections.get(collectionId);
    if (cleanName !== undefined) col.name = cleanName;
    if (cover_url !== undefined) col.cover_url = cover_url;
    if (cleanCategory !== undefined) col.category = cleanCategory;
    if (cleanAudioDesc !== undefined) col.audio_description = cleanAudioDesc;
    col.updated_at = nowIso;
    inMemoryCollections.set(collectionId, col);
    return await getCollectionById(collectionId);
  }

  throw new Error('Colección no encontrada.');
}

async function deleteCollection(collectionId) {
  try {
    await query(`DELETE FROM linkvideo_collections WHERE id::text = $1::text`, [collectionId]);
  } catch (err) {}

  inMemoryCollections.delete(collectionId);
  for (const [vId, v] of inMemoryVideos.entries()) {
    if (v.collection_id === collectionId) {
      inMemoryVideos.delete(vId);
    }
  }

  return { ok: true, id: collectionId };
}

async function addVideoToCollection(collectionId, { url, title, audio_description }) {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    throw new Error('La colección especificada no existe.');
  }

  const ytInfo = await fetchYouTubeInfo(url, title);
  const cleanAudioDesc = audio_description ? audio_description.trim() : null;
  const nowIso = new Date().toISOString();

  // Calcular siguiente posición
  const currentCount = collection.videos ? collection.videos.length : 0;
  const nextPos = currentCount;

  try {
    const { rows } = await query(
      `INSERT INTO linkvideo_videos (collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'active', $7, now(), now())
       RETURNING id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, created_at, updated_at`,
      [collectionId, ytInfo.title, ytInfo.videoId, ytInfo.original_url, ytInfo.thumbnail_url, nextPos, cleanAudioDesc]
    );
    if (rows && rows.length > 0) {
      const createdVid = rows[0];
      inMemoryVideos.set(createdVid.id, createdVid);
      return createdVid;
    }
  } catch (err) {
    // Fallback memory
  }

  const id = 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const createdVid = {
    id,
    collection_id: collectionId,
    title: ytInfo.title,
    video_id: ytInfo.videoId,
    original_url: ytInfo.original_url,
    thumbnail_url: ytInfo.thumbnail_url,
    position: nextPos,
    status: 'active',
    audio_description: cleanAudioDesc,
    created_at: nowIso,
    updated_at: nowIso
  };
  inMemoryVideos.set(id, createdVid);
  return createdVid;
}

async function updateVideo(videoId, { title, position, audio_description }) {
  const cleanTitle = title ? title.trim() : undefined;
  const cleanAudioDesc = audio_description !== undefined ? (audio_description ? audio_description.trim() : null) : undefined;
  const nowIso = new Date().toISOString();

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (cleanTitle !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(cleanTitle);
    }
    if (position !== undefined && typeof position === 'number') {
      fields.push(`position = $${idx++}`);
      values.push(position);
    }
    if (cleanAudioDesc !== undefined) {
      fields.push(`audio_description = $${idx++}`);
      values.push(cleanAudioDesc);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(videoId);
      const queryStr = `UPDATE linkvideo_videos SET ${fields.join(', ')} WHERE id::text = $${idx} RETURNING id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, created_at, updated_at`;
      const { rows } = await query(queryStr, values);
      if (rows && rows.length > 0) {
        const updated = rows[0];
        inMemoryVideos.set(videoId, updated);
        return updated;
      }
    }
  } catch (err) {
    // Memory fallback
  }

  if (inMemoryVideos.has(videoId)) {
    const vid = inMemoryVideos.get(videoId);
    if (cleanTitle !== undefined) vid.title = cleanTitle;
    if (position !== undefined && typeof position === 'number') vid.position = position;
    if (cleanAudioDesc !== undefined) vid.audio_description = cleanAudioDesc;
    vid.updated_at = nowIso;
    inMemoryVideos.set(videoId, vid);
    return vid;
  }

  throw new Error('Video no encontrado.');
}

async function deleteVideo(videoId) {
  try {
    await query(`DELETE FROM linkvideo_videos WHERE id::text = $1::text`, [videoId]);
  } catch (err) {}

  inMemoryVideos.delete(videoId);
  return { ok: true, id: videoId };
}

async function reorderVideos(collectionId, orderedVideoIds) {
  if (!Array.isArray(orderedVideoIds)) return { ok: false };

  for (let pos = 0; pos < orderedVideoIds.length; pos++) {
    const vId = orderedVideoIds[pos];
    await updateVideo(vId, { position: pos });
  }

  return await getCollectionById(collectionId);
}

// ---------------- SERVICIOS ORIGINALES REUTILIZADOS ----------------

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
 * Limpieza periódica de sesiones abandonadas.
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

/**
 * Obtiene subtítulos desde la BD (caché persistente) o mediante el extractor si no existen.
 */
async function getOrFetchSubtitles(videoId, requestedLang = 'es') {
  if (!videoId || typeof videoId !== 'string') {
    return { videoId: '', languageCode: requestedLang, cues: [], status: 'no_subtitles', source: 'none' };
  }

  const cleanVideoId = videoId.trim();
  const cleanLang = (requestedLang || 'es').trim().toLowerCase();
  const now = new Date();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  // 1. Intentar consultar en base de datos PostgreSQL
  try {
    const { rows } = await query(
      `SELECT id, video_id, language_code, status, cues, source, created_at, updated_at
       FROM video_subtitles
       WHERE video_id = $1 AND (language_code = $2 OR language_code LIKE $3)
       ORDER BY (language_code = $2) DESC, updated_at DESC
       LIMIT 1`,
      [cleanVideoId, cleanLang, `${cleanLang.substring(0, 2)}%`]
    );

    if (rows && rows.length > 0) {
      const cached = rows[0];
      const updatedAt = new Date(cached.updated_at);
      const isRecent = (now - updatedAt) < ONE_HOUR_MS;

      // Si están completos ('ready'), devolver directamente desde la BD
      if (cached.status === 'ready' && Array.isArray(cached.cues) && cached.cues.length > 0) {
        return {
          videoId: cached.video_id,
          languageCode: cached.language_code,
          cues: cached.cues,
          source: cached.source || 'db_cache',
          status: 'ready',
          cached: true
        };
      }

      // Si previamente falló o no tenía subtítulos y la consulta es reciente, devolver estado de la BD sin repetir peticiones
      if ((cached.status === 'no_subtitles' || cached.status === 'failed') && isRecent) {
        return {
          videoId: cached.video_id,
          languageCode: cached.language_code,
          cues: [],
          source: cached.source || 'db_cache',
          status: cached.status,
          cached: true
        };
      }
    }
  } catch (err) {
    // Fallback si la BD no está disponible
  }

  // 2. Verificar en almacén en memoria
  const memKey = `${cleanVideoId}_${cleanLang}`;
  if (inMemorySubtitles.has(memKey)) {
    const cachedMem = inMemorySubtitles.get(memKey);
    const isRecent = (now - new Date(cachedMem.updated_at)) < ONE_HOUR_MS;
    if (cachedMem.status === 'ready' && cachedMem.cues.length > 0) {
      return { ...cachedMem, cached: true };
    }
    if (isRecent && (cachedMem.status === 'no_subtitles' || cachedMem.status === 'failed')) {
      return { ...cachedMem, cached: true };
    }
  }

  // 3. Obtener subtítulos mediante extractor
  let extractedCues = [];
  let langCode = cleanLang;
  let source = 'youtube_extractor';
  let status = 'ready';

  try {
    const ytSub = await fetchYouTubeSubtitles(cleanVideoId);
    if (ytSub && Array.isArray(ytSub.cues) && ytSub.cues.length > 0) {
      extractedCues = ytSub.cues;
      langCode = ytSub.languageCode || cleanLang;
      status = 'ready';
    } else {
      status = 'no_subtitles';
    }
  } catch (err) {
    console.error(`[LinkVideo Subtitles] Error al extraer subtítulos para ${cleanVideoId}:`, err.message);
    status = 'failed';
  }

  // 4. Guardar o actualizar en BD (UPSERT)
  const resultObj = {
    videoId: cleanVideoId,
    languageCode: langCode,
    cues: extractedCues,
    source,
    status,
    updated_at: now.toISOString(),
    cached: false
  };

  try {
    await query(
      `INSERT INTO video_subtitles (video_id, language_code, status, cues, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, now(), now())
       ON CONFLICT (video_id, language_code)
       DO UPDATE SET
         status = EXCLUDED.status,
         cues = EXCLUDED.cues,
         source = EXCLUDED.source,
         updated_at = now()`,
      [cleanVideoId, langCode, status, JSON.stringify(extractedCues), source]
    );
  } catch (err) {
    // Memoria fallback
  }

  inMemorySubtitles.set(memKey, resultObj);
  inMemorySubtitles.set(`${cleanVideoId}_${langCode}`, resultObj);

  return resultObj;
}

module.exports = {
  PREDEFINED_CATEGORIES,
  // Subtítulos
  getOrFetchSubtitles,

  // Colecciones & Videos
  getCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  addVideoToCollection,
  updateVideo,
  deleteVideo,
  reorderVideos,

  // Stream & Live Sessions
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
