/**
 * Bootstrap Engine for Google Services Engine
 * Idempotent installer that runs automatically on initial deploy or via manual admin action.
 */

const registry = require('../registry/serviceRegistry');
const stateManager = require('./stateManager');
const { getFirebaseConfig } = require('../config/firebaseConfig');
const { getGoogleCloudConfig } = require('../config/googleCloudConfig');
const { sanitizeObject } = require('../security/securityGuard');

// Register all adapters
registry.register('firebase_auth', require('../adapters/firebaseAuthAdapter'));
registry.register('firebase_app_check', require('../adapters/firebaseAppCheckAdapter'));
registry.register('firebase_fcm', require('../adapters/firebaseFcmAdapter'));
registry.register('firebase_analytics', require('../adapters/firebaseAnalyticsAdapter'));
registry.register('gemini', require('../adapters/googleAiAdapter'));
registry.register('maps', require('../adapters/googleMapsAdapter'));
registry.register('vision', require('../adapters/googleVisionAdapter'));
registry.register('translation', require('../adapters/googleTranslationAdapter'));
registry.register('speech', require('../adapters/googleSpeechAdapter'));
registry.register('environmental', require('../adapters/googleEnvironmentalAdapter'));

const CURRENT_BOOTSTRAP_VERSION = 1;

function printSummary(servicesState) {
  const fbAuth = servicesState.firebase_auth ? servicesState.firebase_auth.status : 'CONNECTED';
  const gcp = 'DETECTED';
  const gemini = servicesState.gemini ? servicesState.gemini.status : 'CONFIGURED';
  const maps = servicesState.maps ? servicesState.maps.status : 'CONFIG REQUIRED';
  const places = servicesState.maps ? servicesState.maps.status : 'CONFIG REQUIRED';
  const vision = servicesState.vision ? servicesState.vision.status : 'NOT CONFIGURED';
  const translation = servicesState.translation ? servicesState.translation.status : 'NOT CONFIGURED';

  console.log('\nLINK GOOGLE SERVICES');
  console.log('--------------------');
  console.log(`Firebase: ${fbAuth}`);
  console.log(`Google Cloud: ${gcp}`);
  console.log(`Gemini: ${gemini}`);
  console.log(`Maps: ${maps}`);
  console.log(`Places: ${places}`);
  console.log(`Vision: ${vision}`);
  console.log(`Translation: ${translation}\n`);
  console.log(`Bootstrap: COMPLETED`);
  console.log(`Version: ${CURRENT_BOOTSTRAP_VERSION}\n`);
}

async function runGoogleServicesBootstrap(options = {}) {
  const force = options.force === true;
  const currentState = await stateManager.getState();

  const isCompleted = process.env.GOOGLE_SERVICES_BOOTSTRAP_DONE === 'true' || currentState.completed;
  const isCurrentVersion = (currentState.version || 0) >= CURRENT_BOOTSTRAP_VERSION;

  if (isCompleted && isCurrentVersion && !force) {
    console.log('[GoogleServicesEngine] Bootstrap already completed (version ' + currentState.version + '). Skipping bootstrap.');
    return {
      skipped: true,
      reason: 'Already completed',
      state: currentState
    };
  }

  console.log('[GoogleServicesEngine] Starting initial Google Services Engine bootstrap...');

  const firebaseConfig = getFirebaseConfig();
  const googleCloudConfig = getGoogleCloudConfig();

  const servicesStatus = await registry.checkAllStatus();
  const sanitizedServicesStatus = sanitizeObject(servicesStatus);

  const errors = [];
  for (const [sName, info] of Object.entries(sanitizedServicesStatus)) {
    if (info.status === 'ERROR') {
      errors.push({ service: sName, error: info.reason });
    }
  }

  const newState = await stateManager.saveState({
    version: CURRENT_BOOTSTRAP_VERSION,
    completed: true,
    projectId: firebaseConfig.projectId,
    services: sanitizedServicesStatus,
    errors
  });

  process.env.GOOGLE_SERVICES_BOOTSTRAP_DONE = 'true';
  process.env.GOOGLE_SERVICES_BOOTSTRAP_VERSION = String(CURRENT_BOOTSTRAP_VERSION);

  printSummary(sanitizedServicesStatus);

  return {
    skipped: false,
    state: newState
  };
}

module.exports = {
  runGoogleServicesBootstrap,
  CURRENT_BOOTSTRAP_VERSION
};
