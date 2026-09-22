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

// Nuevos módulos de APIs públicas
const openLibrary = require('./openLibrary');
const internetArchive = require('./internetArchive');
const wikipedia = require('./wikipedia');
const academicTools = require('./academicTools');
const openStreetMap = require('./openStreetMap');
const geoEnvironment = require('./geoEnvironment');
const devTools = require('./devTools');
const mediaTools = require('./mediaTools');
const socialDataTools = require('./socialDataTools');
const utilityTools = require('./utilityTools');

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

  // Open Library & Internet Archive & Wikipedia
  'openlibrary.search': (params) => openLibrary.searchBooks(params.query, params.limit || 5),
  'openlibrary.details': (params) => openLibrary.getBookDetails(params.key || params.workKey),
  'archive.search': (params) => internetArchive.searchArchive(params.query, params.limit || 5),
  'wayback.check': (params) => internetArchive.checkWayback(params.url, params.timestamp),
  'wikipedia.search': (params) => wikipedia.searchWikipedia(params.query, params.lang || 'es'),
  'wikimedia.search': (params) => wikipedia.searchWikimediaCommons(params.query, params.limit || 5),

  // Académicas
  'arxiv.search': (params) => academicTools.searchArxiv(params.query, params.limit || 5),
  'crossref.search': (params) => academicTools.searchCrossref(params.query, params.limit || 5),
  'openalex.search': (params) => academicTools.searchOpenAlex(params.query, params.limit || 5),
  'pubchem.search': (params) => academicTools.searchPubChem(params.query),
  'gbif.search': (params) => academicTools.searchGBIF(params.query, params.limit || 5),

  // Mapas y Geografía
  'osm.search': (params) => openStreetMap.searchOSM(params.query, params.limit || 5),
  'overpass.query': (params) => openStreetMap.queryOverpass(params.query),
  'restcountries.get': (params) => geoEnvironment.getRestCountries(params.country || params.name),
  'usgs.earthquakes': (params) => geoEnvironment.getUSGSEarthquakes(params.minMagnitude || 4.5, params.limit || 5),
  'openaq.airquality': (params) => geoEnvironment.getOpenAQAirQuality(params.city),
  'noaa.alerts': (params) => geoEnvironment.getNOAAAlerts(params.event || ''),

  // Dev & Código
  'github.search': (params) => devTools.searchGitHub(params.query, params.type || 'repositories'),
  'gitlab.search': (params) => devTools.searchGitLab(params.query),
  'npm.search': (params) => devTools.searchNpm(params.package || params.query),
  'pypi.search': (params) => devTools.searchPyPI(params.package || params.query),
  'huggingface.search': (params) => devTools.searchHuggingFace(params.query, params.type || 'models'),

  // Medios & Juegos
  'tvmaze.search': (params) => mediaTools.searchTVMaze(params.query || params.show),
  'pokeapi.get': (params) => mediaTools.getPokeAPI(params.pokemon || params.query),
  'opentrivia.get': (params) => mediaTools.getOpenTriviaQuestions(params.amount || 3, params.category, params.difficulty),
  'musicbrainz.search': (params) => mediaTools.searchMusicBrainz(params.query || params.artist),

  // Sociales & Datos
  'reddit.search': (params) => socialDataTools.searchReddit(params.subreddit || 'all', params.query || '', params.limit || 5),
  'hackernews.top': (params) => socialDataTools.getHackerNewsTop(params.limit || 5),
  'coingecko.prices': (params) => socialDataTools.getCoinGeckoPrices(params.ids, params.currencies),
  'worldbank.indicator': (params) => socialDataTools.getWorldBankIndicator(params.country, params.indicator),
  'mastodon.search': (params) => socialDataTools.searchMastodonPosts(params.query, params.limit || 5),

  // Utilidad & Curiosidades
  'nager.holidays': (params) => utilityTools.getNagerHolidays(params.year || new Date().getFullYear(), params.country || 'CU'),
  'frankfurter.convert': (params) => utilityTools.convertCurrencyFrankfurter(params.amount || 1, params.from || 'USD', params.to || 'EUR'),
  'themealdb.search': (params) => utilityTools.searchTheMealDB(params.query || params.recipe),
  'openfoodfacts.get': (params) => utilityTools.searchOpenFoodFacts(params.barcode || params.code),
  'joke.get': () => utilityTools.getRandomJoke(),
  'dog.image': () => utilityTools.getRandomDogImage(),
  'cat.fact': () => utilityTools.getCatFact(),
  'numbers.fact': (params) => utilityTools.getNumbersApiFact(params.number || 'random', params.type || 'trivia'),
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
      description: 'Busca cámaras públicas en tiempo real por ciudad.',
      parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
    },
    {
      name: 'youtube.search',
      description: 'Busca vídeos en YouTube.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'twitch.search',
      description: 'Busca transmisiones en vivo en Twitch.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'weather.get',
      description: 'Obtiene el clima actual de una ciudad.',
      parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
    },
    {
      name: 'social.profile',
      description: 'Busca el perfil de un usuario en Enlace.',
      parameters: { type: 'object', properties: { username: { type: 'string' } }, required: ['username'] }
    },
    {
      name: 'image.generate',
      description: 'Genera una imagen digital.',
      parameters: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }
    },
    {
      name: 'translate',
      description: 'Traduce texto a otro idioma.',
      parameters: { type: 'object', properties: { text: { type: 'string' }, target_lang: { type: 'string' } }, required: ['text'] }
    },
    {
      name: 'openlibrary.search',
      description: 'Busca libros en Open Library por título o autor.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'wikipedia.search',
      description: 'Busca resumen Enciclopédico de un tema o persona en Wikipedia.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, lang: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'wikimedia.search',
      description: 'Busca archivos multimedia e imágenes históricas en Wikimedia Commons.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'arxiv.search',
      description: 'Busca artículos y papers científicos en arXiv.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'crossref.search',
      description: 'Busca publicaciones académicas y registros DOI en Crossref.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'openalex.search',
      description: 'Busca trabajos científicos e investigadores en OpenAlex.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'pubchem.search',
      description: 'Obtiene la fórmula y masa molecular de un compuesto químico en PubChem.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'gbif.search',
      description: 'Busca especies biológicas y taxonomía en GBIF.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'osm.search',
      description: 'Busca lugares, coordenadas y direcciones en OpenStreetMap.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'restcountries.get',
      description: 'Obtiene información oficial, capital, población y bandera de un país.',
      parameters: { type: 'object', properties: { country: { type: 'string' } }, required: ['country'] }
    },
    {
      name: 'usgs.earthquakes',
      description: 'Consulta sismos recientes en el mundo registrados por USGS.',
      parameters: { type: 'object', properties: { minMagnitude: { type: 'number' } } }
    },
    {
      name: 'github.search',
      description: 'Busca repositorios o usuarios en GitHub.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'gitlab.search',
      description: 'Busca proyectos públicos en GitLab.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'npm.search',
      description: 'Busca paquetes JavaScript / Node.js en npm Registry.',
      parameters: { type: 'object', properties: { package: { type: 'string' } }, required: ['package'] }
    },
    {
      name: 'pypi.search',
      description: 'Busca paquetes de Python en PyPI.',
      parameters: { type: 'object', properties: { package: { type: 'string' } }, required: ['package'] }
    },
    {
      name: 'huggingface.search',
      description: 'Busca modelos o datasets de Inteligencia Artificial en Hugging Face.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'tvmaze.search',
      description: 'Busca series de televisión y programas en TVMaze.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'pokeapi.get',
      description: 'Obtiene datos y estadísticas de un Pokémon en PokéAPI.',
      parameters: { type: 'object', properties: { pokemon: { type: 'string' } }, required: ['pokemon'] }
    },
    {
      name: 'coingecko.prices',
      description: 'Consulta el precio actual de criptomonedas (Bitcoin, Ethereum, Solana, etc.).',
      parameters: { type: 'object', properties: { ids: { type: 'string' } } }
    },
    {
      name: 'reddit.search',
      description: 'Busca publicaciones y discusiones en subreddits de Reddit.',
      parameters: { type: 'object', properties: { subreddit: { type: 'string' }, query: { type: 'string' } } }
    },
    {
      name: 'hackernews.top',
      description: 'Obtiene las noticias y discusiones principales de Hacker News.',
      parameters: { type: 'object', properties: { limit: { type: 'number' } } }
    },
    {
      name: 'worldbank.indicator',
      description: 'Consulta indicadores económicos del Banco Mundial por país.',
      parameters: { type: 'object', properties: { country: { type: 'string' }, indicator: { type: 'string' } } }
    },
    {
      name: 'frankfurter.convert',
      description: 'Convierte divisas y tasas de cambio internacionales (USD, EUR, etc.).',
      parameters: { type: 'object', properties: { amount: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['amount', 'from', 'to'] }
    },
    {
      name: 'themealdb.search',
      description: 'Busca recetas culinarias e ingredientes en TheMealDB.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'openfoodfacts.get',
      description: 'Obtiene información nutricional e ingredientes de alimentos por código de barras.',
      parameters: { type: 'object', properties: { barcode: { type: 'string' } }, required: ['barcode'] }
    },
    {
      name: 'numbers.fact',
      description: 'Obtiene curiosidades y datos numéricos / matemáticos en Numbers API.',
      parameters: { type: 'object', properties: { number: { type: 'string' } } }
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

  // Wikipedia / Enciclopedia
  if (lower.includes('quién fue') || lower.includes('quien fue') || lower.includes('biografía de') || lower.includes('wikipedia') || lower.includes('qué es') || lower.includes('que es')) {
    const topicMatch = text.replace(/^(quién fue|quien fue|biografía de|qué es|que es|busca en wikipedia sobre|wikipedia sobre)/i, '').trim();
    if (topicMatch) return { tool: 'wikipedia.search', params: { query: topicMatch, lang: 'es' } };
  }

  // Libros / Open Library
  if (lower.includes('libro') || lower.includes('autor de') || lower.includes('busca el libro')) {
    const bookMatch = text.replace(/^(libro|autor de|busca el libro)/i, '').trim();
    if (bookMatch) return { tool: 'openlibrary.search', params: { query: bookMatch } };
  }

  // Países / REST Countries
  if (lower.includes('país') || lower.includes('pais') || lower.includes('capital de') || lower.includes('población de')) {
    const countryMatch = text.replace(/^(país|pais|capital de|población de)/i, '').trim();
    if (countryMatch) return { tool: 'restcountries.get', params: { country: countryMatch } };
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
