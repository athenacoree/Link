class FirebaseAppCheckAdapter {
  constructor() {
    this.name = 'firebase_app_check';
  }

  async checkStatus() {
    const debugToken = process.env.FIREBASE_APPCHECK_DEBUG_TOKEN;
    const recaptchaSiteKey = process.env.FIREBASE_APPCHECK_RECAPTCHA_KEY;
    const configured = Boolean(debugToken || recaptchaSiteKey);

    return {
      status: configured ? 'ENABLED' : 'CONFIG_REQUIRED',
      reason: configured ? 'App Check keys detected' : 'Requires App Check Debug Token or ReCAPTCHA Enterprise Site Key',
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new FirebaseAppCheckAdapter();
