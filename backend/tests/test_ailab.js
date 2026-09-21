const assert = require('assert');

// Mock req and res for testing ailab route logic
async function runTests() {
  console.log('--- Ejecutando pruebas unitarias de Laboratorio IA ---');

  const ailabRouter = require('../routes/ailab');
  assert.ok(ailabRouter, 'El router de AILab debe existir.');

  console.log('✅ Router ailab cargado correctamente.');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas de AILab:', err);
  process.exit(1);
});
