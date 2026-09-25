/**
 * Módulo de Integración con Link Games (Biblioteca Oficial de Minijuegos)
 * Repositorio Oficial: https://athenacoree.github.io/link-games-/
 */

const LINK_GAMES_BASE_URL = 'https://athenacoree.github.io/link-games-/';
const GAMES_CATALOG_URL = 'https://athenacoree.github.io/link-games-/games.json';

// Diccionario con metadata rica por omisión
const RICH_METADATA_MAP = {
  tictactoe: { mode: 'both', difficulty: 'fácil', duration: '2 min', tags: ['rápido', '2 jugadores', 'amigos', 'clásico', 'mesa'] },
  connect4: { mode: 'both', difficulty: 'fácil', duration: '3 min', tags: ['rápido', '2 jugadores', 'amigos', 'estrategia'] },
  pong: { mode: 'both', difficulty: 'fácil', duration: '2 min', tags: ['retro', '2 jugadores', 'rápido', 'arcade'] },
  trivia: { mode: 'solo', difficulty: 'medio', duration: '5 min', tags: ['preguntas', 'conocimiento', 'quiz', 'mental'] },
  memory: { mode: 'solo', difficulty: 'fácil', duration: '3 min', tags: ['cartas', 'memoria', 'cerebro', 'rápido'] },
  snake: { mode: 'solo', difficulty: 'fácil', duration: '3 min', tags: ['clásico', 'arcade', 'retro', 'rápido'] },
  '2048': { mode: 'solo', difficulty: 'medio', duration: '5-10 min', tags: ['números', 'puzzle', 'estrategia', 'mental'] },
  flappy: { mode: 'solo', difficulty: 'difícil', duration: '2 min', tags: ['reflejos', 'arcade', 'rápido', 'desafío'] },
  breakout: { mode: 'solo', difficulty: 'fácil', duration: '4 min', tags: ['bloques', 'pelota', 'arcade', 'retro'] },
  wordle: { mode: 'solo', difficulty: 'medio', duration: '4 min', tags: ['palabras', 'letras', 'puzzle', 'diario'] },
  minesweeper: { mode: 'solo', difficulty: 'medio', duration: '5 min', tags: ['minas', 'lógica', 'estrategia', 'clásico'] },
  simon: { mode: 'solo', difficulty: 'fácil', duration: '3 min', tags: ['colores', 'memoria', 'secuencia', 'sonido'] },
  sudoku: { mode: 'solo', difficulty: 'difícil', duration: '10 min', tags: ['números', 'lógica', 'puzzle', 'relajante'] },
  spaceinvaders: { mode: 'solo', difficulty: 'medio', duration: '4 min', tags: ['espacio', 'disparos', 'arcade', 'retro'] },
  whackamole: { mode: 'solo', difficulty: 'fácil', duration: '2 min', tags: ['reflejos', 'topos', 'rápido', 'divertido'] },
  solitaire: { mode: 'solo', difficulty: 'medio', duration: '8 min', tags: ['cartas', 'solitario', 'clásico', 'relajante'] },
  checkers: { mode: 'both', difficulty: 'medio', duration: '5 min', tags: ['damas', '2 jugadores', 'amigos', 'estrategia', 'mesa'] },
  hanoi: { mode: 'solo', difficulty: 'difícil', duration: '5 min', tags: ['torres', 'lógica', 'puzzle', 'matemáticas'] },
  pacman: { mode: 'solo', difficulty: 'medio', duration: '4 min', tags: ['laberinto', 'fantasma', 'arcade', 'retro'] },
  typing: { mode: 'solo', difficulty: 'medio', duration: '3 min', tags: ['teclado', 'mecanografía', 'velocidad', 'agilidad'] },
  towerstack: { mode: 'solo', difficulty: 'fácil', duration: '2 min', tags: ['apilar', 'bloques', 'torre', 'reflejos'] },
  match3: { mode: 'solo', difficulty: 'fácil', duration: '5 min', tags: ['gemas', 'conecta3', 'puzzle', 'casual'] },
  mathquiz: { mode: 'solo', difficulty: 'fácil', duration: '2 min', tags: ['matemáticas', 'cálculo', 'rápido', 'educativo'] },
  doodlejump: { mode: 'solo', difficulty: 'medio', duration: '3 min', tags: ['salto', 'infinito', 'arcade', 'divertido'] },
  lightsout: { mode: 'solo', difficulty: 'difícil', duration: '4 min', tags: ['luces', 'lógica', 'puzzle', 'desafío'] },
  hangman: { mode: 'solo', difficulty: 'fácil', duration: '3 min', tags: ['ahorcado', 'palabras', 'letras', 'rápido'] },
  wordsearch: { mode: 'solo', difficulty: 'fácil', duration: '5 min', tags: ['sopa de letras', 'palabras', 'puzzle', 'relajante'] }
};

// Catálogo estático de respaldo para garantizar funcionamiento resiliente sin internet
const FALLBACK_CATALOG = [
  { id: 'tictactoe', name: 'Tres en Raya', description: 'Clásico juego de Tres en Raya con modo 1 vs AI o 2 jugadores local.', category: 'board', players: 2, mobile: true, url: './tictactoe/' },
  { id: 'connect4', name: '4 en Raya', description: 'Conecta 4 fichas de tu color en línea horizontal, vertical o diagonal.', category: 'board', players: 2, mobile: true, url: './connect4/' },
  { id: 'pong', name: 'Pong Clásico', description: 'El clásico juego retro de paletas y pelota en 2D.', category: 'arcade', players: 2, mobile: true, url: './pong/' },
  { id: 'trivia', name: 'Trivia Quiz', description: 'Pon a prueba tus conocimientos en tecnología, cultura general, ciencia y cine.', category: 'trivia', players: 1, mobile: true, url: './trivia/' },
  { id: 'memory', name: 'Juego de Memoria', description: 'Encuentra las parejas de cartas iguales en el menor número de movimientos.', category: 'puzzle', players: 1, mobile: true, url: './memory/' },
  { id: 'snake', name: 'Serpiente Classic', description: 'Guía a la serpiente para comer alimentos sin chocar contra las paredes.', category: 'arcade', players: 1, mobile: true, url: './snake/' },
  { id: '2048', name: '2048 Puzzle', description: 'Combina fichas del mismo valor hasta alcanzar la casilla 2048.', category: 'puzzle', players: 1, mobile: true, url: './2048/' },
  { id: 'flappy', name: 'Flappy Link', description: 'Esquiva las tuberías volando con el pajarito Link.', category: 'arcade', players: 1, mobile: true, url: './flappy/' },
  { id: 'breakout', name: 'Brick Breaker', description: 'Destruye los bloques rebotando la pelota sobre la paleta.', category: 'arcade', players: 1, mobile: true, url: './breakout/' },
  { id: 'wordle', name: 'Adivina la Palabra', description: 'Adivina la palabra oculta de 5 letras en 6 intentos.', category: 'puzzle', players: 1, mobile: true, url: './wordle/' },
  { id: 'minesweeper', name: 'Buscaminas', description: 'Limpia el campo de minas sin hacer detonar ninguna.', category: 'board', players: 1, mobile: true, url: './minesweeper/' },
  { id: 'simon', name: 'Secuencia de Colores', description: 'Memoriza y repite la secuencia de colores creciente.', category: 'puzzle', players: 1, mobile: true, url: './simon/' },
  { id: 'sudoku', name: 'Sudoku Puzzle', description: 'Rellena la cuadrícula de 9x9 con números del 1 al 9.', category: 'board', players: 1, mobile: true, url: './sudoku/' },
  { id: 'spaceinvaders', name: 'Invasores del Espacio', description: 'Defiende la Tierra destruyendo la flota alienígena.', category: 'arcade', players: 1, mobile: true, url: './spaceinvaders/' },
  { id: 'whackamole', name: 'Atrapa al Topo', description: 'Golpea a los topos que asoman la cabeza antes de que desaparezcan.', category: 'arcade', players: 1, mobile: true, url: './whackamole/' },
  { id: 'solitaire', name: 'Solitario Klondike', description: 'Ordena las barajas de cartas por palo y orden descendente.', category: 'board', players: 1, mobile: true, url: './solitaire/' },
  { id: 'checkers', name: 'Damas Clásicas', description: 'Captura todas las fichas del oponente en el tablero de damas.', category: 'board', players: 2, mobile: true, url: './checkers/' },
  { id: 'hanoi', name: 'Torres de Hanói', description: 'Mueve los discos a la tercera torre respetando las reglas de tamaño.', category: 'puzzle', players: 1, mobile: true, url: './hanoi/' },
  { id: 'pacman', name: 'Laberinto Pac-Runner', description: 'Recoge los puntos en el laberinto evitando al fantasma.', category: 'arcade', players: 1, mobile: true, url: './pacman/' },
  { id: 'typing', name: 'Mecanografía Veloz', description: 'Pon a prueba tu velocidad escribiendo palabras antes de que expire el tiempo.', category: 'arcade', players: 1, mobile: true, url: './typing/' },
  { id: 'towerstack', name: 'Torre de Bloques', description: 'Apila bloques en movimiento para construir la torre más alta.', category: 'arcade', players: 1, mobile: true, url: './towerstack/' },
  { id: 'match3', name: 'Conecta 3', description: 'Intercambia gemas para conectar 3 o más del mismo tipo.', category: 'puzzle', players: 1, mobile: true, url: './match3/' },
  { id: 'mathquiz', name: 'Reto Matemático', description: 'Resuelve rápidas operaciones aritméticas contra el reloj.', category: 'trivia', players: 1, mobile: true, url: './mathquiz/' },
  { id: 'doodlejump', name: 'Salto Infinito', description: 'Salta de plataforma en plataforma para llegar lo más alto posible.', category: 'arcade', players: 1, mobile: true, url: './doodlejump/' },
  { id: 'lightsout', name: 'Luces Fuera', description: 'Apaga todas las luces del tablero haciendo clic en las casillas.', category: 'puzzle', players: 1, mobile: true, url: './lightsout/' },
  { id: 'hangman', name: 'El Ahorcado', description: 'Adivina la palabra letra por letra antes de agotar tus oportunidades.', category: 'trivia', players: 1, mobile: true, url: './hangman/' },
  { id: 'wordsearch', name: 'Sopa de Letras', description: 'Encuentra las palabras ocultas dentro de la cuadrícula de letras.', category: 'puzzle', players: 1, mobile: true, url: './wordsearch/' }
];

let cachedCatalog = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Convierte una ruta relativa de minijuego (ej. "./snake/") a la URL absoluta oficial de Link Games
 */
function resolveGameUrl(relUrl, gameId) {
  if (!relUrl) return `${LINK_GAMES_BASE_URL}${gameId}/`;
  if (relUrl.startsWith('http://') || relUrl.startsWith('https://')) return relUrl;
  const clean = relUrl.replace(/^\.\//, '').replace(/^\//, '');
  return `${LINK_GAMES_BASE_URL}${clean}`;
}

function enrichGameMetadata(item) {
  const meta = RICH_METADATA_MAP[item.id] || {};
  const numPlayers = item.players || meta.players || 1;
  const mode = item.mode || meta.mode || (numPlayers > 1 ? 'both' : 'solo');
  const difficulty = item.difficulty || meta.difficulty || 'fácil';
  const duration = item.duration || meta.duration || '3-5 min';
  const tags = item.tags && Array.isArray(item.tags) ? item.tags : (meta.tags || [item.category || 'juego']);

  return {
    ...item,
    players: numPlayers,
    mode,
    difficulty,
    duration,
    mobile: item.mobile !== false,
    tags,
    full_url: resolveGameUrl(item.url, item.id),
  };
}

/**
 * Consulta el catálogo oficial de Link Games desde la web o caché
 */
async function getGameCatalog() {
  const now = Date.now();
  if (cachedCatalog && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(GAMES_CATALOG_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedCatalog = data.map(enrichGameMetadata);
        lastFetchTime = now;
        return cachedCatalog;
      }
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('[Link Games] No se pudo cargar catálogo remoto, utilizando catálogo estático local:', err.message);
  }

  cachedCatalog = FALLBACK_CATALOG.map(enrichGameMetadata);
  lastFetchTime = now;
  return cachedCatalog;
}

/**
 * game.list: Lista o busca minijuegos en el catálogo con metadata completa
 */
async function listGames(params = {}) {
  const catalog = await getGameCatalog();
  const catFilter = (params.category || params.cat || '').trim().toLowerCase();
  const qFilter = (params.query || params.q || params.search || '').trim().toLowerCase();

  let filtered = catalog;

  if (catFilter && catFilter !== 'all' && catFilter !== 'todos') {
    filtered = filtered.filter(g => (g.category || '').toLowerCase() === catFilter);
  }

  if (qFilter) {
    filtered = filtered.filter(g =>
      (g.name || '').toLowerCase().includes(qFilter) ||
      (g.description || '').toLowerCase().includes(qFilter) ||
      (g.id || '').toLowerCase().includes(qFilter) ||
      (g.category || '').toLowerCase().includes(qFilter) ||
      (g.mode || '').toLowerCase().includes(qFilter) ||
      (g.tags || []).some(t => t.toLowerCase().includes(qFilter))
    );
  }

  const resultGames = filtered.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    players: g.players,
    mode: g.mode,
    difficulty: g.difficulty,
    duration: g.duration,
    mobile: g.mobile,
    tags: g.tags,
    url: g.full_url,
  }));

  return {
    type: 'game_list_card',
    count: resultGames.length,
    total_in_catalog: catalog.length,
    games: resultGames,
  };
}

/**
 * game.launch: Resuelve el gameId y genera el comando/tarjeta para abrir el juego
 */
async function launchGame(params = {}) {
  const rawId = (params.gameId || params.game_id || params.id || params.query || params.game || '').trim().toLowerCase();

  const catalog = await getGameCatalog();

  if (!rawId) {
    return {
      error: 'Debes especificar el identificador o nombre del juego (gameId) para abrirlo.',
      available_games: catalog.map(g => ({ id: g.id, name: g.name }))
    };
  }

  // 1. Coincidencia exacta por ID
  let match = catalog.find(g => g.id.toLowerCase() === rawId);

  // 2. Coincidencia si el usuario dijo e.g. "snake", "2048", "tres en raya", "memoria"
  if (!match) {
    const cleanId = rawId.replace(/^(juego|jugar|abre|abrir|un|de|el)\s+/gi, '').trim();
    match = catalog.find(g => g.id.toLowerCase() === cleanId || g.name.toLowerCase().includes(cleanId) || cleanId.includes(g.id.toLowerCase()));
  }

  // 3. Mapeos o alias comunes en español
  if (!match) {
    const aliases = {
      'serpiente': 'snake',
      'culebra': 'snake',
      'tres en raya': 'tictactoe',
      '3 en raya': 'tictactoe',
      'tateti': 'tictactoe',
      'cuatro en raya': 'connect4',
      '4 en raya': 'connect4',
      'memoria': 'memory',
      'ahorcado': 'hangman',
      'buscaminas': 'minesweeper',
      'flappy bird': 'flappy',
      'pajarito': 'flappy',
      'solitario': 'solitaire',
      'damas': 'checkers',
      'torres de hanoi': 'hanoi',
      'sopa de letras': 'wordsearch',
      'reto matematico': 'mathquiz',
      'matematicas': 'mathquiz',
      'invisibles': 'spaceinvaders',
      'invasores': 'spaceinvaders'
    };

    for (const [key, val] of Object.entries(aliases)) {
      if (rawId.includes(key)) {
        match = catalog.find(g => g.id === val);
        if (match) break;
      }
    }
  }

  if (!match) {
    return {
      error: `No se encontró ningún juego para '${rawId}' en el catálogo oficial.`,
      available_games: catalog.slice(0, 10).map(g => ({ id: g.id, name: g.name })),
    };
  }

  const gameUrl = match.full_url;

  return {
    type: 'game_launch_card',
    data: {
      game_id: match.id,
      name: match.name,
      description: match.description,
      category: match.category,
      players: match.players || 1,
      mobile: match.mobile !== false,
      url: gameUrl,
      action: 'open_game',
    }
  };
}

module.exports = {
  getGameCatalog,
  listGames,
  launchGame,
  LINK_GAMES_BASE_URL,
};
