/**
 * Servicio Backend para Link Video (Colecciones, Álbumes y Videos),
 * Adaptadores de Contenido Externo Unificado (YouTube, Instagram, Vimeo, Dailymotion, Twitch, PeerTube, etc.),
 * Algoritmo de Recomendaciones Inteligente y Transmisiones Persistentes en Vivo (Link Live).
 */

const { query } = require('../db/postgres');
const videoStreamTool = require('../tools/videoStreamTool');
const { fetchYouTubeInfo, extractYouTubeId } = require('../utils/youtube');
const { extractHiddenTags, isReelUrlOrTitle } = require('../utils/tagExtractor');
const { detectExternalProvider, getAdapter, getProvidersStatus } = require('./videoProviders');

// Lista estática y predefinida de categorías para la plataforma Link Video
const PREDEFINED_CATEGORIES = [
  'General',
  'Películas / documentales',
  'Reels',
  'Vídeos',
  'Vimeo',
  'Directos',
  'Twitch',
  'PeerTube',
  'Charlas',
  'Música',
  'Podcasts'
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
const inMemoryUserViews = new Map(); // userId -> array of view records
const inMemoryExternalContent = new Map(); // id -> external content record

// Colecciones por defecto en memoria
const DEFAULT_MEM_COLLECTIONS = [
  {
    id: 'col_musica_destacada',
    name: 'Música & Videos Destacados',
    cover_url: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Música',
    audio_description: 'Colección oficial de éxitos musicales y clips de video en alta definición.',
    hidden_tags: ['musica', 'hit', 'pop', 'r&b', 'the weeknd', 'rick astley'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'col_cine_trailers',
    name: 'Cine & Estrenos',
    cover_url: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600',
    category: 'Películas / documentales',
    audio_description: 'Tráilers cinematográficos, películas destacadas y estrenos mundiales.',
    hidden_tags: ['peliculas', 'cine', 'trailer', 'estreno', 'hollywood'],
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
    hidden_tags: ['rick astley', 'pop', '80s', 'musica', 'classic'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'vid_default_2',
    collection_id: 'col_musica_destacada',
    title: 'The Weeknd - Blinding Lights (Official Music Video)',
    video_id: '4NRXx6U8ABQ',
    original_url: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
    thumbnail_url: 'https://img.youtube.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
    position: 1,
    status: 'active',
    audio_description: 'Tema icónico de synthpop y R&B de The Weeknd.',
    hidden_tags: ['the weeknd', 'r&b', 'pop', 'synthpop', 'blinding lights', 'musica'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'vid_default_reel_1',
    collection_id: 'col_musica_destacada',
    title: 'The Weeknd Live Short #shorts',
    video_id: '34Na4j8AVgA',
    original_url: 'https://www.youtube.com/shorts/34Na4j8AVgA',
    thumbnail_url: 'https://img.youtube.com/vi/34Na4j8AVgA/hqdefault.jpg',
    position: 2,
    status: 'active',
    audio_description: 'Reel/Short de The Weeknd en vivo.',
    hidden_tags: ['the weeknd', 'reel', 'short', 'live', 'r&b', 'pop'],
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

// ---------------- GESTIÓN UNIFICADA DE CONTENIDO EXTERNO ----------------

/**
 * Agrega contenido externo detectando automáticamente el proveedor
 */
async function addExternalContent({ userId, url, category, title, description, collectionId, status = 'active', visibility = 'public', hostHeader = null }) {
  if (!url || typeof url !== 'string') {
    throw new Error('La URL del contenido es obligatoria.');
  }

  const cleanUrl = url.trim();
  const providerName = detectExternalProvider(cleanUrl);
  if (!providerName) {
    throw new Error('La URL ingresada no pertenece a ninguna plataforma de contenido soportada. Soportadas: YouTube, Instagram, Vimeo, Dailymotion, Twitch, PeerTube, Internet Archive, TED, SoundCloud, Mixcloud.');
  }

  const adapter = getAdapter(providerName);
  if (!adapter) {
    throw new Error(`Adaptador de proveedor para ${providerName} no disponible.`);
  }

  // Parsear URL mediante adaptador
  const parsed = adapter.parseUrl(cleanUrl, {
    title: title ? title.trim() : null,
    category: category ? sanitizeCategory(category) : null,
    host: hostHeader || 'localhost'
  });

  const cleanCategory = parsed.category || sanitizeCategory(category);
  const cleanTitle = (title && title.trim()) || parsed.title || `${adapter.name} Content`;
  const cleanDesc = description ? description.trim() : null;
  const nowIso = new Date().toISOString();

  // Verificar duplicados en contenido activo
  const existingDuplicate = await checkDuplicateExternalContent(cleanUrl, providerName, parsed.content_id);
  if (existingDuplicate) {
    throw new Error('Este contenido ya ha sido añadido previamente a Link Video.');
  }

  // Intentar guardar en PostgreSQL
  try {
    const { rows } = await query(
      `INSERT INTO external_content (user_id, provider, url, content_id, embed_url, category, title, description, thumbnail, collection_id, status, visibility, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       RETURNING id, user_id, provider, url, content_id, embed_url, category, title, description, thumbnail, collection_id, status, visibility, created_at, updated_at`,
      [userId, providerName, cleanUrl, parsed.content_id, parsed.embed_url, cleanCategory, cleanTitle, cleanDesc, parsed.thumbnail, collectionId || null, status, visibility]
    );

    if (rows && rows.length > 0) {
      const created = {
        ...rows[0],
        capabilities: parsed.capabilities
      };
      inMemoryExternalContent.set(created.id, created);
      return created;
    }
  } catch (err) {
    // Memory fallback
  }

  const id = 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const created = {
    id,
    user_id: userId,
    provider: providerName,
    url: cleanUrl,
    content_id: parsed.content_id,
    embed_url: parsed.embed_url,
    category: cleanCategory,
    title: cleanTitle,
    description: cleanDesc,
    thumbnail: parsed.thumbnail,
    collection_id: collectionId || null,
    status,
    visibility,
    created_at: nowIso,
    updated_at: nowIso,
    capabilities: parsed.capabilities
  };
  inMemoryExternalContent.set(id, created);
  return created;
}

/**
 * Comprueba si una URL o ID de contenido ya existe activo
 */
async function checkDuplicateExternalContent(url, provider, contentId) {
  try {
    const { rows } = await query(
      `SELECT id FROM external_content
       WHERE status = 'active' AND (url = $1 OR (provider = $2 AND content_id = $3))
       LIMIT 1`,
      [url, provider, contentId]
    );
    if (rows && rows.length > 0) return true;
  } catch (e) {}

  for (const item of inMemoryExternalContent.values()) {
    if (item.status === 'active' && (item.url === url || (item.provider === provider && item.content_id === contentId))) {
      return true;
    }
  }
  return false;
}

/**
 * Obtiene el catálogo de contenido externo con información del autor y capacidades
 */
async function getExternalContent({ category, provider, userId, collectionId, status = 'active', limit = 50 } = {}) {
  let list = [];

  try {
    let whereClauses = ['ec.status = $1'];
    let params = [status];
    let idx = 2;

    if (category) {
      whereClauses.push(`ec.category ILIKE $${idx++}`);
      params.push(`%${category.trim()}%`);
    }
    if (provider) {
      whereClauses.push(`ec.provider = $${idx++}`);
      params.push(provider.trim().toLowerCase());
    }
    if (userId) {
      whereClauses.push(`ec.user_id = $${idx++}`);
      params.push(userId);
    }
    if (collectionId) {
      whereClauses.push(`ec.collection_id = $${idx++}`);
      params.push(collectionId);
    }

    const { rows } = await query(
      `SELECT ec.*, u.name AS author_name, u.avatar_data AS author_avatar
       FROM external_content ec
       LEFT JOIN users u ON ec.user_id = u.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY ec.created_at DESC
       LIMIT $${idx}`,
      [...params, limit]
    );

    if (rows && rows.length > 0) {
      list = rows.map(item => {
        const adapter = getAdapter(item.provider);
        return {
          ...item,
          capabilities: adapter ? adapter.getCapabilities() : {}
        };
      });
      return list;
    }
  } catch (err) {
    // Memory fallback
  }

  const memList = Array.from(inMemoryExternalContent.values()).filter(item => {
    if (status && item.status !== status) return false;
    if (category && item.category.toLowerCase() !== category.toLowerCase()) return false;
    if (provider && item.provider.toLowerCase() !== provider.toLowerCase()) return false;
    if (userId && item.user_id !== userId) return false;
    if (collectionId && item.collection_id !== collectionId) return false;
    return true;
  });

  return memList.map(item => {
    const adapter = getAdapter(item.provider);
    return {
      ...item,
      capabilities: adapter ? adapter.getCapabilities() : {}
    };
  });
}

/**
 * Obtiene el contenido añadido por un usuario concreto para su perfil público
 */
async function getUserExternalContent(userId, filterCategory = null) {
  if (!userId) return [];
  return await getExternalContent({ userId, category: filterCategory, status: 'active' });
}

/**
 * Actualiza el estado o metadatos de un contenido externo (Moderación / Usuario)
 */
async function updateExternalContent(id, { status, visibility, collectionId, category, title, description }, requestingUserId = null, isAdmin = false) {
  let target = null;
  try {
    const { rows } = await query(`SELECT * FROM external_content WHERE id::text = $1::text`, [id]);
    if (rows && rows.length > 0) target = rows[0];
  } catch (e) {}

  if (!target && inMemoryExternalContent.has(id)) {
    target = inMemoryExternalContent.get(id);
  }

  if (!target) {
    throw new Error('Contenido no encontrado.');
  }

  if (requestingUserId && !isAdmin && target.user_id !== requestingUserId) {
    throw new Error('No tienes permisos para modificar este contenido.');
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status) { fields.push(`status = $${idx++}`); values.push(status); }
    if (visibility) { fields.push(`visibility = $${idx++}`); values.push(visibility); }
    if (collectionId !== undefined) { fields.push(`collection_id = $${idx++}`); values.push(collectionId); }
    if (category) { fields.push(`category = $${idx++}`); values.push(sanitizeCategory(category)); }
    if (title) { fields.push(`title = $${idx++}`); values.push(title.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description ? description.trim() : null); }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(id);
      const queryStr = `UPDATE external_content SET ${fields.join(', ')} WHERE id::text = $${idx} RETURNING *`;
      const { rows } = await query(queryStr, values);
      if (rows && rows.length > 0) {
        const updated = rows[0];
        inMemoryExternalContent.set(id, updated);
        return updated;
      }
    }
  } catch (err) {}

  if (inMemoryExternalContent.has(id)) {
    const item = inMemoryExternalContent.get(id);
    if (status) item.status = status;
    if (visibility) item.visibility = visibility;
    if (collectionId !== undefined) item.collection_id = collectionId;
    if (category) item.category = sanitizeCategory(category);
    if (title) item.title = title.trim();
    if (description !== undefined) item.description = description ? description.trim() : null;
    item.updated_at = new Date().toISOString();
    return item;
  }

  throw new Error('Contenido no encontrado.');
}

/**
 * Elimina un contenido externo
 */
async function deleteExternalContent(id, requestingUserId, isAdmin = false) {
  let target = null;
  try {
    const { rows } = await query(`SELECT * FROM external_content WHERE id::text = $1::text`, [id]);
    if (rows && rows.length > 0) target = rows[0];
  } catch (e) {}

  if (!target && inMemoryExternalContent.has(id)) {
    target = inMemoryExternalContent.get(id);
  }

  if (!target) {
    throw new Error('El contenido especificado no existe.');
  }

  if (!isAdmin && target.user_id !== requestingUserId) {
    throw new Error('No tienes permisos para eliminar este contenido.');
  }

  try {
    await query(`DELETE FROM external_content WHERE id::text = $1::text`, [id]);
  } catch (e) {}

  inMemoryExternalContent.delete(id);
  return { ok: true, id };
}

/**
 * Reporta un contenido externo
 */
async function reportExternalContent(id, reporterUserId, reason) {
  try {
    await query(
      `UPDATE external_content SET status = 'reported', updated_at = now() WHERE id::text = $1::text`,
      [id]
    );
  } catch (e) {}

  if (inMemoryExternalContent.has(id)) {
    const item = inMemoryExternalContent.get(id);
    item.status = 'reported';
  }

  return { ok: true, id, status: 'reported' };
}

// ---------------- ALGORITMO DE RECOMENDACIÓN Y ETIQUETAS OCULTAS ----------------

/**
 * Registra la visualización de un video o reel por parte de un usuario.
 */
async function recordUserView({ userId, videoId, collectionId = null, tags = [], isReel = false }) {
  if (!userId || !videoId) return { ok: false };

  const cleanUserId = String(userId).trim();
  const cleanVideoId = String(videoId).trim();

  let extractedTags = Array.isArray(tags) ? tags : [];
  if (extractedTags.length === 0) {
    const vidObj = Array.from(inMemoryVideos.values()).find(v => v.video_id === cleanVideoId || v.id === cleanVideoId);
    if (vidObj) {
      extractedTags = vidObj.hidden_tags || extractHiddenTags(vidObj);
    }
  }

  const nowIso = new Date().toISOString();

  try {
    await query(
      `INSERT INTO user_video_views (user_id, video_id, collection_id, is_reel, tags, view_count, last_viewed_at, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, 1, now(), now())
       ON CONFLICT (user_id, video_id) DO UPDATE SET
         view_count = user_video_views.view_count + 1,
         last_viewed_at = now(),
         tags = COALESCE(user_video_views.tags, '[]'::jsonb) || EXCLUDED.tags`,
      [cleanUserId, cleanVideoId, collectionId, isReel, JSON.stringify(extractedTags)]
    );
  } catch (err) {
    try {
      const existing = await query(
        `SELECT id, view_count FROM user_video_views WHERE user_id = $1 AND video_id = $2`,
        [cleanUserId, cleanVideoId]
      );
      if (existing.rows && existing.rows.length > 0) {
        await query(
          `UPDATE user_video_views
           SET view_count = view_count + 1, last_viewed_at = now()
           WHERE id = $1`,
          [existing.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO user_video_views (user_id, video_id, collection_id, is_reel, tags, view_count, last_viewed_at, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 1, now(), now())`,
          [cleanUserId, cleanVideoId, collectionId, isReel, JSON.stringify(extractedTags)]
        );
      }
    } catch (e) {}
  }

  if (!inMemoryUserViews.has(cleanUserId)) {
    inMemoryUserViews.set(cleanUserId, []);
  }
  const userViews = inMemoryUserViews.get(cleanUserId);
  const existingIndex = userViews.findIndex(v => v.videoId === cleanVideoId);
  if (existingIndex >= 0) {
    userViews[existingIndex].viewCount += 1;
    userViews[existingIndex].lastViewedAt = nowIso;
    userViews[existingIndex].tags = Array.from(new Set([...userViews[existingIndex].tags, ...extractedTags]));
  } else {
    userViews.push({
      videoId: cleanVideoId,
      collectionId,
      isReel,
      tags: extractedTags,
      viewCount: 1,
      lastViewedAt: nowIso
    });
  }

  return { ok: true, userId: cleanUserId, videoId: cleanVideoId, tags: extractedTags };
}

/**
 * Calcula el mapa de ponderación de etiquetas del usuario
 */
async function getUserRecommendationWeights(userId) {
  if (!userId) return {};

  const cleanUserId = String(userId).trim();
  let views = [];

  try {
    const { rows } = await query(
      `SELECT video_id, collection_id, is_reel, tags, view_count, last_viewed_at
       FROM user_video_views
       WHERE user_id = $1
       ORDER BY last_viewed_at DESC
       LIMIT 100`,
      [cleanUserId]
    );
    if (rows && rows.length > 0) {
      views = rows.map(r => ({
        videoId: r.video_id,
        collectionId: r.collection_id,
        isReel: r.is_reel,
        tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : []),
        viewCount: r.view_count || 1,
        lastViewedAt: r.last_viewed_at
      }));
    }
  } catch (e) {}

  if (views.length === 0 && inMemoryUserViews.has(cleanUserId)) {
    views = inMemoryUserViews.get(cleanUserId);
  }

  const weights = {};
  const now = Date.now();
  const DECAY_LAMBDA = 0.2;

  for (const v of views) {
    const timeMs = new Date(v.lastViewedAt).getTime();
    const daysAgo = Math.max(0, (now - timeMs) / (1000 * 60 * 60 * 24));
    const timeWeight = Math.exp(-DECAY_LAMBDA * daysAgo);
    const scoreDelta = (v.viewCount || 1) * timeWeight;

    for (const tag of (v.tags || [])) {
      const cleanTag = String(tag).toLowerCase().trim();
      if (cleanTag) {
        weights[cleanTag] = (weights[cleanTag] || 0) + scoreDelta;
      }
    }
  }

  return weights;
}

/**
 * Pondera un ítem asignándole una puntuación de recomendación
 */
function calculateItemRecommendationScore(item, userWeights = {}) {
  const tags = item.hidden_tags || extractHiddenTags(item);
  let totalScore = 0;

  for (const t of tags) {
    const cleanTag = String(t).toLowerCase().trim();
    if (userWeights[cleanTag]) {
      totalScore += userWeights[cleanTag];
    }
  }

  if (item.category && userWeights[item.category.toLowerCase()]) {
    totalScore += userWeights[item.category.toLowerCase()] * 1.5;
  }

  return totalScore;
}

// ---------------- GESTIÓN DE COLECCIONES Y VIDEOS ----------------

async function getCollections(userId = null, options = {}) {
  const includeVideos = typeof options === 'boolean' ? options : !!options.includeVideos;
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, Math.min(100, parseInt(options.limit || 20, 10)));
  const offset = (page - 1) * limit;
  const categoryFilter = options.category ? String(options.category).trim() : null;
  const searchFilter = (options.search || options.q) ? String(options.search || options.q).trim() : null;

  let userWeights = {};
  if (userId) {
    userWeights = await getUserRecommendationWeights(userId);
  }

  let collections = [];

  try {
    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (categoryFilter && categoryFilter.toLowerCase() !== 'todas') {
      whereClauses.push(`c.category ILIKE $${idx++}`);
      params.push(`%${categoryFilter}%`);
    }
    if (searchFilter) {
      whereClauses.push(`(c.name ILIKE $${idx} OR c.category ILIKE $${idx} OR c.audio_description ILIKE $${idx})`);
      idx++;
      params.push(`%${searchFilter}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectQuery = includeVideos
      ? `SELECT c.id, c.name, c.cover_url, c.category, c.audio_description, c.hidden_tags, c.created_at, c.updated_at,
                COUNT(v.id)::int AS video_count,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', v.id,
                      'collection_id', v.collection_id,
                      'title', v.title,
                      'video_id', v.video_id,
                      'original_url', v.original_url,
                      'thumbnail_url', v.thumbnail_url,
                      'position', v.position,
                      'status', v.status,
                      'audio_description', v.audio_description,
                      'hidden_tags', v.hidden_tags
                    ) ORDER BY v.position ASC, v.created_at ASC
                  ) FILTER (WHERE v.id IS NOT NULL AND v.status = 'active'),
                  '[]'::json
                ) AS videos
         FROM linkvideo_collections c
         LEFT JOIN linkvideo_videos v ON c.id = v.collection_id AND v.status = 'active'
         ${whereSql}
         GROUP BY c.id
         ORDER BY c.created_at DESC`
      : `SELECT c.id, c.name, c.cover_url, c.category, c.audio_description, c.hidden_tags, c.created_at, c.updated_at,
                COUNT(v.id)::int AS video_count
         FROM linkvideo_collections c
         LEFT JOIN linkvideo_videos v ON c.id = v.collection_id AND v.status = 'active'
         ${whereSql}
         GROUP BY c.id
         ORDER BY c.created_at DESC`;

    const { rows } = await query(selectQuery, params);
    if (rows && rows.length > 0) {
      collections = rows.map(col => {
        const hTags = Array.isArray(col.hidden_tags) && col.hidden_tags.length > 0
          ? col.hidden_tags
          : extractHiddenTags(col);
        return {
          ...col,
          category: sanitizeCategory(col.category),
          hidden_tags: hTags
        };
      });
    }
  } catch (err) {}

  if (!collections.length) {
    collections = Array.from(inMemoryCollections.values()).filter(col => {
      if (categoryFilter && categoryFilter.toLowerCase() !== 'todas' && !col.category.toLowerCase().includes(categoryFilter.toLowerCase())) {
        return false;
      }
      if (searchFilter) {
        const fullText = `${col.name} ${col.category} ${col.audio_description || ''}`.toLowerCase();
        if (!fullText.includes(searchFilter.toLowerCase())) return false;
      }
      return true;
    }).map(col => {
      const memVideos = Array.from(inMemoryVideos.values()).filter(v => v.collection_id === col.id && v.status === 'active');
      const hTags = Array.isArray(col.hidden_tags) && col.hidden_tags.length > 0
        ? col.hidden_tags
        : extractHiddenTags(col);
      const item = {
        ...col,
        category: col.category || 'General',
        hidden_tags: hTags,
        video_count: memVideos.length
      };
      if (includeVideos) {
        item.videos = memVideos.map(v => ({
          ...v,
          hidden_tags: Array.isArray(v.hidden_tags) && v.hidden_tags.length > 0 ? v.hidden_tags : extractHiddenTags(v)
        })).sort((a, b) => (a.position - b.position));
      }
      return item;
    });
  }

  collections = collections.map(col => {
    const score = calculateItemRecommendationScore(col, userWeights);
    return {
      ...col,
      recommendation_score: parseFloat(score.toFixed(2)),
      is_recommended: score > 0
    };
  });

  collections.sort((a, b) => (b.recommendation_score - a.recommendation_score));

  if (options.paginate) {
    const paginated = collections.slice(offset, offset + limit);
    return {
      collections: paginated,
      total: collections.length,
      page,
      limit,
      hasMore: offset + limit < collections.length
    };
  }

  return collections;
}

async function getCollectionById(collectionId) {
  let collection = null;
  let videos = [];

  try {
    const colRes = await query(
      `SELECT id, name, cover_url, category, audio_description, hidden_tags, created_at, updated_at
       FROM linkvideo_collections
       WHERE id::text = $1::text`,
      [collectionId]
    );
    if (colRes.rows && colRes.rows.length > 0) {
      collection = colRes.rows[0];
      const vidRes = await query(
        `SELECT id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, hidden_tags, created_at, updated_at
         FROM linkvideo_videos
         WHERE collection_id::text = $1::text AND status = 'active'
         ORDER BY position ASC, created_at ASC`,
        [collectionId]
      );
      videos = (vidRes.rows || []).map(v => ({
        ...v,
        hidden_tags: Array.isArray(v.hidden_tags) && v.hidden_tags.length > 0 ? v.hidden_tags : extractHiddenTags(v)
      }));
      return {
        ...collection,
        hidden_tags: Array.isArray(collection.hidden_tags) && collection.hidden_tags.length > 0 ? collection.hidden_tags : extractHiddenTags(collection),
        videos
      };
    }
  } catch (err) {}

  if (inMemoryCollections.has(collectionId)) {
    collection = inMemoryCollections.get(collectionId);
    videos = Array.from(inMemoryVideos.values())
      .filter(v => v.collection_id === collectionId && v.status === 'active')
      .map(v => ({
        ...v,
        hidden_tags: Array.isArray(v.hidden_tags) && v.hidden_tags.length > 0 ? v.hidden_tags : extractHiddenTags(v)
      }))
      .sort((a, b) => (a.position - b.position));
    return {
      ...collection,
      hidden_tags: Array.isArray(collection.hidden_tags) && collection.hidden_tags.length > 0 ? collection.hidden_tags : extractHiddenTags(collection),
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
  const hiddenTags = extractHiddenTags({ name: cleanName, category: cleanCategory, audio_description: cleanAudioDesc });
  const nowIso = new Date().toISOString();

  try {
    const { rows } = await query(
      `INSERT INTO linkvideo_collections (name, cover_url, category, audio_description, hidden_tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
       RETURNING id, name, cover_url, category, audio_description, hidden_tags, created_at, updated_at`,
      [cleanName, cleanCover, cleanCategory, cleanAudioDesc, JSON.stringify(hiddenTags)]
    );
    if (rows && rows.length > 0) {
      const created = { ...rows[0], video_count: 0, videos: [] };
      inMemoryCollections.set(created.id, created);
      return created;
    }
  } catch (err) {}

  const id = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const created = {
    id,
    name: cleanName,
    cover_url: cleanCover,
    category: cleanCategory,
    audio_description: cleanAudioDesc,
    hidden_tags: hiddenTags,
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
  const hiddenTags = extractHiddenTags({ name: cleanName, category: cleanCategory, audio_description: cleanAudioDesc });
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

    fields.push(`hidden_tags = $${idx++}::jsonb`);
    values.push(JSON.stringify(hiddenTags));

    fields.push(`updated_at = now()`);
    values.push(collectionId);

    const queryStr = `UPDATE linkvideo_collections SET ${fields.join(', ')} WHERE id::text = $${idx} RETURNING id, name, cover_url, category, audio_description, hidden_tags, created_at, updated_at`;
    const { rows } = await query(queryStr, values);
    if (rows && rows.length > 0) {
      const updated = rows[0];
      inMemoryCollections.set(collectionId, updated);
      return await getCollectionById(collectionId);
    }
  } catch (err) {}

  if (inMemoryCollections.has(collectionId)) {
    const col = inMemoryCollections.get(collectionId);
    if (cleanName !== undefined) col.name = cleanName;
    if (cover_url !== undefined) col.cover_url = cover_url;
    if (cleanCategory !== undefined) col.category = cleanCategory;
    if (cleanAudioDesc !== undefined) col.audio_description = cleanAudioDesc;
    col.hidden_tags = hiddenTags;
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
  const hiddenTags = extractHiddenTags({ title: ytInfo.title, original_url: ytInfo.original_url, audio_description: cleanAudioDesc, category: collection.category });
  const nowIso = new Date().toISOString();

  const currentCount = collection.videos ? collection.videos.length : 0;
  const nextPos = currentCount;

  try {
    const { rows } = await query(
      `INSERT INTO linkvideo_videos (collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, hidden_tags, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'active', $7, $8::jsonb, now(), now())
       RETURNING id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, hidden_tags, created_at, updated_at`,
      [collectionId, ytInfo.title, ytInfo.videoId, ytInfo.original_url, ytInfo.thumbnail_url, nextPos, cleanAudioDesc, JSON.stringify(hiddenTags)]
    );
    if (rows && rows.length > 0) {
      const createdVid = rows[0];
      inMemoryVideos.set(createdVid.id, createdVid);
      return createdVid;
    }
  } catch (err) {}

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
    hidden_tags: hiddenTags,
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
      const queryStr = `UPDATE linkvideo_videos SET ${fields.join(', ')} WHERE id::text = $${idx} RETURNING id, collection_id, title, video_id, original_url, thumbnail_url, position, status, audio_description, hidden_tags, created_at, updated_at`;
      const { rows } = await query(queryStr, values);
      if (rows && rows.length > 0) {
        const updated = rows[0];
        inMemoryVideos.set(videoId, updated);
        return updated;
      }
    }
  } catch (err) {}

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

/**
 * Obtiene las recomendaciones principales personalizadas para un usuario (Spotify/YouTube style).
 */
async function getTopRecommendations(userId, limit = 6) {
  const collections = await getCollections(userId, { includeVideos: false });
  const userWeights = await getUserRecommendationWeights(userId);

  let allVideos = [];
  try {
    const { rows } = await query(
      `SELECT v.id, v.collection_id, v.title, v.video_id, v.original_url, v.thumbnail_url,
              v.position, v.status, v.audio_description, v.hidden_tags,
              c.name AS collection_name, c.category
       FROM linkvideo_videos v
       JOIN linkvideo_collections c ON v.collection_id = c.id
       WHERE v.status = 'active'
       LIMIT 100`
    );
    if (rows && rows.length > 0) {
      allVideos = rows.map(vid => {
        const score = calculateItemRecommendationScore(vid, userWeights);
        return {
          ...vid,
          hidden_tags: Array.isArray(vid.hidden_tags) ? vid.hidden_tags : extractHiddenTags(vid),
          recommendation_score: parseFloat(score.toFixed(2))
        };
      });
    }
  } catch (err) {}

  if (allVideos.length === 0) {
    for (const vid of inMemoryVideos.values()) {
      if (vid.status === 'active') {
        const col = inMemoryCollections.get(vid.collection_id);
        const score = calculateItemRecommendationScore(vid, userWeights);
        allVideos.push({
          ...vid,
          collection_name: col ? col.name : 'Link Video',
          category: col ? col.category : 'General',
          recommendation_score: parseFloat(score.toFixed(2))
        });
      }
    }
  }

  allVideos.sort((a, b) => b.recommendation_score - a.recommendation_score);

  return {
    collections: collections.slice(0, limit),
    videos: allVideos.slice(0, limit)
  };
}

/**
 * Obtiene el catálogo de Reels/Shorts con sistema de desduplicación y priorización por usuario.
 */
async function getReelsCatalog(userId) {
  let allVideos = [];

  try {
    const { rows } = await query(
      `SELECT v.id, v.collection_id, v.title, v.video_id, v.original_url, v.thumbnail_url,
              v.position, v.status, v.audio_description, v.hidden_tags,
              c.name AS collection_name, c.category
       FROM linkvideo_videos v
       JOIN linkvideo_collections c ON v.collection_id = c.id
       WHERE v.status = 'active'
         AND (v.original_url ILIKE '%/shorts/%' OR v.title ILIKE '%#shorts%' OR v.title ILIKE '%reel%' OR v.original_url ILIKE '%reel%')`
    );
    if (rows && rows.length > 0) {
      allVideos = rows.map(vid => ({
        ...vid,
        hidden_tags: Array.isArray(vid.hidden_tags) ? vid.hidden_tags : extractHiddenTags(vid)
      }));
    }
  } catch (err) {}

  if (allVideos.length === 0) {
    for (const vid of inMemoryVideos.values()) {
      if (vid.status === 'active' && isReelUrlOrTitle(vid.original_url, vid.title)) {
        const col = inMemoryCollections.get(vid.collection_id);
        allVideos.push({
          ...vid,
          collection_name: col ? col.name : 'Link Video',
          category: col ? col.category : 'General'
        });
      }
    }
  }

  // Incluir también los Reels de external_content
  const extReels = await getExternalContent({ category: 'Reels', status: 'active' });
  for (const ext of extReels) {
    if (!allVideos.some(v => v.video_id === ext.content_id || v.id === ext.id)) {
      allVideos.push({
        id: ext.id,
        video_id: ext.content_id,
        original_url: ext.url,
        thumbnail_url: ext.thumbnail,
        title: ext.title,
        category: ext.category,
        provider: ext.provider,
        embed_url: ext.embed_url,
        capabilities: ext.capabilities
      });
    }
  }

  const cleanUserId = userId ? String(userId).trim() : null;
  const viewedMap = new Map();

  if (cleanUserId) {
    try {
      const { rows } = await query(
        `SELECT video_id, view_count FROM user_video_views WHERE user_id = $1 AND is_reel = true`,
        [cleanUserId]
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          viewedMap.set(r.video_id, r.view_count || 1);
        }
      }
    } catch (e) {}

    if (viewedMap.size === 0 && inMemoryUserViews.has(cleanUserId)) {
      const views = inMemoryUserViews.get(cleanUserId);
      for (const v of views) {
        if (v.isReel) {
          viewedMap.set(v.videoId, v.viewCount || 1);
        }
      }
    }
  }

  const reelsWithPriority = allVideos.map(reel => {
    const viewCount = viewedMap.get(reel.video_id) || viewedMap.get(reel.id) || 0;
    const isSeen = viewCount > 0;
    const priorityScore = isSeen ? Math.max(-100, 10 - viewCount * 30) : 100;

    return {
      ...reel,
      is_reel: true,
      seen: isSeen,
      view_count: viewCount,
      priority_score: priorityScore
    };
  });

  reelsWithPriority.sort((a, b) => b.priority_score - a.priority_score);

  return reelsWithPriority;
}

// ---------------- SERVICIOS ORIGINALES REUTILIZADOS ----------------

async function getCatalog(forceRefresh = false) {
  return await videoStreamTool.getVideoCatalog(forceRefresh);
}

async function getStreamById(streamId) {
  const catalog = await getCatalog();
  const found = catalog.find(s => s.id === streamId);
  if (found) return found;

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
 * Obtiene el listado de transmisiones activas.
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

module.exports = {
  PREDEFINED_CATEGORIES,
  // Contenido Externo Unificado
  addExternalContent,
  getExternalContent,
  getUserExternalContent,
  updateExternalContent,
  deleteExternalContent,
  reportExternalContent,
  getProvidersStatus,

  // Recomendaciones & Etiquetas Ocultas
  recordUserView,
  getUserRecommendationWeights,
  getTopRecommendations,
  getReelsCatalog,

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
