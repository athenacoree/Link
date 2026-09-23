const assert = require('assert');
const imageEditorService = require('../services/imageEditorService');
const imageEditorRoutes = require('../routes/imageEditor');

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DEL EDITOR DE IMÁGENES ===\n');

  // 1. Prueba de getConfig sin variables de entorno
  console.log('1. Probando getConfig() sin variables de entorno...');
  const originalUrl = process.env.IMAGE_EDITOR_BASE_URL;
  const originalKey = process.env.IMAGE_EDITOR_API_KEY;

  delete process.env.IMAGE_EDITOR_BASE_URL;
  delete process.env.IMAGE_EDITOR_API_KEY;

  assert.throws(() => {
    imageEditorService.getConfig();
  }, /IMAGE_EDITOR_BASE_URL/);
  console.log('   ✅ getConfig() lanza error esperado si faltan variables de entorno.');

  // Configurar variables simuladas para pruebas
  process.env.IMAGE_EDITOR_BASE_URL = 'https://editor-externo.render.com';
  process.env.IMAGE_EDITOR_API_KEY = 'test_api_key_123';

  // 2. Configuración válida
  console.log('2. Probando getConfig() con variables válidas...');
  const cfg = imageEditorService.getConfig();
  assert.strictEqual(cfg.baseUrl, 'https://editor-externo.render.com');
  assert.strictEqual(cfg.apiKey, 'test_api_key_123');
  console.log('   ✅ getConfig() devuelve los valores esperados.');

  // 3. Verificar que las rutas de Express se cargan correctamente
  console.log('3. Probando carga de rutas de Express (/api/image-editor)...');
  assert.ok(imageEditorRoutes);
  assert.strictEqual(typeof imageEditorRoutes, 'function');
  console.log('   ✅ Rutas de Express para el editor de imágenes cargadas correctamente.');

  // 4. Probar simulación de peticiones HTTP a la API externa
  console.log('4. Probando estructura de llamadas a la API externa (Simulación/Fetch Mock)...');

  const originalFetch = globalThis.fetch;
  let fetchCallLog = [];

  globalThis.fetch = async (url, options) => {
    fetchCallLog.push({ url, options });

    if (url.includes('/api/jobs') && options.method === 'POST') {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          requestId: 'req_mock_9999',
          status: 'queued',
        }),
      };
    }

    if (url.includes('/api/jobs/req_mock_9999/result')) {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          requestId: 'req_mock_9999',
          status: 'completed',
          image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        }),
      };
    }

    if (url.includes('/api/jobs/req_mock_9999')) {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          requestId: 'req_mock_9999',
          status: 'processing',
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Ruta no encontrada' }),
    };
  };

  try {
    // Probar createJob
    const dummyUserId = '00000000-0000-0000-0000-000000000001';
    const job = await imageEditorService.createJob({
      userId: dummyUserId,
      prompt: 'Añadir estilo ciberpunk',
      imageBase64: 'data:image/png;base64,test',
      upscale: true,
      upscaleFactor: '2x',
    });

    assert.strictEqual(job.request_id, 'req_mock_9999');
    assert.strictEqual(job.status, 'queued');
    console.log('   ✅ createJob() realiza la petición POST con headers X-API-Key y guarda el estado.');

    // Verificar headers
    const lastCall = fetchCallLog[0];
    assert.strictEqual(lastCall.options.headers['X-API-Key'], 'test_api_key_123');
    const sentBody = JSON.parse(lastCall.options.body);
    assert.strictEqual(sentBody.user_id, dummyUserId);
    assert.strictEqual(sentBody.prompt, 'Añadir estilo ciberpunk');

    // Probar getJobStatus
    const statusResult = await imageEditorService.getJobStatus('req_mock_9999', dummyUserId);
    assert.strictEqual(statusResult.request_id, 'req_mock_9999');
    assert.strictEqual(statusResult.status, 'processing');
    console.log('   ✅ getJobStatus() realiza la petición GET /api/jobs/{requestId} y actualiza el estado.');

    // Probar getJobResult
    const jobResult = await imageEditorService.getJobResult('req_mock_9999', dummyUserId);
    assert.strictEqual(jobResult.request_id, 'req_mock_9999');
    assert.strictEqual(jobResult.status, 'completed');
    assert.ok(jobResult.result_data.includes('data:image/png;base64'));
    console.log('   ✅ getJobResult() obtiene el resultado y marca el trabajo como completado.');

  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl) process.env.IMAGE_EDITOR_BASE_URL = originalUrl;
    else delete process.env.IMAGE_EDITOR_BASE_URL;
    if (originalKey) process.env.IMAGE_EDITOR_API_KEY = originalKey;
    else delete process.env.IMAGE_EDITOR_API_KEY;
  }

  console.log('\n=== TODAS LAS PRUEBAS DEL EDITOR DE IMÁGENES PASARON EXITOSAMENTE ===');
}

if (require.main === module) {
  runTests().then(() => process.exit(0)).catch((err) => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
