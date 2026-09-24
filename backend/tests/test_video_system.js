const assert = require('assert');
const { searchPexelsVideos } = require('../services/videoProviders/pexelsProvider');
const { searchVideos, getFromCache, saveToCache, cleanupExpiredCache } = require('../services/videoService');
const ToolManager = require('../tools/ToolManager');

async function testVideoSystem() {
  console.log('\n=== INICIANDO PRUEBAS DEL SISTEMA DE VIDEOS (PEXELS/LINK) ===\n');

  // 1. Probando adaptador Pexels (Fallback / API Response)
  console.log('1. Probando adaptador searchPexelsVideos()...');
  const pexelsRes = await searchPexelsVideos({ query: 'mar oceano', orientation: 'landscape' });
  assert.ok(pexelsRes, 'searchPexelsVideos debe retornar un objeto');
  assert.ok(pexelsRes.videos && pexelsRes.videos.length > 0, 'Debe retornar al menos 1 video');
  const sampleVideo = pexelsRes.videos[0];
  assert.ok(sampleVideo.id, 'El video debe tener id');
  assert.ok(sampleVideo.stream_url, 'El video debe tener URL de streaming MP4');
  assert.ok(sampleVideo.user && sampleVideo.user.name, 'El video debe tener atribución de usuario/fotógrafo');
  assert.ok(sampleVideo.attribution_text.includes('Pexels'), 'Debe incluir atribución a Pexels');
  console.log('   ✅ Adaptador Pexels validado correctamente.');

  // 2. Probando Servicio de Video y Caché
  console.log('2. Probando videoService.searchVideos() y Caché...');
  const query = 'naturaleza tropical ' + Date.now();
  const searchResult1 = await searchVideos({ query, orientation: 'portrait' });
  assert.strictEqual(searchResult1.type, 'video_search_card', 'El tipo de resultado debe ser video_search_card');
  assert.ok(searchResult1.data.videos.length > 0, 'Debe contener lista de videos');

  // Segunda consulta inmediata debe recuperar de caché
  const searchResult2 = await searchVideos({ query, orientation: 'portrait' });
  assert.strictEqual(searchResult2.cached, true, 'La segunda consulta idéntica debe devolverse desde caché');
  console.log('   ✅ Sistema de caché de videos (10 min TTL) validado correctamente.');

  // 3. Probando registro de herramienta en ToolManager
  console.log('3. Probando definición de herramienta "search_videos" en ToolManager...');
  const toolDefs = ToolManager.getToolDefinitions();
  const videoToolDef = toolDefs.find(t => t.name === 'search_videos');
  assert.ok(videoToolDef, 'La herramienta "search_videos" debe estar definida');
  assert.strictEqual(videoToolDef.parameters.required[0], 'query', 'El parámetro query debe ser requerido');
  console.log('   ✅ Definición de herramienta registrada en ToolManager.');

  // 4. Probando detección de intenciones en lenguaje natural
  console.log('4. Probando detectToolIntent() para búsquedas de video...');
  const intent1 = ToolManager.detectToolIntent('muéstrame un video vertical de la ciudad');
  assert.ok(intent1, 'Debe detectar la intención de búsqueda de video');
  assert.strictEqual(intent1.tool, 'search_videos');
  assert.strictEqual(intent1.params.orientation, 'portrait');
  assert.ok(intent1.params.query.includes('ciudad'), 'Debe extraer el término ciudad');

  const intent2 = ToolManager.detectToolIntent('búscame un video horizontal de autos deportivos');
  assert.ok(intent2);
  assert.strictEqual(intent2.tool, 'search_videos');
  assert.strictEqual(intent2.params.orientation, 'landscape');
  console.log('   ✅ Detección de intenciones para videos validada correctamente.');

  // 5. Probando ejecución de herramienta vía ToolManager
  console.log('5. Probando executeTool("search_videos")...');
  const toolExecRes = await ToolManager.executeTool('search_videos', { query: 'espacio galaxia', orientation: 'square' });
  assert.strictEqual(toolExecRes.type, 'video_search_card');
  assert.ok(toolExecRes.data.videos.length > 0);
  console.log('   ✅ Ejecución de herramienta search_videos en ToolManager validada.');

  // 6. Probando purga/limpieza de caché expirada
  console.log('6. Probando cleanupExpiredCache()...');
  const countCleaned = await cleanupExpiredCache();
  assert.strictEqual(typeof countCleaned, 'number');
  console.log('   ✅ Purga de caché ejecutada exitosamente.');

  console.log('\n=== TODAS LAS PRUEBAS DEL SISTEMA DE VIDEOS PASARON EXITOSAMENTE ===\n');
}

testVideoSystem().catch(err => {
  console.error('❌ Error en pruebas del sistema de videos:', err);
  process.exit(1);
});
