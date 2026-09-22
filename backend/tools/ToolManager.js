/**
 * Gestor Central de Herramientas (Tool Manager Modular) y Misiones IA
 */
const webSearch = require('./webSearch');
const webcamSearch = require('./webcamSearch');
const videoSearch = require('./videoSearch');
const socialProfile = require('./socialProfile');
const weather = require('./weather');
const imageTool = require('./imageTool');
const translateTool = require('./translateTool');
const docExtractor = require('./docExtractor');
const codeTool = require('./codeTool');
const mathTool = require('./mathTool');
const geoTimeTool = require('./geoTimeTool');
const unitTool = require('./unitTool');
const promptTool = require('./promptTool');

const tools = {
  'web.search': webSearch.search,
  'webcam.search': webcamSearch.search,
  'youtube.search': videoSearch.searchYouTube,
  'twitch.search': videoSearch.searchTwitch,
  'weather.get': weather.getWeather,
  'social.profile': socialProfile.getProfile,
  'image.generate': imageTool.generateImage,
  'translate': translateTool.translate,
  'doc.extract': docExtractor.extractText,
  'code.analyze': codeTool.analyzeCode,
  'math.calculate': mathTool.calculate,
  'world.time': geoTimeTool.getWorldTime,
  'unit.convert': unitTool.convertUnits,
  'prompt.enhance': promptTool.enhancePrompt,
};

function getToolDefinitions() {
  return [
    {
      name: 'web.search',
      description: 'Busca información actualizada en la web.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'webcam.search',
      description: 'Busca cámaras públicas y vástagos de vídeo en tiempo real por ciudad.',
      parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
    },
    {
      name: 'youtube.search',
      description: 'Busca vídeos en YouTube.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'twitch.search',
      description: 'Busca canales o transmisiones en vivo en Twitch.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'weather.get',
      description: 'Obtiene el clima actual de una ciudad.',
      parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
    },
    {
      name: 'social.profile',
      description: 'Busca el perfil de un usuario en Enlace o redes.',
      parameters: { type: 'object', properties: { username: { type: 'string' } }, required: ['username'] }
    },
    {
      name: 'image.generate',
      description: 'Genera una imagen digital a partir de un prompt descriptivo.',
      parameters: { type: 'object', properties: { prompt: { type: 'string' }, enhance: { type: 'boolean' } }, required: ['prompt'] }
    },
    {
      name: 'translate',
      description: 'Traduce texto a otro idioma.',
      parameters: { type: 'object', properties: { text: { type: 'string' }, target_lang: { type: 'string' } }, required: ['text'] }
    },
    {
      name: 'doc.extract',
      description: 'Extrae y resume texto de documentos (PDF, TXT, CSV, JSON) o imágenes.',
      parameters: { type: 'object', properties: { content: { type: 'string' }, filename: { type: 'string' }, mimeType: { type: 'string' } } }
    },
    {
      name: 'code.analyze',
      description: 'Analiza código fuente.',
      parameters: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' } }, required: ['code'] }
    },
    {
      name: 'math.calculate',
      description: 'Calcula expresiones matemáticas.',
      parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] }
    },
    {
      name: 'world.time',
      description: 'Consulta la hora oficial y fecha de una ciudad.',
      parameters: { type: 'object', properties: { location: { type: 'string' } } }
    },
    {
      name: 'unit.convert',
      description: 'Convierte unidades de temperatura, distancia o peso.',
      parameters: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] }
    },
    {
      name: 'prompt.enhance',
      description: 'Optimiza un prompt de IA.',
      parameters: { type: 'object', properties: { prompt: { type: 'string' }, style: { type: 'string' } }, required: ['prompt'] }
    }
  ];
}

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
 * Detecta intenciones de herramientas mediante expresiones regulares
 */
function detectToolIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // Búsqueda de perfil de persona/usuario en la plataforma Enlace
  if (
    lower.includes('perfil de') ||
    lower.includes('busca a') ||
    lower.includes('buscar usuario') ||
    lower.includes('ver perfil') ||
    lower.includes('quién es') ||
    lower.includes('quien es') ||
    lower.includes('muéstrame a') ||
    lower.includes('muestrame a') ||
    lower.includes('encuentra a')
  ) {
    const userMatch = text.match(/(?:perfil\s+de|busca\s+a|buscar\s+usuario|ver\s+perfil|quién\s+es|quien\s+es|muéstrame\s+a|muestrame\s+a|encuentra\s+a)\s+@?([a-záéíóúñ0-9._\s]+)/i);
    if (userMatch && userMatch[1]) {
      let cleanTarget = userMatch[1]
        .replace(/\b(en\s+la\s+plataforma|en\s+enlace|por\s+favor|en\s+la\s+red)\b/gi, '')
        .replace(/(\.|\?|!)+$/, '')
        .trim();
      if (cleanTarget) {
        return { tool: 'social.profile', params: { username: cleanTarget } };
      }
    }
  }

  // Cámara pública
  if (lower.includes('cámara') || lower.includes('camara') || lower.includes('webcam') || lower.includes('muéstrame una cámara')) {
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

  // Hora mundial
  if (lower.includes('hora en') || lower.includes('qué hora es') || lower.includes('que hora es')) {
    const locMatch = text.match(/(?:hora\s+(?:en|de)?)\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].trim() : 'La Habana';
    return { tool: 'world.time', params: { location: loc || 'La Habana' } };
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
  if (lower.startsWith('busca') || lower.startsWith('buscar en la web') || lower.includes('noticias sobre') || lower.includes('investiga')) {
    const q = text.replace(/^(busca|buscar en la web|noticias sobre|investiga sobre|investiga)/i, '').trim();
    return { tool: 'web.search', params: { query: q || text } };
  }

  // Cálculo
  if (lower.startsWith('calcula') || lower.startsWith('cuánto es') || lower.startsWith('cuanto es')) {
    const expr = text.replace(/^(calcula|cuánto es|cuanto es)/i, '').trim();
    return { tool: 'math.calculate', params: { expression: expr } };
  }

  return null;
}

/**
 * Modo Misión: Ejecución secuencial de herramientas con límite de pasos
 */
async function executeMission(goal, requesterId = null, maxSteps = 5) {
  if (!goal) return { error: 'Se requiere una meta o misión.' };

  const stepsExecuted = [];
  let currentStep = 0;

  // Paso 1: Detección o búsqueda de partida
  const primaryIntent = detectToolIntent(goal);
  if (primaryIntent && currentStep < maxSteps) {
    currentStep++;
    const res1 = await executeTool(primaryIntent.tool, primaryIntent.params, requesterId);
    stepsExecuted.push({
      step: currentStep,
      tool: primaryIntent.tool,
      params: primaryIntent.params,
      status: 'Completado',
      result: res1,
    });
  }

  // Si la misión requirió búsqueda web, agregar paso de análisis o síntesis
  if (stepsExecuted.length === 0 && currentStep < maxSteps) {
    currentStep++;
    const resWeb = await executeTool('web.search', { query: goal }, requesterId);
    stepsExecuted.push({
      step: currentStep,
      tool: 'web.search',
      params: { query: goal },
      status: 'Completado',
      result: resWeb,
    });
  }

  return {
    mission: goal,
    steps_count: stepsExecuted.length,
    steps: stepsExecuted,
    summary: `Misión completada en ${stepsExecuted.length} paso(s).`
  };
}

module.exports = {
  executeTool,
  detectToolIntent,
  getToolDefinitions,
  executeMission,
  tools,
};
