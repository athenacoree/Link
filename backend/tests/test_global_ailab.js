const assert = require('assert');

async function runTests() {
  console.log('--- Ejecutando Pruebas de Integración para Laboratorio IA Global ---');

  // 1. Carga de módulos
  const aiLabService = require('../services/aiLabService');
  assert.ok(aiLabService, 'El servicio aiLabService debe existir.');
  assert.strictEqual(typeof aiLabService.getGlobalMessages, 'function', 'getGlobalMessages debe ser una función.');
  assert.strictEqual(typeof aiLabService.saveGlobalMessage, 'function', 'saveGlobalMessage debe ser una función.');
  assert.strictEqual(typeof aiLabService.deleteGlobalMessage, 'function', 'deleteGlobalMessage debe ser una función.');
  assert.strictEqual(typeof aiLabService.runAutoAIChatLoopTurn, 'function', 'runAutoAIChatLoopTurn debe ser una función.');

  console.log('✅ Servicio aiLabService verificado con éxito.');

  // 2. Comprobar ToolManager con intención de perfil social
  const ToolManager = require('../tools/ToolManager');
  const profileIntent = ToolManager.detectToolIntent('Busca a Juan en la plataforma');
  assert.ok(profileIntent, 'Debe detectar la intención de búsqueda de perfil.');
  assert.strictEqual(profileIntent.tool, 'social.profile', 'El tool detectado debe ser social.profile.');
  assert.strictEqual(profileIntent.params.username, 'Juan', 'El parámetro buscado debe ser Juan.');

  console.log('✅ Detección de intención para tarjetas de perfil verificada.');

  // 3. Comprobar enrutadores Express
  const ailabRouter = require('../routes/ailab');
  assert.ok(ailabRouter, 'Router de AI Lab debe cargar correctamente.');

  const adminRouter = require('../routes/admin');
  assert.ok(adminRouter, 'Router de Admin debe cargar correctamente.');

  console.log('✅ Enrutadores de API verificados correctamente.');

  // 4. Comprobar configuración predeterminada de Gemini (gemini-2.5-flash)
  const { getAISettings } = require('../services/aiService');
  delete process.env.GEMINI_MODEL;
  const settings = await getAISettings();
  assert.strictEqual(settings.gemini_model, 'gemini-2.5-flash', 'El modelo predeterminado debe ser gemini-2.5-flash');
  assert.ok(parseInt(settings.ailab_timeout_ms, 10) >= 10000, 'El timeout debe ser al menos 10000ms');

  console.log('✅ Verificación de modelo gemini-2.5-flash y timeout seguro realizada.');
  console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE.');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas de Laboratorio IA Global:', err);
  process.exit(1);
});
