/**
 * Test de Integración para el Sistema de YouTube en Link Video
 */

const assert = require('assert');
const { extractYouTubeId, isValidYouTubeUrl } = require('../utils/youtube');
const youtubeService = require('../services/youtubeService');

async function testYouTubeSystem() {
  console.log('=== INICIANDO PRUEBAS DEL SISTEMA DE YOUTUBE EN LINK VIDEO ===\n');

  // 1. Validar extracción de IDs para diferentes formatos de URLs
  console.log('1. Probando extracción de IDs de YouTube...');
  const testUrls = [
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ&feature=shared', expected: 'dQw4w9WgXcQ' },
    { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' }
  ];

  for (const t of testUrls) {
    const extracted = extractYouTubeId(t.url);
    assert.strictEqual(extracted, t.expected, `Fallo extrayendo ID de ${t.url}`);
    assert.strictEqual(isValidYouTubeUrl(t.url), true, `URL debería ser válida: ${t.url}`);
  }
  console.log('   ✅ Extracción de ID validada para watch, shorts, embed y youtu.be.');

  // 2. Probando rechazo de URLs inválidas
  console.log('2. Probando rechazo de URLs inválidas o arbitrarias...');
  const invalidUrls = [
    'https://vimeo.com/12345678',
    'https://malicious-site.com/video.mp4',
    'https://www.youtube.com/invalid_path',
    'not_a_url',
    '',
    null
  ];

  for (const inv of invalidUrls) {
    const extracted = extractYouTubeId(inv);
    assert.strictEqual(extracted, null, `Debería haber rechazado la URL: ${inv}`);
    assert.strictEqual(isValidYouTubeUrl(inv), false, `Debería ser inválida: ${inv}`);
  }
  console.log('   ✅ Rechazo de URLs inválidas/maliciosas comprobado correctamente.');

  // 3. Probando lectura de canales por defecto
  console.log('3. Probando servicio youtubeService.getChannels()...');
  const channels = await youtubeService.getChannels();
  assert(Array.isArray(channels), 'Debería devolver una lista de canales');
  assert(channels.length >= 4, 'Debe incluir al menos los 4 canales por defecto');
  const channelIds = channels.map(c => c.channel_id);
  assert(channelIds.includes('principal'), 'Falta canal principal');
  assert(channelIds.includes('musica'), 'Falta canal musica');
  assert(channelIds.includes('cine'), 'Falta canal cine');
  assert(channelIds.includes('entretenimiento'), 'Falta canal entretenimiento');
  console.log(`   ✅ Canales obtenidos correctamente (${channels.length} canales).`);

  // 4. Probando activación / publicación de video en un canal
  console.log('4. Probando publicación de video en canal "musica"...');
  const published = await youtubeService.setChannelVideo({
    channelId: 'musica',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up'
  });

  assert.strictEqual(published.channel_id, 'musica');
  assert.strictEqual(published.video_id, 'dQw4w9WgXcQ');
  assert.strictEqual(published.title, 'Never Gonna Give You Up');
  assert.strictEqual(published.is_active, true);
  assert(typeof published.currentTime === 'number', 'currentTime debe ser numérico');
  console.log('   ✅ Video publicado exitosamente en canal.');

  // 5. Probando cálculo de posición aproximada de reproducción (sincronización)
  console.log('5. Probando cálculo de tiempo transcurrido (currentTime)...');
  const chInfo = await youtubeService.getChannelById('musica');
  assert.strictEqual(chInfo.is_active, true);
  assert.strictEqual(chInfo.video_id, 'dQw4w9WgXcQ');
  assert(chInfo.currentTime >= 0, 'currentTime debe ser mayor o igual a 0');
  console.log(`   ✅ Posición de reproducción calculada: ${chInfo.currentTime} segundos.`);

  // 6. Probando detener transmisión en canal
  console.log('6. Probando detención de transmisión en canal "musica"...');
  const stopped = await youtubeService.stopChannelVideo('musica');
  assert.strictEqual(stopped.channel_id, 'musica');
  assert.strictEqual(stopped.is_active, false);

  const stoppedInfo = await youtubeService.getChannelById('musica');
  assert.strictEqual(stoppedInfo.is_active, false);
  console.log('   ✅ Canal detenido correctamente.');

  console.log('\n=== TODAS LAS PRUEBAS DEL SISTEMA DE YOUTUBE PASARON EXITOSAMENTE ===\n');
}

if (require.main === module) {
  testYouTubeSystem().then(() => process.exit(0)).catch(err => {
    console.error('❌ Error en tests de YouTube:', err);
    process.exit(1);
  });
}

module.exports = { testYouTubeSystem };
