/**
 * Gestor Central de Herramientas (Tool Manager Modular)
 */
const webSearch = require('./webSearch');
const webcamSearch = require('./webcamSearch');
const videoSearch = require('./videoSearch');
const socialProfile = require('./socialProfile');
const weather = require('./weather');
const imageTool = require('./imageTool');
const translateTool = require('./translateTool');

const tools = {
  'web.search': webSearch.search,
  'webcam.search': webcamSearch.search,
  'youtube.search': videoSearch.searchYouTube,
  'twitch.search': videoSearch.searchTwitch,
  'weather.get': weather.getWeather,
  'social.profile': socialProfile.getProfile,
  'image.generate': imageTool.generateImage,
  'translate': translateTool.translate,
};

async function executeTool(name, params = {}, requesterId = null) {
  const toolFn = tools[name];
  if (!toolFn) {
    return { error: `La herramienta '${name}' no existe o no está registrada.` };
  }

  try {
    if (name === 'social.profile') {
      return await toolFn(params.username || params.query, requesterId);
    }
    if (name === 'web.search' || name === 'webcam.search') {
      return await toolFn(params.query || params.location || params.q);
    }
    if (name === 'youtube.search' || name === 'twitch.search') {
      return await toolFn(params.query || params.q);
    }
    if (name === 'weather.get') {
      return await toolFn(params.location || params.city || params.query);
    }
    if (name === 'image.generate') {
      return await toolFn(params.prompt || params.query, params.enhance);
    }
    if (name === 'translate') {
      return await toolFn(params.text || params.query, params.target_lang || params.lang);
    }

    return await toolFn(params);
  } catch (err) {
    console.error(`Error ejecutando herramienta ${name}:`, err);
    return { error: `Ocurrió un error al ejecutar la herramienta '${name}'.` };
  }
}

/**
 * Detecta intenciones de herramientas en mensajes de texto
 */
function detectToolIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // Cámara pública
  if (lower.includes('cámara') || lower.includes('camara') || lower.includes('webcam') || lower.includes('muéstrame una cámara') || lower.includes('muestrame una camara')) {
    const locMatch = text.match(/(?:cámara|camara|webcam|de)\s+(?:de\s+)?([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].replace(/pública|publica|en vivo/gi, '').trim() : 'Tokio';
    return { tool: 'webcam.search', params: { location: loc || 'Tokio' } };
  }

  // Clima
  if (lower.includes('clima') || lower.includes('tiempo en') || lower.includes('temperatura')) {
    const locMatch = text.match(/(?:clima|tiempo|temperatura)\s+(?:de|en)?\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].trim() : 'La Habana';
    return { tool: 'weather.get', params: { location: loc || 'La Habana' } };
  }

  // Perfil social / Instagram / Usuario
  if (lower.includes('perfil de') || lower.includes('instagram de') || lower.includes('buscar usuario') || lower.includes('ver perfil')) {
    const userMatch = text.match(/(?:perfil|instagram|usuario)\s+(?:de\s+)?@?([a-z0-9._]+)/i);
    if (userMatch) {
      return { tool: 'social.profile', params: { username: userMatch[1] } };
    }
  }

  // Vídeo YouTube
  if (lower.includes('youtube') || lower.includes('vídeo de') || lower.includes('video de') || lower.includes('buscar video')) {
    const qMatch = text.match(/(?:youtube|vídeo|video|de)\s+(?:de\s+)?([a-záéíóúñ0-9\s]+)/i);
    return { tool: 'youtube.search', params: { query: qMatch ? qMatch[1].trim() : text } };
  }

  // Generar imagen
  if (lower.startsWith('dibuja') || lower.startsWith('genera una imagen') || lower.startsWith('crea una imagen') || lower.includes('imagen de')) {
    const promptMatch = text.replace(/^(dibuja|genera una imagen de|crea una imagen de|imagen de)/i, '').trim();
    return { tool: 'image.generate', params: { prompt: promptMatch || text, enhance: true } };
  }

  // Búsqueda web
  if (lower.startsWith('busca') || lower.startsWith('buscar en la web') || lower.includes('noticias sobre')) {
    const q = text.replace(/^(busca|buscar en la web|noticias sobre)/i, '').trim();
    return { tool: 'web.search', params: { query: q || text } };
  }

  return null;
}

module.exports = {
  executeTool,
  detectToolIntent,
  tools
};
