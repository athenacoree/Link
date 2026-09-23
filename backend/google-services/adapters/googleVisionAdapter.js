class GoogleVisionAdapter {
  constructor() {
    this.name = 'vision';
  }

  async checkStatus() {
    const hasKey = Boolean(process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_CLOUD_PROJECT);
    const hasBilling = process.env.GOOGLE_CLOUD_BILLING_ENABLED === 'true';

    if (!hasKey) {
      return {
        status: 'NOT_CONFIGURED',
        reason: 'Vision / OCR API credentials not set',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    if (!hasBilling) {
      return {
        status: 'BILLING_REQUIRED',
        reason: 'Vision API requires active Google Cloud Billing account',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'CONFIGURED',
      reason: 'Google Vision / OCR API ready',
      billingRequired: true,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleVisionAdapter();
