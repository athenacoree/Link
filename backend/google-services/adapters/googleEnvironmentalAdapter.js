class GoogleEnvironmentalAdapter {
  constructor() {
    this.name = 'environmental';
  }

  async checkStatus() {
    const hasKey = Boolean(process.env.GOOGLE_ENVIRONMENTAL_API_KEY || process.env.GOOGLE_CLOUD_PROJECT);
    const hasBilling = process.env.GOOGLE_CLOUD_BILLING_ENABLED === 'true';

    if (!hasKey) {
      return {
        status: 'NOT_CONFIGURED',
        reason: 'Weather, Air Quality, Pollen, Solar APIs not configured',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    if (!hasBilling) {
      return {
        status: 'BILLING_REQUIRED',
        reason: 'Environmental APIs require active Google Cloud Billing account',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'CONFIGURED',
      reason: 'Google Environmental APIs (Weather, Air Quality, Pollen, Solar) ready',
      billingRequired: true,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleEnvironmentalAdapter();
