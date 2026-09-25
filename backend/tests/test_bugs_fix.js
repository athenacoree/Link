const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ToolManager = require('../tools/ToolManager');
const { getWorldTime } = require('../tools/geoTimeTool');

async function testBugFixes() {
  console.log('=== INICIANDO PRUEBAS DE VERIFICACIÓN DE BUG FIXES ===\n');

  // -------------------------------------------------------------
  // Test Bug 1: Panel de Herramientas (ToolManager.executeTool)
  // -------------------------------------------------------------
  console.log('1. Probando Bug 1 Fix (ToolManager capabilities async resolution)...');
  const caps = await ToolManager.executeTool('system.capabilities', {});
  assert.ok(caps, 'caps no debe ser null o undefined');
  assert.strictEqual(caps.type, 'capabilities_card', 'caps.type debe ser capabilities_card');
  assert.ok(Array.isArray(caps.data?.categories), 'caps.data.categories debe ser un Array');
  assert.ok(caps.data.categories.length > 0, 'caps.data.categories debe contener categorías');
  console.log(`   ✅ ToolManager.executeTool('system.capabilities') devolvió ${caps.data.categories.length} categorías.`);

  // -------------------------------------------------------------
  // Test Bug 2: Hora Mundial por ubicación (geoTimeTool.js)
  // -------------------------------------------------------------
  console.log('\n2. Probando Bug 2 Fix (getWorldTime por ubicación real)...');

  // 2a. Madrid
  const timeMadrid = await getWorldTime({ location: 'Madrid' });
  assert.strictEqual(timeMadrid.type, 'geo_time_card');
  assert.ok(timeMadrid.data.location.includes('Madrid'), `location debe incluir Madrid (obtenido: ${timeMadrid.data.location})`);
  assert.ok(timeMadrid.data.timezone.includes('UTC+'), `timezone debe ser UTC+ para Madrid (obtenido: ${timeMadrid.data.timezone})`);
  console.log(`   ✅ Madrid: ${timeMadrid.data.location} | Hora: ${timeMadrid.data.time} | TZ: ${timeMadrid.data.timezone}`);

  // 2b. Tokio
  const timeTokio = await getWorldTime({ location: 'Tokio' });
  assert.strictEqual(timeTokio.type, 'geo_time_card');
  assert.ok(timeTokio.data.timezone.includes('UTC+9') || timeTokio.data.timezone.includes('Japón') || timeTokio.data.timezone.includes('Tokyo'), `timezone Tokio no coincide: ${timeTokio.data.timezone}`);
  console.log(`   ✅ Tokio: ${timeTokio.data.location} | Hora: ${timeTokio.data.time} | TZ: ${timeTokio.data.timezone}`);

  // 2c. La Habana
  const timeHabana = await getWorldTime({ location: 'La Habana' });
  assert.strictEqual(timeHabana.type, 'geo_time_card');
  assert.ok(timeHabana.data.timezone.includes('Cuba') || timeHabana.data.timezone.includes('Havana') || timeHabana.data.timezone.includes('UTC-'), `timezone La Habana no coincide: ${timeHabana.data.timezone}`);
  console.log(`   ✅ La Habana: ${timeHabana.data.location} | Hora: ${timeHabana.data.time} | TZ: ${timeHabana.data.timezone}`);

  // 2d. GPS Coordinates
  const timeGPS = await getWorldTime({ location: 'Lat 40.41, Lon -3.70' });
  assert.strictEqual(timeGPS.type, 'geo_time_card');
  assert.ok(timeGPS.data.location.includes('GPS') || timeGPS.data.location.includes('Madrid'), `location GPS no coincide: ${timeGPS.data.location}`);
  console.log(`   ✅ GPS: ${timeGPS.data.location} | Hora: ${timeGPS.data.time} | TZ: ${timeGPS.data.timezone}`);

  // -------------------------------------------------------------
  // Test Bug 3: PWA Manifest Selection
  // -------------------------------------------------------------
  console.log('\n3. Probando Bug 3 Fix (Inline script PWA Manifest en index.html)...');
  const indexPath = path.join(__dirname, '../../frontend/index.html');
  const indexHTML = fs.readFileSync(indexPath, 'utf8');

  assert.ok(indexHTML.includes('localStorage.getItem(\'enlace_usuario\')'), 'index.html debe leer enlace_usuario de localStorage');
  assert.ok(indexHTML.includes('/manifest-macho.json') && indexHTML.includes('/manifest-hembra.json'), 'index.html debe hacer referencia a manifest-macho.json y manifest-hembra.json');
  console.log('   ✅ Script inline síncrono para manifest verificado en index.html.');

  // Verificación de existencia de manifests
  const manifestPaths = [
    path.join(__dirname, '../../frontend/manifest.json'),
    path.join(__dirname, '../../frontend/manifest-macho.json'),
    path.join(__dirname, '../../frontend/manifest-hembra.json')
  ];
  manifestPaths.forEach(p => {
    assert.ok(fs.existsSync(p), `El archivo ${p} debe existir`);
    const content = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(content.name, `Manifest ${p} debe tener name`);
  });
  console.log('   ✅ Todos los archivos manifest (.json, -macho.json, -hembra.json) son JSON válidos.');

  console.log('\n=== TODAS LAS PRUEBAS DE BUG FIXES PASARON EXITOSAMENTE ===');
}

testBugFixes().catch(err => {
  console.error('\n❌ ERROR EN LAS PRUEBAS DE BUG FIXES:', err);
  process.exit(1);
});
