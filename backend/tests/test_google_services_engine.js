const assert = require('assert');
const { registry, stateManager, runGoogleServicesBootstrap, sanitizeObject } = require('../google-services');

async function testGoogleServicesEngine() {
  console.log('[TEST] Starting Google Services Engine integration tests...');

  // 1. Sanitize secrets test
  const dirty = {
    apiKey: 'AIzaSySecretApiKey12345678',
    privateKey: '-----BEGIN PRIVATE KEY-----\nSecretKeyContent\n-----END PRIVATE KEY-----',
    normalField: 'hello'
  };
  const clean = sanitizeObject(dirty);
  assert.notStrictEqual(clean.apiKey, dirty.apiKey);
  assert.strictEqual(clean.normalField, 'hello');
  console.log('✓ Secret sanitization test passed.');

  // 2. Registry status check
  const allStatus = await registry.checkAllStatus();
  assert.ok(allStatus.firebase_auth, 'firebase_auth adapter present');
  assert.ok(allStatus.gemini, 'gemini adapter present');
  assert.ok(allStatus.maps, 'maps adapter present');
  console.log('✓ Service registry status checks passed.');

  // 3. Bootstrap execution (force run)
  const result = await runGoogleServicesBootstrap({ force: true });
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.state.completed, true);
  console.log('✓ Bootstrap engine execution test passed.');

  // 4. Idempotency test (subsequent run should skip)
  const result2 = await runGoogleServicesBootstrap();
  assert.strictEqual(result2.skipped, true);
  console.log('✓ Idempotency test passed (second run skipped).');

  console.log('ALL GOOGLE SERVICES ENGINE TESTS PASSED SUCCESSFULLY!');
}

if (require.main === module) {
  testGoogleServicesEngine().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}
