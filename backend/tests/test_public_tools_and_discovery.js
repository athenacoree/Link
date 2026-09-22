/**
 * Tests para la Suite de APIs Públicas y el Motor Dinámico de APIs
 */
const ToolManager = require('../tools/ToolManager');
const dynamicEngine = require('../tools/dynamicApiEngine');

async function testPublicToolsAndDiscovery() {
  console.log('=== PRUEBAS DE APIS PÚBLICAS Y MOTOR DINÁMICO ===');

  // 1. Verificar registros de herramientas
  const toolsCount = Object.keys(ToolManager.tools).length;
  console.log(`1. Total de herramientas registradas en ToolManager: ${toolsCount}`);
  if (toolsCount < 40) throw new Error('Faltan herramientas registradas en ToolManager.');

  // 2. Probar Wikipedia
  console.log('2. Probando Wikipedia...');
  const wikiRes = await ToolManager.executeTool('wikipedia.search', { query: 'Marie Curie', lang: 'es' });
  if (!wikiRes || !wikiRes.title) throw new Error('Falló la consulta a Wikipedia.');
  console.log(`   ✅ Wikipedia: ${wikiRes.title}`);

  // 3. Probar Open Library
  console.log('3. Probando Open Library...');
  const openLibRes = await ToolManager.executeTool('openlibrary.search', { query: 'Don Quijote' });
  if (!openLibRes || !Array.isArray(openLibRes.books)) throw new Error('Falló la consulta a Open Library.');
  console.log(`   ✅ Open Library: ${openLibRes.books.length} libros encontrados.`);

  // 4. Probar REST Countries
  console.log('4. Probando REST Countries...');
  const countryRes = await ToolManager.executeTool('restcountries.get', { country: 'Cuba' });
  if (!countryRes || !countryRes.capital) throw new Error('Falló la consulta a REST Countries.');
  console.log(`   ✅ REST Countries: Capital de ${countryRes.common_name} es ${countryRes.capital}`);

  // 5. Probar Motor Dinámico de APIs
  console.log('5. Probando Motor Dinámico de APIs...');
  const discoveryApis = dynamicEngine.INITIAL_DISCOVERY_CATALOG;
  console.log(`   ✅ Catálogo inicial dinámico: ${discoveryApis.length} APIs`);

  const sampleApi = discoveryApis[0];
  const dynamicExec = await dynamicEngine.executeDynamicApiRequest(sampleApi, { latitude: 23.1136, longitude: -82.3666, current_weather: true });
  if (!dynamicExec || !dynamicExec.data) throw new Error('Falló la ejecución de API dinámica.');
  console.log(`   ✅ Ejecución dinámica exitosa: ${dynamicExec.api_name}`);

  // 6. Probar Sincronización con ToolManager
  console.log('6. Sincronizando APIs dinámicas con ToolManager...');
  await dynamicEngine.syncDynamicApisWithToolManager(ToolManager);
  const updatedCount = Object.keys(ToolManager.tools).length;
  console.log(`   ✅ Herramientas tras sincronización dinámica: ${updatedCount}`);

  console.log('=== TODAS LAS PRUEBAS DE APIS PÚBLICAS Y MOTOR DINÁMICO PASARON EXITOSAMENTE ===');
}

if (require.main === module) {
  testPublicToolsAndDiscovery().catch(err => {
    console.error('❌ Error en las pruebas:', err);
    process.exit(1);
  });
}

module.exports = testPublicToolsAndDiscovery;
