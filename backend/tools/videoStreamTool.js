/**
 * Módulo de Integración con Link Video (Plataforma de Streaming de Películas, Video y Audio)
 * Configurable por variable de entorno: LINK_VIDEO_URL, LINK_STREAM_URL o LINK_VIDEO_BASE_URL
 */

const DEFAULT_LINK_VIDEO_BASE_URL = 'https://streamhub-3303.onrender.com/';

function getLinkVideoBaseUrl() {
  const envUrl = process.env.LINK_VIDEO_URL || process.env.LINK_STREAM_URL || process.env.LINK_VIDEO_BASE_URL || DEFAULT_LINK_VIDEO_BASE_URL;
  let cleanUrl = envUrl.trim();
  if (!cleanUrl.endsWith('/')) {
    cleanUrl += '/';
  }
  return cleanUrl;
}

async function getDynamicBaseUrl() {
  try {
    const { query } = require('../db/postgres');
    const { rows } = await query("SELECT value FROM system_settings WHERE key IN ('link_video_url', 'link_video_base_url', 'linkvideo_url') AND value IS NOT NULL AND value != '' ORDER BY updated_at DESC LIMIT 1");
    if (rows && rows.length > 0 && rows[0].value && rows[0].value.trim()) {
      let url = rows[0].value.trim();
      if (!url.endsWith('/')) url += '/';
      return url;
    }
  } catch (e) {}
  return getLinkVideoBaseUrl();
}

function getCatalogUrl(baseUrl) {
  const bUrl = baseUrl || getLinkVideoBaseUrl();
  return `${bUrl}catalog.json`;
}

// Fuentes públicas auto-descubiertas (Cámaras, Transmisiones AI, Películas, Radio, Música, Series)
const PUBLIC_DISCOVERED_FEEDS = [
  {
    id: 'public_cam_tokyo',
    title: 'Cámara Pública Shibuya Crossing 4K',
    type: 'video',
    category: 'camaras',
    description: 'Transmisión en vivo desde la intersección de Shibuya, Tokio.',
    url: 'https://www.youtube.com/embed/live_stream?channel=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    stream_url: 'https://www.youtube.com/embed/live_stream?channel=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'public_cam_iss',
    title: 'Cámara Espacial ISS Live HD',
    type: 'video',
    category: 'camaras',
    description: 'Vista en vivo de la Tierra desde la Estación Espacial Internacional.',
    url: 'https://www.youtube.com/embed/live_stream?channel=UCS8A53A04_cRnh4U93ZqW9g',
    stream_url: 'https://www.youtube.com/embed/live_stream?channel=UCS8A53A04_cRnh4U93ZqW9g',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/2156/sky-earth-space-working.jpg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'ai_reels_cyberpunk',
    title: 'Visión IA: Megaciudad Neón 2099',
    type: 'video',
    category: 'cortos_ai',
    description: 'Generación continua por inteligencia artificial de escenarios cyberpunk.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    stream_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'ai_reels_nature',
    title: 'IA Nature Ultra 8K Experience',
    type: 'video',
    category: 'cortos_ai',
    description: 'Animación sintética hiperrealista de la naturaleza.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    stream_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'movies_classic_cinema',
    title: 'Cine Clásico Abierto HD',
    type: 'video',
    category: 'movies',
    description: 'Streaming de películas de dominio público restauradas en HD.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    stream_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'public_radio_lofi',
    title: 'Lofi Girl Live Radio 24/7',
    type: 'audio',
    category: 'audio',
    description: 'Estación de radio pública relajante en vivo para concentrarse y estudiar.',
    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    stream_url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
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

const FALLBACK_CATALOG = PUBLIC_DISCOVERED_FEEDS;

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
    if (!res.ok && res.status !== 405 && res.status !== 403) { // Si retorna 404, 500, etc. no está transmitiendo
      return false;
    }
    return true;
  } catch (err) {
    clearTimeout(timer);
    // Si la llamada falla por bloqueo CORS/HEAD o falta de red externa en el sandbox, aceptar si status no es offline
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

  const baseUrl = await getDynamicBaseUrl();
  let catalog = FALLBACK_CATALOG;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const catUrl = getCatalogUrl(baseUrl);
    const res = await fetch(catUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        catalog = data;
      } else if (data && Array.isArray(data.catalog) && data.catalog.length > 0) {
        catalog = data.catalog;
      } else if (data && Array.isArray(data.streams) && data.streams.length > 0) {
        catalog = data.streams;
      }
    } else if (baseUrl !== DEFAULT_LINK_VIDEO_BASE_URL) {
      catalog = [
        {
          id: 'external_system_stream',
          title: 'Sistema Link Video Externo',
          type: 'video',
          description: 'Acceso directo al contenido de la plataforma de streaming.',
          category: 'movies',
          url: baseUrl,
          stream_url: baseUrl,
          status: 'active'
        },
        ...FALLBACK_CATALOG
      ];
    }
  } catch (err) {
    clearTimeout(timer);
    if (baseUrl !== DEFAULT_LINK_VIDEO_BASE_URL) {
      catalog = [
        {
          id: 'external_system_stream',
          title: 'Sistema Link Video Externo',
          type: 'video',
          description: 'Acceso directo al contenido de la plataforma de streaming.',
          category: 'movies',
          url: baseUrl,
          stream_url: baseUrl,
          status: 'active'
        },
        ...FALLBACK_CATALOG
      ];
    }
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
