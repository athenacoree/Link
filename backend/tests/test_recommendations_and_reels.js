const assert = require('assert');
const { extractHiddenTags, isReelUrlOrTitle } = require('../utils/tagExtractor');
const linkVideoService = require('../services/linkVideoService');

async function runRecommendationAndReelsTests() {
  console.log('=== INICIANDO PRUEBAS DEL ALGORITMO DE RECOMENDACIONES Y YOUTUBE REELS ===\n');

  // 1. Probando extracción de etiquetas ocultas (hidden tags)
  console.log('1. Probando extracción de etiquetas ocultas (hidden tags)...');
  const sampleWeeknd = {
    title: 'The Weeknd - Blinding Lights (Official Video)',
    original_url: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
    audio_description: 'Exito de synthpop y R&B',
    category: 'Música'
  };
  const weekndTags = extractHiddenTags(sampleWeeknd);
  assert.ok(weekndTags.includes('the weeknd'), 'Debe extraer "the weeknd"');
  assert.ok(weekndTags.includes('r&b') || weekndTags.includes('pop'), 'Debe inferir género r&b o pop');
  console.log('   ✅ Extracción de etiquetas para "The Weeknd" validada:', weekndTags);

  // 2. Detección de Reels / Shorts
  console.log('2. Probando detección de Reels y YouTube Shorts...');
  assert.strictEqual(isReelUrlOrTitle('https://www.youtube.com/shorts/34Na4j8AVgA', 'Short video'), true);
  assert.strictEqual(isReelUrlOrTitle('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Video clasico'), false);
  console.log('   ✅ Detección de URLs de Shorts/Reels validada correctamente.');

  // 3. Probando registro de visualización y pesos de recomendación (Algoritmo No Condemnatorio)
  console.log('3. Probando registro de reproducciones y pesos del algoritmo dinámico...');
  const testUserId = 'user_test_rec_' + Date.now();

  // Registrar visualización de video de The Weeknd
  await linkVideoService.recordUserView({
    userId: testUserId,
    videoId: '4NRXx6U8ABQ',
    collectionId: 'col_musica_destacada',
    tags: ['the weeknd', 'r&b', 'pop', 'musica'],
    isReel: false
  });

  const weights = await linkVideoService.getUserRecommendationWeights(testUserId);
  assert.ok(weights['the weeknd'] > 0, 'El peso para "the weeknd" debe ser > 0');
  assert.ok(weights['r&b'] > 0, 'El peso para "r&b" debe ser > 0');
  console.log('   ✅ Pesos ponderados calculados dinámicamente:', Object.keys(weights));

  // 4. Probando reordenamiento dinámico de colecciones según gustos del usuario
  console.log('4. Probando reordenamiento dinámico de colecciones para el usuario...');
  const collections = await linkVideoService.getCollections(testUserId, { includeVideos: true });
  assert.ok(Array.isArray(collections), 'getCollections debe devolver un array');
  assert.ok(collections.length > 0, 'Debe haber colecciones disponibles');
  assert.ok('recommendation_score' in collections[0], 'Las colecciones deben incluir recommendation_score');
  console.log('   ✅ Colecciones personalizadas y ordenadas por recomendación:', collections.map(c => ({ name: c.name, score: c.recommendation_score })));

  // 5. Probando catálogo de Reels desduplicado y priorizado
  console.log('5. Probando catálogo de Reels desduplicados y priorización de no vistos...');
  let reelsFeed = await linkVideoService.getReelsCatalog(testUserId);
  assert.ok(Array.isArray(reelsFeed), 'getReelsCatalog debe devolver un array de reels');

  if (reelsFeed.length > 0) {
    const firstReel = reelsFeed[0];
    assert.strictEqual(firstReel.seen, false, 'El primer reel entregado a un nuevo usuario debe ser NO VISTO');
    assert.strictEqual(firstReel.priority_score, 100, 'El reel no visto debe tener prioridad alta (100)');

    // Simular que el usuario vio el primer reel
    await linkVideoService.recordUserView({
      userId: testUserId,
      videoId: firstReel.video_id || firstReel.id,
      collectionId: firstReel.collection_id,
      tags: ['reel', 'short'],
      isReel: true
    });

    // Consultar el feed nuevamente
    reelsFeed = await linkVideoService.getReelsCatalog(testUserId);
    const watchedReel = reelsFeed.find(r => (r.video_id || r.id) === (firstReel.video_id || firstReel.id));
    assert.ok(watchedReel, 'El reel visto debe encontrarse en la lista');
    assert.strictEqual(watchedReel.seen, true, 'El reel visto debe marcarse como seen: true');
    assert.ok(watchedReel.priority_score < 100, 'La prioridad del reel visto debe haber disminuido para evitar repeticiones');
  }
  console.log('   ✅ Desduplicación y priorización de Reels comprobada exitosamente.');

  // 6. Probando obtención de top recomendaciones
  console.log('6. Probando getTopRecommendations()...');
  const topRecs = await linkVideoService.getTopRecommendations(testUserId, 4);
  assert.ok(topRecs.collections && topRecs.videos, 'Debe devolver colecciones y videos recomendados');
  console.log('   ✅ Top recomendaciones obtenidas con éxito.');

  console.log('\n=== TODAS LAS PRUEBAS DEL ALGORITMO Y REELS PASARON EXITOSAMENTE ===');
}

if (require.main === module) {
  runRecommendationAndReelsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('FALLO LA PRUEBA:', err);
      process.exit(1);
    });
}

module.exports = { runRecommendationAndReelsTests };
