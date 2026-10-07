/**
 * Utilidad de validación, extracción de IDs y obtención de metadatos de YouTube
 */

/**
 * Extrae el ID del video de YouTube a partir de una URL dada.
 * Soporta formatos:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 *
 * @param {string} url - URL ingresada por el usuario o administrador
 * @returns {string|null} - ID del video (11 caracteres) o null si es inválida
 */
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Si ya es un ID de 11 caracteres de YouTube
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Expresión regular para capturar ID de YouTube (11 caracteres)
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Valida si una URL es una URL legítima de YouTube.
 * @param {string} url
 * @returns {boolean}
 */
function isValidYouTubeUrl(url) {
  return extractYouTubeId(url) !== null;
}

/**
 * Obtiene metadatos del video de YouTube (ID, título real vía oEmbed, miniatura y URL embed oficial)
 * @param {string} url
 * @param {string} [customTitle] - Título personalizado opcional ingresado por el usuario
 * @returns {Promise<{videoId: string, title: string, thumbnail_url: string, embedUrl: string, original_url: string}>}
 */
async function fetchYouTubeInfo(url, customTitle = '') {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('La URL provista no es una URL de YouTube válida. Soportados: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID');
  }

  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  let title = (customTitle || '').trim();
  let thumbnailUrl = defaultThumbnail;

  if (!title) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data && data.title) {
          title = data.title;
        }
        if (data && data.thumbnail_url) {
          thumbnailUrl = data.thumbnail_url;
        }
      }
    } catch (err) {
      // Ignorar fallo de oEmbed y usar fallback
    }
  }

  if (!title) {
    title = `Video de YouTube (${videoId})`;
  }

  return {
    videoId,
    title,
    thumbnail_url: thumbnailUrl,
    embedUrl,
    original_url: url.trim()
  };
}

/**
 * Parsea contenido de subtítulos en diversos formatos (XML de YouTube, VTT, SRT, JSON)
 * y los convierte al formato unificado { start, dur, text }.
 */
function parseSubtitleTime(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;
  const parts = String(timeStr).trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(timeStr) || 0;
}

function parseSubtitleContent(content) {
  if (!content) return [];
  if (Array.isArray(content)) {
    return content.map(item => ({
      start: typeof item.start === 'number' ? item.start : parseSubtitleTime(item.start),
      dur: typeof item.dur === 'number' ? item.dur : (item.end ? (parseSubtitleTime(item.end) - parseSubtitleTime(item.start)) : 3),
      text: String(item.text || '').replace(/<[^>]*>/g, '').trim()
    })).filter(c => c.text);
  }

  const str = String(content);

  // XML YouTube captions
  if (str.includes('<text')) {
    const cues = [];
    const textMatches = [...str.matchAll(/<text start="([\d\.]+)" dur="([\d\.]+)".*?>(.*?)<\/text>/g)];
    for (const m of textMatches) {
      const rawText = m[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<[^>]*>/g, '')
        .trim();
      if (rawText) {
        cues.push({
          start: parseFloat(m[1]),
          dur: parseFloat(m[2]),
          text: rawText
        });
      }
    }
    return cues;
  }

  // VTT o SRT
  if (str.includes('-->')) {
    const cues = [];
    const blocks = str.split(/\n\s*\n/);
    for (const block of blocks) {
      const timeMatch = block.match(/(?:(\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(?:(\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/);
      if (timeMatch) {
        const times = timeMatch[0].split('-->');
        const start = parseSubtitleTime(times[0]);
        const end = parseSubtitleTime(times[1]);
        const dur = Math.max(0.5, end - start);
        const textLines = block.substring(block.indexOf(timeMatch[0]) + timeMatch[0].length)
          .split('\n')
          .map(l => l.replace(/<[^>]*>/g, '').trim())
          .filter(Boolean)
          .join(' ');
        if (textLines) {
          cues.push({ start, dur, text: textLines });
        }
      }
    }
    return cues;
  }

  // JSON string
  try {
    const json = JSON.parse(str);
    if (Array.isArray(json)) {
      return parseSubtitleContent(json);
    }
  } catch (e) {}

  return [];
}

/**
 * Obtiene los subtítulos reales de un video de YouTube en formato Karaoke / Cues.
 * @param {string} videoId
 * @returns {Promise<{cues: Array<{start: number, dur: number, text: string}>, languageCode: string}>}
 */
async function fetchYouTubeSubtitles(videoId) {
  if (!videoId || typeof videoId !== 'string') return { cues: [], languageCode: 'es' };
  const cleanId = extractYouTubeId(videoId) || videoId.trim();

  // Estrategia 1: YouTube captionTracks en página de watch
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${cleanId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (watchRes.ok) {
      const html = await watchRes.text();
      const match = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (match) {
        const tracks = JSON.parse(match[1]);
        if (tracks && tracks.length) {
          const targetTrack = tracks.find(t => t.languageCode?.startsWith('es')) ||
                              tracks.find(t => t.languageCode?.startsWith('en')) ||
                              tracks[0];
          if (targetTrack && targetTrack.baseUrl) {
            const langCode = targetTrack.languageCode || 'es';
            const capController = new AbortController();
            const capTimeout = setTimeout(() => capController.abort(), 6000);
            const capRes = await fetch(targetTrack.baseUrl, { signal: capController.signal });
            clearTimeout(capTimeout);
            const xml = await capRes.text();
            const cues = parseSubtitleContent(xml);
            if (cues.length > 0) {
              return { cues, languageCode: langCode };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[YouTube CaptionTracks Strategy] error for ${cleanId}:`, err.message);
  }

  // Estrategia 2: YouTube API Direct Timedtext Endpoint (es, en)
  for (const lang of ['es', 'en']) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const timedRes = await fetch(`https://www.youtube.com/api/timedtext?v=${cleanId}&lang=${lang}&fmt=vtt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (timedRes.ok) {
        const text = await timedRes.text();
        const cues = parseSubtitleContent(text);
        if (cues.length > 0) {
          return { cues, languageCode: lang };
        }
      }
    } catch (e) {}
  }

  // Estrategia 3: Servicio público/gratuito de transcripción
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const apiRes = await fetch(`https://youtube-transcriptor.vercel.app/api/transcript?url=https://www.youtube.com/watch?v=${cleanId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (apiRes.ok) {
      const data = await apiRes.json();
      const content = data.transcript || data.lines || data;
      const cues = parseSubtitleContent(content);
      if (cues.length > 0) {
        return { cues, languageCode: 'es' };
      }
    }
  } catch (e) {}

  return { cues: [], languageCode: 'es' };
}

/**
 * Obtiene todos los vídeos de una lista de reproducción (Playlist) de YouTube.
 * @param {string} playlistUrlOrId
 * @returns {Promise<{playlistId: string, title: string, videos: Array<{videoId: string, title: string, thumbnail_url: string, url: string}>}>}
 */
async function fetchYouTubePlaylist(playlistUrlOrId) {
  if (!playlistUrlOrId || typeof playlistUrlOrId !== 'string') {
    throw new Error('Ingresa una URL o ID de lista de reproducción de YouTube válida.');
  }

  let playlistId = playlistUrlOrId.trim();
  const listMatch = playlistUrlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch && listMatch[1]) {
    playlistId = listMatch[1];
  }

  if (!playlistId) {
    throw new Error('No se pudo identificar el ID de la lista de reproducción de YouTube.');
  }

  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: controller.signal
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error('No se pudo acceder a la lista de reproducción de YouTube.');
  }

  const html = await response.text();
  const match = html.match(/ytInitialData\s*=\s*({[\s\S]*?});/);
  if (!match) {
    throw new Error('No se pudieron extraer los datos de la lista de reproducción.');
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    throw new Error('Error de lectura en los datos de YouTube.');
  }

  let playlistTitle = 'Lista de Reproducción de YouTube';
  try {
    playlistTitle = data.metadata?.playlistMetadataRenderer?.title ||
                    data.header?.playlistHeaderRenderer?.title?.simpleText ||
                    data.header?.playlistHeaderRenderer?.title?.runs?.[0]?.text ||
                    data.header?.pageHeaderRenderer?.pageTitle ||
                    playlistTitle;
  } catch (e) {}

  const items = [];
  function search(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.lockupViewModel) {
      const lock = obj.lockupViewModel;
      const videoId = lock.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
      let title = lock.metadata?.lockupMetadataViewModel?.title?.content;
      if (!title && lock.metadata?.lockupMetadataViewModel?.title?.runs) {
        title = lock.metadata.lockupMetadataViewModel.title.runs.map(r => r.text).join('');
      }
      if (videoId) {
        items.push({
          videoId,
          title: (title || `Video ${videoId}`).trim(),
          thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
    }

    if (obj.playlistVideoRenderer) {
      const pvr = obj.playlistVideoRenderer;
      const videoId = pvr.videoId;
      const title = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText;
      if (videoId) {
        items.push({
          videoId,
          title: (title || `Video ${videoId}`).trim(),
          thumbnail_url: pvr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
    }

    for (const k in obj) {
      if (typeof obj[k] === 'object') search(obj[k]);
    }
  }

  search(data);

  // Deduplicar por videoId
  const uniqueMap = new Map();
  for (const item of items) {
    if (!uniqueMap.has(item.videoId) || (!uniqueMap.get(item.videoId).title.startsWith('Video ') && item.title)) {
      uniqueMap.set(item.videoId, item);
    }
  }

  const videos = Array.from(uniqueMap.values());
  if (videos.length === 0) {
    throw new Error('No se encontraron videos públicos en esta lista de reproducción.');
  }

  return {
    playlistId,
    title: playlistTitle,
    videos
  };
}

module.exports = {
  extractYouTubeId,
  isValidYouTubeUrl,
  fetchYouTubeInfo,
  fetchYouTubeSubtitles,
  fetchYouTubePlaylist,
  parseSubtitleContent
};
