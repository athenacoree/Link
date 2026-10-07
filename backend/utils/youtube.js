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

module.exports = {
  extractYouTubeId,
  isValidYouTubeUrl,
  fetchYouTubeInfo
};
