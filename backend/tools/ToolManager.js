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
const videoService = require('../services/videoService');

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
const dynamicEngine = require('./dynamicApiEngine');

// Módulos añadidos de APIs públicas externas, Utilidades internas, Acciones de Usuario y Minijuegos
const externalApis = require('./externalApis');
const internalTools = require('./internalTools');
const userActionTools = require('./userActionTools');
const gameTool = require('./gameTool');

const tools = {
  'game.list': (params) => gameTool.listGames(params),
  'game.launch': (params) => gameTool.launchGame(params),
  'web.search': webSearch.search,
  'webcam.search': webcamSearch.search,
  'youtube.search': videoSearch.searchYouTube,
  'twitch.search': videoSearch.searchTwitch,
  'search_videos': (params) => videoService.searchVideos(params),
  'weather.get': weather.getWeather,
  'social.profile': socialProfile.getProfile,
  'image.generate': imageTool.generateImage,
  'image.edit': (params, requesterId) => imageTool.editImage(params, requesterId),
  'translate': translateTool.translate,
  'doc.extract': docExtractor.extractText,
  'code.analyze': codeTool.analyzeCode,
  'math.calculate': mathTool.calculate,
  'world.time': geoTimeTool.getWorldTime,
  'unit.convert': unitTool.convertUnits,
  'prompt.enhance': promptTool.enhancePrompt,

  // Acciones de Usuario e Interacciones
  'chat.preview': (params, requesterId) => userActionTools.getChatPreview(params, requesterId),
  'user.edit_profile': (params, requesterId) => userActionTools.editUserProfile(params, requesterId),
  'status.create': (params, requesterId) => userActionTools.createStatus(params, requesterId),
  'status.delete': (params, requesterId) => userActionTools.deleteStatus(params, requesterId),
  'friend.send_request': (params, requesterId) => userActionTools.sendFriendRequest(params, requesterId),

  // Contenido Abierto, Videos, Fotos de Stock, Directos y Enlaces de Pago
  'youtube.live': (params) => externalApis.searchYouTubeLive(params.query || params.topic),
  'duckduckgo.search': (params) => externalApis.searchDuckDuckGo(params.query),
  'stock.photos': (params) => externalApis.searchStockPhotos(params.query || params.topic),
  'free.videos': (params) => externalApis.searchFreeVideos(params.query || params.topic),
  'system.payment_link': (params, requesterId) => externalApis.generatePaymentLink(params, requesterId),

  // Open Library & Internet Archive & Wikipedia
  'openlibrary.search': (params) => openLibrary.searchBooks(params.query, params.limit || 5),
  'openlibrary.details': (params) => openLibrary.getBookDetails(params.key || params.workKey),
  'archive.search': (params) => internetArchive.searchArchive(params.query, params.limit || 5),
  'wayback.check': (params) => internetArchive.checkWayback(params.url, params.timestamp),
  'wikipedia.search': (params) => wikipedia.searchWikipedia(params.query, params.lang || 'es'),
  'wikimedia.search': (params) => wikipedia.searchWikimediaCommons(params.query, params.limit || 6),
  'image.random': (params) => wikipedia.getRandomPhotos(params?.topic || params?.query, params?.count || 4),

  // Académicas
  'arxiv.search': (params) => academicTools.searchArxiv(params.query, params.limit || 5),
  'crossref.search': (params) => academicTools.searchCrossref(params.query, params.limit || 5),
  'openalex.search': (params) => academicTools.searchOpenAlex(params.query, params.limit || 5),
  'pubchem.search': (params) => academicTools.searchPubChem(params.query),
  'gbif.search': (params) => academicTools.searchGBIF(params.query, params.limit || 5),

  // Búsqueda de personas por intereses & publicaciones
  'user.search_by_interest': (params) => socialProfile.searchUsersByInterest(params.interest || params.query, params.limit || 10),
  'posts.search': (params) => socialProfile.searchPosts(params.query || params.keyword, params.limit || 10),

  // Geolocalización por IP & Descubrimiento de APIs Dinámicas
  'ip.geolocation': (params) => geoEnvironment.getIpGeolocation(params.ip || ''),
  'dynamic.discover': (params) => dynamicEngine.discoverAndRegisterApis(params.query || params.topic || params.url),

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

  // Medios & Juegos & GIFs Animados
  'tvmaze.search': (params) => mediaTools.searchTVMaze(params.query || params.show),
  'pokeapi.get': (params) => mediaTools.getPokeAPI(params.pokemon || params.query),
  'opentrivia.get': (params) => mediaTools.getOpenTriviaQuestions(params.amount || 3, params.category, params.difficulty),
  'musicbrainz.search': (params) => mediaTools.searchMusicBrainz(params.query || params.artist),
  'gif.search': (params) => mediaTools.searchGifs(params.query || params.topic, params.limit || 6),
  'sticker.animated': (params) => mediaTools.getAnimatedStickers(params.category || params.query),
  'graphics3d.generate': (params) => ({
    type: '3d_graphics_card',
    data: {
      title: params.title || 'Gráfico 3D Interactivo con Wiggle',
      shape: params.shape || params.type || 'cube',
      color: params.color || '#8b5cf6',
      speed: params.speed || 1.5,
      interactive: true,
    }
  }),

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

  // 20 Herramientas de APIs Públicas Exteriores
  'nasa.apod': (params) => externalApis.getNasaApod(params.date),
  'nasa.asteroids': () => externalApis.getNasaAsteroids(),
  'metmuseum.search': (params) => externalApis.searchMetMuseum(params.query),
  'poetrydb.search': (params) => externalApis.searchPoetryDB(params.query || params.title),
  'exchangerate.latest': (params) => externalApis.getExchangeRates(params.base || 'USD'),
  'coinpaprika.info': (params) => externalApis.getCoinPaprikaInfo(params.coinId || 'btc-bitcoin'),
  'openmeteo.forecast': (params) => externalApis.getOpenMeteoForecast(params.lat, params.lon),
  'sunrise_sunset.get': (params) => externalApis.getSunriseSunset(params.lat, params.lng),
  'clinicaltrials.search': (params) => externalApis.searchClinicalTrials(params.condition),
  'rcsb.pdb_search': (params) => externalApis.searchRcsbPdb(params.query),
  'dictionary.lookup': (params) => externalApis.lookupDictionary(params.word),
  'datamuse.words': (params) => externalApis.searchDatamuse(params.word, params.mode),
  'dns.doh': (params) => externalApis.lookupDnsOverHttps(params.domain, params.rrType),
  'httpbin.inspect': () => externalApis.inspectHttpBin(),
  'deckofcards.draw': (params) => externalApis.drawDeckOfCards(params.count),
  'bored.activity': (params) => externalApis.getBoredActivity(params.type),
  'jikan.anime': (params) => externalApis.searchJikanAnime(params.query),
  'gutendex.search': (params) => externalApis.searchGutendex(params.query),
  'advice.slip': () => externalApis.getAdviceSlip(),
  'agify.predict': (params) => externalApis.predictAgify(params.name),

  // 20 Herramientas Internas de Procesamiento
  'text.stats': (params) => internalTools.getTextStats(params.text),
  'text.diff': (params) => internalTools.compareTextDiff(params.textA, params.textB),
  'text.clean_html': (params) => internalTools.cleanHtml(params.htmlContent),
  'text.slugify': (params) => internalTools.generateSlug(params.text),
  'crypto.hash': (params) => internalTools.generateCryptoHash(params.text, params.algorithm),
  'crypto.uuid': () => internalTools.generateUUID(),
  'encoding.base64': (params) => internalTools.processBase64(params.data, params.mode),
  'encoding.url': (params) => internalTools.processUrlEncoding(params.text, params.mode),
  'date.format': (params) => internalTools.formatDate(params.dateString, params.locale, params.timeZone),
  'date.diff': (params) => internalTools.calculateDateDiff(params.startDateStr, params.endDateStr),
  'date.business_days': (params) => internalTools.calculateBusinessDays(params.startDateStr, params.endDateStr),
  'data.json_validate': (params) => internalTools.validateAndFormatJson(params.jsonString),
  'math.stats': (params) => internalTools.calculateMathStats(params.numbers),
  'math.prime_check': (params) => internalTools.checkPrimeAndFactors(params.number),
  'data.csv_to_json': (params) => internalTools.convertCsvToJson(params.csvText, params.delimiter),
  'utility.lorem': (params) => internalTools.generateLoremIpsum(params.paragraphsCount),
  'utility.regex_test': (params) => internalTools.testRegexPattern(params.pattern, params.text, params.flags),
  'utility.color_convert': (params) => internalTools.convertColor(params.colorInput),
  'utility.random_generator': (params) => internalTools.generateRandomString(params.length),
  'utility.markdown_to_plain': (params) => internalTools.convertMarkdownToPlain(params.markdownText),
};

function getToolDefinitions() {
  const baseDefs = [
    {
      name: 'game.list',
      description: 'Consulta y muestra la lista de minijuegos disponibles en la biblioteca oficial de Link Games.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Categoría opcional (board, arcade, puzzle, trivia)' },
          query: { type: 'string', description: 'Palabra clave o filtro de búsqueda' }
        }
      }
    },
    {
      name: 'game.launch',
      description: 'Inicia o abre un minijuego directamente dentro de la plataforma Link resolviendo su gameId oficial (ej. snake, 2048, memory, tictactoe, flappy, trivia, wordle, minesweeper, breakout, etc.).',
      parameters: {
        type: 'object',
        properties: {
          gameId: { type: 'string', description: 'Identificador único del juego (gameId) en Link Games (ej. snake, 2048, memory, tictactoe, flappy, wordle, minesweeper, etc.)' }
        },
        required: ['gameId']
      }
    },
    {
      name: 'search_videos',
      description: 'Busca y muestra videos de Pexels directamente en la UI de la plataforma Enlace según la consulta, orientación (landscape, portrait, square) y categoría.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda del video (ej. naturaleza, ciudad, autos, tecnología, espacio)' },
          orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'], description: 'Orientación del video (landscape/horizontal, portrait/vertical, square/cuadrado)' },
          category: { type: 'string', description: 'Categoría opcional del video' }
        },
        required: ['query']
      }
    },
    {
      name: 'weather.get',
      description: 'Obtiene el clima real actual e información meteorológica de una ciudad o coordenadas GPS utilizando Open-Meteo.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Nombre de la ciudad (ej. Madrid, Ciudad de México) o coordenadas GPS (Lat xx, Lon yy)' }
        },
        required: ['location']
      }
    },
    {
      name: 'web.search',
      description: 'Busca información actualizada en la web.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta de búsqueda web' }
        },
        required: ['query']
      }
    },
    {
      name: 'social.profile',
      description: 'Busca un perfil de usuario registrado en la plataforma Enlace por su nombre de usuario o nombre.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Nombre de usuario o nombre en la plataforma Enlace' }
        },
        required: ['username']
      }
    },
    {
      name: 'user.search_by_interest',
      description: 'Busca usuarios en Enlace según sus intereses, gustos o pasatiempos.',
      parameters: {
        type: 'object',
        properties: {
          interest: { type: 'string', description: 'Interés, gusto o pasatiempo a buscar' }
        },
        required: ['interest']
      }
    },
    {
      name: 'posts.search',
      description: 'Busca publicaciones compartidas por usuarios en la plataforma Enlace.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Palabra clave o tema de búsqueda' }
        },
        required: ['query']
      }
    },
    {
      name: 'youtube.search',
      description: 'Busca videos en YouTube.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Búsqueda de videos en YouTube' }
        },
        required: ['query']
      }
    },
    {
      name: 'youtube.live',
      description: 'Busca transmisiones en vivo y directos en YouTube.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Tema o canal para buscar directo en vivo' }
        }
      }
    },
    {
      name: 'wikipedia.search',
      description: 'Busca artículos explicativos e información enciclopédica en Wikipedia.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Concepto, persona, evento o artículo a buscar' },
          lang: { type: 'string', description: 'Idioma de Wikipedia (ej. es, en)' }
        },
        required: ['query']
      }
    },
    {
      name: 'wikimedia.search',
      description: 'Busca imágenes y archivos multimedia libres en Wikimedia Commons.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda de archivos' }
        },
        required: ['query']
      }
    },
    {
      name: 'osm.search',
      description: 'Busca lugares, direcciones o puntos geográficos en OpenStreetMap.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Lugar, dirección o ciudad' }
        },
        required: ['query']
      }
    },
    {
      name: 'github.search',
      description: 'Busca repositorios, proyectos y código en GitHub.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Nombre de proyecto, tecnología o repositorio' }
        },
        required: ['query']
      }
    },
    {
      name: 'reddit.search',
      description: 'Busca publicaciones y discusiones en Reddit.',
      parameters: {
        type: 'object',
        properties: {
          subreddit: { type: 'string', description: 'Nombre del subreddit (opcional, ej. all)' },
          query: { type: 'string', description: 'Término de búsqueda' }
        }
      }
    },
    {
      name: 'nasa.apod',
      description: 'Obtiene la imagen o fotografía del día espacial provista por la NASA.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Fecha opcional (YYYY-MM-DD)' }
        }
      }
    },
    {
      name: 'openlibrary.search',
      description: 'Busca libros, obras literarias y autores en Open Library.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Título de libro, autor o tema' }
        },
        required: ['query']
      }
    },
    {
      name: 'stock.photos',
      description: 'Busca imágenes profesionales de stock en bancos de imágenes libres.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda de imagen' }
        },
        required: ['query']
      }
    },
    {
      name: 'image.generate',
      description: 'Genera una imagen digital ilustrada mediante IA según una descripción.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Descripción detallada de la imagen a generar' }
        },
        required: ['prompt']
      }
    },
    {
      name: 'image.edit',
      description: 'Edita o retoca una imagen adjunta.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Instrucciones de edición o retoque' },
          image_base64: { type: 'string', description: 'Imagen en base64 (opcional)' }
        },
        required: ['prompt']
      }
    },
    {
      name: 'translate',
      description: 'Traduce un texto a un idioma especificado.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Texto a traducir' },
          target_lang: { type: 'string', description: 'Idioma destino (ej. en, es, fr, de)' }
        },
        required: ['text']
      }
    },
    {
      name: 'math.calculate',
      description: 'Evalúa expresiones matemáticas y cálculos exactos.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Expresión matemática (ej. 25 * 4 + 10)' }
        },
        required: ['expression']
      }
    },
    {
      name: 'world.time',
      description: 'Obtiene la hora mundial actual en una ubicación especificada.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Ciudad o país' }
        },
        required: ['location']
      }
    },
    {
      name: 'coingecko.prices',
      description: 'Obtiene precios y cotizaciones en tiempo real de criptomonedas (Bitcoin, Ethereum, etc.).',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'string', description: 'Identificador de la criptomoneda (ej. bitcoin, ethereum, solana)' }
        }
      }
    },
    {
      name: 'chat.preview',
      description: 'Muestra una vista previa de una conversación en la plataforma.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Nombre de usuario' }
        }
      }
    },
    {
      name: 'user.edit_profile',
      description: 'Edita la biografía, profesión o datos del perfil del usuario.',
      parameters: {
        type: 'object',
        properties: {
          bio: { type: 'string' },
          profession: { type: 'string' },
          city: { type: 'string' }
        }
      }
    },
    {
      name: 'status.create',
      description: 'Publica un nuevo estado o historia temporal.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Texto del estado' }
        },
        required: ['text']
      }
    },
    {
      name: 'friend.send_request',
      description: 'Envía una solicitud de amistad a otro usuario.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Nombre de usuario destino' }
        },
        required: ['username']
      }
    },
    {
      name: 'system.payment_link',
      description: 'Genera un enlace de pago del sistema.',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'Nombre del servicio' },
          amount: { type: 'string', description: 'Monto en USD' }
        }
      }
    }
  ];

  const dynamicApis = dynamicEngine.INITIAL_DISCOVERY_CATALOG || [];
  dynamicApis.forEach(api => {
    const toolName = `dynamic.${api.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    baseDefs.push({
      name: toolName,
      description: api.description,
      parameters: { type: 'object', properties: api.params_schema || {} }
    });
  });

  return baseDefs;
}

/**
 * Convierte una definición de parámetro a tipos válidos para Gemini REST API
 */
function convertTypeToGemini(typeStr) {
  if (!typeStr) return 'STRING';
  const t = String(typeStr).toLowerCase();
  if (t === 'string') return 'STRING';
  if (t === 'number') return 'NUMBER';
  if (t === 'integer') return 'INTEGER';
  if (t === 'boolean') return 'BOOLEAN';
  if (t === 'array') return 'ARRAY';
  if (t === 'object') return 'OBJECT';
  return 'STRING';
}

function cleanSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'STRING' };
  const clean = {};
  clean.type = convertTypeToGemini(schema.type);

  if (schema.description) clean.description = schema.description;
  if (schema.enum && Array.isArray(schema.enum)) clean.enum = schema.enum;

  if (schema.properties && typeof schema.properties === 'object') {
    clean.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      clean.properties[key] = cleanSchemaForGemini(val);
    }
  }

  if (schema.required && Array.isArray(schema.required)) {
    clean.required = schema.required;
  }

  return clean;
}

/**
 * Genera el arreglo `tools` en el formato requerido por Gemini REST API:
 * `[{ functionDeclarations: [ { name, description, parameters }, ... ] }]`
 */
function getGeminiToolDeclarations() {
  const toolDefs = getToolDefinitions();
  const declarations = toolDefs.map(def => {
    // Normalizar nombre quitando puntos
    const safeName = def.name.replace(/\./g, '_');
    return {
      name: safeName,
      description: def.description || `Herramienta ${safeName}`,
      parameters: cleanSchemaForGemini(def.parameters || { type: 'object', properties: {} })
    };
  });

  return [
    {
      functionDeclarations: declarations
    }
  ];
}

// Sincronizar de forma síncrona/inicial el catálogo de APIs dinámicas
dynamicEngine.syncDynamicApisWithToolManager({ tools }).catch(() => {});

async function executeTool(name, params = {}, requesterId = null) {
  // Manejar nombres normalizados (con o sin punto)
  let realName = name;
  if (!tools[realName]) {
    // Intentar buscar mapeo si se usó con guión bajo en vez de punto
    for (const registeredKey of Object.keys(tools)) {
      if (registeredKey.replace(/\./g, '_') === name) {
        realName = registeredKey;
        break;
      }
    }
  }

  const toolFn = tools[realName];
  if (!toolFn) {
    return { error: `La herramienta '${name}' no existe o no está registrada.` };
  }

  try {
    if (name === 'game.list' || name === 'game.launch') {
      return await toolFn(params);
    }
    if (name === 'social.profile' || name === 'chat.preview' || name === 'user.edit_profile' || name === 'status.create' || name === 'status.delete' || name === 'friend.send_request' || name === 'system.payment_link') {
      return await toolFn(params, requesterId);
    }
    if (name === 'web.search' || name === 'webcam.search') {
      return await toolFn(params.query || params.location || params.q);
    }
    if (name === 'youtube.search' || name === 'twitch.search' || name === 'youtube.live') {
      return await toolFn(params.query || params.q || params.topic);
    }
    if (name === 'search_videos') {
      return await toolFn(params);
    }
    if (name === 'weather.get') {
      return await toolFn(params.location || params.city || params.query);
    }
    if (name === 'image.generate') {
      return await toolFn(params.prompt || params.query, params.enhance);
    }
    if (name === 'image.edit') {
      return await toolFn(params, requesterId);
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
 * Detecta intenciones de herramientas mediante lenguaje natural conversacional y contextual
 */
function detectToolIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // 0. Búsqueda y Apertura de Minijuegos en Link Games (game.list / game.launch)
  if (
    lower.includes('muéstrame los juegos') || lower.includes('muestrame los juegos') ||
    lower.includes('qué juegos hay') || lower.includes('que juegos hay') ||
    lower.includes('ver juegos') || lower.includes('ver los juegos') ||
    lower.includes('catálogo de juegos') || lower.includes('catalogo de juegos') ||
    lower.includes('lista de juegos') || lower.includes('enseñame los juegos') ||
    lower === 'juegos' || lower === 'minijuegos' || lower === 'juegos gratis'
  ) {
    return { tool: 'game.list', params: {} };
  }

  if (
    lower.includes('quiero jugar') || lower.includes('abre') || lower.includes('abrir') ||
    lower.includes('jugar') || lower.includes('pon el juego') || lower.includes('lanzar juego')
  ) {
    const knownGames = [
      { key: 'snake', names: ['snake', 'serpiente', 'culebra'] },
      { key: '2048', names: ['2048'] },
      { key: 'memory', names: ['memory', 'memoria', 'juego de memoria', 'parejas'] },
      { key: 'tictactoe', names: ['tictactoe', 'tres en raya', '3 en raya', 'tateti'] },
      { key: 'connect4', names: ['connect4', '4 en raya', 'cuatro en raya'] },
      { key: 'pong', names: ['pong'] },
      { key: 'trivia', names: ['trivia', 'preguntas', 'quiz'] },
      { key: 'flappy', names: ['flappy', 'flappy link', 'pajarito'] },
      { key: 'breakout', names: ['breakout', 'brick breaker', 'rompebloques', 'pelotita'] },
      { key: 'wordle', names: ['wordle', 'adivina la palabra', 'palabras'] },
      { key: 'minesweeper', names: ['minesweeper', 'buscaminas'] },
      { key: 'simon', names: ['simon', 'secuencia de colores'] },
      { key: 'sudoku', names: ['sudoku'] },
      { key: 'spaceinvaders', names: ['spaceinvaders', 'space invaders', 'invasores'] },
      { key: 'whackamole', names: ['whackamole', 'atrapa al topo', 'topo'] },
      { key: 'solitaire', names: ['solitaire', 'solitario'] },
      { key: 'checkers', names: ['checkers', 'damas'] },
      { key: 'hanoi', names: ['hanoi', 'torres de hanoi'] },
      { key: 'pacman', names: ['pacman', 'pac-man', 'pacrunner'] },
      { key: 'typing', names: ['typing', 'mecanografía', 'mecanografia'] },
      { key: 'towerstack', names: ['towerstack', 'torre de bloques', 'apilar'] },
      { key: 'match3', names: ['match3', 'conecta 3', 'gemas'] },
      { key: 'mathquiz', names: ['mathquiz', 'reto matemático', 'matemáticas'] },
      { key: 'doodlejump', names: ['doodlejump', 'salto infinito'] },
      { key: 'lightsout', names: ['lightsout', 'luces fuera'] },
      { key: 'hangman', names: ['hangman', 'ahorcado'] },
      { key: 'wordsearch', names: ['wordsearch', 'sopa de letras'] }
    ];

    for (const item of knownGames) {
      if (item.names.some(n => lower.includes(n))) {
        return { tool: 'game.launch', params: { gameId: item.key } };
      }
    }

    if (lower === 'quiero jugar' || lower === 'quiero jugar algo' || lower === 'vamos a jugar') {
      return { tool: 'game.list', params: {} };
    }
  }

  // 1. Ver chat con otra persona
  if (
    lower.includes('mi chat con') || lower.includes('conversación con') || lower.includes('conversacion con') ||
    lower.includes('qué hablé con') || lower.includes('que hable con') || lower.includes('mensajes con') ||
    lower.includes('ver chat con') || lower.includes('muestra mi chat') || lower.includes('muéstrame mi chat')
  ) {
    const targetMatch = text.replace(/.*(?:chat con|conversación con|conversacion con|hablé con|hable con|mensajes con|muestra mi chat con|muéstrame mi chat con)\s*/i, '').trim();
    return { tool: 'chat.preview', params: { username: targetMatch } };
  }

  // 2. Editar perfil del usuario
  if (
    lower.includes('edita mi perfil') || lower.includes('cambia mi biografía') || lower.includes('cambia mi bio') ||
    lower.includes('cambia mi ciudad') || lower.includes('edita mi profesión') || lower.includes('actualiza mi perfil') ||
    lower.includes('modifica mi perfil')
  ) {
    let bioMatch = text.match(/(?:biografía|bio|descripción)\s+(?:a|por)?\s*(.+)/i);
    let cityMatch = text.match(/(?:ciudad|ubicación)\s+(?:a|por)?\s*([a-záéíóúñ\s]+)/i);
    let profMatch = text.match(/(?:profesión|profesion|trabajo)\s+(?:a|por)?\s*([a-záéíóúñ\s]+)/i);

    return {
      tool: 'user.edit_profile',
      params: {
        bio: bioMatch ? bioMatch[1].trim() : undefined,
        city: cityMatch ? cityMatch[1].trim() : undefined,
        profession: profMatch ? profMatch[1].trim() : undefined,
      }
    };
  }

  // 3. Subir / publicar estado
  if (
    lower.includes('sube un estado') || lower.includes('publica un estado') || lower.includes('pon un estado') ||
    lower.includes('crea un estado') || lower.includes('nuevo estado')
  ) {
    const stText = text.replace(/.*(?:sube|publica|pon|crea)(?:\s+un)?\s+estado(?:\s+que\s+diga|\s+de)?\s*/i, '').trim();
    return { tool: 'status.create', params: { text: stText || 'Compartiendo un momento en Link ✨', duration_hours: 24 } };
  }

  // 4. Eliminar estado
  if (
    lower.includes('elimina mi estado') || lower.includes('borra mi estado') || lower.includes('elimina el estado') ||
    lower.includes('borra el estado')
  ) {
    return { tool: 'status.delete', params: {} };
  }

  // 5. Enviar solicitud de amistad
  if (
    lower.includes('envía solicitud a') || lower.includes('envia solicitud a') || lower.includes('mándale solicitud a') ||
    lower.includes('mandale solicitud a') || lower.includes('solicitud de amistad a') || lower.includes('agrega como amigo a')
  ) {
    const friendMatch = text.replace(/.*(?:solicitud\s+a|solicitud\s+de\s+amistad\s+a|amigo\s+a)\s*/i, '').trim();
    return { tool: 'friend.send_request', params: { username: friendMatch } };
  }

  // 6. YouTube en directo / transmisiones en vivo
  if (
    lower.includes('en directo') || lower.includes('en vivo') || lower.includes('live stream') ||
    lower.includes('directo de youtube') || lower.includes('transmisión en vivo') || lower.includes('transmision en vivo')
  ) {
    const liveTopic = text.replace(/.*(?:en directo|en vivo|live stream|directo de youtube|transmisión en vivo|transmision en vivo)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'youtube.live', params: { query: liveTopic || 'noticias' } };
  }

  // 7. Banco de fotos / Fotos de Stock / Fotos Random / Wikimedia Commons
  if (
    lower.includes('foto random') || lower.includes('fotos random') || lower.includes('imagen random') ||
    lower.includes('imágenes random') || lower.includes('foto al azar') || lower.includes('fotos al azar') ||
    lower.includes('imágenes al azar') || lower.includes('fotos aleatorias') || lower.includes('fotos de wikimedia') ||
    lower.includes('imágenes de wikimedia') || lower.includes('fotos de wikipedia')
  ) {
    const topicMatch = text.replace(/.*(?:foto random|fotos random|imagen random|imágenes random|foto al azar|fotos al azar|imágenes al azar|fotos aleatorias|fotos de wikimedia|imágenes de wikimedia|fotos de wikipedia)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'image.random', params: { topic: topicMatch || 'al azar', count: 4 } };
  }

  if (
    lower.includes('foto de stock') || lower.includes('fotos de stock') || lower.includes('banco de fotos') ||
    lower.includes('imagen de stock') || lower.includes('imágenes de stock') || lower.includes('foto libre') ||
    lower.includes('fotos libres')
  ) {
    const stockTopic = text.replace(/.*(?:foto de stock|fotos de stock|banco de fotos|imagen de stock|imágenes de stock|foto libre|fotos libres)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'stock.photos', params: { query: stockTopic || 'nature' } };
  }

  // 8. Búsqueda de Videos Interna (search_videos) - Pexels/Multiproveedor
  if (
    lower.includes('busca un video') || lower.includes('buscame un video') || lower.includes('búscame un video') ||
    lower.includes('muestra un video') || lower.includes('muestrame un video') || lower.includes('muéstrame un video') ||
    lower.includes('quiero ver un video') || lower.includes('ver un video de') || lower.includes('video de pexels') ||
    lower.includes('video vertical de') || lower.includes('video horizontal de') || lower.includes('videos de')
  ) {
    let orientation = 'landscape';
    if (lower.includes('vertical') || lower.includes('reels') || lower.includes('tiktok') || lower.includes('shorts')) {
      orientation = 'portrait';
    } else if (lower.includes('cuadrado') || lower.includes('square')) {
      orientation = 'square';
    } else if (lower.includes('horizontal')) {
      orientation = 'landscape';
    }

    const videoTopic = text.replace(/.*(?:busca un video|buscame un video|búscame un video|muestra un video|muestrame un video|muéstrame un video|quiero ver un video|ver un video|video de pexels|video vertical|video horizontal|videos)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'search_videos', params: { query: videoTopic || 'nature', orientation } };
  }

  // 8a. Videos gratuitos
  if (
    lower.includes('video gratuito') || lower.includes('videos gratuitos') || lower.includes('contenido gratuito') ||
    lower.includes('video libre') || lower.includes('videos libres')
  ) {
    const vidTopic = text.replace(/.*(?:video gratuito|videos gratuitos|contenido gratuito|video libre|videos libres)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'free.videos', params: { query: vidTopic || 'documentary' } };
  }

  // 8b. GIFs Animados y Stickers en Movimiento
  if (
    lower.includes('gif de') || lower.includes('un gif') || lower.includes('dame un gif') ||
    lower.includes('muéstrame un gif') || lower.includes('muestrame un gif') || lower.includes('sticker animado') ||
    lower.includes('emoji animado') || lower.includes('emojis animados') || lower.includes('sticker que se mueva') ||
    lower.includes('gif animado')
  ) {
    const gifTopic = text.replace(/.*(?:gif de|un gif|dame un gif|muéstrame un gif|muestrame un gif|sticker animado|emoji animado|emojis animados|sticker que se mueva|gif animado)\s*(?:de|sobre)?\s*/i, '').trim();
    return { tool: 'gif.search', params: { query: gifTopic || 'happy' } };
  }

  // 8c. Gráficos 3D Interactivos, Wiggle y Figuras Tridimensionales
  if (
    lower.includes('gráfico 3d') || lower.includes('grafico 3d') || lower.includes('gráficos 3d') ||
    lower.includes('graficos 3d') || lower.includes('wiggle') || lower.includes('efecto 3d') ||
    lower.includes('objeto 3d') || lower.includes('esfera 3d') || lower.includes('cubo 3d') ||
    lower.includes('figura 3d') || lower.includes('animación 3d') || lower.includes('animacion 3d')
  ) {
    let shape = 'cube';
    if (lower.includes('esfera') || lower.includes('globo') || lower.includes('pelota')) shape = 'sphere';
    else if (lower.includes('torus') || lower.includes('anillo') || lower.includes('dona')) shape = 'torus';
    else if (lower.includes('pirámide') || lower.includes('piramide')) shape = 'pyramid';
    return { tool: 'graphics3d.generate', params: { shape, title: 'Visualización 3D Interactiva (Wiggle Depth)', color: '#8b5cf6' } };
  }

  // 9. Enlaces de pago del sistema
  if (
    lower.includes('link de pago') || lower.includes('enlace de pago') || lower.includes('link para pagar') ||
    lower.includes('pagar verificación') || lower.includes('pagar verificacion') || lower.includes('checkout')
  ) {
    return { tool: 'system.payment_link', params: { service: text.includes('verificac') ? 'Verificación Oficial' : 'Servicio Enlace', amount: '5.00' } };
  }

  // 10. DuckDuckGo Search
  if (lower.includes('duckduckgo') || lower.includes('duck duck go')) {
    const ddgQuery = text.replace(/.*(?:duckduckgo|duck duck go)\s*/i, '').trim();
    return { tool: 'duckduckgo.search', params: { query: ddgQuery || text } };
  }

  // 11. Clima y tiempo atmosférico (conversacional)
  if (
    lower.includes('clima') || lower.includes('tiempo hace') || lower.includes('tiempo en') ||
    lower.includes('temperatura en') || lower.includes('va a llover') || lower.includes('pronóstico') ||
    lower.includes('pronostico') || lower.includes('hace frio en') || lower.includes('hace calor en')
  ) {
    const locMatch = text.match(/(?:clima|tiempo|temperatura|llover|pronóstico|pronostico|frio|calor)\s+(?:de|en|para|por)?\s*([a-záéíóúñ\s]+)/i);
    let loc = locMatch ? locMatch[1].replace(/\b(hoy|mañana|esta semana|ahora|por favor)\b/gi, '').trim() : '';
    if (!loc) {
      const words = text.split(/\s+/);
      loc = words.length > 2 ? words.slice(-2).join(' ') : 'La Habana';
    }
    return { tool: 'weather.get', params: { location: loc } };
  }

  // 12. Cotización y precios de Criptomonedas
  if (
    lower.includes('bitcoin') || lower.includes('btc') || lower.includes('ethereum') ||
    lower.includes('eth') || lower.includes('solana') || lower.includes('cripto') ||
    lower.includes('criptomonedas') || lower.includes('precio de btc') || lower.includes('cuanto vale el bitcoin')
  ) {
    let ids = 'bitcoin,ethereum,solana';
    if (lower.includes('bitcoin') || lower.includes('btc')) ids = 'bitcoin';
    else if (lower.includes('ethereum') || lower.includes('eth')) ids = 'ethereum';
    else if (lower.includes('solana') || lower.includes('sol')) ids = 'solana';
    return { tool: 'coingecko.prices', params: { ids } };
  }

  // 13. Conversión de divisas y tasas de cambio
  if (
    lower.includes('convierte') || lower.includes('conversión') || lower.includes('conversion') ||
    lower.includes('cuántos euros son') || lower.includes('cuantos euros son') || lower.includes('cuántos dólares son') ||
    lower.includes('cuantos dolares son') || lower.includes('dólares a euros') || lower.includes('euros a dólares') ||
    lower.includes('tasa de cambio') || lower.includes('tasas de cambio') || lower.includes('divisas hoy')
  ) {
    const convMatch = text.match(/(\d+(?:\.\d+)?)\s*([a-z$€£¥]+)\s*(?:a|en|por)\s*([a-z$€£¥]+)/i);
    if (convMatch) {
      const amount = parseFloat(convMatch[1]);
      const fromStr = convMatch[2].toUpperCase();
      const toStr = convMatch[3].toUpperCase();
      const mapCurrency = (s) => {
        if (s.includes('$') || s.includes('USD') || s.includes('DOLAR')) return 'USD';
        if (s.includes('€') || s.includes('EUR') || s.includes('EURO')) return 'EUR';
        if (s.includes('£') || s.includes('GBP')) return 'GBP';
        if (s.includes('CUP') || s.includes('PESO')) return 'CUP';
        return s;
      };
      return { tool: 'frankfurter.convert', params: { amount: amount || 1, from: mapCurrency(fromStr), to: mapCurrency(toStr) } };
    }
    return { tool: 'exchangerate.latest', params: { base: 'USD' } };
  }

  // 14. Hora mundial
  if (
    lower.includes('hora en') || lower.includes('qué hora es') || lower.includes('que hora es') ||
    lower.includes('hora tiene') || lower.includes('hora actual en')
  ) {
    const locMatch = text.match(/(?:hora\s+(?:en|de|tiene)?)\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].replace(/\b(ahora|por favor)\b/gi, '').trim() : 'La Habana';
    return { tool: 'world.time', params: { location: loc || 'La Habana' } };
  }

  // 15. Chistes y humor
  if (
    lower.includes('chiste') || lower.includes('cuéntame algo gracioso') || lower.includes('cuentame algo gracioso') ||
    lower.includes('dime algo divertido') || lower.includes('hazme reír') || lower.includes('hazme reir')
  ) {
    return { tool: 'joke.get', params: {} };
  }

  // 16. Datos curiosos de números o curiosidades
  if (
    lower.includes('dato curioso del número') || lower.includes('dato curioso del numero') ||
    lower.includes('curiosidad sobre el número') || lower.includes('curiosidad del número') ||
    lower.includes('dato de número') || lower.includes('numbers api')
  ) {
    const numMatch = text.match(/\b\d+\b/);
    return { tool: 'numbers.fact', params: { number: numMatch ? numMatch[0] : 'random', type: 'trivia' } };
  }

  // 17. Consejos y motivación
  if (
    lower.includes('dame un consejo') || lower.includes('necesito un consejo') || lower.includes('dame un tip') ||
    lower.includes('consejo aleatorio') || lower.includes('advice slip')
  ) {
    return { tool: 'advice.slip', params: {} };
  }

  // 18. Recetas de cocina
  if (
    lower.includes('receta de') || lower.includes('cómo preparar') || lower.includes('como preparar') ||
    lower.includes('cómo cocinar') || lower.includes('como cocinar') || lower.includes('ingredientes para')
  ) {
    const dish = text.replace(/.*(?:receta de|cómo preparar|como preparar|cómo cocinar|como cocinar|ingredientes para)\s*/i, '').trim();
    return { tool: 'themealdb.search', params: { query: dish || 'pasta' } };
  }

  // 19. Series y Televisión
  if (
    lower.includes('serie sobre') || lower.includes('serie de tv') || lower.includes('programa de tv') ||
    lower.includes('información de la serie') || lower.includes('informacion de la serie') || lower.includes('tvmaze')
  ) {
    const show = text.replace(/.*(?:serie sobre|serie de tv|programa de tv|información de la serie|informacion de la serie|tvmaze)\s*/i, '').trim();
    return { tool: 'tvmaze.search', params: { query: show || 'breaking bad' } };
  }

  // 20. Wikipedia / Enciclopedia / Quién es / Qué es
  if (
    lower.includes('quién fue') || lower.includes('quien fue') || lower.includes('quién es') || lower.includes('quien es') ||
    lower.includes('biografía de') || lower.includes('biografia de') || lower.includes('qué es') || lower.includes('que es') ||
    lower.includes('historia de') || lower.includes('wikipedia')
  ) {
    if (!lower.includes('en enlace') && !lower.includes('en la plataforma') && !lower.includes('en la red')) {
      const topicMatch = text.replace(/.*(?:quién fue|quien fue|quién es|quien es|biografía de|biografia de|qué es|que es|historia de|wikipedia sobre|wikipedia)\s*/i, '').replace(/(\.|\?|!)+$/, '').trim();
      if (topicMatch && topicMatch.length > 2) {
        return { tool: 'wikipedia.search', params: { query: topicMatch, lang: 'es' } };
      }
    }
  }

  // 21. Agendamiento de Cita o Reunión
  if (
    lower.includes('programa una cita') || lower.includes('programar cita') || lower.includes('agenda una reunion') ||
    lower.includes('agendar cita') || lower.includes('agenda una cita') || lower.includes('reunión con') || lower.includes('cita con')
  ) {
    return { tool: 'user.search_by_interest', params: { interest: text.replace(/.*(?:cita con|reunion con|reunión con|para)\s*/i, '').trim() || 'amigos' } };
  }

  // 22. Búsqueda o consulta de perfil de usuario en la red social Enlace
  if (
    lower.includes('mi perfil') || lower.includes('muéstrame mi perfil') || lower.includes('muestrame mi perfil') ||
    lower.includes('ver mi perfil') || lower.includes('mi información') || lower.includes('mi informacion')
  ) {
    return { tool: 'social.profile', params: { username: 'mi_perfil' } };
  }

  if (
    lower.includes('perfil de') || lower.includes('busca a') || lower.includes('buscar usuario') ||
    lower.includes('ver perfil') || lower.includes('muéstrame el perfil') || lower.includes('muestrame el perfil') ||
    lower.includes('muestra el perfil') || lower.includes('muéstrame a') || lower.includes('muestrame a') ||
    lower.includes('encuentra a') || lower.includes('usuario @') || lower.includes('quién es') || lower.includes('quien es')
  ) {
    const userMatch = text.match(/(?:perfil\s+de|busca\s+a|buscar\s+usuario|ver\s+perfil|muéstrame\s+el\s+perfil\s+de|muestrame\s+el\s+perfil\s+de|muestra\s+el\s+perfil\s+de|muéstrame\s+a|muestrame\s+a|encuentra\s+a|quién\s+es|quien\s+es|usuario\s+@?)\s+@?([a-záéíóúñ0-9._\s]+)/i);
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

  // 23. Búsqueda de usuarios por intereses en Enlace
  if (
    lower.includes('personas que les guste') || lower.includes('personas interesadas en') ||
    lower.includes('buscar por interes') || lower.includes('buscar por interés') || lower.includes('quien le gusta') ||
    lower.includes('gente que le guste') || lower.includes('usuarios que les guste')
  ) {
    const intMatch = text.replace(/.*(?:guste|interesadas en|interés|interes|gustos)\s+/i, '').trim();
    if (intMatch) return { tool: 'user.search_by_interest', params: { interest: intMatch } };
  }

  // 24. Publicaciones en Enlace
  if (
    lower.includes('publicaciones sobre') || lower.includes('posts sobre') || lower.includes('buscar publicaciones') ||
    lower.includes('ver publicaciones') || lower.includes('que han publicado')
  ) {
    const postMatch = text.replace(/.*(?:publicaciones sobre|posts sobre|buscar publicaciones|ver publicaciones|que han publicado|publicaciones de)\s+/i, '').trim();
    if (postMatch) return { tool: 'posts.search', params: { query: postMatch } };
  }

  // 25. Libros y literatura (Open Library)
  if (
    lower.includes('libro') || lower.includes('autor de') || lower.includes('busca el libro') ||
    lower.includes('recomiéndame un libro') || lower.includes('recomiendame un libro') || lower.includes('obras de')
  ) {
    const bookMatch = text.replace(/.*(?:libro sobre|libro de|autor de|busca el libro|recomiéndame un libro|recomiendame un libro|obras de)\s*/i, '').trim();
    if (bookMatch) return { tool: 'openlibrary.search', params: { query: bookMatch } };
  }

  // 26. Países e información geográfica (REST Countries)
  if (
    lower.includes('país') || lower.includes('pais') || lower.includes('capital de') ||
    lower.includes('población de') || lower.includes('bandera de') || lower.includes('datos de')
  ) {
    const countryMatch = text.replace(/.*(?:país|pais|capital de|población de|bandera de|datos de)\s*/i, '').trim();
    if (countryMatch && countryMatch.length > 2) return { tool: 'restcountries.get', params: { country: countryMatch } };
  }

  // 27. Cámaras web en vivo
  if (
    lower.includes('cámara') || lower.includes('camara') || lower.includes('webcam') ||
    lower.includes('muéstrame una cámara') || lower.includes('camara en vivo')
  ) {
    const locMatch = text.match(/(?:cámara|camara|webcam)\s+(?:de|en)?\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].replace(/pública|publica|en vivo/gi, '').trim() : 'Tokio';
    return { tool: 'webcam.search', params: { location: loc || 'Tokio' } };
  }

  // 28. Vídeos en YouTube
  if (
    lower.includes('youtube') || lower.includes('vídeo de') || lower.includes('video de') ||
    lower.includes('buscar video') || lower.includes('búscame un video') || lower.includes('buscame un video')
  ) {
    const qMatch = text.replace(/.*(?:youtube|vídeo de|video de|buscar video|búscame un video|buscame un video)\s*/i, '').trim();
    return { tool: 'youtube.search', params: { query: qMatch || text } };
  }

  // 29. NASA, Imágenes Espaciales y Satelitales
  if (
    lower.includes('imagen del dia nasa') || lower.includes('nasa apod') || lower.includes('foto del dia de la nasa') ||
    lower.includes('imagen de la nasa') || lower.includes('foto de la nasa') || lower.includes('imagen nasa') ||
    lower.includes('foto de la tierra') || lower.includes('tierra desde el espacio') || lower.includes('astronomia nasa')
  ) {
    return { tool: 'nasa.apod', params: {} };
  }

  if (
    lower.includes('imagen de el satelite') || lower.includes('imagen del satelite') || lower.includes('imagen del satélite') ||
    lower.includes('foto del satelite') || lower.includes('foto del satélite') || lower.includes('imagen satelital') ||
    lower.includes('foto satelital') || lower.includes('vista de satelite') || lower.includes('vista de satélite')
  ) {
    const satPrompt = text.replace(/.*(?:imagen|foto|vista)(?:\s+de|\s+del)?\s*(?:el\s+)?(?:satelite|satélite|satelital)\s*(?:de|en)?\s*/i, '').trim();
    return { tool: 'image.generate', params: { prompt: `Realistic high-resolution satellite imagery photo of ${satPrompt || 'Earth landscape view from space orbit'}`, enhance: true } };
  }

  // 30. Edición de fotos / imágenes (lenguaje natural)
  if (
    lower.includes('edita esta foto') || lower.includes('edita esta imagen') ||
    lower.includes('edita la foto') || lower.includes('edita la imagen') ||
    lower.includes('editar foto') || lower.includes('editar imagen') ||
    lower.includes('modifica esta foto') || lower.includes('modifica esta imagen') ||
    lower.includes('modifica la foto') || lower.includes('modifica la imagen') ||
    lower.includes('retoca esta foto') || lower.includes('retoca esta imagen') ||
    lower.includes('quiero editar') || lower.includes('puedes editar') ||
    lower.includes('cambia la foto') || lower.includes('cambia la imagen') ||
    lower.includes('hazle un cambio') || lower.includes('filtro a la foto') ||
    lower.includes('filtro a la imagen')
  ) {
    const editPrompt = text.replace(/.*(?:edita|modifica|retoca|cambia|editar|modificar)(?:\s+esta|\s+la)?\s+(?:foto|imagen)\s*(?:para\s+que|para|de|con)?\s*/i, '').trim();
    return { tool: 'image.edit', params: { prompt: editPrompt || text } };
  }

  // 31. Generación de imágenes
  if (
    lower.startsWith('dibuja') || lower.startsWith('genera una imagen') || lower.startsWith('crea una imagen') ||
    lower.includes('imagen de') || lower.includes('haz una imagen') || lower.includes('diseña una imagen') ||
    lower.includes('muestrame una imagen') || lower.includes('muéstrame una imagen') || lower.includes('dame una imagen')
  ) {
    const promptMatch = text.replace(/.*(?:dibuja|genera una imagen de|crea una imagen de|imagen de|haz una imagen de|diseña una imagen de|muestrame una imagen de|muéstrame una imagen de|dame una imagen de)\s*/i, '').trim();
    return { tool: 'image.generate', params: { prompt: promptMatch || text, enhance: true } };
  }

  // 31. Traducción de texto
  if (
    lower.startsWith('traduce') || lower.includes('traducir al') || lower.includes('cómo se dice') || lower.includes('como se dice')
  ) {
    let targetLang = 'en';
    if (lower.includes('español') || lower.includes('espanol')) targetLang = 'es';
    else if (lower.includes('francés') || lower.includes('frances')) targetLang = 'fr';
    else if (lower.includes('alemán') || lower.includes('aleman')) targetLang = 'de';
    else if (lower.includes('italiano')) targetLang = 'it';

    const textToTranslate = text.replace(/.*(?:traduce|traducir al \w+|cómo se dice|como se dice)\s*/i, '').trim();
    return { tool: 'translate', params: { text: textToTranslate || text, target_lang: targetLang } };
  }

  // 32. Cálculos matemáticos y estadísticas
  if (
    lower.startsWith('calcula') || lower.startsWith('cuánto es') || lower.startsWith('cuanto es') ||
    lower.match(/^[\d\s+\-*/().^%]+$/)
  ) {
    const expr = text.replace(/^(calcula|cuánto es|cuanto es)/i, '').trim();
    return { tool: 'math.calculate', params: { expression: expr || text } };
  }
  if (lower.includes('es primo') || lower.includes('numero primo') || lower.includes('número primo')) {
    const numMatch = text.match(/\b\d+\b/);
    if (numMatch) return { tool: 'math.prime_check', params: { number: parseInt(numMatch[0], 10) } };
  }

  // 33. Herramientas de desarrollo / GitHub / NPM
  if (lower.includes('github') || lower.includes('repositorio de') || lower.includes('repositorios sobre')) {
    const q = text.replace(/.*(?:github|repositorio de|repositorios sobre)\s*/i, '').trim();
    return { tool: 'github.search', params: { query: q || 'node.js' } };
  }
  if (lower.includes('npm') || lower.includes('paquete de node') || lower.includes('paquete npm')) {
    const pkg = text.replace(/.*(?:npm|paquete de node|paquete npm)\s*/i, '').trim();
    return { tool: 'npm.search', params: { package: pkg || 'express' } };
  }
  if (lower.includes('obras de arte') || lower.includes('met museum') || lower.includes('museo metropolitano')) {
    const q = text.replace(/.*(?:obras de arte|met museum|museo metropolitano)\s*/i, '').trim();
    return { tool: 'metmuseum.search', params: { query: q || 'sunflowers' } };
  }

  // 34. Herramientas internas (Crypto, Texto)
  if (lower.startsWith('hash') || lower.includes('sha256') || lower.includes('md5 de')) {
    const txt = text.replace(/^(hash|sha256|md5 de|generar hash de)/i, '').trim();
    return { tool: 'crypto.hash', params: { text: txt || text } };
  }
  if (lower.includes('generar uuid') || lower.includes('dame un uuid')) {
    return { tool: 'crypto.uuid', params: {} };
  }
  if (lower.includes('métricas de texto') || lower.includes('contar palabras') || lower.includes('estadísticas de texto')) {
    return { tool: 'text.stats', params: { text } };
  }

  // 35. Búsqueda web abierta
  if (
    lower.startsWith('busca') || lower.startsWith('buscar en la web') || lower.includes('noticias sobre') ||
    lower.includes('investiga sobre') || lower.includes('últimas noticias') || lower.includes('ultimas noticias')
  ) {
    const q = text.replace(/^(busca|buscar en la web|noticias sobre|investiga sobre|últimas noticias sobre|ultimas noticias sobre)/i, '').trim();
    return { tool: 'web.search', params: { query: q || text } };
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
  getGeminiToolDeclarations,
  executeMission,
  tools,
};
