const assert = require('assert');
const { getAISettings, pruneMessages, chatCompletion, ProviderAdapters } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

async function runSystemTests() {
  console.log('=== INICIANDO PRUEBAS DEL SISTEMA IA DE ENLACE ===');

  // 0. Prueba de Configuración Gemini desde Entorno
  console.log('0. Probando getAISettings() y prioridad de variables de entorno (Gemini)...');
  process.env.GEMINI_API_KEY = 'gemini-test-key-12345';
  process.env.GEMINI_MODEL = 'gemini-1.5-flash';

  const settings = await getAISettings();
  assert.strictEqual(settings.gemini_api_key, 'gemini-test-key-12345', 'gemini_api_key debe coincidir con process.env.GEMINI_API_KEY');
  assert.strictEqual(settings.gemini_model, 'gemini-1.5-flash', 'gemini_model debe coincidir con process.env.GEMINI_MODEL');

  assert.ok(typeof ProviderAdapters.gemini === 'function', 'ProviderAdapters.gemini debe existir');
  console.log('   ✅ Configuración de Gemini en entorno validada.');

  // 0b. Prueba de regresión de formato de roles para Gemini Function Calling
  console.log('0b. Probando que Gemini function calling nunca use "role: function"...');
  let fetchPayloads = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      const payload = JSON.parse(options.body);
      fetchPayloads.push(payload);
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            finishReason: 'STOP',
            content: { parts: [{ text: 'Respuesta con herramienta' }] }
          }]
        })
      };
    }
    return originalFetch(url, options);
  };

  const testMessages = [
    { role: 'user', content: '¿Qué hora es?' },
    { role: 'model', parts: [{ functionCall: { name: 'world_time', args: { location: 'Madrid' } } }] },
    { role: 'user', parts: [{ functionResponse: { name: 'world_time', response: { content: { time: '14:00' } } } }] }
  ];

  await ProviderAdapters.gemini({
    settings: { gemini_api_key: 'test_key', gemini_model: 'gemini-1.5-flash', ai_temperature: '0.7' },
    messages: testMessages,
    tools: null,
    maxTokens: 100,
  });

  global.fetch = originalFetch;

  assert.strictEqual(fetchPayloads.length, 1, 'Debe haber capturado una llamada a Gemini API');
  const contents = fetchPayloads[0].contents;
  const invalidRole = contents.find(c => c.role === 'function');
  assert.strictEqual(invalidRole, undefined, 'Gemini contents NUNCA debe contener role: "function"');
  console.log('   ✅ Formato de roles para Gemini function calling validado correctamente.');

  // 1. Prueba de Prune Messages (Context Budgeting)
  console.log('1. Probando pruneMessages()...');
  const messages = [
    { role: 'system', content: 'Eres un asistente' },
    { role: 'user', content: 'Hola 1' },
    { role: 'assistant', content: 'Hola 1 respuesta' },
    { role: 'user', content: 'Hola 2' },
  ];
  const pruned = pruneMessages(messages, 100);
  assert.ok(Array.isArray(pruned), 'pruned debe ser un arreglo');
  assert.strictEqual(pruned[0].role, 'system', 'El system prompt debe preservarse siempre');
  console.log('   ✅ pruneMessages() funciona correctamente.');

  // 2. Prueba de Tool Manager - Definiciones
  console.log('2. Probando getToolDefinitions()...');
  const toolDefs = ToolManager.getToolDefinitions();
  assert.ok(Array.isArray(toolDefs) && toolDefs.length >= 25, `Debe haber al menos 25 herramientas registradas. Se encontraron ${toolDefs.length}`);
  console.log(`   ✅ getToolDefinitions() devolvió ${toolDefs.length} herramientas.`);

  // 3. Prueba de Tool Manager - Detección de Intención
  console.log('3. Probando detectToolIntent()...');
  const intent1 = ToolManager.detectToolIntent('clima en La Habana');
  assert.strictEqual(intent1?.tool, 'weather.get', 'Debe detectar intención de clima');

  const intent2 = ToolManager.detectToolIntent('cuánto es 25 * 4');
  assert.strictEqual(intent2?.tool, 'math.calculate', 'Debe detectar intención de cálculo matemático');

  const intent3 = ToolManager.detectToolIntent('dibuja un gato espacial');
  assert.strictEqual(intent3?.tool, 'image.generate', 'Debe detectar intención de generar imagen');

  const intentNasa = ToolManager.detectToolIntent('imagen del dia nasa');
  assert.strictEqual(intentNasa?.tool, 'nasa.apod', 'Debe detectar intención de NASA APOD');

  const intentChatPrev = ToolManager.detectToolIntent('muéstrame mi chat con Maria');
  assert.strictEqual(intentChatPrev?.tool, 'chat.preview', 'Debe detectar intención de ver chat');

  const intentEditProf = ToolManager.detectToolIntent('edita mi perfil biografía desarrollador web');
  assert.strictEqual(intentEditProf?.tool, 'user.edit_profile', 'Debe detectar intención de editar perfil');

  const intentStatusCreate = ToolManager.detectToolIntent('sube un estado que diga Hola a todos');
  assert.strictEqual(intentStatusCreate?.tool, 'status.create', 'Debe detectar intención de crear estado');

  const intentStatusDelete = ToolManager.detectToolIntent('elimina mi estado actual');
  assert.strictEqual(intentStatusDelete?.tool, 'status.delete', 'Debe detectar intención de borrar estado');

  const intentFriendReq = ToolManager.detectToolIntent('envia solicitud de amistad a Carlos');
  assert.strictEqual(intentFriendReq?.tool, 'friend.send_request', 'Debe detectar intención de enviar solicitud');

  const intentYtLive = ToolManager.detectToolIntent('transmisión en vivo de noticias en directo');
  assert.strictEqual(intentYtLive?.tool, 'youtube.live', 'Debe detectar transmisión en vivo');

  const intentStockPhoto = ToolManager.detectToolIntent('banco de fotos de paisajes');
  assert.strictEqual(intentStockPhoto?.tool, 'stock.photos', 'Debe detectar fotos de stock');

  const intentPaymentLink = ToolManager.detectToolIntent('enlace de pago para pagar verificación');
  assert.strictEqual(intentPaymentLink?.tool, 'system.payment_link', 'Debe detectar enlace de pago');

  const intentEditImage = ToolManager.detectToolIntent('edita esta foto para que sea estilo anime');
  assert.strictEqual(intentEditImage?.tool, 'image.edit', 'Debe detectar intención de editar foto');

  const intentCapabilitiesNL = ToolManager.detectToolIntent('que puedes hacer');
  assert.strictEqual(intentCapabilitiesNL?.tool, 'system.capabilities', 'Debe detectar capacidades con "que puedes hacer"');

  const intentCapabilitiesNL2 = ToolManager.detectToolIntent('para que sirves');
  assert.strictEqual(intentCapabilitiesNL2?.tool, 'system.capabilities', 'Debe detectar capacidades con "para que sirves"');

  const intentGameNL = ToolManager.detectToolIntent('quiero jugar un juego');
  assert.strictEqual(intentGameNL?.tool, 'game.list', 'Debe detectar lista de juegos con "quiero jugar un juego"');

  console.log('   ✅ Detección de intenciones validada con lenguaje natural.');

  // 4. Prueba de Ejecución de Herramientas Modulares (Existentes y Nuevas)
  console.log('4. Probando ejecuciones individuales de herramientas...');

  const mathRes = await ToolManager.executeTool('math.calculate', { expression: '15 + 35' });
  assert.strictEqual(mathRes.data?.result, 50, '15 + 35 debe ser 50');

  const nasaRes = await ToolManager.executeTool('nasa.apod', {});
  assert.strictEqual(nasaRes.type, 'nasa_apod', 'Debe devolver un resultado de tipo nasa_apod');
  assert.ok(nasaRes.url, 'NASA APOD debe entregar una URL de imagen válida');

  const stockRes = await ToolManager.executeTool('stock.photos', { query: 'montañas' });
  assert.strictEqual(stockRes.type, 'stock_photos_card', 'Debe devolver stock_photos_card');
  assert.ok(Array.isArray(stockRes.data?.photos), 'Debe incluir lista de fotos');

  const paymentRes = await ToolManager.executeTool('system.payment_link', { service: 'Verificación' });
  assert.strictEqual(paymentRes.type, 'payment_link_card', 'Debe devolver payment_link_card');
  assert.ok(paymentRes.data?.qvapay_link, 'Debe incluir checkout link de QvaPay');

  const ytLiveRes = await ToolManager.executeTool('youtube.live', { query: 'noticias en vivo' });
  assert.strictEqual(ytLiveRes.type, 'youtube_live_card', 'Debe devolver youtube_live_card');

  console.log('   ✅ Herramientas modulares ejecutadas correctamente.');

  // 5. Prueba de Modo Misión
  console.log('5. Probando executeMission()...');
  const missionRes = await ToolManager.executeMission('Clima en Madrid', null, 3);
  assert.ok(missionRes.steps && missionRes.steps.length > 0, 'La misión debe generar al menos un paso de herramientas');
  console.log('   ✅ Modo Misión validado.');

  // 6. Prueba de Chat Completion (fallback graceful cuando la API Key o modelo es inválido)
  console.log('6. Probando chatCompletion() con resiliencia...');
  const chatRes = await chatCompletion({
    messages: [{ role: 'user', content: 'Prueba de integración' }],
    timeoutMs: 5000,
  });
  assert.ok(chatRes, 'chatCompletion debe retornar un objeto de respuesta');
  assert.ok(typeof chatRes.reply === 'string', 'La respuesta debe ser una cadena');
  console.log('   ✅ chatCompletion() ejecutado de forma resiliente.');

  // 7. Carga de Rutas Express
  console.log('7. Probando carga de rutas Express...');
  const routeAilab = require('../routes/ailab');
  const routeAi = require('../routes/ai');
  const routeAdmin = require('../routes/admin');
  assert.ok(routeAilab && routeAi && routeAdmin, 'Todas las rutas de IA deben cargar correctamente');
  console.log('   ✅ Rutas de Express cargadas sin errores.');

  console.log('=== TODAS LAS PRUEBAS DEL SISTEMA IA PASARON EXITOSAMENTE ===');
}

runSystemTests().catch(err => {
  console.error('❌ Error en pruebas del sistema IA:', err);
  process.exit(1);
});
