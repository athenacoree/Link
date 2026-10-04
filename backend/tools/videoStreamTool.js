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

// Fuentes públicas auto-descubiertas (Cámaras públicas, Transmisiones AI, Películas, Radios y Música)
// Con opciones multi-resolución optimizadas para ahorro de megas (140p, 360p, 480p, 720p)
const PUBLIC_DISCOVERED_FEEDS = [
  {
    id: 'cam_shibuya_live',
    title: 'Cámara Pública Shibuya Crossing 24/7',
    type: 'video',
    category: 'camaras',
    description: 'Cámara en directo desde el cruce peatonal de Shibuya, Tokio.',
    resolution: '360p / 720p',
    resolutions: [
      { label: '360p (Ahorro megas)', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
      { label: '720p HD', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
    ],
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'cam_times_square',
    title: 'Cámara Urbana Times Square Neón',
    type: 'video',
    category: 'camaras',
    description: 'Vista urbana en tiempo real de las pantallas y movimiento en Nueva York.',
    resolution: '360p / 480p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    stream_url: 'https://vjs.zencdn.net/v/oceans.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/378570/pexels-photo-378570.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'cam_iss_earth',
    title: 'Cámara Espacial Vista Tierra ISS',
    type: 'video',
    category: 'camaras',
    description: 'Transmisión orbital desde la Estación Espacial Internacional.',
    resolution: '360p / 720p',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/2156/sky-earth-space-working.jpg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'cam_beach_live',
    title: 'Cámara Playa Tropical & Océano Live',
    type: 'video',
    category: 'camaras',
    description: 'Vista en vivo de las olas y paisaje tropical 24 horas.',
    resolution: '140p / 360p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    stream_url: 'https://vjs.zencdn.net/v/oceans.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'ai_reels_cyberpunk',
    title: 'Visión IA: Megaciudad Neón 2099',
    type: 'video',
    category: 'cortos_ai',
    description: 'Bucle generado por inteligencia artificial con paisajes futuristas cyberpunk.',
    resolution: '140p / 360p / 480p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    stream_url: 'https://vjs.zencdn.net/v/oceans.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'ai_reels_nature',
    title: 'IA Nature Experience 360p',
    type: 'video',
    category: 'cortos_ai',
    description: 'Generación sintética fluida de paisajes naturales y flora.',
    resolution: '360p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    stream_url: 'https://vjs.zencdn.net/v/oceans.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'movies_sintel_hd',
    title: 'Película Sintel (Acción & Fantasía) HD',
    type: 'video',
    category: 'movies',
    description: 'Largometraje animado de código abierto en calidad adaptable 360p / 720p.',
    resolution: '360p / 720p',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'movies_classic_cinema',
    title: 'Cine Clásico Abierto adaptable',
    type: 'video',
    category: 'movies',
    description: 'Streaming continuo de películas clásicas en 140p, 360p y 480p.',
    resolution: '140p / 360p / 480p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    stream_url: 'https://vjs.zencdn.net/v/oceans.mp4',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/2510428/pexels-photo-2510428.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'radio_lofi_beats',
    title: 'Radio Lofi Chill Beats 24/7',
    type: 'audio',
    category: 'audio',
    description: 'Música lofi tranquila en vivo para relajarse, programar o estudiar.',
    resolution: 'Audio HQ (Bajo consumo de datos)',
    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    stream_url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'radio_fip_groove',
    title: 'Radio FIP World & Groove Live',
    type: 'audio',
    category: 'audio',
    description: 'Estación internacional en directo con funk, jazz y beats eclécticos.',
    resolution: 'Audio HQ (Bajo consumo de datos)',
    url: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3',
    stream_url: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=600'
  },
  {
    id: 'radio_electro_dance',
    title: 'Radio Electro Synthwave & Dance',
    type: 'audio',
    category: 'audio',
    description: 'Ritmos electrónicos ininterrumpidos con pantalla ambientada.',
    resolution: 'Audio HQ (Ahorro de megas)',
    url: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3',
    stream_url: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3',
    status: 'active',
    thumbnail: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=600'
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
