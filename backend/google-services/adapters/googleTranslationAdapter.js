class GoogleTranslationAdapter {
  constructor() {
    this.name = 'translation';
  }

  async checkStatus() {
    const hasKey = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_PROJECT);
    const hasBilling = process.env.GOOGLE_CLOUD_BILLING_ENABLED === 'true';

    if (!hasKey) {
      return {
        status: 'NOT_CONFIGURED',
        reason: 'Google Translation API credentials not set',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    if (!hasBilling) {
      return {
        status: 'BILLING_REQUIRED',
        reason: 'Translation API requires active Google Cloud Billing account',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'CONFIGURED',
      reason: 'Google Translation API ready',
      billingRequired: true,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleTranslationAdapter();
