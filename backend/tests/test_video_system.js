const assert = require('assert');
const { searchPexelsVideos } = require('../services/videoProviders/pexelsProvider');
const { searchVideos, getFromCache, saveToCache, cleanupExpiredCache } = require('../services/videoService');
const ToolManager = require('../tools/ToolManager');

async function testVideoSystem() {
  console.log('\n=== INICIANDO PRUEBAS DEL SISTEMA DE VIDEOS (PEXELS/LINK) ===\n');

  // 1. Probando adaptador Pexels sin API key (Error controlado)
  console.log('1. Probando adaptador searchPexelsVideos() sin API key...');
  delete process.env.PEXELS_API_KEY;
  const pexelsNoKeyRes = await searchPexelsVideos({ query: 'mar oceano', orientation: 'landscape' });
  assert.ok(pexelsNoKeyRes.error, 'Debe retornar error controlado si falta PEXELS_API_KEY');
  assert.strictEqual(pexelsNoKeyRes.videos.length, 0, 'No debe retornar videos simulados falsos');

  // 1b. Probando adaptador Pexels con API Key configurada (Mock)
  console.log('1b. Probando adaptador searchPexelsVideos() con API key...');
  process.env.PEXELS_API_KEY = 'pexels_test_key_abc123';
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    return {
      ok: true,
      json: async () => ({
        total_results: 10,
        videos: [
          {
            id: 857195,
            width: 1920,
            height: 1080,
            url: 'https://www.pexels.com/video/857195/',
            duration: 20,
            user: { name: 'Pexels Creator', url: 'https://www.pexels.com/@creator' },
            video_files: [{ file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://video.pexels.com/stream.mp4' }],
            video_pictures: [{ picture: 'https://images.pexels.com/thumb.jpg' }]
          }
        ]
      })
    };
  };

  const pexelsRes = await searchPexelsVideos({ query: 'mar oceano', orientation: 'landscape' });
  assert.ok(pexelsRes, 'searchPexelsVideos debe retornar un objeto');
  assert.ok(pexelsRes.videos && pexelsRes.videos.length > 0, 'Debe retornar al menos 1 video');
  const sampleVideo = pexelsRes.videos[0];
  assert.strictEqual(sampleVideo.id, '857195', 'El video debe tener id correcto');
  assert.strictEqual(sampleVideo.stream_url, 'https://video.pexels.com/stream.mp4', 'El video debe tener URL de streaming MP4 real de Pexels');
  assert.ok(sampleVideo.user && sampleVideo.user.name, 'El video debe tener atribución de usuario/fotógrafo');
  assert.ok(sampleVideo.attribution_text.includes('Pexels'), 'Debe incluir atribución a Pexels');
  console.log('   ✅ Adaptador Pexels validado correctamente con API key y sin fallbacks falsos.');

  // 2. Probando Servicio de Video y Caché
  console.log('2. Probando videoService.searchVideos() y Caché...');
  const queryTerm = 'naturaleza tropical ' + Date.now();
  const searchResult1 = await searchVideos({ query: queryTerm, orientation: 'portrait' });
  assert.strictEqual(searchResult1.type, 'video_search_card', 'El tipo de resultado debe ser video_search_card');
  assert.ok(searchResult1.data.videos.length > 0, 'Debe contener lista de videos');

  // Segunda consulta inmediata debe recuperar de caché
  const searchResult2 = await searchVideos({ query: queryTerm, orientation: 'portrait' });
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

  global.fetch = originalFetch;
  console.log('\n=== TODAS LAS PRUEBAS DEL SISTEMA DE VIDEOS PASARON EXITOSAMENTE ===\n');
}

testVideoSystem().catch(err => {
  console.error('❌ Error en pruebas del sistema de videos:', err);
  process.exit(1);
});
