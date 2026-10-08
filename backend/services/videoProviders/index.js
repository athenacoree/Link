/**
 * Registro y Detector Centralizado de Adaptadores de Proveedores Externos
 * Cumple con la arquitectura unificada para Link Video.
 */

const ExternalProviderAdapter = require('./ExternalProviderAdapter');
const { extractYouTubeId } = require('../../utils/youtube');

// 1. YouTube Adapter
class YouTubeAdapter extends ExternalProviderAdapter {
  constructor() {
    super('youtube');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return (
      clean.includes('youtube.com/') ||
      clean.includes('youtu.be/') ||
      clean.includes('youtube-nocookie.com/')
    );
  }

  parseUrl(url, options = {}) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      throw new Error('No se pudo extraer el ID de video de YouTube.');
    }

    const isReel = url.toLowerCase().includes('/shorts/');
    const embed_url = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&autoplay=0`;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    return {
      provider: 'youtube',
      content_id: videoId,
      embed_url,
      thumbnail,
      title: options.title || `YouTube Video (${videoId})`,
      category: isReel ? 'Reels' : (options.category || 'Vídeos'),
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: true,
      supportsBackgroundPlayback: true,
      supportsPlayerAPI: true,
      supportsPortrait: true,
      supportsLandscape: true
    };
  }
}

// 2. Instagram Reels Adapter
class InstagramAdapter extends ExternalProviderAdapter {
  constructor() {
    super('instagram');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('instagram.com/reel/') || clean.includes('instagr.am/reel/') || clean.includes('instagram.com/reels/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Instagram Reel no válida.');
    }
    const match = url.match(/\/reel(?:s)?\/([A-Za-z0-9_-]+)/);
    const reelId = match ? match[1] : null;
    if (!reelId) {
      throw new Error('No se pudo determinar el ID del Reel de Instagram.');
    }

    const embed_url = `https://www.instagram.com/reel/${reelId}/embed`;
    const thumbnail = `https://www.instagram.com/reel/${reelId}/media/?size=m`;

    return {
      provider: 'instagram',
      content_id: reelId,
      embed_url,
      thumbnail,
      title: options.title || `Instagram Reel (${reelId})`,
      category: 'Reels',
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: false,
      supportsAutoplay: false,
      supportsProgress: false,
      supportsSubtitles: false,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: false,
      supportsPortrait: true,
      supportsLandscape: false
    };
  }
}

// 3. Vimeo Adapter
class VimeoAdapter extends ExternalProviderAdapter {
  constructor() {
    super('vimeo');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('vimeo.com/') || clean.includes('player.vimeo.com/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Vimeo no válida.');
    }
    const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
    const videoId = match ? match[1] : null;
    if (!videoId) {
      throw new Error('No se pudo extraer el ID de video de Vimeo.');
    }

    const embed_url = `https://player.vimeo.com/video/${videoId}`;
    const thumbnail = options.thumbnail || `https://vumbnail.com/${videoId}.jpg`;

    return {
      provider: 'vimeo',
      content_id: videoId,
      embed_url,
      thumbnail,
      title: options.title || `Vimeo Video (${videoId})`,
      category: options.category || 'Vimeo',
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: true,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: true,
      supportsPortrait: true,
      supportsLandscape: true
    };
  }
}

// 4. Dailymotion Adapter
class DailymotionAdapter extends ExternalProviderAdapter {
  constructor() {
    super('dailymotion');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('dailymotion.com/') || clean.includes('dai.ly/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Dailymotion no válida.');
    }
    const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/|geo\.dailymotion\.com\/player\/.*?video=)([a-zA-Z0-9]+)/);
    const videoId = match ? match[1] : null;
    if (!videoId) {
      throw new Error('No se pudo extraer el ID de video de Dailymotion.');
    }

    const playerId = process.env.DAILYMOTION_PLAYER_ID;
    const embed_url = playerId
      ? `https://geo.dailymotion.com/player/${playerId}.html?video=${videoId}`
      : `https://www.dailymotion.com/embed/video/${videoId}`;
    const thumbnail = `https://www.dailymotion.com/thumbnail/video/${videoId}`;

    return {
      provider: 'dailymotion',
      content_id: videoId,
      embed_url,
      thumbnail,
      title: options.title || `Dailymotion Video (${videoId})`,
      category: options.category || 'Vídeos',
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: true,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: true,
      supportsPortrait: true,
      supportsLandscape: true
    };
  }
}

// 5. Twitch Adapter
class TwitchAdapter extends ExternalProviderAdapter {
  constructor() {
    super('twitch');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('twitch.tv/') || clean.includes('clips.twitch.tv/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Twitch no válida.');
    }

    const rawDomain = options.host || options.domain || 'localhost';
    const parentDomain = rawDomain.split(':')[0].trim() || 'localhost';

    let content_id = '';
    let embed_url = '';
    let category = options.category || 'Twitch';

    if (url.includes('clips.twitch.tv/') || url.includes('/clip/')) {
      const match = url.match(/(?:clips\.twitch\.tv\/|clip\/)([A-Za-z0-9_-]+)/);
      content_id = match ? match[1] : '';
      if (!content_id) throw new Error('No se pudo identificar el Clip de Twitch.');
      embed_url = `https://clips.twitch.tv/embed?clip=${content_id}&parent=${parentDomain}&autoplay=false`;
    } else if (url.includes('/videos/')) {
      const match = url.match(/\/videos\/(\d+)/);
      content_id = match ? match[1] : '';
      if (!content_id) throw new Error('No se pudo identificar el VOD/Vídeo de Twitch.');
      embed_url = `https://player.twitch.tv/?video=${content_id}&parent=${parentDomain}&autoplay=false`;
    } else {
      const match = url.match(/twitch\.tv\/([A-Za-z0-9_]+)/);
      content_id = match ? match[1] : '';
      if (!content_id) throw new Error('No se pudo identificar el Canal/Stream de Twitch.');
      embed_url = `https://player.twitch.tv/?channel=${content_id}&parent=${parentDomain}&autoplay=false`;
      category = 'Directos';
    }

    return {
      provider: 'twitch',
      content_id,
      embed_url,
      thumbnail: options.thumbnail || 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg',
      title: options.title || `Twitch Content (${content_id})`,
      category,
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: false,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: true,
      supportsPortrait: false,
      supportsLandscape: true
    };
  }
}

// 6. PeerTube Adapter
class PeerTubeAdapter extends ExternalProviderAdapter {
  constructor() {
    super('peertube');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return (
      clean.includes('/w/') ||
      clean.includes('/videos/watch/') ||
      clean.includes('/videos/embed/') ||
      clean.includes('/peertube/') ||
      clean.includes('peertube')
    );
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de PeerTube no válida.');
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname;

      let videoId = '';
      if (parsed.pathname.includes('/w/')) {
        videoId = parsed.pathname.split('/w/')[1]?.split('?')[0];
      } else if (parsed.pathname.includes('/videos/watch/')) {
        videoId = parsed.pathname.split('/videos/watch/')[1]?.split('?')[0];
      } else if (parsed.pathname.includes('/videos/embed/')) {
        videoId = parsed.pathname.split('/videos/embed/')[1]?.split('?')[0];
      }

      if (!videoId) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        videoId = parts[parts.length - 1];
      }

      if (!videoId) {
        throw new Error('No se pudo determinar el ID de video en la instancia de PeerTube.');
      }

      const embed_url = `https://${host}/videos/embed/${videoId}`;
      const thumbnail = `https://${host}/static/thumbnails/${videoId}.jpg`;

      return {
        provider: 'peertube',
        content_id: `${host}:${videoId}`,
        embed_url,
        thumbnail,
        title: options.title || `PeerTube (${host})`,
        category: options.category || 'PeerTube',
        capabilities: this.getCapabilities()
      };
    } catch (e) {
      throw new Error(`Error analizando URL de PeerTube: ${e.message}`);
    }
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: true,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: true,
      supportsPortrait: true,
      supportsLandscape: true
    };
  }
}

// 7. Internet Archive Adapter
class InternetArchiveAdapter extends ExternalProviderAdapter {
  constructor() {
    super('internet_archive');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('archive.org/details/') || clean.includes('archive.org/embed/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Internet Archive no válida.');
    }

    const match = url.match(/archive\.org\/(?:details|embed)\/([A-Za-z0-9_-]+)/);
    const identifier = match ? match[1] : null;
    if (!identifier) {
      throw new Error('No se pudo extraer el identificador de Internet Archive.');
    }

    const embed_url = `https://archive.org/embed/${identifier}`;
    const thumbnail = `https://archive.org/services/img/${identifier}`;

    return {
      provider: 'internet_archive',
      content_id: identifier,
      embed_url,
      thumbnail,
      title: options.title || `Internet Archive (${identifier})`,
      category: options.category || 'Películas',
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: false,
      supportsProgress: true,
      supportsSubtitles: false,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: false,
      supportsPortrait: false,
      supportsLandscape: true
    };
  }
}

// 8. TED Talks Adapter
class TEDAdapter extends ExternalProviderAdapter {
  constructor() {
    super('ted');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('ted.com/talks') || clean.includes('embed.ted.com/talks');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de TED no válida.');
    }

    const match = url.match(/(?:ted\.com\/talks|embed\.ted\.com\/talks)\/([A-Za-z0-9_-]+)/);
    const talkSlug = match ? match[1] : null;
    if (!talkSlug) {
      throw new Error('No se pudo determinar la charla de TED.');
    }

    const embed_url = `https://embed.ted.com/talks/${talkSlug}`;

    return {
      provider: 'ted',
      content_id: talkSlug,
      embed_url,
      thumbnail: options.thumbnail || 'https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/ted-logo.jpg',
      title: options.title || `TED Talk (${talkSlug})`,
      category: options.category || 'Charlas',
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: true,
      supportsAutoplay: false,
      supportsProgress: true,
      supportsSubtitles: true,
      supportsBackgroundPlayback: false,
      supportsPlayerAPI: false,
      supportsPortrait: false,
      supportsLandscape: true
    };
  }
}

// 9. SoundCloud Adapter
class SoundCloudAdapter extends ExternalProviderAdapter {
  constructor() {
    super('soundcloud');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('soundcloud.com/') || clean.includes('w.soundcloud.com/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de SoundCloud no válida.');
    }

    const encoded = encodeURIComponent(url);
    const embed_url = `https://w.soundcloud.com/player/?url=${encoded}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=true&show_user=true&show_reposts=false&show_teaser=false`;

    const isPlaylist = url.toLowerCase().includes('/sets/');
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    const content_id = pathParts.join('_') || 'sc_track';

    return {
      provider: 'soundcloud',
      content_id,
      embed_url,
      thumbnail: options.thumbnail || 'https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62c832f.png',
      title: options.title || `SoundCloud (${pathParts[pathParts.length - 1] || 'Audio'})`,
      category: isPlaylist ? 'Álbumes' : (options.category || 'Música'),
      capabilities: this.getCapabilities()
    };
  }

  getCapabilities() {
    return {
      supportsFullscreen: false,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: false,
      supportsBackgroundPlayback: true,
      supportsPlayerAPI: true,
      supportsPortrait: false,
      supportsLandscape: false
    };
  }
}

// 10. Mixcloud Adapter
class MixcloudAdapter extends ExternalProviderAdapter {
  constructor() {
    super('mixcloud');
  }

  validateUrl(url) {
    if (!super.validateUrl(url)) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes('mixcloud.com/');
  }

  parseUrl(url, options = {}) {
    if (!this.validateUrl(url)) {
      throw new Error('URL de Mixcloud no válida.');
    }

    try {
      const parsed = new URL(url);
      const feedPath = encodeURIComponent(parsed.pathname);
      const embed_url = `https://www.mixcloud.com/widget/iframe/?feed=${feedPath}&hide_cover=1&light=1`;
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const content_id = pathParts.join('_') || 'mc_show';

      return {
        provider: 'mixcloud',
        content_id,
        embed_url,
        thumbnail: options.thumbnail || 'https://thumbnailer.mixcloud.com/unsafe/300x300/profile/mixcloud.jpg',
        title: options.title || `Mixcloud Show (${pathParts[pathParts.length - 1] || 'Mix'})`,
        category: options.category || 'Podcasts',
        capabilities: this.getCapabilities()
      };
    } catch (e) {
      throw new Error(`Error analizando URL de Mixcloud: ${e.message}`);
    }
  }

  getCapabilities() {
    return {
      supportsFullscreen: false,
      supportsAutoplay: true,
      supportsProgress: true,
      supportsSubtitles: false,
      supportsBackgroundPlayback: true,
      supportsPlayerAPI: true,
      supportsPortrait: false,
      supportsLandscape: false
    };
  }
}

// Registro Global de Adaptadores
const ADAPTERS = {
  youtube: new YouTubeAdapter(),
  instagram: new InstagramAdapter(),
  vimeo: new VimeoAdapter(),
  dailymotion: new DailymotionAdapter(),
  twitch: new TwitchAdapter(),
  peertube: new PeerTubeAdapter(),
  internet_archive: new InternetArchiveAdapter(),
  ted: new TEDAdapter(),
  soundcloud: new SoundCloudAdapter(),
  mixcloud: new MixcloudAdapter()
};

/**
 * Detecta automáticamente el proveedor correspondiente a una URL
 * @param {string} url
 * @returns {string|null} Nombre del proveedor o null si no coincide
 */
function detectExternalProvider(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().toLowerCase();

  // Validar y rechazar esquemas inseguros
  if (
    clean.startsWith('javascript:') ||
    clean.startsWith('data:') ||
    clean.startsWith('file:') ||
    clean.startsWith('blob:') ||
    clean.includes('<script')
  ) {
    return null;
  }

  for (const [providerName, adapter] of Object.entries(ADAPTERS)) {
    if (adapter.validateUrl(url)) {
      return providerName;
    }
  }

  return null;
}

/**
 * Obtiene la instancia del adaptador por su nombre
 * @param {string} providerName
 * @returns {ExternalProviderAdapter|null}
 */
function getAdapter(providerName) {
  if (!providerName) return null;
  return ADAPTERS[providerName.toLowerCase().trim()] || null;
}

/**
 * Obtiene todos los adaptadores registrados
 */
function getAllAdapters() {
  return ADAPTERS;
}

/**
 * Retorna el estado real de configuración de cada proveedor para el Panel de Administración
 */
function getProvidersStatus() {
  const statusList = [
    { provider: 'youtube', name: 'YouTube', status: 'ready', icon: '✅', note: 'IFrame Player API oficial disponible' },
    { provider: 'instagram', name: 'Instagram', status: 'ready', icon: '✅', note: 'Embed oficial público para Reels' },
    { provider: 'vimeo', name: 'Vimeo', status: 'ready', icon: '✅', note: 'Vimeo Player / oEmbed oficial disponible' },
    {
      provider: 'dailymotion',
      name: 'Dailymotion',
      status: process.env.DAILYMOTION_PLAYER_ID ? 'ready' : 'configured_default',
      icon: process.env.DAILYMOTION_PLAYER_ID ? '✅' : '⚙️',
      note: process.env.DAILYMOTION_PLAYER_ID ? 'Player ID configurado (DAILYMOTION_PLAYER_ID)' : 'Usando reproductor estándar oficial (Configura DAILYMOTION_PLAYER_ID opcionalmente en env)'
    },
    {
      provider: 'twitch',
      name: 'Twitch',
      status: 'ready',
      icon: '⚙️',
      note: 'Embed oficial con parámetro parent adaptado dinámicamente al dominio'
    },
    { provider: 'peertube', name: 'PeerTube', status: 'ready', icon: '✅', note: 'Soporte multinstancia descentralizada' },
    { provider: 'internet_archive', name: 'Internet Archive', status: 'ready', icon: '✅', note: 'Embed audiovisual oficial' },
    { provider: 'ted', name: 'TED Talks', status: 'ready', icon: '⚙️', note: 'TED Embed oficial (delega a YouTube en charlas alojadas allí)' },
    { provider: 'soundcloud', name: 'SoundCloud', status: 'ready', icon: '✅', note: 'Widget HTML5 / oEmbed oficial' },
    { provider: 'mixcloud', name: 'Mixcloud', status: 'ready', icon: '✅', note: 'Widget iframe de programas y mixes' }
  ];

  return statusList;
}

module.exports = {
  detectExternalProvider,
  getAdapter,
  getAllAdapters,
  getProvidersStatus,
  ADAPTERS
};
