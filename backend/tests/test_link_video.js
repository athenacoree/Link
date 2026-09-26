const assert = require('assert');
const videoStreamTool = require('../tools/videoStreamTool');
const linkVideoService = require('../services/linkVideoService');

async function runLinkVideoTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE LINK VIDEO ===\n');

  // 1. Probando getLinkVideoBaseUrl() con variables de entorno
  console.log('1. Probando getLinkVideoBaseUrl() y precedencia de variables de entorno...');
  const origVideoUrl = process.env.LINK_VIDEO_URL;
  const origStreamUrl = process.env.LINK_STREAM_URL;
  const origVideoBaseUrl = process.env.LINK_VIDEO_BASE_URL;

  delete process.env.LINK_VIDEO_URL;
  delete process.env.LINK_STREAM_URL;
  delete process.env.LINK_VIDEO_BASE_URL;

  assert.strictEqual(videoStreamTool.getLinkVideoBaseUrl(), 'https://athenacoree.github.io/link-video/');

  process.env.LINK_VIDEO_URL = 'https://mi-servidor-video.com/app';
  videoStreamTool.clearVideoCache();
  assert.strictEqual(videoStreamTool.getLinkVideoBaseUrl(), 'https://mi-servidor-video.com/app/');

  // Restaurar
  if (origVideoUrl) process.env.LINK_VIDEO_URL = origVideoUrl; else delete process.env.LINK_VIDEO_URL;
  if (origStreamUrl) process.env.LINK_STREAM_URL = origStreamUrl; else delete process.env.LINK_STREAM_URL;
  if (origVideoBaseUrl) process.env.LINK_VIDEO_BASE_URL = origVideoBaseUrl; else delete process.env.LINK_VIDEO_BASE_URL;
  videoStreamTool.clearVideoCache();
  console.log('   ✅ Resolución de URL base configurada dinámicamente por variables de entorno.');

  // 2. Probando filtro de transmisiones inactivas / 404
  console.log('2. Probando filtro de rutas internas que no estén transmitiendo...');
  const origFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('catalog.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: 'movie_1', title: 'Película En Vivo', type: 'video', url: './stream_active/', status: 'active' },
          { id: 'movie_404', title: 'Canal Caído', type: 'video', url: './stream_404/', status: 'active' },
          { id: 'movie_off', title: 'Canal Apagado', type: 'video', url: './stream_offline/', status: 'offline' }
        ]
      };
    }
    if (url.includes('stream_active')) {
      return { ok: true, status: 200 };
    }
    return { ok: false, status: 404 };
  };

  const activeCheck = await videoStreamTool.isStreamActive({
    id: 'stream_active',
    status: 'active',
    url: './stream_active/'
  });
  assert.strictEqual(activeCheck, true, 'Transmisión activa respondiendo 200 OK debe retornar true');

  const inactive404Check = await videoStreamTool.isStreamActive({
    id: 'stream_404',
    status: 'active',
    url: './stream_404/'
  });
  assert.strictEqual(inactive404Check, false, 'Ruta interna con error 404 (sin transmisión) debe retornar false');

  const offlineCheck = await videoStreamTool.isStreamActive({
    id: 'stream_offline',
    status: 'offline',
    url: './stream_offline/'
  });
  assert.strictEqual(offlineCheck, false, 'Transmisión con status offline debe retornar false y descartarse');

  console.log('   ✅ Detección y filtrado de contenido offline/inactivo/404 validado.');

  // 3. Probando listStreams
  console.log('3. Probando herramienta linkvideo.list...');
  videoStreamTool.clearVideoCache();
  const listRes = await videoStreamTool.listStreams({});
  assert.strictEqual(listRes.type, 'video_stream_list_card');
  assert.ok(Array.isArray(listRes.streams), 'Debe retornar una lista de transmisiones');
  assert.strictEqual(listRes.streams.length, 1, 'Solo debe contener la transmisión activa (descartando 404 y offline)');
  assert.strictEqual(listRes.streams[0].id, 'movie_1');
  console.log('   ✅ Herramienta linkvideo.list ejecutada correctamente.');

  // 4. Probando launchStream
  console.log('4. Probando herramienta linkvideo.launch...');
  const launchRes = await videoStreamTool.launchStream({ streamId: listRes.streams[0].id });
  assert.strictEqual(launchRes.type, 'video_stream_launch_card');
  assert.strictEqual(launchRes.data.action, 'open_stream');
  assert.ok(launchRes.data.url, 'Debe incluir la URL de la transmisión');
  console.log('   ✅ Herramienta linkvideo.launch ejecutada correctamente.');

  global.fetch = origFetch;
  console.log('\n=== TODAS LAS PRUEBAS DE LINK VIDEO PASARON EXITOSAMENTE ===\n');
}

runLinkVideoTests().catch(err => {
  console.error('❌ FALLARON LAS PRUEBAS DE LINK VIDEO:', err);
  process.exit(1);
});

module.exports = { runLinkVideoTests };
