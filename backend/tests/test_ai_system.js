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
  assert.ok(Array.isArray(toolDefs) && toolDefs.length >= 80, `Debe haber al menos 80 herramientas registradas. Se encontraron ${toolDefs.length}`);
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

  const intentHash = ToolManager.detectToolIntent('sha256 de hola mundo');
  assert.strictEqual(intentHash?.tool, 'crypto.hash', 'Debe detectar intención de Hash SHA256');
  console.log('   ✅ Detección de intenciones validada.');

  // 4. Prueba de Ejecución de Herramientas Modulares (Existentes y Nuevas)
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

  // Pruebas de Nuevas Herramientas Internas
  const hashRes = await ToolManager.executeTool('crypto.hash', { text: 'hola mundo', algorithm: 'sha256' });
  assert.strictEqual(hashRes.type, 'crypto_hash', 'Debe devolver tipo crypto_hash');
  assert.strictEqual(hashRes.hash, '0b894166d3336435c800bea36ff21b29eaa801a52f584c006c49289a0dcf6e2f');

  const uuidRes = await ToolManager.executeTool('crypto.uuid', {});
  assert.strictEqual(uuidRes.type, 'crypto_uuid', 'Debe devolver tipo crypto_uuid');
  assert.ok(uuidRes.uuid && uuidRes.uuid.length === 36, 'UUID debe tener formato válido de 36 caracteres');

  const textStatsRes = await ToolManager.executeTool('text.stats', { text: 'Hola mundo. Esta es una prueba.' });
  assert.strictEqual(textStatsRes.metrics.words, 6, 'Debe contar 6 palabras');

  const primeRes = await ToolManager.executeTool('math.prime_check', { number: 17 });
  assert.strictEqual(primeRes.isPrime, true, '17 es un número primo');

  const statsMathRes = await ToolManager.executeTool('math.stats', { numbers: [10, 20, 30, 40] });
  assert.strictEqual(statsMathRes.mean, 25, 'La media de 10,20,30,40 debe ser 25');

  // Pruebas de Nuevas Herramientas Externas (Simulación / Verificación de Estructura)
  const adviceRes = await ToolManager.executeTool('advice.slip', {});
  assert.ok(adviceRes.type === 'advice_slip' || adviceRes.error, 'Debe devolver estructura de advice_slip o error controlado');

  const agifyRes = await ToolManager.executeTool('agify.predict', { name: 'Michael' });
  assert.ok(agifyRes.type === 'agify' || agifyRes.error, 'Debe devolver estructura de agify o error controlado');

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
