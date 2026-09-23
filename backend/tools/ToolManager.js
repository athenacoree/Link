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
const dynamicEngine = require('./dynamicApiEngine');

// Módulos añadidos de APIs públicas externas y Utilidades internas
const externalApis = require('./externalApis');
const internalTools = require('./internalTools');

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
      name: 'web.search',
      description: 'Busca información actualizada en la web.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'ip.geolocation',
      description: 'Obtiene la geolocalización e información de red por dirección IP.',
      parameters: { type: 'object', properties: { ip: { type: 'string' } } }
    },
    {
      name: 'user.search_by_interest',
      description: 'Busca usuarios en Enlace por sus intereses o gustos.',
      parameters: { type: 'object', properties: { interest: { type: 'string' } }, required: ['interest'] }
    },
    {
      name: 'posts.search',
      description: 'Busca publicaciones compartidas en la plataforma Enlace por palabras clave.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    },
    {
      name: 'dynamic.discover',
      description: 'Descubre e integra automáticamente nuevas APIs públicas o especificaciones OpenAPI en la plataforma.',
      parameters: { type: 'object', properties: { query: { type: 'string' } } }
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
    },

    // Definiciones de las 20 APIs Externas
    { name: 'nasa.apod', description: 'Obtiene la imagen astronómica del día de la NASA.', parameters: { type: 'object', properties: { date: { type: 'string' } } } },
    { name: 'nasa.asteroids', description: 'Consulta asteroides cercanos a la Tierra hoy vía NASA NEO.', parameters: { type: 'object', properties: {} } },
    { name: 'metmuseum.search', description: 'Busca obras de arte en el Metropolitan Museum of Art.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'poetrydb.search', description: 'Busca poemas por título o autor en PoetryDB.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'exchangerate.latest', description: 'Obtiene tasas de cambio de divisas en tiempo real.', parameters: { type: 'object', properties: { base: { type: 'string' } } } },
    { name: 'coinpaprika.info', description: 'Consulta precio e información de una criptomoneda en CoinPaprika.', parameters: { type: 'object', properties: { coinId: { type: 'string' } } } },
    { name: 'openmeteo.forecast', description: 'Consulta el pronóstico del tiempo con coordenadas en Open-Meteo.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } } } },
    { name: 'sunrise_sunset.get', description: 'Obtiene la hora de amanecer y atardecer por coordenadas.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } } },
    { name: 'clinicaltrials.search', description: 'Busca estudios y ensayos clínicos en ClinicalTrials.gov.', parameters: { type: 'object', properties: { condition: { type: 'string' } }, required: ['condition'] } },
    { name: 'rcsb.pdb_search', description: 'Busca estructuras de proteínas en Protein Data Bank (PDB).', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'dictionary.lookup', description: 'Busca definiciones, pronunciación y sinónimos en inglés.', parameters: { type: 'object', properties: { word: { type: 'string' } }, required: ['word'] } },
    { name: 'datamuse.words', description: 'Encuentra palabras relacionadas, rimas y sinónimos en Datamuse.', parameters: { type: 'object', properties: { word: { type: 'string' }, mode: { type: 'string' } }, required: ['word'] } },
    { name: 'dns.doh', description: 'Realiza consultas DNS sobre HTTPS (DoH).', parameters: { type: 'object', properties: { domain: { type: 'string' }, rrType: { type: 'string' } }, required: ['domain'] } },
    { name: 'httpbin.inspect', description: 'Inspecciona peticiones y cabeceras de red.', parameters: { type: 'object', properties: {} } },
    { name: 'deckofcards.draw', description: 'Simula el robo de cartas de una baraja.', parameters: { type: 'object', properties: { count: { type: 'number' } } } },
    { name: 'bored.activity', description: 'Obtiene actividades sugeridas para el aburrimiento.', parameters: { type: 'object', properties: { type: { type: 'string' } } } },
    { name: 'jikan.anime', description: 'Busca series de anime y manga en Jikan / MyAnimeList.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'gutendex.search', description: 'Busca libros clásicos de dominio público en Proyecto Gutenberg.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'advice.slip', description: 'Obtiene un consejo o frase motivacional aleatoria.', parameters: { type: 'object', properties: {} } },
    { name: 'agify.predict', description: 'Predice la edad estimada según el nombre de una persona.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },

    // Definiciones de las 20 Herramientas Internas
    { name: 'text.stats', description: 'Calcula métricas de texto: palabras, caracteres, oraciones y tiempo de lectura.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text.diff', description: 'Compara dos textos para encontrar líneas diferentes y comunes.', parameters: { type: 'object', properties: { textA: { type: 'string' }, textB: { type: 'string' } }, required: ['textA', 'textB'] } },
    { name: 'text.clean_html', description: 'Limpia etiquetas HTML y devuelve texto plano limpio.', parameters: { type: 'object', properties: { htmlContent: { type: 'string' } }, required: ['htmlContent'] } },
    { name: 'text.slugify', description: 'Genera un slug URL-friendly a partir de un título o texto.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'crypto.hash', description: 'Genera un hash criptográfico (MD5, SHA1, SHA256, SHA512).', parameters: { type: 'object', properties: { text: { type: 'string' }, algorithm: { type: 'string' } }, required: ['text'] } },
    { name: 'crypto.uuid', description: 'Genera un identificador único global (UUID v4).', parameters: { type: 'object', properties: {} } },
    { name: 'encoding.base64', description: 'Codifica o decodifica texto en formato Base64.', parameters: { type: 'object', properties: { data: { type: 'string' }, mode: { type: 'string' } }, required: ['data'] } },
    { name: 'encoding.url', description: 'Codifica o decodifica componentes de URL.', parameters: { type: 'object', properties: { text: { type: 'string' }, mode: { type: 'string' } }, required: ['text'] } },
    { name: 'date.format', description: 'Formatea fechas a un formato legible con soporte de zonas horarias.', parameters: { type: 'object', properties: { dateString: { type: 'string' }, locale: { type: 'string' }, timeZone: { type: 'string' } } } },
    { name: 'date.diff', description: 'Calcula la diferencia en días, horas, minutos y ms entre dos fechas.', parameters: { type: 'object', properties: { startDateStr: { type: 'string' }, endDateStr: { type: 'string' } }, required: ['startDateStr'] } },
    { name: 'date.business_days', description: 'Calcula la cantidad de días hábiles entre dos fechas.', parameters: { type: 'object', properties: { startDateStr: { type: 'string' }, endDateStr: { type: 'string' } }, required: ['startDateStr', 'endDateStr'] } },
    { name: 'data.json_validate', description: 'Valida la sintaxis de una cadena JSON y la formatea.', parameters: { type: 'object', properties: { jsonString: { type: 'string' } }, required: ['jsonString'] } },
    { name: 'math.stats', description: 'Calcula estadísticas (media, mediana, min, max, desviación estándar) sobre un arreglo de números.', parameters: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'math.prime_check', description: 'Verifica si un número es primo y calcula sus factores primos.', parameters: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'data.csv_to_json', description: 'Convierte datos en formato CSV estructurado a un objeto JSON.', parameters: { type: 'object', properties: { csvText: { type: 'string' }, delimiter: { type: 'string' } }, required: ['csvText'] } },
    { name: 'utility.lorem', description: 'Genera texto de relleno Lorem Ipsum.', parameters: { type: 'object', properties: { paragraphsCount: { type: 'number' } } } },
    { name: 'utility.regex_test', description: 'Evalúa y prueba una expresión regular sobre un texto.', parameters: { type: 'object', properties: { pattern: { type: 'string' }, text: { type: 'string' }, flags: { type: 'string' } }, required: ['pattern', 'text'] } },
    { name: 'utility.color_convert', description: 'Convierte un color HEX a formato RGB y valores numéricos.', parameters: { type: 'object', properties: { colorInput: { type: 'string' } }, required: ['colorInput'] } },
    { name: 'utility.random_generator', description: 'Genera contraseñas o cadenas aleatorias seguras.', parameters: { type: 'object', properties: { length: { type: 'number' } } } },
    { name: 'utility.markdown_to_plain', description: 'Convierte un texto con formato Markdown a texto plano limpio.', parameters: { type: 'object', properties: { markdownText: { type: 'string' } }, required: ['markdownText'] } },
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

// Sincronizar de forma síncrona/inicial el catálogo de APIs dinámicas
dynamicEngine.syncDynamicApisWithToolManager({ tools }).catch(() => {});

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
 * Detecta intenciones de herramientas mediante lenguaje natural conversacional y contextual
 */
function detectToolIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // 1. Clima y tiempo atmosférico (conversacional)
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

  // 2. Cotización y precios de Criptomonedas
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

  // 3. Conversión de divisas y tasas de cambio
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

  // 4. Hora mundial
  if (
    lower.includes('hora en') || lower.includes('qué hora es') || lower.includes('que hora es') ||
    lower.includes('hora tiene') || lower.includes('hora actual en')
  ) {
    const locMatch = text.match(/(?:hora\s+(?:en|de|tiene)?)\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].replace(/\b(ahora|por favor)\b/gi, '').trim() : 'La Habana';
    return { tool: 'world.time', params: { location: loc || 'La Habana' } };
  }

  // 5. Chistes y humor
  if (
    lower.includes('chiste') || lower.includes('cuéntame algo gracioso') || lower.includes('cuentame algo gracioso') ||
    lower.includes('dime algo divertido') || lower.includes('hazme reír') || lower.includes('hazme reir')
  ) {
    return { tool: 'joke.get', params: {} };
  }

  // 6. Datos curiosos de números o curiosidades
  if (
    lower.includes('dato curioso del número') || lower.includes('dato curioso del numero') ||
    lower.includes('curiosidad sobre el número') || lower.includes('curiosidad del número') ||
    lower.includes('dato de número') || lower.includes('numbers api')
  ) {
    const numMatch = text.match(/\b\d+\b/);
    return { tool: 'numbers.fact', params: { number: numMatch ? numMatch[0] : 'random', type: 'trivia' } };
  }

  // 7. Consejos y motivación
  if (
    lower.includes('dame un consejo') || lower.includes('necesito un consejo') || lower.includes('dame un tip') ||
    lower.includes('consejo aleatorio') || lower.includes('advice slip')
  ) {
    return { tool: 'advice.slip', params: {} };
  }

  // 8. Recetas de cocina
  if (
    lower.includes('receta de') || lower.includes('cómo preparar') || lower.includes('como preparar') ||
    lower.includes('cómo cocinar') || lower.includes('como cocinar') || lower.includes('ingredientes para')
  ) {
    const dish = text.replace(/.*(?:receta de|cómo preparar|como preparar|cómo cocinar|como cocinar|ingredientes para)\s*/i, '').trim();
    return { tool: 'themealdb.search', params: { query: dish || 'pasta' } };
  }

  // 9. Series y Televisión
  if (
    lower.includes('serie sobre') || lower.includes('serie de tv') || lower.includes('programa de tv') ||
    lower.includes('información de la serie') || lower.includes('informacion de la serie') || lower.includes('tvmaze')
  ) {
    const show = text.replace(/.*(?:serie sobre|serie de tv|programa de tv|información de la serie|informacion de la serie|tvmaze)\s*/i, '').trim();
    return { tool: 'tvmaze.search', params: { query: show || 'breaking bad' } };
  }

  // 10. Wikipedia / Enciclopedia / Quién es / Qué es
  if (
    lower.includes('quién fue') || lower.includes('quien fue') || lower.includes('quién es') || lower.includes('quien es') ||
    lower.includes('biografía de') || lower.includes('biografia de') || lower.includes('qué es') || lower.includes('que es') ||
    lower.includes('historia de') || lower.includes('wikipedia')
  ) {
    // Si menciona perfil o usuario de la red social Enlace, dejar pasar a la herramienta social
    if (!lower.includes('en enlace') && !lower.includes('en la plataforma') && !lower.includes('en la red')) {
      const topicMatch = text.replace(/.*(?:quién fue|quien fue|quién es|quien es|biografía de|biografia de|qué es|que es|historia de|wikipedia sobre|wikipedia)\s*/i, '').replace(/(\.|\?|!)+$/, '').trim();
      if (topicMatch && topicMatch.length > 2) {
        return { tool: 'wikipedia.search', params: { query: topicMatch, lang: 'es' } };
      }
    }
  }

  // 11. Búsqueda de perfil de usuario en la red social Enlace
  if (
    lower.includes('perfil de') || lower.includes('busca a') || lower.includes('buscar usuario') ||
    lower.includes('ver perfil') || lower.includes('muéstrame a') || lower.includes('muestrame a') ||
    lower.includes('encuentra a') || lower.includes('usuario @')
  ) {
    const userMatch = text.match(/(?:perfil\s+de|busca\s+a|buscar\s+usuario|ver\s+perfil|muéstrame\s+a|muestrame\s+a|encuentra\s+a|usuario\s+@?)\s+@?([a-záéíóúñ0-9._\s]+)/i);
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

  // 12. Búsqueda de usuarios por intereses en Enlace
  if (
    lower.includes('personas que les guste') || lower.includes('personas interesadas en') ||
    lower.includes('buscar por interes') || lower.includes('buscar por interés') || lower.includes('quien le gusta') ||
    lower.includes('gente que le guste') || lower.includes('usuarios que les guste')
  ) {
    const intMatch = text.replace(/.*(?:guste|interesadas en|interés|interes|gustos)\s+/i, '').trim();
    if (intMatch) return { tool: 'user.search_by_interest', params: { interest: intMatch } };
  }

  // 13. Publicaciones en Enlace
  if (
    lower.includes('publicaciones sobre') || lower.includes('posts sobre') || lower.includes('buscar publicaciones') ||
    lower.includes('ver publicaciones') || lower.includes('que han publicado')
  ) {
    const postMatch = text.replace(/.*(?:publicaciones sobre|posts sobre|buscar publicaciones|ver publicaciones|que han publicado|publicaciones de)\s+/i, '').trim();
    if (postMatch) return { tool: 'posts.search', params: { query: postMatch } };
  }

  // 14. Libros y literatura (Open Library)
  if (
    lower.includes('libro') || lower.includes('autor de') || lower.includes('busca el libro') ||
    lower.includes('recomiéndame un libro') || lower.includes('recomiendame un libro') || lower.includes('obras de')
  ) {
    const bookMatch = text.replace(/.*(?:libro sobre|libro de|autor de|busca el libro|recomiéndame un libro|recomiendame un libro|obras de)\s*/i, '').trim();
    if (bookMatch) return { tool: 'openlibrary.search', params: { query: bookMatch } };
  }

  // 15. Países e información geográfica (REST Countries)
  if (
    lower.includes('país') || lower.includes('pais') || lower.includes('capital de') ||
    lower.includes('población de') || lower.includes('bandera de') || lower.includes('datos de')
  ) {
    const countryMatch = text.replace(/.*(?:país|pais|capital de|población de|bandera de|datos de)\s*/i, '').trim();
    if (countryMatch && countryMatch.length > 2) return { tool: 'restcountries.get', params: { country: countryMatch } };
  }

  // 16. Cámaras web en vivo
  if (
    lower.includes('cámara') || lower.includes('camara') || lower.includes('webcam') ||
    lower.includes('muéstrame una cámara') || lower.includes('camara en vivo')
  ) {
    const locMatch = text.match(/(?:cámara|camara|webcam)\s+(?:de|en)?\s*([a-záéíóúñ\s]+)/i);
    const loc = locMatch ? locMatch[1].replace(/pública|publica|en vivo/gi, '').trim() : 'Tokio';
    return { tool: 'webcam.search', params: { location: loc || 'Tokio' } };
  }

  // 17. Vídeos en YouTube
  if (
    lower.includes('youtube') || lower.includes('vídeo de') || lower.includes('video de') ||
    lower.includes('buscar video') || lower.includes('búscame un video') || lower.includes('buscame un video')
  ) {
    const qMatch = text.replace(/.*(?:youtube|vídeo de|video de|buscar video|búscame un video|buscame un video)\s*/i, '').trim();
    return { tool: 'youtube.search', params: { query: qMatch || text } };
  }

  // 18. NASA y Obras de Arte (Prioridad antes de generación genérica de imágenes)
  if (lower.includes('imagen del dia nasa') || lower.includes('nasa apod') || lower.includes('foto del dia de la nasa')) {
    return { tool: 'nasa.apod', params: {} };
  }

  // 19. Generación de imágenes
  if (
    lower.startsWith('dibuja') || lower.startsWith('genera una imagen') || lower.startsWith('crea una imagen') ||
    lower.includes('imagen de') || lower.includes('haz una imagen') || lower.includes('diseña una imagen')
  ) {
    const promptMatch = text.replace(/.*(?:dibuja|genera una imagen de|crea una imagen de|imagen de|haz una imagen de|diseña una imagen de)\s*/i, '').trim();
    return { tool: 'image.generate', params: { prompt: promptMatch || text, enhance: true } };
  }

  // 20. Traducción de texto
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

  // 21. Cálculos matemáticos y estadísticas
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

  // 22. Herramientas de desarrollo / GitHub / NPM
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

  // 23. Herramientas internas (Crypto, Texto)
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

  // 24. Búsqueda web abierta (fallback para consultas informativas / investigativas)
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
