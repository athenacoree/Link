class FirebaseFcmAdapter {
  constructor() {
    this.name = 'firebase_fcm';
  }

  async checkStatus() {
    const vapidKey = process.env.FIREBASE_VAPID_KEY;
    const configured = Boolean(vapidKey);

    return {
      status: configured ? 'ENABLED' : 'CONFIG_REQUIRED',
      reason: configured ? 'FCM Web Push VAPID key configured' : 'Requires FIREBASE_VAPID_KEY for web push notifications',
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new FirebaseFcmAdapter();
