/**
 * ExternalProviderAdapter - Clase base para adaptadores de plataformas de contenido externo
 */

class ExternalProviderAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Valida si la URL pertenece a este proveedor y no contiene esquemas maliciosos/inválidos
   * @param {string} url
   * @returns {boolean}
   */
  validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();

    // Rechazar esquemas inseguros o peligrosos
    if (
      clean.startsWith('javascript:') ||
      clean.startsWith('data:') ||
      clean.startsWith('file:') ||
      clean.startsWith('blob:') ||
      clean.includes('<script') ||
      clean.includes('onload=')
    ) {
      return false;
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      return false;
    }

    try {
      new URL(clean);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extrae el ID, construye la URL de embed y metadatos básicos
   * @param {string} url
   * @param {Object} [options]
   * @returns {Object} { provider, content_id, embed_url, title, thumbnail_url, category, capabilities }
   */
  parseUrl(url, options = {}) {
    throw new Error(`parseUrl must be implemented by adapter subclass for ${this.name}`);
  }

  /**
   * Declara las capacidades de interacción multimedia soportadas por este proveedor
   * @returns {Object}
   */
  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: false,
      supportsProgress: false,
      supportsSubtitles: false,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: false,
      supportsPortrait: false,
      supportsLandscape: true
    };
  }
}

module.exports = ExternalProviderAdapter;
