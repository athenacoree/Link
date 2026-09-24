/**
 * Servicio Central de Búsqueda de Videos con Caché y Arquitectura Multiproveedor.
 * Soporta Pexels Video API (e infraestructura lista para Pixabay u otras fuentes).
 */

const { query: dbQuery } = require('../db/postgres');
const { searchPexelsVideos } = require('./videoProviders/pexelsProvider');

// Caché en memoria de respaldo si PostgreSQL no estuviera disponible
const inMemoryCache = new Map();

/**
 * Normaliza y genera una clave de caché unívoca
 */
function buildCacheKey(provider, query, orientation = '', category = '') {
  const q = (query || '').toLowerCase().trim();
  const o = (orientation || '').toLowerCase().trim();
  const c = (category || '').toLowerCase().trim();
  return `${provider}:${q}:${o}:${c}`;
}

/**
 * Intenta recuperar del caché de base de datos o de memoria
 */
async function getFromCache(cacheKey) {
  // 1. Intentar en base de datos PostgreSQL
  try {
    const sql = `
      SELECT results_json, expires_at
      FROM video_search_cache
      WHERE cache_key = $1 AND expires_at > now()
      LIMIT 1
    `;
    const res = await dbQuery(sql, [cacheKey]);
    if (res && res.rows && res.rows.length > 0) {
      return res.rows[0].results_json;
    }
  } catch (err) {
    // Si PostgreSQL falla o no está conectado, usar en memoria
  }

  // 2. Intentar en memoria
  const memEntry = inMemoryCache.get(cacheKey);
  if (memEntry && memEntry.expires_at > Date.now()) {
    return memEntry.results_json;
  }
  if (memEntry) {
    inMemoryCache.delete(cacheKey);
  }

  return null;
}

/**
 * Almacena los resultados en caché por 10 minutos (600,000 ms)
 */
async function saveToCache(cacheKey, provider, query, orientation, category, resultsData) {
  const ttlMs = 10 * 60 * 1000; // 10 minutos
  const expiresAt = new Date(Date.now() + ttlMs);

  // Guardar en memoria
  inMemoryCache.set(cacheKey, {
    results_json: resultsData,
    expires_at: expiresAt.getTime()
  });

  // Guardar en PostgreSQL
  try {
    const sql = `
      INSERT INTO video_search_cache (cache_key, provider, query, orientation, category, results_json, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cache_key)
      DO UPDATE SET
        results_json = EXCLUDED.results_json,
        created_at = now(),
        expires_at = EXCLUDED.expires_at
    `;
    await dbQuery(sql, [
      cacheKey,
      provider,
      query || '',
      orientation || null,
      category || null,
      JSON.stringify(resultsData),
      expiresAt.toISOString()
    ]);
  } catch (err) {
    // Si falla escritura en BD, no interrumpe el flujo principal
  }
}

/**
 * Elimina registros caducados de la caché
 */
async function cleanupExpiredCache() {
  let dbCount = 0;
  try {
    const res = await dbQuery('DELETE FROM video_search_cache WHERE expires_at <= now()');
    dbCount = res.rowCount || 0;
  } catch (err) {}

  // Limpiar memoria
  const now = Date.now();
  for (const [key, val] of inMemoryCache.entries()) {
    if (val.expires_at <= now) {
      inMemoryCache.delete(key);
    }
  }

  return dbCount;
}

/**
 * Función principal para buscar videos a través de proveedores
 */
async function searchVideos({ query, orientation = '', category = '', provider = 'pexels', page = 1, perPage = 6 }) {
  const cleanQuery = (query || '').trim();
  const selectedProvider = (provider || 'pexels').toLowerCase();
  const cacheKey = buildCacheKey(selectedProvider, cleanQuery, orientation, category);

  // 1. Revisar caché existente
  const cachedResult = await getFromCache(cacheKey);
  if (cachedResult) {
    return {
      type: 'video_search_card',
      data: cachedResult,
      cached: true
    };
  }

  // 2. Consultar el proveedor solicitado
  let providerResult = null;
  if (selectedProvider === 'pexels') {
    providerResult = await searchPexelsVideos({ query: cleanQuery, orientation, category, page, perPage });
  } else {
    // Fallback por omisión a Pexels (preparado para registrar Pixabay u otros proveedores en el futuro)
    providerResult = await searchPexelsVideos({ query: cleanQuery, orientation, category, page, perPage });
  }

  // 3. Guardar en caché si se obtuvieron resultados válidos
  if (providerResult && providerResult.videos && providerResult.videos.length > 0) {
    await saveToCache(cacheKey, selectedProvider, cleanQuery, orientation, category, providerResult);
  }

  return {
    type: 'video_search_card',
    data: providerResult,
    cached: false
  };
}

module.exports = {
  searchVideos,
  cleanupExpiredCache,
  getFromCache,
  saveToCache
};
