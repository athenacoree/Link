/**
 * Módulo de Integración con Link Video (Plataforma de Streaming de Películas, Video y Audio)
 * Configurable por variable de entorno: LINK_VIDEO_URL, LINK_STREAM_URL o LINK_VIDEO_BASE_URL
 */

const DEFAULT_LINK_VIDEO_BASE_URL = 'https://athenacoree.github.io/link-video/';

function getLinkVideoBaseUrl() {
  const envUrl = process.env.LINK_VIDEO_URL || process.env.LINK_STREAM_URL || process.env.LINK_VIDEO_BASE_URL || DEFAULT_LINK_VIDEO_BASE_URL;
  let cleanUrl = envUrl.trim();
  if (!cleanUrl.endsWith('/')) {
    cleanUrl += '/';
  }
  return cleanUrl;
}

function getCatalogUrl() {
  const baseUrl = getLinkVideoBaseUrl();
  return `${baseUrl}catalog.json`;
}

// Catálogo estático de respaldo cuando la web no está disponible en línea
const FALLBACK_CATALOG = [
  {
    id: 'demo_stream_1',
    title: 'Canal Películas 24/7 HD',
    type: 'video',
    description: 'Transmisión continua de cine y películas en alta definición.',
    category: 'movies',
    url: './stream/movies/',
    stream_url: './stream/movies/index.m3u8',
    status: 'active'
  },
  {
    id: 'demo_stream_2',
    title: 'Estación de Audio y Música En Vivo',
    type: 'audio',
    description: 'Streaming de audio con música variada y podcasts en directo.',
    category: 'audio',
    url: './stream/audio/',
    stream_url: './stream/audio/index.m3u8',
    status: 'active'
  }
];

let cachedCatalog = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function resolveUrl(relUrl, id) {
  const baseUrl = getLinkVideoBaseUrl();
  if (!relUrl) return `${baseUrl}${id}/`;
  if (relUrl.startsWith('http://') || relUrl.startsWith('https://')) return relUrl;
  const clean = relUrl.replace(/^\.\//, '').replace(/^\//, '');
  return `${baseUrl}${clean}`;
}

/**
 * Verifica si una ruta interna de streaming está transmitiendo activamente.
 * Si responde con error (404, 500) o sin señal / status offline/inactive, retorna false.
 */
async function isStreamActive(streamItem) {
  if (!streamItem) return false;
  if (streamItem.status && (streamItem.status === 'offline' || streamItem.status === 'inactive')) {
    return false;
  }

  const checkUrl = streamItem.stream_url ? resolveUrl(streamItem.stream_url, streamItem.id) : resolveUrl(streamItem.url, streamItem.id);

  if (!checkUrl.startsWith('http://') && !checkUrl.startsWith('https://')) {
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(checkUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok && res.status !== 405) { // Si retorna 404, 500, etc. no está transmitiendo
      return false;
    }
    return true;
  } catch (err) {
    clearTimeout(timer);
    // Si la URL falla por falta de internet/conectividad, verificar si el item explícitamente indica status inactivo
    return streamItem.status !== 'offline' && streamItem.status !== 'inactive';
  }
}

/**
 * Obtiene el catálogo oficial de Link Video filtrando elementos que no estén transmitiendo.
 */
async function getVideoCatalog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCatalog && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  let catalog = FALLBACK_CATALOG;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const catUrl = getCatalogUrl();
    const res = await fetch(catUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        catalog = data;
      }
    }
  } catch (err) {
    clearTimeout(timer);
  }

  // Filtrar rutas que no estén transmitiendo contenido
  const activeStreams = [];
  for (const item of catalog) {
    const active = await isStreamActive(item);
    if (active) {
      activeStreams.push({
        ...item,
        full_url: resolveUrl(item.url, item.id),
        full_stream_url: item.stream_url ? resolveUrl(item.stream_url, item.id) : resolveUrl(item.url, item.id)
      });
    }
  }

  cachedCatalog = activeStreams;
  lastFetchTime = now;
  return cachedCatalog;
}

/**
 * linkvideo.list: Lista transmisiones y contenido de Link Video
 */
async function listStreams(params = {}) {
  const catalog = await getVideoCatalog(params.refresh || false);
  const typeFilter = (params.type || params.category || '').trim().toLowerCase();
  const qFilter = (params.query || params.q || params.search || '').trim().toLowerCase();

  let filtered = catalog;

  if (typeFilter && typeFilter !== 'all' && typeFilter !== 'todos') {
    filtered = filtered.filter(s => (s.type || '').toLowerCase() === typeFilter || (s.category || '').toLowerCase() === typeFilter);
  }

  if (qFilter) {
    filtered = filtered.filter(s =>
      (s.title || s.name || '').toLowerCase().includes(qFilter) ||
      (s.description || '').toLowerCase().includes(qFilter) ||
      (s.id || '').toLowerCase().includes(qFilter)
    );
  }

  return {
    type: 'video_stream_list_card',
    count: filtered.length,
    streams: filtered,
    base_url: getLinkVideoBaseUrl()
  };
}

/**
 * linkvideo.launch: Abre una transmisión de Link Video
 */
async function launchStream(params = {}) {
  const rawId = (params.streamId || params.id || params.query || '').trim().toLowerCase();
  const catalog = await getVideoCatalog(params.refresh || false);

  if (!rawId) {
    return {
      error: 'Debes especificar el id o nombre del contenido para reproducirlo.',
      available_streams: catalog.map(s => ({ id: s.id, title: s.title || s.name }))
    };
  }

  let match = catalog.find(s => s.id.toLowerCase() === rawId || (s.title && s.title.toLowerCase().includes(rawId)));

  if (!match) {
    return {
      error: `No se encontró transmisión activa para '${rawId}'.`,
      available_streams: catalog.map(s => ({ id: s.id, title: s.title || s.name }))
    };
  }

  return {
    type: 'video_stream_launch_card',
    data: {
      stream_id: match.id,
      title: match.title || match.name,
      description: match.description,
      type: match.type || 'video',
      url: match.full_url,
      stream_url: match.full_stream_url,
      action: 'open_stream'
    }
  };
}

function clearVideoCache() {
  cachedCatalog = null;
  lastFetchTime = 0;
}

module.exports = {
  getLinkVideoBaseUrl,
  getVideoCatalog,
  isStreamActive,
  listStreams,
  launchStream,
  clearVideoCache,
  get LINK_VIDEO_BASE_URL() {
    return getLinkVideoBaseUrl();
  }
};
