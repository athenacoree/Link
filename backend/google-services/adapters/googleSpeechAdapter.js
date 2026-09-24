class GoogleSpeechAdapter {
  constructor() {
    this.name = 'speech';
  }

  async checkStatus() {
    const hasKey = Boolean(process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_CLOUD_PROJECT);
    const hasBilling = process.env.GOOGLE_CLOUD_BILLING_ENABLED === 'true';

    if (!hasKey) {
      return {
        status: 'NOT_CONFIGURED',
        reason: 'Google Speech-to-Text / Text-to-Speech API credentials not set',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    if (!hasBilling) {
      return {
        status: 'BILLING_REQUIRED',
        reason: 'Speech APIs require active Google Cloud Billing account',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'CONFIGURED',
      reason: 'Google Speech-to-Text and Text-to-Speech ready',
      billingRequired: true,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleSpeechAdapter();
