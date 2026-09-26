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

async function getCapabilities(params = {}) {
  const gamesList = await gameTool.listGames({});
  const gameTools = (gamesList.games || []).map(g => ({
    id: `game_${g.id}`,
    name: g.name,
    icon: getGameIcon(g.id),
    description: g.description || `Juega a ${g.name} en Link`,
    tool: 'game.launch',
    params: { gameId: g.id },
    prompt_example: `Quiero jugar ${g.name}`
  }));

  function getGameIcon(id) {
    const svgIcons = {
      tictactoe: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/><circle cx="12" cy="12" r="9" stroke="#3b82f6" stroke-width="2.5" fill="none"/></svg>`,
      connect4: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="3" fill="#1e293b" stroke="#3b82f6"/><circle cx="7" cy="8" r="2" fill="#ef4444"/><circle cx="12" cy="8" r="2" fill="#eab308"/><circle cx="17" cy="8" r="2" fill="#ef4444"/><circle cx="7" cy="14" r="2" fill="#eab308"/><circle cx="12" cy="14" r="2" fill="#ef4444"/><circle cx="17" cy="14" r="2" fill="#eab308"/></svg>`,
      pong: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="2" y="6" width="3" height="12" rx="1" fill="#60a5fa"/><rect x="19" y="8" width="3" height="12" rx="1" fill="#60a5fa"/><circle cx="12" cy="12" r="2.5" fill="#f59e0b"/><line x1="12" y1="2" x2="12" y2="22" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2 2"/></svg>`,
      trivia: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6"/></svg>`,
      memory: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="2" fill="rgba(59,130,246,0.2)"/><rect x="13" y="3" width="8" height="8" rx="2" fill="rgba(59,130,246,0.2)"/><rect x="3" y="13" width="8" height="8" rx="2" fill="rgba(59,130,246,0.2)"/><rect x="13" y="13" width="8" height="8" rx="2" fill="rgba(59,130,246,0.2)"/></svg>`,
      snake: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8a2 2 0 0 0 2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-3"/><circle cx="4" cy="12" r="1.5" fill="#10b981"/></svg>`,
      '2048': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4" fill="rgba(245,158,11,0.15)"/><text x="12" y="15" font-size="9" font-weight="900" fill="#f59e0b" text-anchor="middle" font-family="sans-serif">2048</text></svg>`,
      flappy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M4 14a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z" fill="rgba(234,179,8,0.2)"/><circle cx="14" cy="12" r="1.5" fill="#fff"/><path d="M16 13h4l-2 2z" fill="#f97316"/></svg>`,
      breakout: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><rect x="3" y="4" width="5" height="3" rx="1" fill="#ec4899"/><rect x="9.5" y="4" width="5" height="3" rx="1" fill="#8b5cf6"/><rect x="16" y="4" width="5" height="3" rx="1" fill="#ec4899"/><rect x="7" y="19" width="10" height="2" rx="1" fill="#3b82f6"/><circle cx="12" cy="13" r="2" fill="#f59e0b"/></svg>`,
      wordle: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="5" height="5" rx="1" fill="#10b981"/><rect x="9.5" y="3" width="5" height="5" rx="1" fill="#f59e0b"/><rect x="16" y="3" width="5" height="5" rx="1" fill="#374151"/><rect x="3" y="9.5" width="5" height="5" rx="1" fill="#10b981"/><text x="12" y="21" font-size="8" font-weight="800" fill="#10b981" text-anchor="middle">ABC</text></svg>`,
      minesweeper: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="6" fill="#ef4444"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><circle cx="10" cy="10" r="1.5" fill="#fff"/></svg>`,
      simon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2A10 10 0 0 0 2 12h9V2z" fill="#ef4444"/><path d="M13 2v9h9A10 10 0 0 0 13 2z" fill="#3b82f6"/><path d="M2 13a10 10 0 0 0 10 10v-9H2z" fill="#eab308"/><path d="M13 13v9a10 10 0 0 0 10-10h-9z" fill="#10b981"/><circle cx="12" cy="12" r="3" fill="#0f172a"/></svg>`,
      sudoku: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
      spaceinvaders: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M6 6h12v4H6zM4 10h16v4H4zM8 14h2v4H8zM14 14h2v4h-2z" fill="#a855f7"/></svg>`,
      whackamole: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      solitaire: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect x="5" y="4" width="14" height="16" rx="2" fill="rgba(239,68,68,0.1)"/><path d="M12 7.5L13.5 10H16.5L14 12L15 15L12 13.5L9 15L10 12L7.5 10H10.5L12 7.5Z" fill="#ef4444"/></svg>`,
      checkers: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2.5" fill="#ef4444"/><circle cx="16" cy="16" r="2.5" fill="#f8fafc"/></svg>`,
      hanoi: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><line x1="2" y1="20" x2="22" y2="20"/><line x1="6" y1="8" x2="6" y2="20"/><line x1="12" y1="8" x2="12" y2="20"/><line x1="18" y1="8" x2="18" y2="20"/><rect x="9" y="16" width="6" height="3" rx="1" fill="#a855f7"/><rect x="10" y="12" width="4" height="3" rx="1" fill="#ec4899"/></svg>`,
      pacman: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10h-6l6-5a10 10 0 0 0-10-5z" fill="#eab308"/><circle cx="19" cy="12" r="1.5" fill="#f8fafc"/></svg>`,
      typing: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><line x1="6" y1="8" x2="8" y2="8"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="16" y1="8" x2="18" y2="8"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
      towerstack: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="4" y="16" width="16" height="4" rx="1" fill="#10b981"/><rect x="6" y="10" width="12" height="4" rx="1" fill="#3b82f6"/><rect x="8" y="4" width="8" height="4" rx="1" fill="#f59e0b"/></svg>`,
      match3: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><path d="M6 3l4 4-4 4-4-4 4-4z" fill="#ec4899"/><path d="M18 3l4 4-4 4-4-4 4-4z" fill="#3b82f6"/><path d="M12 13l4 4-4 4-4-4 4-4z" fill="#10b981"/></svg>`,
      mathquiz: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="19" x2="11" y2="19"/></svg>`,
      doodlejump: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 4a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" fill="rgba(16,185,129,0.2)"/><line x1="5" y1="18" x2="10" y2="18" stroke="#f59e0b" stroke-width="3"/><line x1="14" y1="12" x2="19" y2="12" stroke="#f59e0b" stroke-width="3"/></svg>`,
      lightsout: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="2" fill="#f59e0b"/><circle cx="16" cy="8" r="2" fill="#334155"/><circle cx="8" cy="16" r="2" fill="#334155"/><circle cx="16" cy="16" r="2" fill="#f59e0b"/></svg>`,
      hangman: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M4 20h16M7 20V4h8v3M15 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM13 9v5M11 11h4M12 14l-2 4M12 14l2 4"/></svg>`,
      wordsearch: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="7" y="11" font-size="7" font-weight="800" fill="#a855f7">A</text><text x="14" y="11" font-size="7" font-weight="800" fill="#a855f7">B</text><text x="7" y="18" font-size="7" font-weight="800" fill="#a855f7">C</text><text x="14" y="18" font-size="7" font-weight="800" fill="#a855f7">D</text></svg>`
    };
    return svgIcons[id] || `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><polygon points="6 2 18 2 18 6 6 6"/><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="#8b5cf6"/><circle cx="18" cy="13" r="1" fill="#8b5cf6"/></svg>`;
  }

  const qvapayOfficialSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#00D09C"/><path d="M12 5.5a6.5 6.5 0 1 0 4.16 11.5l2.42 2.42a1 1 0 0 0 1.42-1.42l-2.32-2.32A6.5 6.5 0 0 0 12 5.5zm0 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z" fill="#003125"/></svg>`;

  const categories = [
    {
      id: 'conexiones',
      name: 'Conexiones y APIs externas',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
      tools: [
        { id: 'wikipedia.search', name: 'Wikipedia API', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#e2e8f0"/><text x="12" y="17" font-size="15" font-weight="900" font-family="serif" fill="#0f172a" text-anchor="middle">W</text></svg>`, description: 'Busca artículos y referencias en la enciclopedia Wikipedia', tool: 'wikipedia.search', params: { query: 'Tecnología' }, prompt_example: 'Busca en Wikipedia sobre tecnología' },
        { id: 'github.search', name: 'GitHub API', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fill="#f8fafc"/></svg>`, description: 'Explora repositorios, código y desarrolladores en GitHub', tool: 'github.search', params: { query: 'JavaScript' }, prompt_example: 'Busca proyectos en GitHub' },
        { id: 'frankfurter.convert', name: 'Divisas API', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, description: 'Consulta tasas de cambio e intercambio de divisas oficiales', tool: 'frankfurter.convert', params: { amount: 10, from: 'USD', to: 'EUR' }, prompt_example: 'Convierte 10 dólares a euros' },
        { id: 'coingecko.prices', name: 'Cripto API', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M15 9.5a2.5 2.5 0 0 0-2.5-2.5H10v10h2.5a2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2-2.45A2.5 2.5 0 0 0 15 9.5z" stroke="#fff" stroke-width="2"/></svg>`, description: 'Precios de criptomonedas en tiempo real vía CoinGecko', tool: 'coingecko.prices', params: { ids: 'bitcoin,ethereum,solana' }, prompt_example: 'Precio de Bitcoin' },
        { id: 'osm.search', name: 'OpenStreetMap API', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ef4444"/></svg>`, description: 'Geolocalización y mapas globales vía OpenStreetMap', tool: 'osm.search', params: { query: 'La Habana' }, prompt_example: 'Busca en el mapa La Habana' }
      ]
    },
    {
      id: 'multimedia',
      name: 'Ver Video y Multimedia',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
      tools: [
        { id: 'search_videos', name: 'Ver Videos HD', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`, description: 'Busca y reproduce videos libres de alta calidad en HD', tool: 'search_videos', params: { query: 'naturaleza', orientation: 'landscape' }, prompt_example: 'Muéstrame un video de naturaleza' },
        { id: 'youtube.search', name: 'YouTube Video', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`, description: 'Busca videos, tráilers y canales en YouTube', tool: 'youtube.search', params: { query: 'Música de fondo' }, prompt_example: 'Busca un video en YouTube' },
        { id: 'youtube.live', name: 'En Vivo / Directos', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="3" fill="#ef4444"/><path d="M4.93 4.93a10 10 0 0 1 14.14 0"/><path d="M7.76 7.76a6 6 0 0 1 8.48 0"/></svg>`, description: 'Transmisiones en vivo e impresiones en directo', tool: 'youtube.live', params: { query: 'Noticias en vivo' }, prompt_example: 'Transmisiones en vivo' },
        { id: 'wikimedia.search', name: 'Wikimedia Media', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`, description: 'Imágenes y archivos de Wikimedia Commons', tool: 'wikimedia.search', params: { query: 'Galaxia' }, prompt_example: 'Fotos de Wikimedia' }
      ]
    },
    {
      id: 'herramientas',
      name: 'Herramientas y Clima',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      tools: [
        { id: 'weather.get', name: 'Clima Actual', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/><circle cx="12" cy="12" r="4" fill="#eab308"/></svg>`, description: 'Consulta el tiempo y pronóstico meteorológico en tiempo real', tool: 'weather.get', params: { location: 'auto' }, prompt_example: 'Dame el clima actual' },
        { id: 'translate', name: 'Traductor', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, description: 'Traduce textos entre múltiples idiomas al instante', tool: 'translate', params: { text: 'Hola, ¿cómo estás?', target_lang: 'en' }, prompt_example: 'Traduce al inglés: Hola' },
        { id: 'math.calculate', name: 'Calculadora', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/></svg>`, description: 'Cálculos matemáticos exactos y fórmulas', tool: 'math.calculate', params: { expression: '128 * 4 + 50' }, prompt_example: 'Calcula 128 * 4 + 50' },
        { id: 'world.time', name: 'Hora Mundial', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, description: 'Consulta la hora actual en cualquier ciudad del mundo', tool: 'world.time', params: { location: 'Madrid' }, prompt_example: '¿Qué hora es en Tokio?' },
        { id: 'doc.extract', name: 'Lector de Docs', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, description: 'Extrae y analiza texto de archivos y PDF adjuntos', tool: 'doc.extract', params: {}, prompt_example: 'Extrae texto del documento' }
      ]
    },
    {
      id: 'juegos',
      name: 'Juegos',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><polygon points="6 2 18 2 18 6 6 6"/><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="#8b5cf6"/><circle cx="18" cy="13" r="1" fill="#8b5cf6"/></svg>`,
      tools: gameTools
    },
    {
      id: 'entretenimiento',
      name: 'Entretenimiento',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      tools: [
        { id: 'gif.search', name: 'GIFs Animados', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><text x="12" y="15" font-size="8" font-weight="900" fill="#ec4899" text-anchor="middle">GIF</text></svg>`, description: 'Busca y comparte GIFs animados en el chat', tool: 'gif.search', params: { query: 'alegre' }, prompt_example: 'Muéstrame un GIF divertido' },
        { id: 'sticker.animated', name: 'Stickers', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="rgba(234,179,8,0.2)"/></svg>`, description: 'Colección de stickers animados y expresivos', tool: 'sticker.animated', params: { category: 'happy' }, prompt_example: 'Muéstrame stickers animados' },
        { id: 'graphics3d.generate', name: 'Gráfico 3D', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`, description: 'Genera figuras 3D interactivas con rotación y Wiggle', tool: 'graphics3d.generate', params: { shape: 'cube', title: 'Cubo 3D Interactivo' }, prompt_example: 'Genera una figura 3D' },
        { id: 'joke.get', name: 'Chistes', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`, description: 'Ríete con chistes divertidos y humor', tool: 'joke.get', params: {}, prompt_example: 'Cuéntame un chiste' },
        { id: 'numbers.fact', name: 'Datos de Números', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`, description: 'Curiosidades y datos interesantes sobre números', tool: 'numbers.fact', params: { number: 'random' }, prompt_example: 'Dime un dato curioso sobre números' },
        { id: 'advice.slip', name: 'Consejos', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`, description: 'Recibe consejos e inspiración cotidiana', tool: 'advice.slip', params: {}, prompt_example: 'Dame un consejo' }
      ]
    },
    {
      id: 'busqueda',
      name: 'Búsqueda',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      tools: [
        { id: 'web.search', name: 'Búsqueda Web', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, description: 'Busca información fresca y actualizada en la web', tool: 'web.search', params: { query: 'Últimas noticias' }, prompt_example: 'Busca noticias sobre ciencia' },
        { id: 'duckduckgo.search', name: 'DuckDuckGo', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12c2 0 3-2 4-2s2 2 4 2"/><circle cx="9" cy="9" r="1" fill="#f97316"/></svg>`, description: 'Búsqueda web directa vía DuckDuckGo API', tool: 'duckduckgo.search', params: { query: 'Open source' }, prompt_example: 'Busca en DuckDuckGo' },
        { id: 'youtube.search', name: 'YouTube', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`, description: 'Busca videos e información en YouTube', tool: 'youtube.search', params: { query: 'Música de fondo' }, prompt_example: 'Busca un video de música en YouTube' },
        { id: 'youtube.live', name: 'Directos YouTube', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="3" fill="#ef4444"/><path d="M4.93 4.93a10 10 0 0 1 14.14 0"/><path d="M7.76 7.76a6 6 0 0 1 8.48 0"/></svg>`, description: 'Transmisiones y eventos en vivo en directo', tool: 'youtube.live', params: { query: 'Noticias en vivo' }, prompt_example: 'Busca transmisiones en vivo' },
        { id: 'search_videos', name: 'Videos HD', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`, description: 'Encuentra videos libres en HD con reproductor integrado', tool: 'search_videos', params: { query: 'naturaleza', orientation: 'landscape' }, prompt_example: 'Muéstrame un video de naturaleza' },
        { id: 'wikimedia.search', name: 'Wikimedia', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`, description: 'Busca fotos y archivos libres de Wikimedia Commons', tool: 'wikimedia.search', params: { query: 'Espacio exterior' }, prompt_example: 'Fotos de Wikimedia Commons' },
        { id: 'stock.photos', name: 'Banco de Fotos', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`, description: 'Galería de fotos de alta calidad de stock', tool: 'stock.photos', params: { query: 'tecnología' }, prompt_example: 'Muestra fotos de stock de tecnología' },
        { id: 'openlibrary.search', name: 'Open Library', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`, description: 'Busca libros, autores y obras literarias', tool: 'openlibrary.search', params: { query: 'Cien años de soledad' }, prompt_example: 'Busca el libro Cien años de soledad' }
      ]
    },
    {
      id: 'informacion',
      name: 'Información',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      tools: [
        { id: 'nasa.apod', name: 'NASA APOD', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`, description: 'La foto astronómica del día provista por la NASA', tool: 'nasa.apod', params: {}, prompt_example: 'Muéstrame la imagen del día de la NASA' },
        { id: 'coingecko.prices', name: 'Criptomonedas', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M15 9.5a2.5 2.5 0 0 0-2.5-2.5H10v10h2.5a2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2-2.45A2.5 2.5 0 0 0 15 9.5z" stroke="#fff" stroke-width="2"/></svg>`, description: 'Precios en tiempo real de Bitcoin, Ethereum y Solana', tool: 'coingecko.prices', params: { ids: 'bitcoin,ethereum,solana' }, prompt_example: '¿Cuál es el precio de Bitcoin?' },
        { id: 'themealdb.search', name: 'Recetas', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`, description: 'Busca recetas, platillos e ingredientes culinarios', tool: 'themealdb.search', params: { query: 'pasta' }, prompt_example: 'Busca una receta de pasta' },
        { id: 'tvmaze.search', name: 'Series TV', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`, description: 'Información de programas, series y shows de TV', tool: 'tvmaze.search', params: { query: 'Breaking Bad' }, prompt_example: 'Información sobre la serie Breaking Bad' },
        { id: 'restcountries.get', name: 'Países del Mundo', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`, description: 'Capitales, población, banderas y datos de países', tool: 'restcountries.get', params: { country: 'Cuba' }, prompt_example: 'Datos del país España' },
        { id: 'osm.search', name: 'Mapas OSM', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ef4444"/></svg>`, description: 'Lugares y geolocalización en OpenStreetMap', tool: 'osm.search', params: { query: 'La Habana' }, prompt_example: 'Busca en el mapa La Habana' }
      ]
    },
    {
      id: 'pagos',
      name: 'Pagos',
      icon: qvapayOfficialSvg,
      tools: [
        { id: 'system.payment_link', name: 'Pago QvaPay', icon: qvapayOfficialSvg, description: 'Genera enlaces de pago y facturas oficiales con QvaPay API', tool: 'system.payment_link', params: { service: 'Servicio Enlace', amount: '5.00' }, prompt_example: 'Genera un enlace de pago' }
      ]
    },
    {
      id: 'funciones_link',
      name: 'Funciones de Link',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      tools: [
        { id: 'social.profile', name: 'Buscar Perfil', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`, description: 'Encuentra perfiles de personas registradas en Link', tool: 'social.profile', params: { username: 'admin' }, prompt_example: 'Busca el perfil de admin' },
        { id: 'user.search_by_interest', name: 'Buscar por Gustos', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, description: 'Encuentra usuarios según pasatiempos e intereses', tool: 'user.search_by_interest', params: { interest: 'música' }, prompt_example: 'Busca personas interesadas en música' },
        { id: 'posts.search', name: 'Publicaciones', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, description: 'Busca publicaciones compartidas en el feed social', tool: 'posts.search', params: { query: 'tecnología' }, prompt_example: 'Busca publicaciones sobre tecnología' },
        { id: 'user.edit_profile', name: 'Editar Perfil', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, description: 'Actualiza tu biografía, ciudad o profesión en Link', tool: 'user.edit_profile', params: {}, prompt_example: 'Edita mi biografía de perfil' },
        { id: 'status.create', name: 'Publicar Estado', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`, description: 'Comparte un estado temporal de 24 horas en tu perfil', tool: 'status.create', params: { text: 'Compartiendo un momento en Link ✨' }, prompt_example: 'Publica un estado' },
        { id: 'friend.send_request', name: 'Agregar Amigo', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>`, description: 'Envía una solicitud de amistad a otro usuario', tool: 'friend.send_request', params: { username: 'usuario' }, prompt_example: 'Envía solicitud de amistad' },
        { id: 'chat.preview', name: 'Vista Previa Chat', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`, description: 'Muestra los mensajes recientes en un chat privado', tool: 'chat.preview', params: {}, prompt_example: 'Muestra mi chat con un amigo' },
        { id: 'appointment.create', name: 'Agendar Cita', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, description: 'Programa una cita o reunión con otro usuario de Link', tool: 'appointment.create', params: { guest_username: 'amigo', title: 'Reunión de proyectos' }, prompt_example: 'Agenda una cita con un amigo' },
        { id: 'reminder.create', name: 'Crear Recordatorio', icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, description: 'Crea un recordatorio para tus actividades importantes', tool: 'reminder.create', params: { title: 'Comprar boletos', note: 'Mañana por la tarde' }, prompt_example: 'Crea un recordatorio' }
      ]
    }
  ];

  return {
    type: 'capabilities_card',
    data: {
      title: 'Conexiones y Capacidades de Link',
      description: 'Explora todas las herramientas, juegos y conexiones disponibles:',
      categories: categories
    }
  };
}

const tools = {
  'system.capabilities': (params) => getCapabilities(params),
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
  'appointment.create': (params, requesterId) => userActionTools.createAppointment(params, requesterId),
  'reminder.create': (params, requesterId) => userActionTools.createReminder(params, requesterId),

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

  // Experiencias Multimedia e Interactivas de Lab AI
  'ailab.experience.list': async () => {
    const aiLabService = require('../services/aiLabService');
    const events = await aiLabService.getEvents();
    return {
      type: 'experience_events_card',
      data: {
        events: (events || []).map(e => ({
          id: e.id,
          title: e.title,
          experience_title: e.experience_title,
          content_type: e.content_type,
          scheduled_at: e.scheduled_at,
          status: e.status
        }))
      }
    };
  },
  'ailab.experience.open': async (params) => {
    const aiLabService = require('../services/aiLabService');
    const activeEvt = params && params.eventId ? await aiLabService.getEventById(params.eventId) : await aiLabService.getActiveEvent();
    if (!activeEvt) {
      return { type: 'experience_card', data: { error: 'No hay experiencias multimedia activas en este momento.' } };
    }
    const sync = await aiLabService.getEventSyncInfo(activeEvt.id);
    return {
      type: 'experience_card',
      data: sync
    };
  },
  'ailab.experience.interact': async (params, requesterId) => {
    const aiLabService = require('../services/aiLabService');
    const { eventId, interactionType, question, options, duration } = params || {};
    if (!eventId) return { error: 'eventId es requerido para la interacción.' };
    const interaction = await aiLabService.recordEventInteraction({
      eventId,
      userId: requesterId,
      userName: 'Mia AI Host',
      interactionType: interactionType || 'question',
      data: { question, options, duration: duration || 15 }
    });
    return { type: 'experience_interaction_card', data: interaction };
  },

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
      name: 'system.capabilities',
      description: 'Muestra el catálogo interactivo de capacidades, herramientas y juegos disponibles en Link agrupados por categorías.',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
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
      description: 'Busca un perfil de usuario registrado en la plataforma Enlace por su nombre de usuario, nombre, o cuando se solicite ver el perfil de alguien (ej. @usuario, admin, "mi perfil").',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Nombre de usuario, @username o nombre de la persona en Enlace' }
        },
        required: ['username']
      }
    },
    {
      name: 'user.search_by_interest',
      description: 'Busca usuarios en Enlace según sus gustos, intereses, pasatiempos, biografía, profesión, ubicación o ciudad (ej. "de La Habana", "le guste la música", "Santiago").',
      parameters: {
        type: 'object',
        properties: {
          interest: { type: 'string', description: 'Interés, pasatiempo, ciudad o característica a buscar (ej. música, La Habana, baile, programación)' }
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
      description: 'Genera un enlace de pago o factura oficial de QvaPay para un servicio (ej. verificación de cuenta, compra de usuario).',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'Nombre o descripción del servicio a pagar' },
          amount: { type: 'string', description: 'Monto en USD (ej. 5.00)' }
        }
      }
    },
    {
      name: 'gif.search',
      description: 'Busca y muestra un GIF animado en el chat según una emoción o búsqueda.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término o tema del GIF (ej. divertido, risa, hola, baile)' }
        },
        required: ['query']
      }
    },
    {
      name: 'sticker.animated',
      description: 'Busca y muestra stickers animados expresivos en el chat.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Categoría del sticker (ej. happy, love, laugh, party)' }
        }
      }
    },
    {
      name: 'graphics3d.generate',
      description: 'Genera una figura tridimensional interactiva en 3D con efecto Wiggle y rotación en el chat.',
      parameters: {
        type: 'object',
        properties: {
          shape: { type: 'string', description: 'Forma geométrica 3D: cube, sphere, torus, pyramid' },
          title: { type: 'string', description: 'Título del gráfico 3D' }
        }
      }
    },
    {
      name: 'joke.get',
      description: 'Obtiene un chiste divertido o frase humorística.',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'advice.slip',
      description: 'Obtiene un consejo o reflexión inspiradora.',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'frankfurter.convert',
      description: 'Convierte montos entre divisas (USD, EUR, GBP, CUP, etc.).',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Monto a convertir' },
          from: { type: 'string', description: 'Moneda origen (ej. USD)' },
          to: { type: 'string', description: 'Moneda destino (ej. EUR)' }
        }
      }
    },
    {
      name: 'restcountries.get',
      description: 'Obtiene información geográfica y datos sobre un país.',
      parameters: {
        type: 'object',
        properties: {
          country: { type: 'string', description: 'Nombre del país' }
        },
        required: ['country']
      }
    },
    {
      name: 'ailab.experience.list',
      description: 'Lista los eventos y experiencias multimedia compartidas activas y programadas en Lab AI.',
      parameters: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'ailab.experience.open',
      description: 'Abre y sincroniza la experiencia multimedia pública compartida activa en Lab AI (videos, audios o libros).',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID opcional del evento a sincronizar' }
        }
      }
    },
    {
      name: 'ailab.experience.interact',
      description: 'Permite a Mia lanzar una encuesta, pregunta o interacción durante la experiencia compartida.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID del evento activo' },
          question: { type: 'string', description: 'Pregunta para la audiencia' },
          options: { type: 'array', items: { type: 'string' }, description: 'Opciones de encuesta' }
        },
        required: ['eventId', 'question']
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

  // -2. Experiencias Multimedia e Eventos IA
  if (
    lower.includes('ver eventos multimedia') || lower.includes('eventos de lab ai') ||
    lower.includes('experiencias multimedia') || lower.includes('qué eventos hay') ||
    lower.includes('que eventos hay') || lower.includes('lista de eventos')
  ) {
    return { tool: 'ailab.experience.list', params: {} };
  }

  if (
    lower.includes('abrir experiencia') || lower.includes('entrar al evento') ||
    lower.includes('unirse al evento') || lower.includes('ver la experiencia') ||
    lower.includes('ver la película') || lower.includes('ver el video compartido')
  ) {
    return { tool: 'ailab.experience.open', params: {} };
  }

  // -1. Capacidades de Link (Consultas sobre herramientas, funciones y capacidades disponibles)
  if (
    lower.includes('qué puedes hacer') || lower.includes('que puedes hacer') ||
    lower.includes('para qué sirves') || lower.includes('para que sirves') ||
    lower.includes('qué herramientas tienes') || lower.includes('que herramientas tienes') ||
    lower.includes('qué puedo hacer en link') || lower.includes('que puedo hacer en link') ||
    lower.includes('muéstrame tus funciones') || lower.includes('muestrame tus funciones') ||
    lower.includes('muéstrame tus herramientas') || lower.includes('muestrame tus herramientas') ||
    lower.includes('qué funciones tienes') || lower.includes('que funciones tienes') ||
    lower.includes('mis capacidades') || lower.includes('capacidades de link') ||
    lower.includes('tus capacidades') || lower.includes('qué capacidades tienes') ||
    lower.includes('ver herramientas') || lower.includes('qué juegos tienes') || lower.includes('que juegos tienes')
  ) {
    return { tool: 'system.capabilities', params: {} };
  }

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

    if (
      lower.includes('quiero jugar') || lower.includes('vamos a jugar') ||
      lower.includes('pon un juego') || lower.includes('lanzar un juego') ||
      lower.includes('enseñame un juego') || lower.includes('enseñame juegos')
    ) {
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
