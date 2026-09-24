const { getFirebaseConfig } = require('../config/firebaseConfig');

class FirebaseAnalyticsAdapter {
  constructor() {
    this.name = 'firebase_analytics';
  }

  async checkStatus() {
    const fb = getFirebaseConfig();
    const hasMeasurementId = Boolean(fb.measurementId);

    return {
      status: hasMeasurementId ? 'ENABLED' : 'CONFIG_REQUIRED',
      reason: hasMeasurementId ? 'Firebase Analytics, Performance, and Remote Config ready' : 'Requires FIREBASE_MEASUREMENT_ID',
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new FirebaseAnalyticsAdapter();
