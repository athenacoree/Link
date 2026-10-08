/**
 * Test Suite para el Sistema Unificado de Contenido Externo de Link Video
 * Verifica detectores de proveedores, validación, adaptadores, capacidades, CRUD,
 * prevención de duplicados y versión PWA v38.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  detectExternalProvider,
  getAdapter,
  getProvidersStatus
} = require('../services/videoProviders');
const linkVideoService = require('../services/linkVideoService');

async function testExternalContentSystem() {
  console.log('=== INICIANDO PRUEBAS DE CONTENIDO EXTERNO Y PROVEEDORES DE LINK VIDEO ===\n');

  // 1. Verificación de Versión PWA (v38)
  console.log('1. Verificando versión PWA v38 en frontend/sw.js e index.html...');
  const swPath = path.join(__dirname, '..', '..', 'frontend', 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.ok(swContent.includes(`const CACHE_NAME = 'enlace-shell-v38';`), 'sw.js debe contener enlace-shell-v38');
  assert.ok(swContent.includes(`'/index.html?v=38'`), 'sw.js debe incluir index.html?v=38');

  const htmlPath = path.join(__dirname, '..', '..', 'frontend', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(htmlContent.includes(`/css/app.css?v=38`), 'index.html debe cargar css/app.css?v=38');
  assert.ok(htmlContent.includes(`/js/app.js?v=38`), 'index.html debe cargar js/app.js?v=38');
  console.log('   ✅ Versión PWA v38 verificada correctamente.');

  // 2. Detección de Proveedores
  console.log('\n2. Probando detector de proveedores detectExternalProvider()...');
  const testUrls = [
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'youtube' },
    { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'youtube' },
    { url: 'https://www.youtube.com/shorts/34Na4j8AVgA', expected: 'youtube' },
    { url: 'https://www.instagram.com/reel/C123456789/', expected: 'instagram' },
    { url: 'https://vimeo.com/76979871', expected: 'vimeo' },
    { url: 'https://www.dailymotion.com/video/x8xxxxx', expected: 'dailymotion' },
    { url: 'https://www.twitch.tv/ninja', expected: 'twitch' },
    { url: 'https://www.twitch.tv/videos/12345678', expected: 'twitch' },
    { url: 'https://clips.twitch.tv/SampleClipId', expected: 'twitch' },
    { url: 'https://peertube.example.org/w/sampleVid123', expected: 'peertube' },
    { url: 'https://archive.org/details/sample_archive_movie', expected: 'internet_archive' },
    { url: 'https://www.ted.com/talks/sample_ted_talk', expected: 'ted' },
    { url: 'https://soundcloud.com/artist/sample-track', expected: 'soundcloud' },
    { url: 'https://www.mixcloud.com/artist/sample-show/', expected: 'mixcloud' }
  ];

  for (const item of testUrls) {
    const detected = detectExternalProvider(item.url);
    assert.strictEqual(detected, item.expected, `Detección fallida para ${item.url}: esperado ${item.expected}, obtenido ${detected}`);
  }
  console.log('   ✅ Detección de los 10 proveedores completada con éxito.');

  // 3. Rechazo de URLs inseguras o inválidas
  console.log('\n3. Probando rechazo de URLs inválidas o inseguras...');
  const invalidUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert("xss")</script>',
    'file:///etc/passwd',
    'blob:https://example.com/12345',
    'https://domaindesconocido.com/video/123',
    'http://sitioinvalido.org'
  ];

  for (const url of invalidUrls) {
    const detected = detectExternalProvider(url);
    assert.strictEqual(detected, null, `La URL ${url} debió ser rechazada.`);
  }
  console.log('   ✅ Rechazo de URLs inseguras o no soportadas validado.');

  // 4. Adaptadores y Capacidades
  console.log('\n4. Probando adaptadores de proveedores y declaración de capacidades...');
  const ytAdapter = getAdapter('youtube');
  const parsedYt = ytAdapter.parseUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(parsedYt.content_id, 'dQw4w9WgXcQ');
  assert.strictEqual(parsedYt.capabilities.supportsFullscreen, true);
  assert.strictEqual(parsedYt.capabilities.supportsSubtitles, true);

  const igAdapter = getAdapter('instagram');
  const parsedIg = igAdapter.parseUrl('https://www.instagram.com/reel/C123456789/');
  assert.strictEqual(parsedIg.content_id, 'C123456789');
  assert.strictEqual(parsedIg.capabilities.supportsPortrait, true);

  const twAdapter = getAdapter('twitch');
  const parsedTw = twAdapter.parseUrl('https://www.twitch.tv/ninja', { host: 'enlace.app' });
  assert.strictEqual(parsedTw.content_id, 'ninja');
  assert.ok(parsedTw.embed_url.includes('parent=enlace.app'), 'Twitch embed URL debe incluir parent=enlace.app');

  console.log('   ✅ Parseo de adaptadores y capacidades verificado.');

  // 5. CRUD de Contenido Externo asociándolo al usuario
  console.log('\n5. Probando CRUD de contenido externo asociado al perfil del usuario...');
  const testUserId = 'usr_test_12345';
  const createdContent = await linkVideoService.addExternalContent({
    userId: testUserId,
    url: 'https://vimeo.com/76979871',
    category: 'Vimeo',
    title: 'Video Vimeo de Prueba',
    description: 'Descripción de prueba'
  });

  assert.ok(createdContent.id, 'El contenido creado debe tener ID');
  assert.strictEqual(createdContent.provider, 'vimeo');
  assert.strictEqual(createdContent.user_id, testUserId);

  // Consultar contenido del perfil
  const userContent = await linkVideoService.getUserExternalContent(testUserId);
  assert.ok(userContent.length >= 1, 'Debe retornar el contenido añadido por el usuario');
  assert.strictEqual(userContent[0].id, createdContent.id);

  // 6. Prevención de Duplicados
  console.log('\n6. Probando prevención de duplicados...');
  try {
    await linkVideoService.addExternalContent({
      userId: testUserId,
      url: 'https://vimeo.com/76979871',
      category: 'Vimeo'
    });
    assert.fail('Debió lanzar error por contenido duplicado');
  } catch (err) {
    assert.ok(err.message.includes('ya ha sido añadido previamente'), 'Mensaje de error de duplicado correcto');
  }
  console.log('   ✅ Prevención de duplicados verificada.');

  // 7. Eliminación de Contenido por Propietario
  console.log('\n7. Probando eliminación de contenido por su propietario...');
  const deleteRes = await linkVideoService.deleteExternalContent(createdContent.id, testUserId, false);
  assert.strictEqual(deleteRes.ok, true);

  const userContentAfter = await linkVideoService.getUserExternalContent(testUserId);
  assert.strictEqual(userContentAfter.length, 0, 'El contenido debe eliminarse del perfil');
  console.log('   ✅ Eliminación de contenido verificada.');

  // 8. Estado de Proveedores para Administración
  console.log('\n8. Probando listado de estado de proveedores para el Administrador...');
  const providersStatus = linkVideoService.getProvidersStatus();
  assert.strictEqual(providersStatus.length, 10, 'Debe retornar el estado de las 10 plataformas');
  const ytStatus = providersStatus.find(p => p.provider === 'youtube');
  assert.ok(ytStatus, 'YouTube debe estar en el reporte de estado');
  console.log('   ✅ Estado de los 10 proveedores verificado.');

  console.log('\n=== TODAS LAS PRUEBAS DE CONTENIDO EXTERNO PASARON CON ÉXITO ===');
}

testExternalContentSystem().catch(err => {
  console.error('\n❌ ERROR EN LAS PRUEBAS DE CONTENIDO EXTERNO:', err);
  process.exit(1);
});
