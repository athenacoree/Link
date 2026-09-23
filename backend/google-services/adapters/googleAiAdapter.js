class GoogleAiAdapter {
  constructor() {
    this.name = 'gemini';
  }

  async checkStatus() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const configured = Boolean(geminiKey);

    return {
      status: configured ? 'CONFIGURED' : 'CONFIG_REQUIRED',
      reason: configured ? `Gemini API configured (Model: ${model})` : 'GEMINI_API_KEY environment variable missing',
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleAiAdapter();
