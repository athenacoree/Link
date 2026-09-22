const assert = require('assert');
const { getAISettings, pruneMessages, chatCompletion, getOpenRouterFreeModels, ProviderAdapters } = require('../services/aiService');
const ToolManager = require('../tools/ToolManager');

async function runSystemTests() {
  console.log('=== INICIANDO PRUEBAS DEL SISTEMA IA DE ENLACE ===');

  // 0. Prueba de Configuración OpenRouter desde Entorno
  console.log('0. Probando getAISettings() y prioridad de variables de entorno de OpenRouter...');
  process.env.OPENROUTER_MODEL = 'openrouter/free';
  process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
  const settings = await getAISettings();
  assert.strictEqual(settings.openrouter_model, 'openrouter/free', 'openrouter_model debe coincidir con process.env.OPENROUTER_MODEL');
  assert.strictEqual(settings.openrouter_api_key, 'sk-or-v1-test-key', 'openrouter_api_key debe coincidir con process.env.OPENROUTER_API_KEY');

  const freeModels = await getOpenRouterFreeModels();
  assert.ok(Array.isArray(freeModels) && freeModels.length > 0, 'getOpenRouterFreeModels debe devolver al menos un modelo');
  console.log(`   ℹ️ Se obtuvieron ${freeModels.length} modelos gratuitos de OpenRouter.`);
  console.log('   ✅ Configuración de OpenRouter en entorno validada.');

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
  assert.ok(Array.isArray(toolDefs) && toolDefs.length >= 10, 'Debe haber al menos 10 herramientas registradas');
  console.log(`   ✅ getToolDefinitions() devolvió ${toolDefs.length} herramientas.`);

  // 3. Prueba de Tool Manager - Detección de Intención
  console.log('3. Probando detectToolIntent()...');
  const intent1 = ToolManager.detectToolIntent('clima en La Habana');
  assert.strictEqual(intent1?.tool, 'weather.get', 'Debe detectar intención de clima');

  const intent2 = ToolManager.detectToolIntent('cuánto es 25 * 4');
  assert.strictEqual(intent2?.tool, 'math.calculate', 'Debe detectar intención de cálculo matemático');

  const intent3 = ToolManager.detectToolIntent('dibuja un gato espacial');
  assert.strictEqual(intent3?.tool, 'image.generate', 'Debe detectar intención de generar imagen');
  console.log('   ✅ Detección de intenciones validada.');

  // 4. Prueba de Ejecución de Herramientas Modulares
  console.log('4. Probando ejecuciones individuales de herramientas...');

  const mathRes = await ToolManager.executeTool('math.calculate', { expression: '15 + 35' });
  assert.strictEqual(mathRes.data?.result, 50, '15 + 35 debe ser 50');

  const unitRes = await ToolManager.executeTool('unit.convert', { value: 100, from: 'c', to: 'f' });
  assert.strictEqual(unitRes.data?.converted_value, 212, '100°C debe ser 212°F');

  const docRes = await ToolManager.executeTool('doc.extract', { content: 'Texto de prueba de documento', filename: 'prueba.txt', mimeType: 'text/plain' });
  assert.ok(docRes.data?.extracted_text.includes('Texto de prueba'), 'Debe extraer texto del documento');

  const imgRes = await ToolManager.executeTool('image.generate', { prompt: 'paisaje futurista', enhance: true });
  assert.strictEqual(imgRes.type, 'image_card', 'Debe devolver una tarjeta de imagen');
  assert.ok(imgRes.data?.image_url, 'Debe incluir URL de imagen');

  const webcamRes = await ToolManager.executeTool('webcam.search', { location: 'Tokio' });
  assert.strictEqual(webcamRes.type, 'webcam_card', 'Debe devolver tarjeta de cámara');

  console.log('   ✅ Herramientas modulares ejecutadas correctamente.');

  // 5. Prueba de Modo Misión
  console.log('5. Probando executeMission()...');
  const missionRes = await ToolManager.executeMission('Clima en Madrid', null, 3);
  assert.ok(missionRes.steps && missionRes.steps.length > 0, 'La misión debe generar al menos un paso de herramientas');
  console.log('   ✅ Modo Misión validado.');

  // 6. Prueba de Chat Completion (fallback graceful cuando no hay API Key activa)
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
