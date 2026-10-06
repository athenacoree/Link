/**
 * Utilidad de validación y extracción de IDs de YouTube
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

  // Expresión regular robusta para validar URLs exclusivamente de YouTube y capturar ID (de 11 caracteres alfannuméricos, guiones o guiones bajos)
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&].*)?$/;
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

module.exports = {
  extractYouTubeId,
  isValidYouTubeUrl
};
