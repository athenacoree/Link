const assert = require('assert');
const express = require('express');

console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN DE EXPERIENCIAS MULTIMEDIA ===\n');

async function testMultimediaSystem() {
  const aiLabService = require('../services/aiLabService');

  // 1. Probando carga de rutas de Express (/api/ailab)
  console.log('1. Probando carga de rutas Express de AILab...');
  const app = express();
  app.use(express.json());
  app.use('/api/ailab', require('../routes/ailab'));
  console.log('   ✅ Rutas Express de experiencias y eventos cargadas sin errores.');

  // 2. Probando estructura de generateExperienceTimelineAI()
  console.log('\n2. Probando generateExperienceTimelineAI()...');
  const genResult = await aiLabService.generateExperienceTimelineAI({
    contentType: 'video',
    title: 'Cultura Cubana en La Habana',
    description: 'Recorrido por el Malecón',
    contentUrl: 'https://pexels.com/video/12345'
  });

  assert(genResult && Array.isArray(genResult.timeline), 'generateExperienceTimelineAI debe devolver un arreglo en la propiedad timeline.');
  assert(genResult.timeline.length > 0, 'La timeline generada debe contener al menos un evento.');
  console.log(`   ✅ Timeline generada exitosamente con ${genResult.timeline.length} marcas de tiempo.`);

  // 3. Probando herramientas estructuradas en ToolManager
  console.log('\n3. Probando herramientas estructuradas en ToolManager...');
  const ToolManager = require('../tools/ToolManager');

  const listRes = await ToolManager.executeTool('ailab.experience.list', {});
  assert(listRes && listRes.type === 'experience_events_card', 'ailab.experience.list debe devolver una tarjeta de eventos.');
  console.log('   ✅ Herramienta ailab.experience.list ejecutada correctamente.');

  const openRes = await ToolManager.executeTool('ailab.experience.open', {});
  assert(openRes && openRes.type === 'experience_card', 'ailab.experience.open debe devolver una tarjeta de experiencia.');
  console.log('   ✅ Herramienta ailab.experience.open ejecutada correctamente.');

  // 4. Probando intenciones en lenguaje natural (detectToolIntent)
  console.log('\n4. Probando detección de intenciones en lenguaje natural...');
  const intent1 = ToolManager.detectToolIntent('ver eventos multimedia');
  assert(intent1 && intent1.tool === 'ailab.experience.list', 'Debe detectar la herramienta ailab.experience.list');

  const intent2 = ToolManager.detectToolIntent('abrir experiencia multimedia');
  assert(intent2 && intent2.tool === 'ailab.experience.open', 'Debe detectar la herramienta ailab.experience.open');
  console.log('   ✅ Detección de intenciones para experiencias multimedia validada.');

  console.log('\n=== TODAS LAS PRUEBAS DE EXPERIENCIAS MULTIMEDIA PASARON EXITOSAMENTE ===\n');
}

testMultimediaSystem().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE EXPERIENCIAS MULTIMEDIA:', err);
  process.exit(1);
});
