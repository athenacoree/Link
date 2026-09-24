/**
 * PRUEBAS AUTOMATIZADAS: INTEGRACIÓN DE LINK GAMES (GAME.LIST & GAME.LAUNCH)
 */

const assert = require('assert');
const gameTool = require('../tools/gameTool');
const ToolManager = require('../tools/ToolManager');

async function runGamesTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE LINK GAMES ===\n');

  // 1. Obtención del Catálogo
  console.log('1. Probando getGameCatalog()...');
  const catalog = await gameTool.getGameCatalog();
  assert.ok(Array.isArray(catalog), 'El catálogo debe ser un arreglo');
  assert.ok(catalog.length >= 20, 'El catálogo debe contener al menos 20 minijuegos');
  const snakeEntry = catalog.find(g => g.id === 'snake');
  assert.ok(snakeEntry, 'Debe incluir el juego "snake"');
  assert.strictEqual(snakeEntry.full_url, 'https://athenacoree.github.io/link-games-/snake/', 'La URL de Snake debe ser la ruta real de Link Games');
  console.log(`   ✅ Catálogo cargado con ${catalog.length} minijuegos reales.`);

  // 2. Ejecución de game.list
  console.log('2. Probando herramienta game.list...');
  const listAll = await gameTool.listGames({});
  assert.strictEqual(listAll.type, 'game_list_card', 'game.list debe retornar tipo game_list_card');
  assert.ok(listAll.games.length > 0, 'game.list debe retornar lista de juegos');

  const listArcade = await gameTool.listGames({ category: 'arcade' });
  assert.ok(listArcade.games.every(g => g.category.toLowerCase() === 'arcade'), 'Filtrado por categoría arcade debe ser exacto');
  console.log('   ✅ game.list ejecutado y filtrado correctamente.');

  // 3. Ejecución de game.launch
  console.log('3. Probando herramienta game.launch...');
  const launchSnake = await gameTool.launchGame({ gameId: 'snake' });
  assert.strictEqual(launchSnake.type, 'game_launch_card', 'game.launch debe retornar tipo game_launch_card');
  assert.strictEqual(launchSnake.data.game_id, 'snake');
  assert.strictEqual(launchSnake.data.url, 'https://athenacoree.github.io/link-games-/snake/', 'URL de Snake verificada');
  assert.strictEqual(launchSnake.data.action, 'open_game');

  const launch2048 = await gameTool.launchGame({ gameId: '2048' });
  assert.strictEqual(launch2048.data.game_id, '2048');
  assert.strictEqual(launch2048.data.url, 'https://athenacoree.github.io/link-games-/2048/', 'URL de 2048 verificada');

  const launchInvalid = await gameTool.launchGame({ gameId: 'juego_inexistente_xyz' });
  assert.ok(launchInvalid.error, 'game.launch con ID inválido debe retornar mensaje de error');
  assert.ok(Array.isArray(launchInvalid.available_games), 'game.launch debe listar juegos disponibles');
  console.log('   ✅ game.launch ejecutado sin inventar URLs.');

  // 4. Detección de intenciones en lenguaje natural (detectToolIntent)
  console.log('4. Probando detectToolIntent() para minijuegos...');
  const intentList = ToolManager.detectToolIntent('muéstrame los juegos');
  assert.deepStrictEqual(intentList, { tool: 'game.list', params: {} });

  const intentSnake = ToolManager.detectToolIntent('abre Snake');
  assert.deepStrictEqual(intentSnake, { tool: 'game.launch', params: { gameId: 'snake' } });

  const intent2048 = ToolManager.detectToolIntent('quiero jugar 2048');
  assert.deepStrictEqual(intent2048, { tool: 'game.launch', params: { gameId: '2048' } });

  const intentMemoria = ToolManager.detectToolIntent('abre un juego de memoria');
  assert.deepStrictEqual(intentMemoria, { tool: 'game.launch', params: { gameId: 'memory' } });
  console.log('   ✅ Detección de intenciones en lenguaje natural verificada.');

  console.log('\n=== TODAS LAS PRUEBAS DE LINK GAMES PASARON EXITOSAMENTE ===\n');
}

if (require.main === module) {
  runGamesTests().catch(err => {
    console.error('❌ FALLARON LAS PRUEBAS DE LINK GAMES:', err);
    process.exit(1);
  });
}

module.exports = { runGamesTests };
