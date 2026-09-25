/**
 * Adaptador de Proveedor de Video: Pexels Video API
 * Documentación oficial: https://www.pexels.com/api/documentation/#videos-search
 */

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Busca videos en Pexels Video API
 * @param {Object} params
 * @param {string} params.query
 * @param {string} [params.orientation] 'landscape' | 'portrait' | 'square'
 * @param {string} [params.category]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=6]
 */
async function searchPexelsVideos({ query, orientation, category, page = 1, perPage = 6 }) {
  const apiKey = process.env.PEXELS_API_KEY;
  let searchTerm = (query || '').trim();
  if (category && category.trim() && !searchTerm.toLowerCase().includes(category.toLowerCase())) {
    searchTerm = `${searchTerm} ${category.trim()}`.trim();
  }

  if (!searchTerm) {
    searchTerm = 'nature landscape';
  }

  if (!apiKey) {
    return {
      error: 'La clave PEXELS_API_KEY no está configurada en las variables de entorno.',
      provider: 'Pexels',
      query: searchTerm,
      total: 0,
      videos: []
    };
  }

  try {
    let pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchTerm)}&page=${page}&per_page=${perPage}`;
    if (orientation && ['landscape', 'portrait', 'square'].includes(orientation.toLowerCase())) {
      pexelsUrl += `&orientation=${orientation.toLowerCase()}`;
    }

    const res = await fetchWithTimeout(pexelsUrl, {
      headers: { Authorization: apiKey }
    }, 8000);

    if (res.ok) {
      const data = await res.json();
      if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        const parsedVideos = data.videos.map(v => {
          // Seleccionar el mejor archivo de video MP4
          const mp4Files = (v.video_files || []).filter(f => f.file_type === 'video/mp4' || (f.link && f.link.includes('.mp4')));
          // Ordenar por resolución óptima (máx 1080p para buen rendimiento)
          const sortedFiles = mp4Files.sort((a, b) => {
            const resA = (a.width || 0) * (a.height || 0);
            const resB = (b.width || 0) * (b.height || 0);
            return resB - resA;
          });

          const bestFile = sortedFiles.find(f => (f.width || 0) <= 1920) || sortedFiles[0] || v.video_files?.[0];
          const rawTitle = (v.url || '').split('/video/')[1] || '';
          const cleanTitle = rawTitle.replace(/-\d+\/?$/, '').replace(/-/g, ' ').trim();
          const displayTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : `Video de ${searchTerm}`;

          const width = v.width || 1280;
          const height = v.height || 720;
          const computedOrientation = width > height ? 'landscape' : width < height ? 'portrait' : 'square';

          return {
            id: String(v.id),
            title: displayTitle,
            url: v.url,
            stream_url: bestFile ? bestFile.link : '',
            thumbnail: v.image || (v.video_pictures && v.video_pictures[0] ? v.video_pictures[0].picture : ''),
            duration: v.duration || 0,
            width,
            height,
            orientation: computedOrientation,
            user: {
              name: v.user?.name || 'Creador de Pexels',
              url: v.user?.url || 'https://www.pexels.com'
            },
            attribution_text: `Video por ${v.user?.name || 'Creador'} en Pexels`,
            provider: 'Pexels'
          };
        }).filter(v => v.stream_url);

        if (parsedVideos.length > 0) {
          return {
            provider: 'Pexels',
            query: searchTerm,
            orientation: orientation || 'all',
            category: category || '',
            total: data.total_results || parsedVideos.length,
            videos: parsedVideos
          };
        }
      }
    }
  } catch (err) {
    console.error('[pexelsProvider] Error llamando a Pexels Video API:', err.message);
    return {
      error: `Error al conectar con Pexels Video API: ${err.message}`,
      provider: 'Pexels',
      query: searchTerm,
      total: 0,
      videos: []
    };
  }

  return {
    error: `No se encontraron videos en Pexels para '${searchTerm}'.`,
    provider: 'Pexels',
    query: searchTerm,
    total: 0,
    videos: []
  };
}

module.exports = {
  searchPexelsVideos
};
