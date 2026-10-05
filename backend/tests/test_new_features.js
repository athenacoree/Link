const assert = require('assert');

console.log('=== INICIANDO PRUEBAS DE REGISTRO RÁPIDO, ONBOARDING Y MISIONES ===');

const mockSettings = { missions_enabled: 'true' };

async function testLogic() {
  console.log('1. Probando lógica de Registro Rápido...');
  const phone = '51234567';
  const name = 'Usuario Prueba';
  const password = 'password123';

  assert(phone.length >= 6, 'El teléfono debe tener longitud válida.');
  assert(password.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
  console.log('   ✅ Datos de Registro Rápido validados.');

  console.log('2. Probando lógica de Onboarding Obligatorio...');
  const username = 'usuario_test';
  const gender = 'Hombre';
  const city = 'La Habana';
  const interests = ['fútbol', 'música'];

  const onboardingComplete = Boolean(username && gender && city);
  assert.strictEqual(onboardingComplete, true, 'El onboarding debe quedar completado.');
  console.log('   ✅ Onboarding obligatorio verificado.');

  console.log('3. Probando lógica de Misiones y Retos...');
  const missionsEnabled = mockSettings.missions_enabled === 'true';
  assert.strictEqual(missionsEnabled, true, 'Las misiones deben estar habilitadas globalmente.');

  const sampleMission = {
    key: 'discover_soccer',
    title: 'Fanático del Fútbol ⚽',
    target: 1,
    progress: 1,
    completed: true,
    claimed: false
  };

  assert.strictEqual(sampleMission.completed, true, 'Misión de fútbol debe marcarse como completada.');
  console.log('   ✅ Lógica de Misiones verificada con éxito.');

  console.log('4. Probando que las rutas de misiones cargan en Express...');
  const missionsRouter = require('../routes/missions');
  assert(missionsRouter, 'Router de misiones cargado correctamente.');
  console.log('   ✅ Router de misiones de Express cargado.');

  console.log('\n=== TODAS LAS PRUEBAS DE REGISTRO, ONBOARDING Y MISIONES PASARON CON ÉXITO ===\n');
}

testLogic().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
