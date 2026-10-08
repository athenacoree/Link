/**
 * Utilidad para extracción e inferencia automática de etiquetas ocultas (hidden tags)
 * para el algoritmo de recomendación de Link Video y Reels.
 */

// Diccionarios de detección de géneros, artistas y categorías
const KNOWN_ARTISTS = [
  'the weeknd', 'bad bunny', 'drake', 'taylor swift', 'rick astley', 'michael jackson',
  'coldplay', 'eminem', 'ed sheeran', 'shakira', 'karol g', 'rosalia', 'feid',
  'rauw alejandro', 'duki', 'bizarrap', 'quevedo', 'ozuna', 'daddy yankee',
  'j balvin', 'maluma', 'anuel', 'myke towers', 'mora', 'post malone', 'dua lipa',
  'billie eilish', 'bruno mars', 'lady gaga', 'rihanna', 'beyonce', 'justin bieber',
  'kanye west', 'travis scott', 'kendrick lamar', 'sza', 'olivia rodrigo'
];

const GENRE_MAP = {
  'r&b': ['r&b', 'rnb', 'rhythm and blues', 'soul', 'the weeknd'],
  'pop': ['pop', 'synthpop', 'dance pop', 'pope'],
  'reggaeton': ['reggaeton', 'urban', 'urbano', 'perreo', 'dembow'],
  'rock': ['rock', 'alternative', 'alternativo', 'indie', 'metal', 'punk'],
  'hip hop': ['hip hop', 'hiphop', 'rap', 'trap'],
  'salsa': ['salsa', 'timba', 'guaguanco'],
  'bachata': ['bachata'],
  'electronica': ['electronica', 'electronic', 'edm', 'house', 'techno', 'trance'],
  'lofi': ['lofi', 'chill', 'relax', 'study', 'ambient'],
  'balada': ['balada', 'romantic', 'romantica', 'bolero'],
  'cine': ['movie', 'pelicula', 'cine', 'trailer', 'estreno', 'estrenos', 'film', 'cinema'],
  'serie': ['serie', 'series', 'episodio', 'capitulo', 'telenovela', 'kdrama', 'drama'],
  'anime': ['anime', 'manga', 'otaku', 'japan', 'opening', 'ending'],
  'documental': ['documental', 'documentary', 'historia', 'ciencia', 'natgeo']
};

/**
 * Normaliza un texto removiendo diacríticos y caracteres especiales.
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, ' ')
    .trim();
}

/**
 * Determina si una URL o título corresponde a un YouTube Shorts / Reel.
 */
function isReelUrlOrTitle(url = '', title = '') {
  const normUrl = (url || '').toLowerCase();
  const normTitle = (title || '').toLowerCase();
  return normUrl.includes('/shorts/') || normUrl.includes('#shorts') || normTitle.includes('#shorts') || normTitle.includes('reel') || normTitle.includes('short');
}

/**
 * Extrae e infiere un conjunto deduplicado de etiquetas ocultas (hidden tags)
 * a partir del título, URL, descripción y categoría de un video o álbum.
 *
 * @param {Object} item - Datos del video o álbum { title, original_url, audio_description, category }
 * @returns {Array<string>} Lista de etiquetas ocultas en minúsculas
 */
function extractHiddenTags(item = {}) {
  const title = item.title || item.name || '';
  const url = item.original_url || item.url || '';
  const desc = item.audio_description || item.description || '';
  const category = item.category || '';

  const fullTextNorm = normalizeText(`${title} ${desc} ${category} ${url}`);
  const tagsSet = new Set();

  // 1. Agregar la categoría como etiqueta base
  if (category) {
    const catNorm = normalizeText(category);
    if (catNorm) tagsSet.add(catNorm);
  }

  // 2. Detectar si es un Reel / Short
  if (isReelUrlOrTitle(url, title)) {
    tagsSet.add('reel');
    tagsSet.add('short');
  }

  // 3. Detectar artistas conocidos
  for (const artist of KNOWN_ARTISTS) {
    if (fullTextNorm.includes(artist)) {
      tagsSet.add(artist);
      // Mapeos específicos de artista a género
      if (artist === 'the weeknd') {
        tagsSet.add('r&b');
        tagsSet.add('pop');
        tagsSet.add('synthpop');
      } else if (['bad bunny', 'daddy yankee', 'carol g', 'feid', 'rauw alejandro', 'ozuna'].includes(artist)) {
        tagsSet.add('reggaeton');
        tagsSet.add('urbano');
      }
    }
  }

  // 4. Mapeo de géneros por palabras clave
  for (const [genre, keywords] of Object.entries(GENRE_MAP)) {
    if (keywords.some(kw => fullTextNorm.includes(kw))) {
      tagsSet.add(genre);
    }
  }

  // 5. Palabras clave relevantes del título (longitud >= 3 y no stopwords comunes)
  const STOPWORDS = new Set(['con', 'por', 'para', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas', 'video', 'oficial', 'official', 'music', 'ft', 'feat', 'ft.', 'hd', '4k', 'lyrics']);
  const titleWords = normalizeText(title).split(/\s+/);
  for (const word of titleWords) {
    if (word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word)) {
      tagsSet.add(word);
    }
  }

  return Array.from(tagsSet);
}

module.exports = {
  extractHiddenTags,
  isReelUrlOrTitle,
  normalizeText
};
