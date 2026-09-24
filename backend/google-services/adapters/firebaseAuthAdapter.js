const { getFirebaseConfig } = require('../config/firebaseConfig');

class FirebaseAuthAdapter {
  constructor() {
    this.name = 'firebase_auth';
  }

  async checkStatus() {
    const fb = getFirebaseConfig();
    const available = Boolean(fb.projectId && fb.appId);

    return {
      status: available ? 'CONNECTED' : 'CONFIG_REQUIRED',
      reason: available ? 'Firebase Authentication and Google Sign-In configured' : 'Missing Firebase App ID or Project ID',
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new FirebaseAuthAdapter();
